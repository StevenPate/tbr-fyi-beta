/**
 * Export API
 *
 * Returns user's complete book collection as JSON with download headers.
 */

import { json } from '@sveltejs/kit';
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

export const GET: RequestHandler = async ({ request }) => {
	try {
		// Extract identifier from referer (could be username, phone, or email_user_*)
		const identifier = requireUserId(request);

		// Resolve to actual user_id (phone_number)
		const userId = await resolveIdentifierToUserId(identifier);
		if (!userId) {
			return json({ error: 'User not found' }, { status: 404 });
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

		// Transform database rows to clean JSON structure
		const exportData = {
			exportedAt: new Date().toISOString(),
			userId: userId,
			totalBooks: books?.length || 0,
			books: (books || []).map((book) => ({
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
					.filter((name: string | null | undefined): name is string => name !== null),
				addedAt: book.added_at
			}))
		};

		// Generate filename with current date
		const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const filename = `tbr-export-${date}.json`;

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
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return json({ error: message }, { status });
	}
};
