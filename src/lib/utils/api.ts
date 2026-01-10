// API utility with automatic 401 handling
// Shows sign-in prompt when session is expired

import { authPrompt } from '$lib/stores/auth-prompt';

/**
 * Wrapper around fetch that triggers sign-in prompt on 401 responses.
 * Use this for API calls that require authentication.
 */
export async function apiFetch(
	url: string,
	options?: RequestInit
): Promise<Response> {
	const response = await fetch(url, options);

	if (response.status === 401) {
		// Try to get error message from response
		const data = await response.clone().json().catch(() => ({}));
		authPrompt.trigger(data.error || 'Please sign in to continue');
	}

	return response;
}
