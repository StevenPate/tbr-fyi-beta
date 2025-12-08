import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		logger.warn('No authenticated user in username setup, redirecting to claim');
		throw redirect(307, '/auth/claim');
	}

	// Check if user already has a profile with username
	const { data: profile } = await locals.supabase
		.from('users')
		.select('*')
		.eq('auth_id', locals.user.id)
		.maybeSingle();

	if (!profile) {
		logger.error({ user_id: locals.user.id }, 'No profile found for authenticated user');
		throw redirect(307, '/auth/verify-phone');
	}

	if (profile.username) {
		logger.info({ username: profile.username }, 'User already has username, redirecting to shelf');
		throw redirect(307, `/@${profile.username}`);
	}

	return {
		userId: locals.user.id,
		userEmail: locals.user.email,
		phoneNumber: profile.phone_number
	};
};