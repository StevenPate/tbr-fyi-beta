import type { Handle } from '@sveltejs/kit';
import { logger, startTimer } from '$lib/server/logger';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
	const requestTimer = startTimer();
	const { pathname } = event.url;
	const requestId = crypto.randomUUID();

	// Add request ID to locals for tracing
	event.locals.requestId = requestId;

	// Create Supabase client for this request
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) => {
				cookies.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	// Get the session
	const {
		data: { user }
	} = await event.locals.supabase.auth.getUser();

	event.locals.user = user ?? null;

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
