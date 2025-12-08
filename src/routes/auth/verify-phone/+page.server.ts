import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		logger.warn('No authenticated user in verify-phone, redirecting to claim');
		throw redirect(307, '/auth/claim');
	}

	// Get stored phone from localStorage (will be handled client-side)
	// or from existing profile
	const { data: profile } = await locals.supabase
		.from('users')
		.select('*')
		.eq('auth_id', locals.user.id)
		.maybeSingle();

	const phoneNumber = profile?.phone_number || null;

	return {
		phoneNumber,
		userId: locals.user.id,
		userEmail: locals.user.email
	};
};