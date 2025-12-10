import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { getOrCreateUser, generateSessionToken, COOKIE_OPTIONS } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { phone, code } = await request.json();

		if (!phone || !code) {
			return json({ error: 'Phone and code are required' }, { status: 400 });
		}

		// First, check if there's an active code for this identifier
		const { data: activeCode } = await supabase
			.from('verification_codes')
			.select('*')
			.eq('identifier', phone)
			.eq('code_type', 'sms_6digit')
			.is('used_at', null)
			.gt('expires_at', new Date().toISOString())
			.single();

		// If no active code exists, fail immediately
		if (!activeCode) {
			return json({ error: 'No active verification code. Please request a new one.' }, { status: 400 });
		}

		// Check if the provided code matches
		if (activeCode.code !== code) {
			// Wrong code - increment attempts on the active code
			const { data: attempts } = await supabase.rpc('increment_verification_attempts', {
				code_id: activeCode.id
			});

			if (attempts && attempts >= 3) {
				// Lock out this code
				await supabase
					.from('verification_codes')
					.update({ used_at: new Date().toISOString() })
					.eq('id', activeCode.id);
				return json({ error: 'Too many failed attempts. Please request a new code.' }, { status: 400 });
			}

			return json({ error: 'Invalid verification code' }, { status: 400 });
		}

		// Code is valid - mark as used
		await supabase
			.from('verification_codes')
			.update({ used_at: new Date().toISOString() })
			.eq('id', activeCode.id);

		// Get or create user (returns record with phone_number as PK)
		const user = await getOrCreateUser({ phone });

		// Create session with hashed token
		const { token, hash } = generateSessionToken();
		await supabase.from('sessions').insert({
			token_hash: hash,
			user_id: user.phone_number // PK is phone_number, not id!
		});

		// Set cookie (raw token)
		cookies.set('tbr_session', token, COOKIE_OPTIONS);

		return json({
			success: true,
			user: {
				phone_number: user.phone_number,
				email: user.email,
				username: user.username,
				display_name: user.display_name
			}
		});
	} catch (error) {
		console.error('Error in verify-phone:', error);
		return json({ error: 'An unexpected error occurred' }, { status: 500 });
	}
};
