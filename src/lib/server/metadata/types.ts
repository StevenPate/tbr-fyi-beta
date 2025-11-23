/**
 * Metadata Service Type Definitions
 *
 * Core types for book metadata fetching.
 * All metadata functions accept ONLY ISBN-13 format.
 */

/**
 * ISBN-13 Branded Type
 */
export type ISBN13 = string & { readonly __brand: 'ISBN13' };

/**
 * Book Metadata Interface
 */
export interface BookMetadata {
	isbn: ISBN13;
	title: string;
	author: string[];
	coverUrl?: string;
	description?: string;
	publicationDate?: string;
	pageCount?: number;
	genres?: string[];
	publisher?: string;
	source: 'google' | 'openlibrary' | 'isbndb' | 'cache';
	confidence: 'high' | 'medium' | 'low' | 'none';
	cachedAt?: string;
	last_enriched_at: string;
	sources: string[];
}

/**
 * Custom Error Classes
 */
export class InvalidISBNError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidISBNError';
	}
}

export class RateLimitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RateLimitError';
	}
}

/**
 * Normalize ISBN to ISBN-13 Format
 *
 * Converts ISBN-10 to ISBN-13 by:
 * 1. Removing the ISBN-10 check digit
 * 2. Prepending "978"
 * 3. Calculating new ISBN-13 check digit
 */
export function normalizeISBN(input: string): string {
	// Remove all non-digit characters except 'X' (valid in ISBN-10)
	const cleaned = input.replace(/[^0-9Xx]/g, '').toUpperCase();

	// If already 13 digits, return as-is
	if (cleaned.length === 13) {
		return cleaned;
	}

	// If 10 digits, convert to ISBN-13
	if (cleaned.length === 10) {
		return convertISBN10ToISBN13(cleaned);
	}

	// Invalid length
	throw new InvalidISBNError(`ISBN must be 10 or 13 digits, got ${cleaned.length}`);
}

/**
 * Convert ISBN-10 to ISBN-13
 */
function convertISBN10ToISBN13(isbn10: string): string {
	// Take first 9 digits (drop ISBN-10 check digit)
	const base = '978' + isbn10.substring(0, 9);

	// Calculate ISBN-13 check digit
	const checksum = base
		.split('')
		.map(Number)
		.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0);

	const checkDigit = (10 - (checksum % 10)) % 10;

	return base + checkDigit;
}

/**
 * Validate ISBN-13 Checksum
 */
export function validateISBN13(isbn13: string): boolean {
	if (isbn13.length !== 13) return false;
	if (!/^\d{13}$/.test(isbn13)) return false;

	const checksum = isbn13
		.split('')
		.map(Number)
		.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0);

	return checksum % 10 === 0;
}

/**
 * Convert Input to ISBN-13 Branded Type
 *
 * CRITICAL: This is the ONLY way to create ISBN13 branded types.
 */
export function toISBN13(input: string): ISBN13 {
	const normalized = normalizeISBN(input);

	if (!validateISBN13(normalized)) {
		throw new InvalidISBNError(`Invalid ISBN-13 checksum: ${input}`);
	}

	return normalized as ISBN13;
}
