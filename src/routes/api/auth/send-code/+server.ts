import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { checkIPRateLimit, checkIdentifierRateLimit, checkVerificationAttemptLimit } from '$lib/server/rate-limit';
import { getTwilioClient, TWILIO_FROM_NUMBER } from '$lib/server/twilio';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { phone } = await request.json();
		const ip = getClientAddress();

		if (!phone) {
			return json({ error: 'Phone number is required' }, { status: 400 });
		}

		// Validate phone number format (E.164)
		const phoneRegex = /^\+[1-9]\d{1,14}$/;
		if (!phoneRegex.test(phone)) {
			return json(
				{ error: 'Phone number must be in international format (e.g., +15551234567)' },
				{ status: 400 }
			);
		}

		// Check IP rate limit (3 per hour)
		if (!(await checkIPRateLimit(ip))) {
			return json({ error: 'Too many attempts from this IP. Try again later.' }, { status: 429 });
		}

		// Check identifier rate limit (5 codes per day)
		const rateLimitError = await checkIdentifierRateLimit(phone);
		if (rateLimitError) {
			return json({ error: rateLimitError }, { status: 429 });
		}

		// Check failed verification attempts (10 per hour across all codes)
		if (!(await checkVerificationAttemptLimit(phone))) {
			return json(
				{ error: 'Too many failed verification attempts. Please wait an hour.' },
				{ status: 429 }
			);
		}

		// Mark existing unused codes as superseded (don't delete - preserve audit trail)
		await supabase
			.from('verification_codes')
			.update({ used_at: new Date().toISOString() })
			.eq('identifier', phone)
			.eq('code_type', 'sms_6digit')
			.is('used_at', null);

		// Generate 6-digit code
		const code = Math.floor(100000 + Math.random() * 900000).toString();

		// Store code with metadata
		const { error: insertError } = await supabase.from('verification_codes').insert({
			identifier: phone,
			code,
			code_type: 'sms_6digit',
			ip_address: ip
		});

		if (insertError) {
			logger.error({ error: insertError }, 'Error storing verification code');
			return json({ error: 'Failed to generate verification code' }, { status: 500 });
		}

		// Send SMS
		try {
			const client = await getTwilioClient();
			await client.messages.create({
				to: phone,
				from: TWILIO_FROM_NUMBER,
				body: `Your TBR.fyi verification code: ${code}\n\nExpires in 10 minutes.`
			});

			return json({ success: true });
		} catch (smsError) {
			logger.error({ error: smsError }, 'Error sending SMS');
			return json({ error: 'Failed to send SMS. Please verify your phone number.' }, { status: 500 });
		}
	} catch (error) {
		logger.error({ error }, 'Unexpected error in send-code');
		return json({ error: 'An unexpected error occurred' }, { status: 500 });
	}
};
