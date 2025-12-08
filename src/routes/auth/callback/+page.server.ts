import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals, url }) => {
	logger.info(
		{
			has_user: !!locals.user,
			user_id: locals.user?.id,
			user_email: locals.user?.email,
			url: url.toString()
		},
		'Auth callback - checking session'
	);

	// By the time we get here, Supabase client-side should have processed
	// the magic link and set cookies that hooks.server.ts picks up
	const user = locals.user;

	if (!user) {
		logger.warn('No user session found in callback, client will retry');
		// No session yet - client will handle retrying
		return {
			status: 'no_session',
			redirect: null
		};
	}

	// User is authenticated! Check their profile status
	const { data: profile, error: profileError } = await locals.supabase
		.from('users')
		.select('*')
		.eq('auth_id', user.id)
		.maybeSingle(); // Use maybeSingle instead of single to avoid error if no row

	if (!profile) {
		logger.info({ user_id: user.id }, 'No profile found, needs phone verification');
		// No profile yet - they need to verify phone
		return {
			status: 'authenticated',
			redirect: '/auth/verify-phone'
		};
	}

	// Check what stage they're at
	if (!profile.username) {
		logger.info({ phone: profile.phone_number }, 'Profile exists but no username');
		return {
			status: 'authenticated',
			redirect: '/auth/username'
		};
	}

	// Everything complete - go to their shelf
	logger.info({ username: profile.username }, 'Profile complete, redirecting to shelf');
	return {
		status: 'authenticated',
		redirect: `/@${profile.username}`
	};
};