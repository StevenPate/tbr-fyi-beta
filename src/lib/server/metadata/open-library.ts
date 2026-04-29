/**
 * Open Library Metadata Adapter
 *
 * Fetches book metadata from Open Library Books API.
 * Used as fallback when Google Books doesn't have the book.
 */

import type { ISBN13, BookMetadata } from './types';
import { InvalidISBNError, toISBN13 } from './types';

interface OpenLibraryAuthor {
	name: string;
	url?: string;
}

interface OpenLibraryPublisher {
	name: string;
}

interface OpenLibraryCover {
	small?: string;
	medium?: string;
	large?: string;
}

interface OpenLibrarySubject {
	name: string;
	url?: string;
}

interface OpenLibraryBook {
	url: string;
	title: string;
	subtitle?: string;
	authors?: OpenLibraryAuthor[];
	publishers?: OpenLibraryPublisher[];
	publish_date?: string;
	publish_places?: Array<{ name: string }>;
	subjects?: OpenLibrarySubject[];
	cover?: OpenLibraryCover;
	number_of_pages?: number;
}

interface OpenLibraryResponse {
	[key: string]: OpenLibraryBook;
}

/**
 * Fetch metadata for an ISBN from Open Library
 *
 * @param input - ISBN-13 or ISBN-10 string
 * @returns BookMetadata or null if not found
 */
export async function fetchOpenLibraryMetadata(input: string): Promise<BookMetadata | null> {
	try {
		// Normalize and validate ISBN
		const isbn13 = toISBN13(input);

		// Build API URL - Open Library accepts both ISBN-10 and ISBN-13
		const baseUrl = 'https://openlibrary.org/api/books';
		const params = new URLSearchParams({
			bibkeys: `ISBN:${isbn13}`,
			jscmd: 'data',
			format: 'json'
		});

		const url = `${baseUrl}?${params.toString()}`;

		// Fetch with 5-second timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 5000);

		try {
			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					'User-Agent': 'TBR Personal/1.0'
				}
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				if (response.status === 404) {
					return null;
				}
				throw new Error(`Open Library API error: ${response.status}`);
			}

			const data = (await response.json()) as OpenLibraryResponse;

			// Check if book found - Open Library returns empty object if not found
			const bookKey = `ISBN:${isbn13}`;
			if (!data[bookKey]) {
				return null;
			}

			return normalizeOpenLibraryResponse(data[bookKey], isbn13);
		} finally {
			clearTimeout(timeoutId);
		}
	} catch (error) {
		if (error instanceof InvalidISBNError) {
			throw error;
		}
		console.error('Open Library fetch failed:', error);
		return null;
	}
}

/**
 * Normalize Open Library response to BookMetadata format
 */
function normalizeOpenLibraryResponse(book: OpenLibraryBook, isbn13: ISBN13): BookMetadata {
	// Extract author names
	const authors = book.authors?.map((a) => a.name) || [];

	// Get cover URL - prefer large, fall back to medium, then small
	// If Books API doesn't provide a cover, use the direct Covers API URL
	let coverUrl = book.cover?.large || book.cover?.medium || book.cover?.small;

	if (!coverUrl) {
		// Fall back to direct Covers API URL (separate from Books API)
		// This URL will return the cover if it exists, or redirect to a blank image if not
		// The ?default=false parameter makes it return 404 instead of blank image
		coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`;
	}

	// Get publisher name (take first if multiple)
	const publisher = book.publishers?.[0]?.name;

	// Extract subject/genre names
	const genres = book.subjects?.slice(0, 5).map((s) => s.name) || [];

	return {
		isbn: isbn13,
		title: book.title || 'Unknown Title',
		author: authors,
		coverUrl,
		description: undefined, // Open Library doesn't provide descriptions in Books API
		publicationDate: book.publish_date,
		pageCount: book.number_of_pages,
		genres,
		publisher,
		source: 'openlibrary',
		confidence: assessConfidence(book),
		last_enriched_at: new Date().toISOString(),
		sources: ['open_library']
	};
}

/**
 * Search Open Library by free text or parsed title/author.
 * Used as fallback when Google Books is rate-limited or returns no results.
 */
export interface OpenLibrarySearchResult {
	isbn13: string;
	title: string;
	authors: string[];
	publisher?: string;
	publicationDate?: string;
	coverUrl?: string;
}

interface OpenLibrarySearchDoc {
	title?: string;
	author_name?: string[];
	isbn?: string[];
	cover_i?: number;
	publisher?: string[];
	first_publish_year?: number;
}

interface OpenLibrarySearchResponse {
	numFound: number;
	docs: OpenLibrarySearchDoc[];
}

export async function searchOpenLibrary(params: {
	q?: string;
	title?: string;
	author?: string;
	max?: number;
	timeoutMs?: number;
}): Promise<OpenLibrarySearchResult[]> {
	const { q, title, author, max = 8, timeoutMs = 5000 } = params;

	// Build query — Open Library uses plain text queries
	let query = '';
	if (q) query = q;
	else if (title && author) query = `${title} ${author}`;
	else if (title) query = title;
	else if (author) query = author;
	else return [];

	const searchParams = new URLSearchParams({
		q: query,
		limit: String(Math.min(Math.max(max, 1), 40)),
		fields: 'title,author_name,isbn,cover_i,publisher,first_publish_year'
	});

	const url = `https://openlibrary.org/search.json?${searchParams.toString()}`;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': 'TBR Personal/1.0' }
		});
		clearTimeout(timeoutId);

		if (!response.ok) {
			console.error('Open Library search error:', response.status);
			return [];
		}

		const data = (await response.json()) as OpenLibrarySearchResponse;
		if (!data.docs || data.docs.length === 0) return [];

		const results: OpenLibrarySearchResult[] = [];
		for (const doc of data.docs) {
			// Find an ISBN-13 from the isbn array
			const isbn13 = extractISBN13FromArray(doc.isbn);
			if (!isbn13) continue;

			const coverUrl = doc.cover_i
				? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
				: undefined;

			results.push({
				isbn13,
				title: doc.title || 'Unknown Title',
				authors: doc.author_name || [],
				publisher: doc.publisher?.[0],
				publicationDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
				coverUrl
			});
		}

		return results;
	} catch (e) {
		clearTimeout(timeoutId);
		if (e instanceof Error && e.name === 'AbortError') {
			console.warn('Open Library search timeout');
			return [];
		}
		console.error('Open Library search failed:', e);
		return [];
	}
}

/**
 * Find the first valid ISBN-13 in an array of mixed ISBN-10/ISBN-13 strings.
 */
function extractISBN13FromArray(isbns?: string[]): string | null {
	if (!isbns || isbns.length === 0) return null;

	// Prefer native ISBN-13
	for (const isbn of isbns) {
		if (/^978\d{10}$/.test(isbn)) {
			try {
				return toISBN13(isbn);
			} catch {
				continue;
			}
		}
	}

	// Fallback: convert first valid ISBN-10
	for (const isbn of isbns) {
		if (/^\d{9}[\dXx]$/.test(isbn)) {
			try {
				return toISBN13(isbn);
			} catch {
				continue;
			}
		}
	}

	return null;
}

/**
 * Assess metadata confidence based on available fields
 */
function assessConfidence(book: OpenLibraryBook): 'high' | 'medium' | 'low' {
	const score = [
		book.title,
		book.authors && book.authors.length > 0,
		book.cover && (book.cover.large || book.cover.medium || book.cover.small),
		book.publishers && book.publishers.length > 0
	].filter(Boolean).length;

	if (score >= 4) return 'high';
	if (score >= 2) return 'medium';
	return 'low';
}
