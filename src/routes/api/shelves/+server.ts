/**
 * Shelves API
 *
 * Handles shelf management (list, create, delete).
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireUserId } from '$lib/server/auth';

// GET: List all shelves for a user
export const GET: RequestHandler = async ({ url }) => {
	try {
		const userId = url.searchParams.get('user_id');

		if (!userId) {
			return json({ error: 'User ID required' }, { status: 400 });
		}

		const { data, error } = await supabase
			.from('shelves')
			.select('*')
			.eq('user_id', userId)
			.order('created_at', { ascending: true });

		if (error) {
			console.error('Fetch shelves error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		return json({ shelves: data });
	} catch (error) {
		console.error('Shelves API error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// POST: Create a new shelf
export const POST: RequestHandler = async ({ request }) => {
	try {
		// Extract and verify user ID from referer instead of trusting client
		const userId = requireUserId(request);

		const body = await request.json();
		const { name } = body;

		if (!name) {
			return json({ error: 'Shelf name required' }, { status: 400 });
		}

		// Use derived userId instead of client-provided user_id
		const { data, error } = await supabase
			.from('shelves')
			.insert({ user_id: userId, name })
			.select()
			.single();

		if (error) {
			// Check for unique constraint violation
			if (error.code === '23505') {
				return json({ error: 'Shelf with this name already exists' }, { status: 409 });
			}
			console.error('Create shelf error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		return json({ success: true, shelf: data });
	} catch (error) {
		console.error('Create shelf error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return json({ error: message }, { status });
	}
};

// DELETE: Delete a shelf
export const DELETE: RequestHandler = async ({ request }) => {
	try {
		// Extract and verify user ID from referer instead of trusting client
		const userId = requireUserId(request);

		const body = await request.json();
		const { id } = body;

		if (!id) {
			return json({ error: 'Shelf ID required' }, { status: 400 });
		}

		// Delete shelf (CASCADE will automatically remove book_shelves entries)
		// Verify shelf belongs to user before deleting
		const { data: deletedShelf, error } = await supabase
			.from('shelves')
			.delete()
			.eq('id', id)
			.eq('user_id', userId) // Only delete if belongs to user
			.select('id')
			.maybeSingle();

		if (error) {
			console.error('Delete shelf error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		// Check if a row was actually deleted
		if (!deletedShelf) {
			return json({ error: 'Shelf not found or access denied' }, { status: 404 });
		}

		// Clear default_shelf_id if this was the user's default shelf
		// This prevents orphaned references when the default shelf is deleted
		const { error: updateError } = await supabase
			.from('users')
			.update({ default_shelf_id: null })
			.eq('phone_number', userId)
			.eq('default_shelf_id', id);

		if (updateError) {
			console.error('Failed to clear default_shelf_id:', updateError);
			// Non-critical error, shelf is already deleted
		}

		return json({ success: true });
	} catch (error) {
		console.error('Delete shelf error:', error);
		const message = error instanceof Error ? error.message : 'Internal server error';
		const status = error instanceof Error && error.message.includes('User ID') ? 401 : 500;
		return json({ error: message }, { status });
	}
};
