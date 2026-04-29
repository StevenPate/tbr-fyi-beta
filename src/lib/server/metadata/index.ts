/**
 * Metadata Service Orchestrator
 *
 * Coordinates metadata fetching from multiple sources with fallback logic.
 * Tries Google Books first, falls back to Open Library if not found.
 */

import type { BookMetadata } from './types';
import { fetchGoogleBooksMetadata } from './google-books';
import { searchGoogleBooks, type GoogleBooksSearchResult } from './google-books';
import { fetchOpenLibraryMetadata, searchOpenLibrary } from './open-library';

/**
 * Fetch book metadata with automatic fallback
 *
 * Strategy:
 * 1. Try Google Books first (better coverage, richer descriptions)
 * 2. Fall back to Open Library if:
 *    a) Google returns null (book not found)
 *    b) Google returns metadata but no cover image
 *
 * @param isbn - ISBN-13 or ISBN-10 string
 * @returns BookMetadata or null if not found in any source
 */
export async function fetchBookMetadata(isbn: string): Promise<BookMetadata | null> {
	// Try Google Books first
	const googleMetadata = await fetchGoogleBooksMetadata(isbn);

	// If Google Books has complete metadata with a cover, use it
	if (googleMetadata?.coverUrl) {
		return googleMetadata;
	}

	// Try Open Library if:
	// - Google Books returned nothing, OR
	// - Google Books returned metadata but no cover
	console.log(
		googleMetadata
			? `Google Books missing cover for ISBN ${isbn}, trying Open Library...`
			: `Google Books had no data for ISBN ${isbn}, trying Open Library...`
	);

	const openLibraryMetadata = await fetchOpenLibraryMetadata(isbn);

	// If Open Library found metadata, decide what to return
	if (openLibraryMetadata) {
		// If Google had metadata but no cover, and Open Library has a cover,
		// prefer Google's metadata but use Open Library's cover
		if (googleMetadata && openLibraryMetadata.coverUrl) {
			console.log(`Using Google Books metadata with Open Library cover for ISBN ${isbn}`);
			return {
				...googleMetadata,
				coverUrl: openLibraryMetadata.coverUrl
			};
		}

		// Otherwise use Open Library's metadata
		console.log(`Using Open Library metadata for ISBN ${isbn}`);
		return openLibraryMetadata;
	}

	// If we have Google metadata (even without cover), return it
	if (googleMetadata) {
		console.log(`Using Google Books metadata (no cover available) for ISBN ${isbn}`);
		return googleMetadata;
	}

	// Not found in either source
	console.log(`No metadata found for ISBN ${isbn} in Google Books or Open Library`);
	return null;
}

/**
 * Search for books by free text or parsed title/author.
 * Tries Google Books first, falls back to Open Library on empty results or rate limit.
 */
export async function searchBooks(params: {
	q?: string;
	title?: string;
	author?: string;
	max?: number;
}): Promise<GoogleBooksSearchResult[]> {
	const googleResults = await searchGoogleBooks(params);
	if (googleResults.length > 0) return googleResults;

	// Google returned nothing (rate-limited, no results, or timeout) — try Open Library
	console.log('Google Books search returned no results, falling back to Open Library');
	const olResults = await searchOpenLibrary(params);
	// Map to same shape
	return olResults.map((r) => ({
		isbn13: r.isbn13,
		title: r.title,
		authors: r.authors,
		publisher: r.publisher,
		publicationDate: r.publicationDate,
		coverUrl: r.coverUrl
	}));
}

// Re-export types for convenience
export type { BookMetadata, ISBN13 } from './types';
export { toISBN13, InvalidISBNError } from './types';
