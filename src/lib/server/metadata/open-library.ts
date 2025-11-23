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
