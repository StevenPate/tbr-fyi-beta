/**
 * Rate Limiting Utilities
 * Persistent database-backed rate limiting for verification codes
 */

import { supabase } from '$lib/server/supabase';

/**
 * Check IP rate limit (3 attempts per hour)
 * Returns true if allowed, false if rate limited
 * Uses atomic database function to prevent race conditions
 */
export async function checkIPRateLimit(ip: string): Promise<boolean> {
	const { data, error } = await supabase.rpc('check_and_increment_ip_limit', {
		ip_addr: ip,
		max_attempts: 3
	});

	if (error) {
		// Log error but allow request (fail open for availability)
		console.error('Rate limit check failed:', error);
		return true;
	}

	return data === true;
}

/**
 * Check identifier rate limit (5 codes per day)
 * Returns error message if rate limited, null if allowed
 */
export async function checkIdentifierRateLimit(identifier: string): Promise<string | null> {
	const { data: rateLimit } = await supabase
		.from('verification_rate_limits')
		.select('*')
		.eq('identifier', identifier)
		.single();

	if (rateLimit) {
		// Check daily limit
		if (rateLimit.attempts_today >= 5 && rateLimit.day_reset_at > new Date().toISOString()) {
			return 'Daily limit reached. Try again tomorrow.';
		}

		// Check hourly limit
		if (
			rateLimit.attempts_this_hour >= 3 &&
			rateLimit.hour_reset_at > new Date().toISOString()
		) {
			return 'Too many attempts. Try again in an hour.';
		}
	}

	// Increment atomically
	await supabase.rpc('increment_identifier_attempts', { ident: identifier });
	return null;
}

/**
 * Check if identifier is rate limited for failed verification attempts
 * Returns true if allowed, false if rate limited (10+ failed attempts in last hour)
 */
export async function checkVerificationAttemptLimit(identifier: string): Promise<boolean> {
	const { data, error } = await supabase.rpc('check_verification_rate_limit', {
		ident: identifier,
		max_attempts: 10
	});

	if (error) {
		// Fail open for availability
		console.error('Verification rate limit check failed:', error);
		return true;
	}

	return data === true;
}

/**
 * Increment failed verification attempts for identifier
 * Returns current count, or -1 if over limit
 */
export async function incrementFailedVerification(identifier: string): Promise<number> {
	const { data, error } = await supabase.rpc('increment_failed_verification', {
		ident: identifier,
		max_attempts: 10
	});

	if (error) {
		console.error('Failed to increment verification attempts:', error);
		return 0;
	}

	return data;
}

/**
 * Reset failed verification attempts on successful verification
 */
export async function resetFailedVerification(identifier: string): Promise<void> {
	await supabase.rpc('reset_failed_verification', { ident: identifier });
}
