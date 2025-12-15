import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { checkIPRateLimit, checkIdentifierRateLimit } from '$lib/server/rate-limit';
import { sendEmail, generateMagicLinkEmail } from '$lib/server/email';
import { PUBLIC_BASE_URL } from '$env/static/public';
import { randomBytes } from 'crypto';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { email } = await request.json();
		const ip = getClientAddress();

		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return json({ error: 'Invalid email address' }, { status: 400 });
		}

		// Check IP rate limit (3 per hour)
		if (!(await checkIPRateLimit(ip))) {
			return json({ error: 'Too many attempts from this IP. Try again later.' }, { status: 429 });
		}

		// Check identifier rate limit (5 per day)
		const rateLimitError = await checkIdentifierRateLimit(email);
		if (rateLimitError) {
			return json({ error: rateLimitError }, { status: 429 });
		}

		// Delete existing unused codes for this email
		await supabase
			.from('verification_codes')
			.delete()
			.eq('identifier', email)
			.eq('code_type', 'email_token')
			.is('used_at', null);

		// Generate secure token (32 bytes = 256 bits)
		const token = randomBytes(32).toString('base64url');

		// Store token with proper code_type
		const { error: insertError } = await supabase.from('verification_codes').insert({
			identifier: email,
			code: token,
			code_type: 'email_token', // REQUIRED: Must specify email_token type
			ip_address: ip
		});

		if (insertError) {
			logger.error({ error: insertError }, 'Error storing verification token');
			return json({ error: 'Failed to generate verification link' }, { status: 500 });
		}

		// Generate magic link
		const link = `${PUBLIC_BASE_URL}/auth/confirm?token=${token}&email=${encodeURIComponent(email)}`;

		// Send email (placeholder logs to console in dev)
		try {
			const emailBody = generateMagicLinkEmail(link);
			await sendEmail(email, 'Verify your email - TBR.fyi', emailBody);

			return json({ success: true });
		} catch (emailError) {
			logger.error({ error: emailError }, 'Error sending email');
			return json(
				{ error: 'Failed to send verification email. Please try again.' },
				{ status: 500 }
			);
		}
	} catch (error) {
		logger.error({ error: error instanceof Error ? error : new Error(String(error)) }, 'Unexpected error in send-magic-link');
		return json({ error: 'An unexpected error occurred' }, { status: 500 });
	}
};
