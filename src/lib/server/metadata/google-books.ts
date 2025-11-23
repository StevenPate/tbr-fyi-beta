/**
 * Simplified Google Books Adapter
 *
 * Fetches book metadata from Google Books API v1.
 * No circuit breakers, rate limiters, or observability - just the core functionality.
 */

import type { ISBN13, BookMetadata } from './types';
import { InvalidISBNError, toISBN13 } from './types';

/**
 * Get environment variables - supports both SvelteKit and standalone contexts
 */
function getApiKey(): string | undefined {
	// Check if we're in a SvelteKit context
	if (typeof process !== 'undefined' && process.env) {
		return process.env.GOOGLE_BOOKS_API_KEY;
	}
	return undefined;
}

interface GoogleBooksVolume {
	id: string;
	volumeInfo: {
		title?: string;
		authors?: string[];
		description?: string;
		imageLinks?: {
			smallThumbnail?: string;
			thumbnail?: string;
			small?: string;
			medium?: string;
			large?: string;
			extraLarge?: string;
		};
		publishedDate?: string;
		pageCount?: number;
		categories?: string[];
		publisher?: string;
		industryIdentifiers?: Array<{
			type: string;
			identifier: string;
		}>;
	};
}

interface GoogleBooksResponse {
	totalItems: number;
	items?: GoogleBooksVolume[];
}

/**
 * Fetch metadata for an ISBN from Google Books API
 *
 * @param isbn13 - ISBN-13 string (or ISBN-10, will be converted)
 * @returns BookMetadata or null if not found
 */
export async function fetchGoogleBooksMetadata(input: string): Promise<BookMetadata | null> {
	try {
		// Normalize and validate ISBN
		const isbn13 = toISBN13(input);

		// Build API URL
		const baseUrl = 'https://www.googleapis.com/books/v1/volumes';
		const params = new URLSearchParams({
			q: `isbn:${isbn13}`
		});

		// Add API key if configured (optional, increases rate limits)
		const apiKey = getApiKey();
		if (apiKey) {
			params.set('key', apiKey);
		}

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

			// Handle errors
			if (!response.ok) {
				if (response.status === 404) {
					return null;
				}
				throw new Error(`Google Books API error: ${response.status}`);
			}

			// Parse response
			const data = (await response.json()) as GoogleBooksResponse;

			// Check if book found
			if (data.totalItems === 0 || !data.items || data.items.length === 0) {
				return null;
			}

			// Take first result and normalize
			const volume = data.items[0];
			return normalizeGoogleBooksResponse(volume, isbn13);
		} finally {
			clearTimeout(timeoutId);
		}
	} catch (error) {
		if (error instanceof InvalidISBNError) {
			throw error;
		}
		console.error('Google Books fetch failed:', error);
		return null;
	}
}

/**
 * Search Google Books by free text or parsed title/author and return
 * candidate results that include an ISBN-13 and basic metadata.
 */
export interface GoogleBooksSearchResult {
	isbn13: string;
	title: string;
	authors: string[];
	publisher?: string;
	publicationDate?: string;
	coverUrl?: string;
}

export async function searchGoogleBooks(params: {
	q?: string; // full-text query
	title?: string;
	author?: string;
	max?: number; // default 8
	timeoutMs?: number; // default 5000
}): Promise<GoogleBooksSearchResult[]> {
	const { q, title, author, max = 8, timeoutMs = 5000 } = params;

	// Build Google Books q param
	let query = '';
	if (title && author) query = `intitle:${title} inauthor:${author}`;
	else if (title) query = `intitle:${title}`;
	else if (author) query = `inauthor:${author}`;
	else if (q) query = q;
	else return [];

	const baseUrl = 'https://www.googleapis.com/books/v1/volumes';
	const searchParams = new URLSearchParams({
		q: query,
		maxResults: String(Math.min(Math.max(max, 1), 40))
	});

	const apiKey = getApiKey();
	if (apiKey) searchParams.set('key', apiKey);

	const url = `${baseUrl}?${searchParams.toString()}`;

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': 'TBR Personal/1.0' }
		});
		clearTimeout(timeoutId);

		if (!response.ok) {
			console.error('Google Books search error:', response.status);
			return [];
		}

		const data = (await response.json()) as GoogleBooksResponse;
		if (!data.items || data.items.length === 0) return [];

		// Normalize candidates with ISBN-13 only
		const results: GoogleBooksSearchResult[] = [];
		for (const volume of data.items) {
			const info = volume.volumeInfo;
			const isbn13 = extractISBN13(info.industryIdentifiers);
			if (!isbn13) continue;

			// Prefer larger images similar to metadata fetch
			let coverUrl = info.imageLinks?.extraLarge
				|| info.imageLinks?.large
				|| info.imageLinks?.medium
				|| info.imageLinks?.small
				|| info.imageLinks?.thumbnail
				|| info.imageLinks?.smallThumbnail;

			if (coverUrl) {
				coverUrl = coverUrl
					.replace('http:', 'https:')
					.replace(/zoom=\d+/, 'zoom=1');
				if (!coverUrl.includes('&w=')) coverUrl += '&w=1280';
			}

			results.push({
				isbn13,
				title: info.title || 'Unknown Title',
				authors: info.authors || [],
				publisher: info.publisher,
				publicationDate: info.publishedDate,
				coverUrl
			});
		}

		return results;
	} catch (e) {
		clearTimeout(timeoutId);
		if (e instanceof Error && e.name === 'AbortError') {
			console.warn('Google Books search timeout');
			return [];
		}
		console.error('Google Books search failed:', e);
		return [];
	}
}

