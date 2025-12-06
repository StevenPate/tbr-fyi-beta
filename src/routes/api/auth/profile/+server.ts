import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ locals }) => {
	// Get authenticated user from locals (set by hooks.server.ts)
	const authUser = locals.user;

	if (!authUser) {
		return json({ error: 'Not authenticated' }, { status: 401 });
	}

	// Get user profile from our users table
	const { data: profile, error } = await supabase
		.from('users')
		.select('*')
		.or(`auth_id.eq.${authUser.id},email.eq.${authUser.email}`)
		.single();

	if (error || !profile) {
		return json({ error: 'Profile not found' }, { status: 404 });
	}

	// Return profile data in expected format
	return json({
		data: {
			phone_number: profile.phone_number,
			username: profile.username,
			email: profile.email,
			display_name: profile.display_name,
			is_public: profile.is_public,
			has_started: profile.has_started,
			auth_id: profile.auth_id,
			created_at: profile.created_at,
			account_created_at: profile.account_created_at
		},
		error: null
	});
};