import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request }) => {
	// Get authenticated user
	const authUser = await getAuthUser(request);

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

	// Return profile data
	return json({
		phone_number: profile.phone_number,
		username: profile.username,
		email: profile.email,
		display_name: profile.display_name,
		is_public: profile.is_public,
		has_started: profile.has_started,
		auth_id: profile.auth_id,
		created_at: profile.created_at,
		account_created_at: profile.account_created_at
	});
};