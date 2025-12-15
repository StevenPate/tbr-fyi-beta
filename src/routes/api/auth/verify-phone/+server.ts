import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { getOrCreateUser, generateSessionToken, COOKIE_OPTIONS } from '$lib/server/auth';
import { incrementFailedVerification, resetFailedVerification } from '$lib/server/rate-limit';
import { logger } from '$lib/server/logger';

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
			// Wrong code - increment IDENTIFIER-level failed attempts (persists across code regenerations)
			const failedCount = await incrementFailedVerification(phone);

			if (failedCount === -1) {
				// Mark code as used to prevent further attempts
				await supabase
					.from('verification_codes')
					.update({ used_at: new Date().toISOString() })
					.eq('id', activeCode.id);

				return json(
					{ error: 'Too many failed attempts. Please wait an hour before trying again.' },
					{ status: 429 }
				);
			}

			const remainingAttempts = 10 - failedCount;
			return json(
				{ error: `Invalid verification code. ${remainingAttempts} attempts remaining.` },
				{ status: 400 }
			);
		}

		// Code is valid - mark as used
		await supabase
			.from('verification_codes')
			.update({ used_at: new Date().toISOString() })
			.eq('id', activeCode.id);

		// Reset failed verification attempts on success
		await resetFailedVerification(phone);

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
		logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error in verify-phone');
		return json({ error: 'An unexpected error occurred' }, { status: 500 });
	}
};