/**
 * Normalize Google Books response to BookMetadata format
 */
function normalizeGoogleBooksResponse(
	volume: GoogleBooksVolume,
	requestedIsbn: ISBN13
): BookMetadata {
	const volumeInfo = volume.volumeInfo;

	// Extract ISBN-13 from response
	const returnedIsbn13 = extractISBN13(volumeInfo.industryIdentifiers);
	let finalIsbn: ISBN13 = requestedIsbn;

	// If Google returned a different ISBN, use it (different edition)
	if (returnedIsbn13 && returnedIsbn13 !== requestedIsbn) {
		try {
			finalIsbn = toISBN13(returnedIsbn13);
		} catch {
			// If invalid, stick with requested ISBN
		}
	}

	// Get cover URL - prefer larger sizes for better quality
	// Google Books provides: extraLarge (~1280px), large (~800px), medium (~575px),
	// small (~300px), thumbnail (~128px), smallThumbnail (~80px)
	const imageLinks = volumeInfo.imageLinks;

	// Determine which size is available and log it
	let coverUrl: string | undefined;
	let imageSize: string = 'none';

	if (imageLinks?.extraLarge) {
		coverUrl = imageLinks.extraLarge;
		imageSize = 'extraLarge';
	} else if (imageLinks?.large) {
		coverUrl = imageLinks.large;
		imageSize = 'large';
	} else if (imageLinks?.medium) {
		coverUrl = imageLinks.medium;
		imageSize = 'medium';
	} else if (imageLinks?.small) {
		coverUrl = imageLinks.small;
		imageSize = 'small';
	} else if (imageLinks?.thumbnail) {
		coverUrl = imageLinks.thumbnail;
		imageSize = 'thumbnail';
	} else if (imageLinks?.smallThumbnail) {
		coverUrl = imageLinks.smallThumbnail;
		imageSize = 'smallThumbnail';
	}

	console.log(`[Google Books] ISBN ${requestedIsbn} - Image size: ${imageSize}`, coverUrl ? `URL: ${coverUrl.substring(0, 80)}...` : 'No image available');

	if (coverUrl) {
		const originalUrl = coverUrl;

		// Upgrade to HTTPS and maximize zoom for highest resolution
		// Note: zoom=1 is the LARGEST size, higher numbers are smaller
		coverUrl = coverUrl
			.replace('http:', 'https:')
			.replace(/zoom=\d+/, 'zoom=1') // zoom=1 is highest quality
			.replace(/&edge=curl/g, ''); // Remove edge curl effect (can reduce quality)

		// Add width parameter if not present (request 1280px width)
		if (!coverUrl.includes('&w=')) {
			coverUrl += '&w=1280';
		}

		console.log(`[Google Books] ISBN ${requestedIsbn} - Enhanced URL from ${imageSize}:`, coverUrl.substring(0, 120) + '...');
	}

	return {
		isbn: finalIsbn,
		title: volumeInfo.title || 'Unknown Title',
		author: volumeInfo.authors || [],
		coverUrl,
		description: volumeInfo.description,
		publicationDate: volumeInfo.publishedDate,
		pageCount: volumeInfo.pageCount,
		genres: volumeInfo.categories || [],
		publisher: volumeInfo.publisher,
		source: 'google',
		confidence: assessConfidence(volumeInfo),
		last_enriched_at: new Date().toISOString(),
		sources: ['google_books']
	};
}

/**
 * Extract ISBN-13 from Google Books identifiers
 */
function extractISBN13(
	identifiers?: Array<{ type: string; identifier: string }>
): string | null {
	if (!identifiers || identifiers.length === 0) return null;

	const isbn13 = identifiers.find((id) => id.type === 'ISBN_13');
	if (isbn13) return isbn13.identifier;

	return null;
}

/**
 * Assess metadata confidence based on available fields
 */
function assessConfidence(
	volumeInfo: GoogleBooksVolume['volumeInfo']
): 'high' | 'medium' | 'low' {
	const score = [
		volumeInfo.title,
		volumeInfo.authors && volumeInfo.authors.length > 0,
		volumeInfo.description,
		volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail
	].filter(Boolean).length;

	if (score >= 4) return 'high';
	if (score >= 2) return 'medium';
	return 'low';
}
