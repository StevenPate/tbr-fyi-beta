/**
 * Export API
 *
 * Returns user's complete book collection as JSON with download headers.
 * Requires authenticated session.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireSessionUserId } from '$lib/server/auth';

/**
 * Type for book-shelf join structure from Supabase query
 */
interface BookShelfJoin {
	shelf_id: string;
	shelves: {
		name: string;
	} | null;
}

export const GET: RequestHandler = async (event) => {
	try {
		// Get authenticated user from session
		const userId = requireSessionUserId(event);

		// Parse optional shelf filter from query params
		const shelfId = event.url.searchParams.get('shelf');
		let shelfName: string | null = null;
		let bookIdsOnShelf: Set<string> | null = null;

		// Resolve shelf ID to book IDs (avoids brittle nested Supabase filter syntax)
		if (shelfId) {
			// Verify shelf exists and belongs to this user
			const { data: shelf, error: shelfError } = await supabase
				.from('shelves')
				.select('id, name')
				.eq('id', shelfId)
				.eq('user_id', userId)
				.single();

			if (shelfError || !shelf) {
				return json({ error: 'Shelf not found' }, { status: 400 });
			}

			shelfName = shelf.name;

			// Get book IDs on this shelf
			const { data: bookShelves } = await supabase
				.from('book_shelves')
				.select('book_id')
				.eq('shelf_id', shelfId);

			bookIdsOnShelf = new Set((bookShelves || []).map((bs) => bs.book_id));
		}

		// Query books with joined shelf data
		const { data: books, error } = await supabase
			.from('books')
			.select('*, book_shelves(shelf_id, shelves(name))')
			.eq('user_id', userId)
			.order('added_at', { ascending: false });

		if (error) {
			console.error('Export query error:', error);
			return json({ error: 'Failed to fetch books' }, { status: 500 });
		}

		// Filter books by shelf if filtering
		let filteredBooks = books || [];
		if (bookIdsOnShelf) {
			filteredBooks = filteredBooks.filter((book) => bookIdsOnShelf!.has(book.id));
		}

		// Transform database rows to clean JSON structure
		const exportData = {
			exportedAt: new Date().toISOString(),
			userId: userId,
			...(shelfName && { shelfFilter: shelfName }),
			totalBooks: filteredBooks.length,
			books: filteredBooks.map((book) => ({
				isbn13: book.isbn13,
				title: book.title,
				author: book.author,
				publisher: book.publisher,
				publicationDate: book.publication_date,
				description: book.description,
				coverUrl: book.cover_url,
				note: book.note,
				isRead: book.is_read,
				isOwned: book.is_owned,
				shelves: (book.book_shelves || [])
					.map((bs: BookShelfJoin) => bs.shelves?.name)
					.filter((name: string | null | undefined): name is string => typeof name === 'string'),
				addedAt: book.added_at
			}))
		};

		// Generate filename with current date and optional shelf name
		const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const sanitizedShelfName = shelfName
			? shelfName
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-|-$/g, '')
			: null;
		const filename = sanitizedShelfName
			? `tbr-export-${sanitizedShelfName}-${date}.json`
			: `tbr-export-${date}.json`;

		// Return JSON with download headers
		return new Response(JSON.stringify(exportData, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (error) {
		console.error('Export error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('Authentication') ? 401 : 500;
		return json({ error: message }, { status });
	}
};
