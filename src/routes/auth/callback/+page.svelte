<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let processing = $state(true);
	let error = $state<string | null>(null);

	// Parse hash parameters from URL
	function parseHashParams(hash: string) {
		const params: Record<string, string> = {};
		const hashWithoutHash = hash.substring(1); // Remove the # character
		const pairs = hashWithoutHash.split('&');

		for (const pair of pairs) {
			const [key, value] = pair.split('=');
			if (key) {
				params[key] = decodeURIComponent(value || '');
			}
		}

		return params;
	}

	onMount(async () => {
		if (!browser) return;

		console.log('[Callback] Processing magic link...', { serverData: data });

		// Check if server already authenticated us
		if (data.status === 'authenticated' && data.redirect) {
			console.log('[Callback] Already authenticated, redirecting to:', data.redirect);
			await goto(data.redirect);
			return;
		}

		// Check if we're on the wrong port and redirect
		if (window.location.port === '3000') {
			window.location.href = `http://localhost:5173/auth/callback${window.location.hash}`;
			return;
		}

		// Get the hash from either the URL or sessionStorage
		let hash = window.location.hash;
		if (!hash || hash === '#') {
			// Try to get it from sessionStorage (set by claim page)
			hash = sessionStorage.getItem('auth-hash') || '';
			console.log('[Callback] Retrieved hash from sessionStorage:', hash);
		} else {
			console.log('[Callback] Hash from URL:', hash);
		}

		// Parse the hash to get tokens
		const hashParams = parseHashParams(hash);
		console.log('[Callback] Hash params:', hashParams);

		// Check if we have the required tokens
		if (!hashParams.access_token) {
			console.error('[Callback] No access_token in hash');
			error = 'Invalid magic link. Please request a new one.';
			processing = false;
			setTimeout(async () => {
				await goto('/auth/claim?error=invalid_link');
			}, 2000);
			return;
		}

		try {
			// Manually set the session with the tokens from the hash
			console.log('[Callback] Setting session manually...');
			const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
				access_token: hashParams.access_token,
				refresh_token: hashParams.refresh_token
			});

			if (setSessionError) {
				console.error('[Callback] Error setting session:', setSessionError);
				throw setSessionError;
			}

			if (sessionData.session) {
				console.log('[Callback] Session set successfully!', sessionData.session.user?.email);

				// Clear the attempt counter and stored hash
				sessionStorage.removeItem('auth-attempts');
				sessionStorage.removeItem('auth-hash');

				// Give cookies time to be set
				await new Promise(resolve => setTimeout(resolve, 500));

				// Reload to check server-side session and get redirect
				console.log('[Callback] Reloading to check server-side session...');
				window.location.reload();
			} else {
				throw new Error('No session returned after setSession');
			}
		} catch (err) {
			console.error('[Callback] Failed to set session:', err);
			error = 'Failed to authenticate. Please try again.';
			processing = false;

			// Clear attempts and redirect back to claim
			sessionStorage.removeItem('auth-attempts');
			sessionStorage.removeItem('auth-hash');
			setTimeout(async () => {
				await goto('/auth/claim?error=auth_failed');
			}, 2000);
		}
	});
</script>

<svelte:head>
	<title>Authenticating - TBR.FYI</title>
</svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4">
	<div class="max-w-md w-full text-center">
		{#if processing}
			<svg class="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
			<h2 class="text-2xl font-semibold text-gray-900">Authenticating...</h2>
			<p class="mt-2 text-sm text-gray-600">Setting up your account</p>
		{:else if error}
			<div class="rounded-full bg-red-100 h-12 w-12 flex items-center justify-center mx-auto mb-4">
				<svg class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</div>
			<h2 class="text-2xl font-semibold text-gray-900">Authentication failed</h2>
			<p class="mt-2 text-sm text-gray-600">{error}</p>
			<p class="mt-4 text-sm text-gray-500">Redirecting...</p>
		{/if}
	</div>
</div>