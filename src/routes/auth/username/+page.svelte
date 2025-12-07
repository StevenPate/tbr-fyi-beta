<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let username = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let checkingUsername = $state(false);
	let usernameAvailable = $state<boolean | null>(null);
	let isAuthenticated = $state(false);
	let checkTimeout: number;

	onMount(async () => {
		// Check if user is authenticated
		const session = await auth.getSession();
		if (!session) {
			// Redirect to signin if not authenticated
			goto('/auth/signin');
			return;
		}
		isAuthenticated = true;
	});

	function checkUsernameAvailability() {
		clearTimeout(checkTimeout);
		usernameAvailable = null;

		if (username.length < 3) return;

		checkingUsername = true;
		checkTimeout = window.setTimeout(async () => {
			try {
				const response = await fetch(`/api/auth/username?username=${encodeURIComponent(username)}`);
				const data = await response.json();
				usernameAvailable = data.available;
			} catch {
				usernameAvailable = null;
			} finally {
				checkingUsername = false;
			}
		}, 500);
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = null;
		loading = true;

		try {
			await auth.setUsername(username);
			// Redirect to their new shelf
			goto(`/@${username}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to set username';
			loading = false;
		}
	}

	$effect(() => {
		if (username) {
			checkUsernameAvailability();
		}
	});
</script>

<svelte:head>
	<title>Choose Username - TBR.FYI</title>
</svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4">
	<div class="max-w-md w-full space-y-8">
		<div>
			<h2 class="text-center text-3xl font-bold text-gray-900">
				Choose Your Username
			</h2>
			<p class="mt-2 text-center text-sm text-gray-600">
				This will be your custom URL: tbr.fyi/@{username || 'username'}
			</p>
		</div>

		{#if isAuthenticated}
			<form onsubmit={handleSubmit} class="space-y-6">
				{#if error}
					<div class="rounded-md bg-red-50 border border-red-200 p-4">
						<div class="text-sm text-red-700">{error}</div>
					</div>
				{/if}

				<div>
					<label for="username" class="block text-sm font-medium text-gray-700">
						Username
					</label>
					<div class="mt-1 relative">
						<input
							id="username"
							name="username"
							type="text"
							required
							bind:value={username}
							disabled={loading}
							class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
							placeholder="bookworm123"
						/>
						{#if checkingUsername}
							<div class="absolute inset-y-0 right-0 flex items-center pr-3">
								<svg class="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
							</div>
						{:else if usernameAvailable === true}
							<div class="absolute inset-y-0 right-0 flex items-center pr-3">
								<svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
								</svg>
							</div>
						{:else if usernameAvailable === false}
							<div class="absolute inset-y-0 right-0 flex items-center pr-3">
								<svg class="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
								</svg>
							</div>
						{/if}
					</div>
					<p class="mt-1 text-xs text-gray-500">
						3-20 characters, letters, numbers, underscores, and hyphens only
					</p>
					{#if usernameAvailable === false}
						<p class="mt-1 text-xs text-red-600">
							This username is already taken
						</p>
					{/if}
				</div>

				<button
					type="submit"
					disabled={loading || !username || usernameAvailable === false}
					class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
				>
					{#if loading}
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Creating username...
					{:else}
						Create Username
					{/if}
				</button>

				<div class="text-center">
					<button
						type="button"
						onclick={() => goto('/')}
						class="text-sm text-gray-500 hover:text-gray-700"
					>
						Skip for now
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>