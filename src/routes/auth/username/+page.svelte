<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let username = $state('');
	let status = $state<'idle' | 'checking' | 'submitting' | 'error'>('idle');
	let errorMessage = $state('');
	let usernameAvailable = $state<boolean | null>(null);
	let checkTimeout: number;

	async function checkAvailability() {
		clearTimeout(checkTimeout);
		usernameAvailable = null;

		if (username.length < 3) return;

		status = 'checking';
		checkTimeout = window.setTimeout(async () => {
			try {
				const response = await fetch(`/api/auth/username?username=${encodeURIComponent(username)}`);
				const data = await response.json();
				usernameAvailable = data.available;
				status = 'idle';
			} catch {
				usernameAvailable = null;
				status = 'idle';
			}
		}, 500);
	}

	$effect(() => {
		if (username) {
			checkAvailability();
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!username || username.length < 3) {
			errorMessage = 'Username must be at least 3 characters';
			status = 'error';
			return;
		}

		if (usernameAvailable === false) {
			errorMessage = 'This username is already taken';
			status = 'error';
			return;
		}

		status = 'submitting';
		errorMessage = '';

		try {
			await auth.setUsername(username);

			// Redirect to their new shelf
			goto(`/@${username}`);
		} catch (err) {
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to set username';
		}
	}
</script>

<svelte:head>
	<title>Choose Username - TBR.FYI</title>
</svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4">
	<div class="max-w-md w-full space-y-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-gray-900">Choose Your Username</h1>
			<p class="mt-2 text-sm text-gray-600">
				This will be your custom URL: tbr.fyi/@{username || 'username'}
			</p>
		</div>

		<div class="bg-green-50 border border-green-200 rounded-md p-4">
			<h3 class="text-sm font-medium text-green-800 mb-2">Account verified!</h3>
			<p class="text-sm text-green-700">
				{#if data.userEmail}
					Email: <strong>{data.userEmail}</strong>
				{/if}
				{#if data.phoneNumber}
					{#if data.userEmail}<br />{/if}
					Phone: <strong>{data.phoneNumber}</strong>
				{/if}
			</p>
		</div>

		<form onsubmit={handleSubmit} class="space-y-6">
			<div>
				<label for="username" class="block text-sm font-medium text-gray-700">
					Username
				</label>
				<div class="mt-1 relative">
					<input
						id="username"
						type="text"
						bind:value={username}
						disabled={status === 'submitting'}
						class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
						placeholder="bookworm123"
						pattern="[a-zA-Z0-9_-]+"
						minlength="3"
						maxlength="20"
						required
					/>
					{#if status === 'checking'}
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
				{#if status === 'error' && errorMessage}
					<p class="mt-2 text-sm text-red-600">
						{errorMessage}
					</p>
				{/if}
			</div>

			<button
				type="submit"
				disabled={status === 'submitting' || status === 'checking' || !username || usernameAvailable === false}
				class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
			>
				{#if status === 'submitting'}
					<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Creating username...
				{:else}
					Complete setup
				{/if}
			</button>
		</form>

		<div class="text-center">
			<p class="text-xs text-gray-500">
				You can always change your username later in settings.
			</p>
		</div>
	</div>
</div>