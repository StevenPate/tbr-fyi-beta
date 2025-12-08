import type { PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ url, locals }) => {
	let profile = null;
	let verificationError = null;

	try {
		// Extract magic link token from URL
		const token = url.searchParams.get('token');
		const type = url.searchParams.get('type');

		logger.info(
			{
				has_token: !!token,
				type: type,
				url: url.toString()
			},
			'Verify page load - magic link parameters'
		);

		// If we have a magic link token, verify it server-side
		if (token && type === 'magiclink') {
			const { error: verifyError } = await locals.supabase.auth.verifyOtp({
				token_hash: token,
				type: 'email'
			});

			if (verifyError) {
				logger.error({ error: verifyError }, 'Error verifying OTP');
				verificationError = verifyError.message || 'Invalid or expired link';
				return { profile: null, verificationError };
			}

			logger.info({}, 'Magic link verified successfully');
		}

		// Now get the authenticated user (either from magic link or existing session)
		const {
			data: { user }
		} = await locals.supabase.auth.getUser();

		logger.info(
			{
				has_user: !!user,
				user_id: user?.id,
				user_email: user?.email
			},
			'Verify page load - checking session after verification'
		);

		if (!user) {
			verificationError = 'No active session. Please try signing in again.';
			return { profile: null, verificationError };
		}

		// Fetch the user profile from the database
		const { data: profileData, error: profileError } = await locals.supabase
			.from('users')
			.select('*')
			.or(`auth_id.eq.${user.id},email.eq.${user.email}`)
			.single();

		if (profileError) {
			logger.error({ error: profileError }, 'Error fetching profile from database');
			verificationError = 'Failed to load profile. Please try again.';
		} else {
			profile = profileData;
			logger.info({ username: profile?.username }, 'Profile loaded successfully');
		}
	} catch (err) {
		logger.error({ error: err }, 'Error in verify page load');
		verificationError = 'An error occurred during verification';
	}

	return { profile, verificationError };
};
