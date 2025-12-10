import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { checkIPRateLimit, checkIdentifierRateLimit } from '$lib/server/rate-limit';
import { getTwilioClient, TWILIO_FROM_NUMBER } from '$lib/server/twilio';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { phone } = await request.json();
		const ip = getClientAddress();

		if (!phone) {
			return json({ error: 'Phone number is required' }, { status: 400 });
		}

		// Check IP rate limit (3 per hour)
		if (!(await checkIPRateLimit(ip))) {
			return json({ error: 'Too many attempts from this IP. Try again later.' }, { status: 429 });
		}

		// Check identifier rate limit (5 per day)
		const rateLimitError = await checkIdentifierRateLimit(phone);
		if (rateLimitError) {
			return json({ error: rateLimitError }, { status: 429 });
		}

		// Delete existing unused codes for this phone
		await supabase
			.from('verification_codes')
			.delete()
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
			console.error('Error storing verification code:', insertError);
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
			console.error('Error sending SMS:', smsError);
			return json({ error: 'Failed to send SMS. Please verify your phone number.' }, { status: 500 });
		}
	} catch (error) {
		console.error('Unexpected error in send-code:', error);
		return json({ error: 'An unexpected error occurred' }, { status: 500 });
	}
};
