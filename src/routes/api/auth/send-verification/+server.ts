import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from '$env/static/private';

// Import Twilio
const accountSid = TWILIO_ACCOUNT_SID;
const authToken = TWILIO_AUTH_TOKEN;
const twilioNumber = TWILIO_PHONE_NUMBER;

// Dynamic import for Twilio
async function getTwilioClient() {
	const twilio = await import('twilio');
	return twilio.default(accountSid, authToken);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { phone } = await request.json();

	if (!phone) {
		return json({ data: null, error: 'Phone number required' }, { status: 400 });
	}

	// Get authenticated user from locals
	const authUser = locals.user;

	if (!authUser) {
		return json({ data: null, error: 'Not authenticated' }, { status: 401 });
	}

	// Generate a 6-digit code
	const code = Math.floor(100000 + Math.random() * 900000).toString();

	// Store the verification code
	const { error: dbError } = await supabase
		.from('phone_verification_codes')
		.insert({
			phone_number: phone,
			code,
			auth_id: authUser.id,
			email: authUser.email,
			purpose: 'account_claim',
			expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
		});

	if (dbError) {
		console.error('Error storing verification code:', dbError);
		return json({ data: null, error: 'Failed to generate verification code' }, { status: 500 });
	}

	// Send SMS with verification code
	try {
		const client = await getTwilioClient();
		await client.messages.create({
			body: `Your TBR.FYI verification code is: ${code}\n\nThis code expires in 10 minutes.`,
			from: twilioNumber,
			to: phone
		});

		return json({ data: { success: true }, error: null });
	} catch (error) {
		console.error('Error sending SMS:', error);
		return json({ data: null, error: 'Failed to send verification code' }, { status: 500 });
	}
};