/**
 * Authentication and Authorization Utilities
 *
 * Session-based authentication using locals.user populated by hooks.server.ts
 */

import type { RequestEvent } from '@sveltejs/kit';

export interface AuthUser {
	/**
	 * Unique identifier for the authenticated user.
	 * For the current MVP, we reuse the phone number as the identifier.
	 */
	id: string;
	/**
	 * Primary phone number associated with the user.
	 */
	phone?: string | null;
	phone_number?: string;
	/**
	 * Additional metadata about the user (matches Supabase auth shape).
	 */
	user_metadata?: {
		phone?: string;
		phone_number?: string;
	};
}

/**
 * Get the authenticated user from session (populated by hooks.server.ts)
 * Returns null if not authenticated.
 */
export function getSessionUser(event: RequestEvent): User | null {
	return event.locals.user || null;
}

/**
 * Require authenticated user from session.
 * Throws 401 error if not authenticated.
 */
export function requireSessionUser(event: RequestEvent): User {
	const user = event.locals.user;
	if (!user) {
		throw new Error('Authentication required');
	}
	return user;
}

/**
 * Get the authenticated user's ID (phone_number) from session.
 * Returns null if not authenticated.
 */
export function getSessionUserId(event: RequestEvent): string | null {
	return event.locals.user?.phone_number || null;
}

/**
 * Require authenticated user ID from session.
 * Throws error if not authenticated.
 */
export function requireSessionUserId(event: RequestEvent): string {
	const userId = event.locals.user?.phone_number;
	if (!userId) {
		throw new Error('Authentication required');
	}
	return userId;
}

/**
 * @deprecated Use getSessionUserId instead. Referer-based auth is insecure.
 *
 * Extracts user ID from the referer header.
 * The user ID is expected to be the first path segment (e.g., /+15551234567)
 *
 * @param request - The incoming request object
 * @returns The extracted user ID or null if not found/invalid
 */
export function getUserIdFromReferer(request: Request): string | null {
	const referer = request.headers.get('referer');
	if (!referer) return null;

	try {
		const url = new URL(referer);
		const pathSegments = url.pathname.split('/').filter(Boolean);
		if (pathSegments.length === 0) return null;

		// First segment is the username/phone number
		const userIdRaw = pathSegments[0];
		if (!userIdRaw) return null;

		// Decode URL encoding (e.g., %2B -> +)
		return decodeURIComponent(userIdRaw);
	} catch {
		return null;
	}
}

/**
 * @deprecated Use getSessionUser instead. Referer-based auth is insecure.
 */
export function getAuthUserFromRequest(request: Request): AuthUser | null {
	const userId = getUserIdFromReferer(request);
	if (!userId) {
		return null;
	}

	return {
		id: userId,
		phone: userId,
		phone_number: userId,
		user_metadata: { phone_number: userId, phone: userId }
	};
}

/**
 * Safely extract the canonical user ID from an AuthUser structure.
 */
type PhoneLikeUser = Pick<AuthUser, 'phone' | 'phone_number' | 'user_metadata'>;

export function getAuthUserId(authUser: PhoneLikeUser | null | undefined): string | null {
	if (!authUser) {
		return null;
	}

	if (authUser.phone_number) {
		return authUser.phone_number;
	}

	if (authUser.phone) {
		return authUser.phone;
	}

	return authUser.user_metadata?.phone_number || authUser.user_metadata?.phone || null;
}

/**
 * @deprecated Use requireSessionUserId instead. Referer-based auth is insecure.
 */
export function requireUserId(request: Request): string {
	const userId = getUserIdFromReferer(request);
	if (!userId) {
		throw new Error('User ID could not be determined from request');
	}
	return userId;
}

/**
 * Resolve an identifier (username, phone, or email_user_*) to actual phone_number (user_id)
 *
 * URL paths can contain usernames (/steven), phone numbers (/+15551234567),
 * or email user IDs (/email_user_uuid). This function resolves any of these
 * to the canonical phone_number used as user_id in the database.
 *
 * @param identifier - The URL identifier to resolve
 * @returns The actual phone_number (user_id) or null if not found
 */
export async function resolveIdentifierToUserId(identifier: string): Promise<string | null> {
	// Phone numbers and email_user_* are already user_ids
	if (identifier.startsWith('+') || identifier.startsWith('email_user_')) {
		return identifier;
	}

	// Username lookup
	const { data } = await supabase
		.from('users')
		.select('phone_number')
		.eq('username', identifier)
		.single();

	return data?.phone_number || null;
}

/**
 * Session Management
 * Secure cookie-based sessions with token hashing
 */

import { randomBytes, createHash } from 'crypto';
import { dev } from '$app/environment';
import { supabase } from '$lib/server/supabase';

export interface User {
	phone_number: string;
	email: string | null;
	username: string | null;
	display_name: string | null;
	verified_at: string | null;
	created_at: string;
}

// Generate secure token and hash
export function generateSessionToken(): { token: string; hash: string } {
	const token = randomBytes(32).toString('base64url');
	const hash = createHash('sha256').update(token).digest('hex');
	return { token, hash };
}

// Environment-aware cookie settings
export const COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	secure: !dev, // Only require HTTPS in production
	sameSite: 'lax' as const,
	maxAge: 60 * 60 * 24 * 7 // 7 days
};

// Get or create user - handles both phone and email users
export async function getOrCreateUser(params: {
	phone?: string;
	email?: string;
}): Promise<User> {
	if (params.phone) {
		// Phone user - phone_number is the natural PK
		const { data: existing } = await supabase
			.from('users')
			.select('*')
			.eq('phone_number', params.phone)
			.single();

		if (existing) return existing as User;

		const { data: newUser } = await supabase
			.from('users')
			.insert({
				phone_number: params.phone,
				verified_at: new Date().toISOString()
			})
			.select()
			.single();

		return newUser as User;
	} else if (params.email) {
		// Email user - check for existing first!
		const { data: existing } = await supabase
			.from('users')
			.select('*')
			.eq('email', params.email)
			.single();

		if (existing) return existing as User; // Return existing email user

		// Only create new user if email doesn't exist
		const fakePhoneNumber = `email_user_${crypto.randomUUID()}`;

		const { data: user } = await supabase
			.from('users')
			.insert({
				phone_number: fakePhoneNumber, // Satisfies PK requirement
				email: params.email,
				verified_at: new Date().toISOString()
			})
			.select()
			.single();

		return user as User;
	}

	throw new Error('Either phone or email must be provided');
}
