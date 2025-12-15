<script lang="ts">
	// This page is only briefly visible during server-side redirect
	// The actual verification happens in +page.server.ts
</script>

<svelte:head>
	<title>Verifying Email - TBR.FYI</title>
</svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4">
	<div class="text-center">
		<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
		<h1 class="text-2xl font-bold text-gray-900">Verifying your email...</h1>
		<p class="mt-2 text-gray-600">Please wait while we log you in.</p>
	</div>
</div>
