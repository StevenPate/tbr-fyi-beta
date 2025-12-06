/**
 * Authentication and Authorization Utilities
 *
 * Provides helpers for extracting and validating user IDs from requests.
 * Supports both session-based auth (via Supabase Auth) and legacy phone-based auth.
 */

import { supabase } from '$lib/server/supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Gets authenticated user from Authorization header
 * @param request - The incoming request object
 * @returns The authenticated user or null if not authenticated
 */
async function getUserFromAuthHeader(request: Request): Promise<User | null> {
	const authHeader = request.headers.get('authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}

	const token = authHeader.slice(7); // Remove 'Bearer ' prefix

	try {
		const { data: { user }, error } = await supabase.auth.getUser(token);
		if (error || !user) {
			return null;
		}
		return user;
	} catch {
		return null;
	}
}

/**
 * Gets user profile from authenticated user
 * @param authUser - The authenticated user from Supabase Auth
 * @returns The user ID (phone_number) from users table
 */
async function getUserIdFromAuthUser(authUser: User): Promise<string | null> {
	const { data, error } = await supabase
		.from('users')
		.select('phone_number')
		.eq('auth_id', authUser.id)
		.single();

	if (error || !data) {
		// Try by email as fallback
		const { data: emailData, error: emailError } = await supabase
			.from('users')
			.select('phone_number')
			.eq('email', authUser.email)
			.single();

		if (emailError || !emailData) {
			return null;
		}
		return emailData.phone_number;
	}

	return data.phone_number;
}

/**
 * Extracts user ID from the referer header.
 * The user ID is expected to be the first path segment (e.g., /+13123756327)
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
 * Gets user ID from request, checking auth session first, then referer
 * @param request - The incoming request object
 * @returns The user ID or null if not found
 */
export async function getUserId(request: Request): Promise<string | null> {
	// Check session auth first
	const authUser = await getUserFromAuthHeader(request);
	if (authUser) {
		const userId = await getUserIdFromAuthUser(authUser);
		if (userId) {
			return userId;
		}
	}

	// Fall back to referer-based auth (legacy)
	return getUserIdFromReferer(request);
}

/**
 * Extracts user ID from referer and throws an error if not found.
 * Use this in endpoints that require authentication.
 *
 * @param request - The incoming request object
 * @returns The extracted user ID
 * @throws Error if user ID cannot be determined
 */
export function requireUserId(request: Request): string {
	const userId = getUserIdFromReferer(request);
	if (!userId) {
		throw new Error('User ID could not be determined from request');
	}
	return userId;
}

/**
 * Async version that checks auth session first, then referer
 * Use this in endpoints that require authentication.
 *
 * @param request - The incoming request object
 * @returns The extracted user ID
 * @throws Error if user ID cannot be determined
 */
export async function requireUserIdAsync(request: Request): Promise<string> {
	const userId = await getUserId(request);
	if (!userId) {
		throw new Error('User ID could not be determined from request');
	}
	return userId;
}

/**
 * Gets the authenticated user from the request
 * @param request - The incoming request object
 * @returns The authenticated user object or null
 */
export async function getAuthUser(request: Request): Promise<User | null> {
	return getUserFromAuthHeader(request);
}

/**
 * Check if a user owns a specific phone number
 * @param userId - The user ID to check
 * @param phoneNumber - The phone number to verify ownership of
 * @returns True if the user owns the phone number
 */
export async function userOwnsPhone(userId: string, phoneNumber: string): Promise<boolean> {
	const { data, error } = await supabase
		.from('users')
		.select('phone_number')
		.eq('phone_number', userId)
		.single();

	if (error || !data) {
		return false;
	}

	return data.phone_number === phoneNumber;
}
