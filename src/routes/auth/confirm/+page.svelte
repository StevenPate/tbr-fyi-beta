<script lang="ts">
	// This page is only briefly visible during server-side redirect
	// The actual verification happens in +page.server.ts
</script>

<svelte:head>
	<title>Verifying Email - TBR.FYI</title>
</svelte:head>

<div class="auth-page">
	<div class="text-center">
		<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mb-4"></div>
		<h1 class="text-2xl font-bold text-[var(--text-primary)]">Verifying your email...</h1>
		<p class="mt-2 text-[var(--text-secondary)]">Please wait while we log you in.</p>
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
