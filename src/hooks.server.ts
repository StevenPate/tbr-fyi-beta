import type { Handle } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { logger, startTimer } from '$lib/server/logger';
import { createHash } from 'crypto';
import { supabase } from '$lib/server/supabase';

// Routes exempt from CSRF origin check (receive external webhooks)
const CSRF_EXEMPT_ROUTES = ['/api/sms', '/api/admin/cleanup'];

export const handle: Handle = async ({ event, resolve }) => {
	const requestTimer = startTimer();
	const { pathname } = event.url;
	const requestId = crypto.randomUUID();

	// Add request ID to locals for tracing
	event.locals.requestId = requestId;

	// CSRF protection for mutation requests
	const method = event.request.method;
	if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
		const isExempt = CSRF_EXEMPT_ROUTES.some((route) => pathname.startsWith(route));

		if (!isExempt) {
			const origin = event.request.headers.get('origin');
			const host = event.url.origin;

			// Origin must match host for non-exempt mutation requests
			if (!origin || origin !== host) {
				logger.warn(
					{ path: pathname, origin, host, request_id: requestId },
					'CSRF check failed: origin mismatch'
				);
				throw error(403, 'CSRF check failed');
			}
		}
	}

	// Session validation
	const sessionToken = event.cookies.get('tbr_session');

	if (sessionToken) {
		try {
			// Hash the token to look up in database
			const tokenHash = createHash('sha256').update(sessionToken).digest('hex');

			// Validate session (join using phone_number)
			const { data: session } = await supabase
				.from('sessions')
				.select(
					`
					*,
					user:users!user_id(*)
				`
				)
				.eq('token_hash', tokenHash)
				.gt('expires_at', new Date().toISOString())
				.single();

			if (session && session.user) {
				event.locals.user = session.user;

				// Throttle activity updates to once per hour
				const lastActivity = new Date(session.last_activity).getTime();
				const oneHourAgo = Date.now() - 60 * 60 * 1000;

				if (lastActivity < oneHourAgo) {
					// Update in background, don't await
					supabase
						.from('sessions')
						.update({ last_activity: new Date().toISOString() })
						.eq('token_hash', tokenHash)
						.then(
							() => {
								// Success - no action needed
							},
							(err: unknown) => {
								logger.error({ error: err }, 'Failed to update session activity');
							}
						);
				}
			}
		} catch (error) {
			// Invalid session - clear cookie
			event.cookies.delete('tbr_session', { path: '/' });
			event.locals.user = null;
		}
	} else {
		event.locals.user = null;
	}

	try {
		const response = await resolve(event);
		const duration = requestTimer();

		// Log all requests
		logger.info(
			{
				request_id: requestId,
				method: event.request.method,
				path: pathname,
				status: response.status,
				duration_ms: duration,
				user_agent: event.request.headers.get('user-agent')
			},
			`${event.request.method} ${pathname} ${response.status}`
		);

		return response;
	} catch (error) {
		const duration = requestTimer();

		logger.error(
			{
				request_id: requestId,
				method: event.request.method,
				path: pathname,
				duration_ms: duration,
				error: error instanceof Error ? error.message : 'Unknown error',
				stack: error instanceof Error ? error.stack : undefined
			},
			`Request failed: ${pathname}`
		);

		throw error;
	}
};
