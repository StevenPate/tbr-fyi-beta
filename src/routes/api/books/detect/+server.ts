import { json } from '@sveltejs/kit';
import { toISBN13, InvalidISBNError, fetchBookMetadata, searchBooks } from '$lib/server/metadata';
import { extractISBNFromAmazon } from '$lib/server/amazon-parser';
import {
	extractISBNFromRetailer,
	containsRetailerUrl,
	extractISBNFromIndiecommerce,
	isIndiecommerceUrl,
	isUnsupportedBookstoreUrl
} from '$lib/server/bookshop-parser';
import { detectBarcodes } from '$lib/server/vision';
import { logger, startTimer } from '$lib/server/logger';

interface DetectedBook {
	isbn13: string;
	title: string;
	author: string[];
	publisher?: string;
	publicationDate?: string;
	coverUrl?: string;
}

interface DetectionMetadata {
	totalLines: number;
	validIsbns: number;
	skippedLines: number;
	duplicatesRemoved?: number;
}

/**
 * Fetch book metadata in batches to avoid rate limiting and timeouts
 * @param isbns Array of ISBN13 strings to fetch
 * @param concurrency Number of parallel requests (default: 5)
 * @returns Array of detected books with metadata
 */
async function fetchMetadataInBatches(
	isbns: string[],
	concurrency = 5
): Promise<DetectedBook[]> {
	const results: DetectedBook[] = [];

	for (let i = 0; i < isbns.length; i += concurrency) {
		const batch = isbns.slice(i, i + concurrency);
		const batchResults = await Promise.all(
			batch.map(async (isbn): Promise<DetectedBook | null> => {
				const metadata = await fetchBookMetadata(isbn);
				if (!metadata) return null;
				return {
					isbn13: isbn,
					title: metadata.title,
					author: metadata.author,
					publisher: metadata.publisher,
					publicationDate: metadata.publicationDate,
					coverUrl: metadata.coverUrl
				};
			})
		);

		results.push(...batchResults.filter((book): book is DetectedBook => book !== null));

		// Small delay between batches to respect rate limits
		if (i + concurrency < isbns.length) {
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	}

	return results;
}

export const POST = async ({ request }: any) => {
	try {
		const { type, content } = await request.json();

		if (!type || !content) {
			return json({ error: 'Missing type or content' }, { status: 400 });
		}

		// Tuneable per deployment environment
		const MAX_DECODED_IMAGE_BYTES = 3.5 * 1024 * 1024; // ~3.5MB

		let isbns: string[] = [];

		// Route to appropriate parser based on input type
		if (type === 'text') {
			// Try plain ISBN first
			const cleaned = (content as string).replace(/[^0-9Xx]/g, '');
			if (cleaned.length === 10 || cleaned.length === 13) {
				try {
					const isbn13 = toISBN13(cleaned);
					isbns = [isbn13];
				} catch (error) {
					if (error instanceof InvalidISBNError) {
						return json({ error: `Invalid ISBN: ${error.message}` }, { status: 400 });
					}
					throw error;
				}
			}
			// Try Amazon URL parser (pass 'web' source for logging)
			else if ((content as string).includes('amazon.com') || (content as string).includes('a.co')) {
				const isbn = await extractISBNFromAmazon(content as string, 'web');
				if (!isbn) {
					return json({ error: 'Could not extract ISBN from Amazon URL' }, { status: 400 });
				}
				isbns = [isbn];
			}
			// Try retailer URL parser (Bookshop.org, Barnes & Noble)
			else if (containsRetailerUrl(content as string)) {
				const result = await extractISBNFromRetailer(content as string, 'web');
				if (!result) {
					// Case-insensitive retailer detection for accurate error message
					const retailer = (content as string).toLowerCase().includes('barnesandnoble.com')
						? 'Barnes & Noble'
						: 'Bookshop.org';
					return json(
						{
							error: `That ${retailer} link doesn't include the ISBN. Try a link with ?ean= in the URL, or enter the ISBN directly.`
						},
						{ status: 400 }
					);
				}
				isbns = [result.isbn];
			}
			// Check for Indiecommerce links (/book/{ISBN} pattern)
			else if (isIndiecommerceUrl(content as string)) {
				const result = await extractISBNFromIndiecommerce(content as string, 'web');
				if (result) {
					isbns = [result.isbn];
				}
				// If no ISBN extracted, fall through to other checks
			}
			// Check for unsupported bookstore links
			else if (!isbns.length && isUnsupportedBookstoreUrl(content as string)) {
				return json(
					{
						error:
							"I can't read ISBNs from that bookstore's links. Try entering the title and author, or copy the ISBN/EAN from the page."
					},
					{ status: 400 }
				);
			}
			else {
				// Treat as free-text search: try to split "title by author" heuristically
				const raw = (content as string).trim();
				let title: string | undefined;
				let author: string | undefined;
				const byMatch = /\s+by\s+/i;
				if (byMatch.test(raw)) {
					const [t, a] = raw.split(byMatch);
					title = t?.trim() || undefined;
					author = a?.trim() || undefined;
				}
				// Fallback: try common delimiters, else use full text as query
				const q = title || author ? undefined : raw.replace(/["\[\]()]/g, '').trim();

				const candidates = await searchBooks({ q, title, author, max: 8 });
				if (!candidates || candidates.length === 0) {
					return json({ error: 'No books found for your query' }, { status: 404 });
				}

				// Map directly to detected results; no extra metadata lookups needed
				const detected = candidates.map((c) => ({
					isbn13: c.isbn13,
					title: c.title,
					author: c.authors,
					publisher: c.publisher,
					publicationDate: c.publicationDate,
					coverUrl: c.coverUrl
				}));
				return json({ success: true, detected });
			}
		}
		else if (type === 'image') {
			// Validate decoded bytes (base64 inflates by ~33%)
			const sizeEstimate = (content as string).length * 0.75;
			if (sizeEstimate > MAX_DECODED_IMAGE_BYTES) {
				return json({ error: 'Image too large (max 3.5MB)' }, { status: 413 });
			}

			// Convert base64 to buffer
			const imageBuffer = Buffer.from(content as string, 'base64');

			// Detect barcodes using Google Vision
			const { isbns: detectedISBNs } = await detectBarcodes(imageBuffer, {
				timeoutMs: 5000,
				maxResults: 5
			});

			if (detectedISBNs.length === 0) {
				return json({ error: 'No barcodes found in image' }, { status: 400 });
			}

			isbns = detectedISBNs;
		} else if (type === 'file') {
			// Handle CSV/TXT file content
			const MAX_BOOKS = 50;
			const fileContent = content as string;
			const lines = fileContent.split(/\r?\n/).filter((line) => line.trim().length > 0);

			if (lines.length === 0) {
				return json({ error: 'File is empty' }, { status: 400 });
			}

			const isbnSet = new Set<string>();
			let skippedLines = 0;

			// Parse each line for ISBNs
			for (const line of lines) {
				const trimmedLine = line.trim();

				// Skip header rows (case insensitive check)
				if (/^(isbn|title|author|book)/i.test(trimmedLine)) {
					skippedLines++;
					continue;
				}

				// Split by common delimiters: comma, semicolon, tab, pipe
				const tokens = trimmedLine.split(/[,;\t|]/);

				// Try each token for ISBN
				let foundISBN = false;
				for (const token of tokens) {
					const cleaned = token
						.replace(/^=\"?/, '') // Remove Goodreads format: ="9780547928227"
						.replace(/\"?$/, '') // Remove trailing quote
						.replace(/[^0-9Xx]/g, ''); // Keep only ISBN characters

					if (cleaned.length === 10 || cleaned.length === 13) {
						try {
							const isbn13 = toISBN13(cleaned);
							isbnSet.add(isbn13);
							foundISBN = true;
							break; // Found ISBN in this line, move to next line
						} catch (error) {
							// Invalid ISBN checksum, try next token
							continue;
						}
					}
				}

				if (!foundISBN) {
					skippedLines++;
				}
			}

			if (isbnSet.size === 0) {
				return json({ error: 'No valid ISBNs found in file' }, { status: 400 });
			}

			if (isbnSet.size > MAX_BOOKS) {
				return json(
					{ error: `Too many books (${isbnSet.size}). Maximum is ${MAX_BOOKS} per import.` },
					{ status: 400 }
				);
			}

			isbns = Array.from(isbnSet);

			// Calculate duplicates removed
			const totalParsedLines = lines.length - skippedLines;
			const duplicatesRemoved = totalParsedLines - isbnSet.size;

			// Fetch metadata in batches
			const timer = startTimer();
			const detected = await fetchMetadataInBatches(isbns);

			if (detected.length === 0) {
				return json({ error: 'No books found for detected ISBNs' }, { status: 404 });
			}

			// Log successful file import
			logger.info({
				event: 'bulk_import',
				type: 'detect',
				totalLines: lines.length,
				validIsbns: isbnSet.size,
				skippedLines,
				duplicatesRemoved: duplicatesRemoved > 0 ? duplicatesRemoved : undefined,
				foundBooks: detected.length,
				durationMs: timer(),
				source: 'web'
			});

			// Return with metadata for UI feedback
			return json({
				success: true,
				detected,
				metadata: {
					totalLines: lines.length,
					validIsbns: isbnSet.size,
					skippedLines,
					duplicatesRemoved: duplicatesRemoved > 0 ? duplicatesRemoved : undefined
				}
			});
		}
		else {
			return json({ error: 'Invalid type' }, { status: 400 });
		}

		// Fetch metadata for all detected ISBNs (in parallel) and build result list
		const metadataResults = await Promise.all(isbns.map((isbn) => fetchBookMetadata(isbn)));
		const detected: DetectedBook[] = metadataResults.reduce<DetectedBook[]>((acc, metadata, index) => {
			if (!metadata) return acc;
			acc.push({
				isbn13: isbns[index],
				title: metadata.title,
				author: metadata.author,
				publisher: metadata.publisher,
				publicationDate: metadata.publicationDate,
				coverUrl: metadata.coverUrl
			});
			return acc;
		}, []);

		if (detected.length === 0) {
			return json({ error: 'No books found for detected ISBNs' }, { status: 404 });
		}

		return json({ success: true, detected });
	} catch (error) {
		console.error('Detection error:', error);

		if (error instanceof Error && error.name === 'AbortError') {
			return json({ error: 'Request timed out. Please try again.' }, { status: 504 });
		}

		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
