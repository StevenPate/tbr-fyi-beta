/**
 * Authentication and Authorization Utilities
 *
 * Provides helpers for extracting and validating user IDs from requests.
 */

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
