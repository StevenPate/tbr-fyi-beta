<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let status = $state<'loading' | 'success' | 'error'>('loading');
	let errorMessage = $state('');
	let needsUsername = $state(false);

	onMount(async () => {
		// Handle the magic link verification
		const { data: { session }, error } = await supabase.auth.getSession();

		if (error) {
			status = 'error';
			errorMessage = error.message;
			return;
		}

		if (!session) {
			status = 'error';
			errorMessage = 'Invalid or expired link. Please try signing in again.';
			return;
		}

		// Check if user has a username already
		try {
			const response = await fetch('/api/auth/profile');
			const { data: profile } = await response.json();

			if (profile && !profile.username) {
				// New user needs to set username
				needsUsername = true;
				status = 'success';
				// Redirect to username selection
				setTimeout(() => {
					goto('/auth/username');
				}, 2000);
			} else {
				// Existing user with username
				status = 'success';
				// Redirect to their shelf or home
				setTimeout(() => {
					if (profile?.username) {
						goto(`/@${profile.username}`);
					} else {
						goto('/');
					}
				}, 2000);
			}
		} catch (err) {
			status = 'error';
			errorMessage = 'Failed to load profile. Please try again.';
		}
	});
</script>

<svelte:head>
	<title>Verifying - TBR.FYI</title>
</svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4">
	<div class="max-w-md w-full space-y-8">
		{#if status === 'loading'}
			<div class="text-center">
				<svg class="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<h2 class="text-2xl font-semibold text-gray-900">Verifying your email...</h2>
				<p class="mt-2 text-sm text-gray-600">Please wait while we confirm your identity.</p>
			</div>
		{:else if status === 'success'}
			<div class="text-center">
				<div class="rounded-full bg-green-100 h-12 w-12 flex items-center justify-center mx-auto mb-4">
					<svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<h2 class="text-2xl font-semibold text-gray-900">Welcome to TBR.FYI!</h2>
				{#if needsUsername}
					<p class="mt-2 text-sm text-gray-600">
						Redirecting you to choose your username...
					</p>
				{:else}
					<p class="mt-2 text-sm text-gray-600">
						Redirecting you to your shelf...
					</p>
				{/if}
			</div>
		{:else}
			<div class="text-center">
				<div class="rounded-full bg-red-100 h-12 w-12 flex items-center justify-center mx-auto mb-4">
					<svg class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</div>
				<h2 class="text-2xl font-semibold text-gray-900">Verification failed</h2>
				<p class="mt-2 text-sm text-gray-600">{errorMessage}</p>
				<div class="mt-6">
					<a
						href="/auth/signin"
						class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
					>
						Try signing in again
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>