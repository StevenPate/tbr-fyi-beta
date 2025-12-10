/**
 * Rate Limiting Utilities
 * Persistent database-backed rate limiting for verification codes
 */

import { supabase } from '$lib/server/supabase';

/**
 * Check IP rate limit (3 attempts per hour)
 * Returns true if allowed, false if rate limited
 */
export async function checkIPRateLimit(ip: string): Promise<boolean> {
	const now = new Date();
	const limit = 3;

	// Check existing rate limit
	const { data: rateLimit } = await supabase
		.from('ip_rate_limits')
		.select('*')
		.eq('ip_address', ip)
		.gt('window_end', now.toISOString())
		.single();

	if (!rateLimit) {
		// Create new window
		await supabase.from('ip_rate_limits').upsert({
			ip_address: ip,
			attempts: 1,
			window_start: now.toISOString(),
			window_end: new Date(now.getTime() + 60 * 60 * 1000).toISOString()
		});
		return true;
	}

	if (rateLimit.attempts >= limit) {
		return false; // Rate limited
	}

	// Increment atomically using Supabase RPC
	await supabase.rpc('increment_ip_attempts', { ip_addr: ip });
	return true;
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
