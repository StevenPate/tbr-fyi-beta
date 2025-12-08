<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabase';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';

	onMount(async () => {
		if (!browser) return;

		console.log('[AuthHandler] Checking for magic link token...');
		console.log('[AuthHandler] Current URL:', window.location.href);
		console.log('[AuthHandler] Hash:', window.location.hash);

		// Check if there's a magic link token in the URL hash
		if (!window.location.hash || !window.location.hash.includes('access_token')) {
			console.log('[AuthHandler] No magic link token found');
			return; // No magic link to process
		}

		console.log('[AuthHandler] Magic link detected, processing...');

		// Parse the hash to get tokens
		const hashParams = new URLSearchParams(window.location.hash.substring(1));
		const access_token = hashParams.get('access_token');
		const refresh_token = hashParams.get('refresh_token');

		if (!access_token || !refresh_token) {
			console.error('[AuthHandler] Missing tokens in hash');
			return;
		}

		try {
			// Set the session with the tokens
			console.log('[AuthHandler] Setting session...');
			const { data, error: setSessionError } = await supabase.auth.setSession({
				access_token,
				refresh_token
			});

			if (setSessionError) {
				console.error('[AuthHandler] Error setting session:', setSessionError);
				// Clear the hash and show error
				const currentPage = get(page);
				replaceState(currentPage.url.pathname + currentPage.url.search, {});
				await goto('/auth/claim?error=auth_failed');
				return;
			}

			if (data.session) {
				console.log('[AuthHandler] Session established!', data.session.user?.email);

				// Clear the hash from URL
				const currentPage = get(page);
				replaceState(currentPage.url.pathname + currentPage.url.search, {});

				// Wait for cookies to be set
				await new Promise(resolve => setTimeout(resolve, 1000));

				// Check if we have a stored phone number
				const storedPhone = localStorage.getItem('tbr-claim-phone');

				// Determine where to redirect based on auth status
				const { data: { user } } = await supabase.auth.getUser();
				if (!user) {
					console.error('[AuthHandler] No user after setting session');
					return;
				}

				// Check if user has a profile
				// Try to find user by email first (in case auth_id column doesn't exist yet)
				console.log('[AuthHandler] Checking for user profile with email:', user.email);
				let profile = null;
				let profileError = null;

				try {
					// First try with auth_id and email
					const { data, error } = await supabase
						.from('users')
						.select('*')
						.or(`auth_id.eq.${user.id},email.eq."${user.email}"`)
						.maybeSingle();

					profile = data;
					profileError = error;
				} catch (err) {
					// If auth_id column doesn't exist, try just email
					console.log('[AuthHandler] Trying query with just email...');
					const { data, error } = await supabase
						.from('users')
						.select('*')
						.eq('email', user.email)
						.maybeSingle();

					profile = data;
					profileError = error;
				}

				if (profileError) {
					console.error('[AuthHandler] Error fetching profile:', profileError);
				}
				console.log('[AuthHandler] Profile found:', profile);

				if (!profile && storedPhone) {
					// New user with phone - go to phone verification
					console.log('[AuthHandler] Redirecting to phone verification');
					await goto('/auth/verify-phone');
				} else if (!profile) {
					// New user without phone - go to phone verification
					console.log('[AuthHandler] Redirecting to phone setup');
					await goto('/auth/verify-phone');
				} else if (!profile.username) {
					// Existing user without username
					console.log('[AuthHandler] Redirecting to username setup');
					await goto('/auth/username');
				} else {
					// Complete profile - go to shelf
					console.log('[AuthHandler] Redirecting to shelf');
					await goto(`/@${profile.username}`);
				}
			}
		} catch (err) {
			console.error('[AuthHandler] Failed to process magic link:', err);
			// Clear the hash
			const currentPage = get(page);
			replaceState(currentPage.url.pathname + currentPage.url.search, {});
			await goto('/auth/claim?error=auth_failed');
		}
	});
</script>

<!-- This component has no visual output, it just handles auth in the background -->