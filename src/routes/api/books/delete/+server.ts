/**
 * Delete Book API Endpoint
 *
 * Permanently removes a book from the user's shelf.
 * Requires authenticated session.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireSessionUserId } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	try {
		// Get authenticated user from session
		const userId = requireSessionUserId(event);

		const { bookId } = await event.request.json();

		if (!bookId) {
			return json({ error: 'Book ID is required' }, { status: 400 });
		}

		// Delete with user ownership check
		const { data, error } = await supabase
			.from('books')
			.delete()
			.eq('id', bookId)
			.eq('user_id', userId) // Only delete books owned by this user
			.select('id')
			.maybeSingle();

		if (error) {
			console.error('Error deleting book:', error);
			return json({ error: 'Failed to delete book' }, { status: 500 });
		}

		// Check if a book was actually deleted
		if (!data) {
			return json({ error: 'Book not found or access denied' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Delete book error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('Authentication') ? 401 : 500;
		return json({ error: message }, { status });
	}
};
