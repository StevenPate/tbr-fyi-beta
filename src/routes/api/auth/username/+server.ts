import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { username } = await request.json();

	if (!username) {
		return json({ data: null, error: 'Username required' }, { status: 400 });
	}

	// Validate username format
	const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
	if (!usernameRegex.test(username)) {
		return json({
			data: null,
			error: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens'
		}, { status: 400 });
	}

	// Get authenticated user from locals
	const authUser = locals.user;

	if (!authUser) {
		return json({ data: null, error: 'Not authenticated' }, { status: 401 });
	}

	// Check if username is taken
	const { data: existing } = await supabase
		.from('users')
		.select('username')
		.eq('username', username)
		.single();

	if (existing) {
		return json({ error: 'Username already taken' }, { status: 409 });
	}

	// Update user's username
	const { data, error } = await supabase
		.from('users')
		.update({ username })
		.or(`auth_id.eq.${authUser.id},email.eq.${authUser.email}`)
		.select()
		.single();

	if (error) {
		console.error('Error updating username:', error);
		return json({ data: null, error: 'Failed to set username' }, { status: 500 });
	}

	return json({
		data: { username: data.username },
		error: null
	});
};

// Check if username is available
export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('username');

	if (!username) {
		return json({ error: 'Username required' }, { status: 400 });
	}

	// Validate username format
	const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
	if (!usernameRegex.test(username)) {
		return json({
			available: false,
			error: 'Invalid username format'
		});
	}

	// Check if username is taken
	const { data: existing } = await supabase
		.from('users')
		.select('username')
		.eq('username', username)
		.single();

	return json({
		available: !existing,
		username
	});
};