import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabase } from '$lib/server/supabase';
import { getOrCreateUser, generateSessionToken, COOKIE_OPTIONS } from '$lib/server/auth';
import { fetchBookMetadata, toISBN13 } from '$lib/server/metadata';
import { upsertBookForUser } from '$lib/server/book-operations';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const token = url.searchParams.get('token');
	const email = url.searchParams.get('email');

	if (!token || !email) {
		throw redirect(303, '/auth/verify-email?error=invalid_link');
	}

	// Normalize email to lowercase for consistent lookup
	const normalizedEmail = email.toLowerCase().trim();

	try {
		// Verify token (check it exists and is valid)
		const { data: verificationCode } = await supabase
			.from('verification_codes')
			.select('*')
			.eq('identifier', normalizedEmail)
			.eq('code', token)
			.eq('code_type', 'email_token') // Must check email_token type
			.is('used_at', null)
			.gt('expires_at', new Date().toISOString())
			.single();

		if (!verificationCode) {
			throw redirect(303, '/auth/verify-email?error=invalid_or_expired');
		}

		// Mark token as used
		await supabase
			.from('verification_codes')
			.update({ used_at: new Date().toISOString() })
			.eq('id', verificationCode.id);

		// Get or create user - handles existing email users correctly!
		const user = await getOrCreateUser({ email: normalizedEmail });

		// Create session with phone_number as user_id
		const { token: sessionToken, hash } = generateSessionToken();
		await supabase.from('sessions').insert({
			token_hash: hash,
			user_id: user.phone_number // Use phone_number (real or synthetic)
		});

		cookies.set('tbr_session', sessionToken, COOKIE_OPTIONS);

		// Check for isbn param from share flow - auto-add the book
		const isbn = url.searchParams.get('isbn');
		if (isbn) {
			try {
				const normalizedIsbn = toISBN13(isbn);
				const metadata = await fetchBookMetadata(normalizedIsbn);
				if (metadata) {
					await upsertBookForUser(user.phone_number, metadata);
				}
			} catch (e) {
				// Log but don't block redirect - user can still add manually
				console.warn('Auto-add from share failed:', e);
			}
		}

		// Get redirect URL if provided
		const redirectUrl = url.searchParams.get('redirect');

		// Redirect to username selection (new users) or shelf/redirect URL (existing users)
		if (!user.username) {
			// Pass along redirect and isbn params to username page
			const usernameUrl = new URL('/auth/username', url.origin);
			if (redirectUrl) usernameUrl.searchParams.set('redirect', redirectUrl);
			throw redirect(303, usernameUrl.toString());
		} else if (redirectUrl) {
			throw redirect(303, redirectUrl);
		} else {
			throw redirect(303, `/${user.username}`);
		}
	} catch (error) {
		// If it's already a redirect (SvelteKit Redirect object), re-throw it
		if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
			throw error;
		}

		console.error('Error in confirm:', error);
		throw redirect(303, '/auth/verify-email?error=server_error');
	}
};
