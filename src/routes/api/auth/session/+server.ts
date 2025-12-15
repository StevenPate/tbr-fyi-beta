import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { COOKIE_OPTIONS } from '$lib/server/auth';
import { supabase } from '$lib/server/supabase';
import { createHash } from 'crypto';

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
	// Get token before clearing
	const sessionToken = cookies.get('tbr_session');

	if (sessionToken) {
		// Delete session from database
		const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
		await supabase.from('sessions').delete().eq('token_hash', tokenHash);
	}

	// Clear cookie regardless
	cookies.delete('tbr_session', { path: '/' });

	// Clear user from locals
	locals.user = null;

	return json({ success: true });
};
