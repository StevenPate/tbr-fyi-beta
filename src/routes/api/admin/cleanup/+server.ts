import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { logger } from '$lib/server/logger';
import { env } from '$env/dynamic/private';

// POST - Run cleanup (protected by secret)
export const POST: RequestHandler = async ({ request }) => {
	// Verify cleanup secret (set via environment variable)
	const authHeader = request.headers.get('Authorization');
	const providedSecret = authHeader?.replace('Bearer ', '');

	if (!env.CLEANUP_SECRET || providedSecret !== env.CLEANUP_SECRET) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		// Clean up expired sessions
		const { data: sessionsDeleted } = await supabase.rpc('cleanup_expired_sessions');

		// Clean up expired verification codes
		const { data: codesDeleted } = await supabase.rpc('cleanup_expired_verification_codes');

		// Clean up expired rate limits
		const { data: rateLimitsDeleted } = await supabase.rpc('cleanup_expired_rate_limits');

		logger.info(
			{
				sessions_deleted: sessionsDeleted,
				codes_deleted: codesDeleted,
				rate_limits_deleted: rateLimitsDeleted
			},
			'Cleanup completed'
		);

		return json({
			success: true,
			deleted: {
				sessions: sessionsDeleted,
				verification_codes: codesDeleted,
				rate_limits: rateLimitsDeleted
			}
		});
	} catch (error) {
		logger.error({ error }, 'Cleanup failed');
		return json({ error: 'Cleanup failed' }, { status: 500 });
	}
};

// Disable CSRF for external cron services (protected by CLEANUP_SECRET bearer token)
export const config = {
	csrf: false
};
