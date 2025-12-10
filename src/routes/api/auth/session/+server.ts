import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { COOKIE_OPTIONS } from '$lib/server/auth';

// GET - Check current session
export const GET: RequestHandler = async ({ locals }) => {
	if (locals.user) {
		return json({
			authenticated: true,
			user: locals.user
		});
	}

	return json({
		authenticated: false,
		user: null
	});
};

// DELETE - Logout (destroy session)
export const DELETE: RequestHandler = async ({ cookies, locals }) => {
	if (!locals.user) {
		return json({ success: false, error: 'Not authenticated' }, { status: 401 });
	}

	// Delete session cookie
	cookies.delete('tbr_session', { path: '/' });

	// Clear user from locals
	locals.user = null;

	return json({ success: true });
};
