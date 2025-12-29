/**
 * Book-Shelves API
 *
 * Handles adding/removing books from shelves.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireUserId, resolveIdentifierToUserId } from '$lib/server/auth';

// POST: Add a book to a shelf
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Extract identifier from referer (could be username, phone, or email_user_*)
		const identifier = requireUserId(request);

		// Resolve to actual user_id (phone_number)
		const userId = await resolveIdentifierToUserId(identifier);
		if (!userId) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		const body = await request.json();
		const { book_id, shelf_id } = body;

		if (!book_id || !shelf_id) {
			return json({ error: 'Book ID and Shelf ID required' }, { status: 400 });
		}

		// Verify book belongs to user
		const { data: book, error: bookError } = await supabase
			.from('books')
			.select('id')
			.eq('id', book_id)
			.eq('user_id', userId)
			.maybeSingle();

		if (bookError) {
			console.error('Book lookup error:', bookError);
			return json({ error: 'Failed to verify book ownership' }, { status: 500 });
		}

		if (!book) {
			return json({ error: 'Book not found or access denied' }, { status: 404 });
		}

		// Verify shelf belongs to user
		const { data: shelf, error: shelfError } = await supabase
			.from('shelves')
			.select('id')
			.eq('id', shelf_id)
			.eq('user_id', userId)
			.maybeSingle();

		if (shelfError) {
			console.error('Shelf lookup error:', shelfError);
			return json({ error: 'Failed to verify shelf ownership' }, { status: 500 });
		}

		if (!shelf) {
			return json({ error: 'Shelf not found or access denied' }, { status: 404 });
		}

		// Both book and shelf belong to user, proceed with insert
		const { data, error } = await supabase
			.from('book_shelves')
			.insert({ book_id, shelf_id })
			.select()
			.single();

		if (error) {
			// Check for unique constraint violation (book already on shelf)
			if (error.code === '23505') {
				return json({ error: 'Book is already on this shelf' }, { status: 409 });
			}
			console.error('Add book to shelf error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true, bookShelf: data });
	} catch (error) {
		console.error('Add book to shelf error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return json({ error: message }, { status });
	}
};

// DELETE: Remove a book from a shelf
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		// Extract identifier from referer (could be username, phone, or email_user_*)
		const identifier = requireUserId(request);

		// Resolve to actual user_id (phone_number)
		const userId = await resolveIdentifierToUserId(identifier);
		if (!userId) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		const body = await request.json();
		const { book_id, shelf_id } = body;

		if (!book_id || !shelf_id) {
			return json({ error: 'Book ID and Shelf ID required' }, { status: 400 });
		}

		// Verify book belongs to user
		const { data: book, error: bookError } = await supabase
			.from('books')
			.select('id')
			.eq('id', book_id)
			.eq('user_id', userId)
			.maybeSingle();

		if (bookError) {
			console.error('Book lookup error:', bookError);
			return json({ error: 'Failed to verify book ownership' }, { status: 500 });
		}

		if (!book) {
			return json({ error: 'Book not found or access denied' }, { status: 404 });
		}

		// Verify shelf belongs to user
		const { data: shelf, error: shelfError } = await supabase
			.from('shelves')
			.select('id')
			.eq('id', shelf_id)
			.eq('user_id', userId)
			.maybeSingle();

		if (shelfError) {
			console.error('Shelf lookup error:', shelfError);
			return json({ error: 'Failed to verify shelf ownership' }, { status: 500 });
		}

		if (!shelf) {
			return json({ error: 'Shelf not found or access denied' }, { status: 404 });
		}

		// Both book and shelf belong to user, proceed with delete
		const { error } = await supabase
			.from('book_shelves')
			.delete()
			.eq('book_id', book_id)
			.eq('shelf_id', shelf_id);

		if (error) {
			console.error('Remove book from shelf error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Remove book from shelf error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return json({ error: message }, { status });
	}
};
