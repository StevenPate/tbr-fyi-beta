/**
 * Update Book API
 *
 * Handles updating book properties (read, owned, note).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireUserId, resolveIdentifierToUserId } from '$lib/server/auth';

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
		const { id, is_read, is_owned, note } = body;

		if (!id) {
			return json({ error: 'Book ID required' }, { status: 400 });
		}

		// Build update object with only provided fields
		const updates: Record<string, any> = {};
		if (typeof is_read === 'boolean') updates.is_read = is_read;
		if (typeof is_owned === 'boolean') updates.is_owned = is_owned;
		if (typeof note === 'string') updates.note = note;

		if (Object.keys(updates).length === 0) {
			return json({ error: 'No fields to update' }, { status: 400 });
		}

		// Update in Supabase with user ownership check
		const { data, error } = await supabase
			.from('books')
			.update(updates)
			.eq('id', id)
			.eq('user_id', userId) // Only update books owned by this user
			.select()
			.maybeSingle();

		if (error) {
			console.error('Update error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		// Check if book was actually updated (i.e., it existed and belonged to user)
		if (!data) {
			return json({ error: 'Book not found or access denied' }, { status: 404 });
		}

		return json({ success: true, book: data });
	} catch (error) {
		console.error('Update book error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return json({ error: message }, { status });
	}
};
