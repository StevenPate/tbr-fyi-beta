import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	// Ensure user is authenticated
	if (!locals.user) {
		throw redirect(303, '/auth/verify-email');
	}

	// If user already has a username, redirect to their shelf
	if (locals.user.username) {
		throw redirect(303, `/@${locals.user.username}`);
	}

	// Return user data for display
	return {
		userEmail: locals.user.email,
		phoneNumber: locals.user.phone_number.startsWith('email_user_')
			? null
			: locals.user.phone_number
	};
};
