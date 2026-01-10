<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	onMount(async () => {
		try {
			await auth.signOut();
		} catch (error) {
			console.error('Error signing out:', error);
		}
		// Redirect to home after signout
		goto('/');
	});
</script>

<div class="auth-page">
	<div class="text-center">
		<svg class="animate-spin h-12 w-12 text-[var(--accent)] mx-auto mb-4" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
		<h2 class="text-2xl font-semibold text-[var(--text-primary)]">Signing out...</h2>
	</div>
</div>

<style>
	.auth-page {
		font-family: var(--font-sans);
		background: var(--background);
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
</style>
