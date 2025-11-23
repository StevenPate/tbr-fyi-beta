/**
 * Delete Book API Endpoint
 *
 * Permanently removes a book from the user's shelf
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireUserId } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Extract and verify user ID from referer
		const userId = requireUserId(request);

		const { bookId } = await request.json();

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
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return json({ error: message }, { status });
	}
};
