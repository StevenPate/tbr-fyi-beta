/**
 * Twilio SMS Client
 * Shared client for sending verification codes
 */

import { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } from '$env/static/private';

// Dynamic import for Twilio
export async function getTwilioClient() {
	const twilio = await import('twilio');
	return twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

export const TWILIO_FROM_NUMBER = TWILIO_PHONE_NUMBER;
