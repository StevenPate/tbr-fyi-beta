import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';
import { getOrCreateUser, generateSessionToken, COOKIE_OPTIONS } from '$lib/server/auth';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const token = url.searchParams.get('token');
	const email = url.searchParams.get('email');

	if (!token || !email) {
		throw redirect(303, '/auth/verify-email?error=invalid_link');
	}

	try {
		// Verify token (check it exists and is valid)
		const { data: verificationCode } = await supabase
			.from('verification_codes')
			.select('*')
			.eq('identifier', email)
			.eq('code', token)
			.eq('code_type', 'email_token') // Must check email_token type
			.is('used_at', null)
			.gt('expires_at', new Date().toISOString())
			.single();

		if (!verificationCode) {
			throw redirect(303, '/auth/verify-email?error=invalid_or_expired');
		}

		// Mark token as used
		await supabase
			.from('verification_codes')
			.update({ used_at: new Date().toISOString() })
			.eq('id', verificationCode.id);

		// Get or create user - handles existing email users correctly!
		const user = await getOrCreateUser({ email });

		// Create session with phone_number as user_id
		const { token: sessionToken, hash } = generateSessionToken();
		await supabase.from('sessions').insert({
			token_hash: hash,
			user_id: user.phone_number // Use phone_number (real or synthetic)
		});

		cookies.set('tbr_session', sessionToken, COOKIE_OPTIONS);

		// Redirect to username selection (new users) or shelf (existing users)
		if (!user.username) {
			throw redirect(303, '/auth/username');
		} else {
			throw redirect(303, `/@${user.username}`);
		}
	} catch (error) {
		// If it's already a redirect, re-throw it
		if (error instanceof Response && error.status >= 300 && error.status < 400) {
			throw error;
		}

		console.error('Error in confirm:', error);
		throw redirect(303, '/auth/verify-email?error=server_error');
	}
};
