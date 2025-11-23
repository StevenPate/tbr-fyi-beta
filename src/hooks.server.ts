import type { Handle } from '@sveltejs/kit';
import { logger, startTimer } from '$lib/server/logger';

export const handle: Handle = async ({ event, resolve }) => {
	const requestTimer = startTimer();
	const { pathname } = event.url;
	const requestId = crypto.randomUUID();

	// Add request ID to locals for tracing
	event.locals.requestId = requestId;

	try {
		// CSRF protection is disabled in svelte.config.js to allow Twilio webhooks
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
