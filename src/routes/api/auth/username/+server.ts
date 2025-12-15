import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { logger } from '$lib/server/logger';

// Reserved usernames that conflict with routes or are otherwise protected
const RESERVED_USERNAMES = [
	// Current routes
	'about',
	'help',
	'auth',
	'api',
	'settings',
	// Future-proofing
	'admin',
	'page',
	'content',
	'media',
	'list',
	'book',
	'books',
	'shelf',
	'shelves',
	'user',
	'users',
	'account',
	'login',
	'logout',
	'signup',
	'signin',
	'signout',
	'register',
	'profile',
	'search',
	'explore',
	'home',
	'index',
	'static',
	'assets',
	'public',
	'private',
	'feed',
	'notifications',
	'messages',
	'support',
	'contact',
	'terms',
	'privacy',
	'legal'
];

// POST - Set username
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { username } = await request.json();

		// Must be authenticated
		if (!locals.user) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		if (!username) {
			return json({ error: 'Username is required' }, { status: 400 });
		}

		// Validate username format
		// - 3-20 characters
		// - Alphanumeric, underscores, hyphens only
		// - Must start with letter or number
		const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/;
		if (!usernameRegex.test(username)) {
			return json(
				{
					error:
						'Username must be 3-20 characters, start with a letter or number, and contain only letters, numbers, underscores, and hyphens'
				},
				{ status: 400 }
			);
		}

		// Check if username is reserved
		if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
			return json({ error: 'This username is not available' }, { status: 400 });
		}

		// Check if username is already taken
		const { data: existing } = await supabase
			.from('users')
			.select('phone_number')
			.eq('username', username)
			.single();

		if (existing && existing.phone_number !== locals.user.phone_number) {
			return json({ error: 'Username is already taken' }, { status: 409 });
		}

		// Update user with username (rely on unique constraint for race condition)
		const { error: updateError } = await supabase
			.from('users')
			.update({ username })
			.eq('phone_number', locals.user.phone_number);

		if (updateError) {
			// Check for unique constraint violation (race condition)
			if (updateError.code === '23505') {
				return json({ error: 'Username was just taken. Please try another.' }, { status: 409 });
			}
			logger.error({ error: updateError }, 'Error setting username');
			return json({ error: 'Failed to set username' }, { status: 500 });
		}

		// Return updated user
		const { data: updatedUser } = await supabase
			.from('users')
			.select('*')
			.eq('phone_number', locals.user.phone_number)
			.single();

		return json({
			success: true,
			user: updatedUser
		});
	} catch (error) {
		logger.error({ error: error instanceof Error ? error : new Error(String(error)) }, 'Unexpected error in username');
		return json({ error: 'An unexpected error occurred' }, { status: 500 });
	}
};

// GET - Check username availability
export const GET: RequestHandler = async ({ url }) => {
	const username = url.searchParams.get('username');

	if (!username) {
		return json({ error: 'Username parameter is required' }, { status: 400 });
	}

	// Validate format
	const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/;
	if (!usernameRegex.test(username)) {
		return json({ available: false, error: 'Invalid username format' });
	}

	// Check if username is reserved
	if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
		return json({ available: false, error: 'This username is not available' });
	}

	// Check availability
	const { data: existing } = await supabase
		.from('users')
		.select('phone_number')
		.eq('username', username)
		.single();

	return json({
		available: !existing,
		username
	});
};
