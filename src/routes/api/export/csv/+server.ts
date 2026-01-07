/**
 * CSV Export API (Goodreads Format)
 *
 * Returns user's complete book collection as Goodreads-compatible CSV.
 * Compatible with StoryGraph, Hardcover, BookWyrm, and Literal.
 */

import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireUserId, resolveIdentifierToUserId } from '$lib/server/auth';

/**
 * Type for book-shelf join structure from Supabase query
 */
interface BookShelfJoin {
	shelf_id: string;
	shelves: {
		name: string;
	} | null;
}

interface BookRow {
	isbn13: string;
	title: string;
	author: string[] | null;
	publisher: string | null;
	publication_date: string | null;
	description: string | null;
	cover_url: string | null;
	note: string | null;
	is_read: boolean;
	is_owned: boolean;
	added_at: string;
	book_shelves: BookShelfJoin[];
}

// Goodreads CSV columns (all 31)
const GOODREADS_HEADERS = [
	'Book Id',
	'Title',
	'Author',
	'Author l-f',
	'Additional Authors',
	'ISBN',
	'ISBN13',
	'My Rating',
	'Average Rating',
	'Publisher',
	'Binding',
	'Number of Pages',
	'Year Published',
	'Original Publication Year',
	'Date Read',
	'Date Added',
	'Bookshelves',
	'Bookshelves with positions',
	'Exclusive Shelf',
	'My Review',
	'Spoiler',
	'Private Notes',
	'Read Count',
	'Recommended For',
	'Recommended By',
	'Owned Copies',
	'Original Purchase Date',
	'Original Purchase Location',
	'Condition',
	'Condition Description',
	'BCID'
];

export const GET: RequestHandler = async ({ request }) => {
	try {
		// Extract identifier from referer (could be username, phone, or email_user_*)
		const identifier = requireUserId(request);

		// Resolve to actual user_id (phone_number)
		const userId = await resolveIdentifierToUserId(identifier);
		if (!userId) {
			return new Response(JSON.stringify({ error: 'User not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Query books with joined shelf data
		const { data: books, error } = await supabase
			.from('books')
			.select('*, book_shelves(shelf_id, shelves(name))')
			.eq('user_id', userId)
			.order('added_at', { ascending: false });

		if (error) {
			console.error('CSV export query error:', error);
			return new Response(JSON.stringify({ error: 'Failed to fetch books' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const csv = generateGoodreadsCSV((books as BookRow[]) || []);

		const date = new Date().toISOString().split('T')[0];
		const filename = `tbr-export-${date}.csv`;

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (error) {
		console.error('CSV export error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return new Response(JSON.stringify({ error: message }), {
			status,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

/**
 * Generate Goodreads-compatible CSV from book data
 */
function generateGoodreadsCSV(books: BookRow[]): string {
	const rows = books.map((book) => [
		'', // Book Id (empty - Goodreads internal)
		escapeCSV(book.title || ''),
		escapeCSV(book.author?.[0] || ''),
		escapeCSV(formatAuthorLastFirst(book.author?.[0] || '')),
		escapeCSV(book.author?.slice(1).join(', ') || ''),
		formatISBN(isbn13ToIsbn10(book.isbn13)),
		formatISBN(book.isbn13),
		'0', // My Rating (TBR.fyi doesn't have ratings)
		'', // Average Rating
		escapeCSV(book.publisher || ''),
		'', // Binding
		'', // Number of Pages
		extractYear(book.publication_date),
		'', // Original Publication Year
		'', // Date Read (TBR.fyi doesn't track this separately)
		formatDate(book.added_at),
		formatBookshelves(book.book_shelves || []),
		'', // Bookshelves with positions
		book.is_read ? 'read' : 'to-read',
		'', // My Review
		'', // Spoiler
		escapeCSV(book.note || ''),
		book.is_read ? '1' : '0',
		'', // Recommended For
		'', // Recommended By
		book.is_owned ? '1' : '0',
		'', // Original Purchase Date
		'', // Original Purchase Location
		'', // Condition
		'', // Condition Description
		'' // BCID
	]);

	return [GOODREADS_HEADERS.join(','), ...rows.map((row) => row.join(','))].join('\n');
}

/**
 * Escape value for CSV (handle commas, quotes, newlines)
 */
function escapeCSV(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/**
 * Format ISBN with Goodreads quoting to preserve leading zeros
 * Goodreads uses ="0140449132" format
 */
function formatISBN(isbn: string | null): string {
	if (!isbn) return '';
	return `="${isbn}"`;
}

/**
 * Format date as YYYY/MM/DD (Goodreads format)
 * Uses UTC to avoid timezone shifts from ISO timestamps
 */
function formatDate(dateStr: string | null): string {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return '';
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `${year}/${month}/${day}`;
}

/**
 * Extract year from publication date
 */
function extractYear(dateStr: string | null): string {
	if (!dateStr) return '';
	return dateStr.split('-')[0] || '';
}

/**
 * Format author name as "Last, First"
 */
function formatAuthorLastFirst(author: string): string {
	if (!author) return '';
	const parts = author.trim().split(' ');
	if (parts.length === 1) return author;
	const last = parts.pop();
	return `${last}, ${parts.join(' ')}`;
}

/**
 * Format bookshelves as lowercase hyphenated names (CSV-escaped)
 */
function formatBookshelves(bookShelves: BookShelfJoin[]): string {
	const names = bookShelves
		.map((bs) => bs.shelves?.name)
		.filter((name): name is string => Boolean(name))
		.map((name) =>
			name
				.toLowerCase()
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9-]/g, '')
		);
	// Must escape the result since it contains commas
	return escapeCSV(names.join(', '));
}

/**
 * Convert ISBN-13 to ISBN-10
 * Only works for ISBNs starting with 978 (Bookland prefix)
 * Returns null for 979 prefixes (no ISBN-10 equivalent)
 */
function isbn13ToIsbn10(isbn13: string): string | null {
	if (!isbn13 || isbn13.length !== 13) return null;
	if (!isbn13.startsWith('978')) return null;

	const isbn10Base = isbn13.slice(3, 12);
	const checkDigit = calculateIsbn10CheckDigit(isbn10Base);
	return isbn10Base + checkDigit;
}

/**
 * Calculate ISBN-10 check digit
 */
function calculateIsbn10CheckDigit(isbn10Base: string): string {
	let sum = 0;
	for (let i = 0; i < 9; i++) {
		sum += parseInt(isbn10Base[i]) * (10 - i);
	}
	const check = (11 - (sum % 11)) % 11;
	return check === 10 ? 'X' : String(check);
}
