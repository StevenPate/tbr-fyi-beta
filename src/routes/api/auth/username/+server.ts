import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';

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

		// Check if username is already taken
		const { data: existing } = await supabase
			.from('users')
			.select('phone_number')
			.eq('username', username)
			.single();

		if (existing && existing.phone_number !== locals.user.phone_number) {
			return json({ error: 'Username is already taken' }, { status: 409 });
		}

		// Update user with username
		const { error: updateError } = await supabase
			.from('users')
			.update({ username })
			.eq('phone_number', locals.user.phone_number);

		if (updateError) {
			console.error('Error setting username:', updateError);
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
		console.error('Unexpected error in username:', error);
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
