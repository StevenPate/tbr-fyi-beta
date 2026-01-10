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
			goto(`/${username}`);
		} catch (err) {
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to set username';
		}
	}
</script>

<svelte:head>
	<title>Choose Username - TBR.FYI</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-container">
		<div class="text-center">
			<h1 class="auth-title">Choose Your Username</h1>
			<p class="auth-subtitle">
				This will be your custom URL: tbr.fyi/{username || 'username'}
			</p>
		</div>

		<div class="bg-green-50 border border-green-200 rounded-md p-4 mt-8">
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

		<form onsubmit={handleSubmit} class="space-y-6 mt-6">
			<div>
				<label for="username" class="block text-sm font-medium text-[var(--text-primary)]">
					Username
				</label>
				<div class="mt-1 relative">
					<input
						id="username"
						type="text"
						bind:value={username}
						disabled={status === 'submitting'}
						class="auth-input"
						placeholder="bookworm123"
						pattern="[a-zA-Z0-9_-]+"
						minlength="3"
						maxlength="20"
						required
					/>
					{#if status === 'checking'}
						<div class="absolute inset-y-0 right-0 flex items-center pr-3">
							<svg class="animate-spin h-4 w-4 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24">
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
				<p class="mt-1 text-xs text-[var(--text-secondary)]">
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
				class="auth-button"
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

		<div class="text-center mt-4">
			<p class="text-xs text-[var(--text-secondary)]">
				You can always change your username later in settings.
			</p>
		</div>
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

	.auth-container {
		max-width: 28rem;
		width: 100%;
	}

	.auth-title {
		font-size: 1.875rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.auth-subtitle {
		margin-top: 8px;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.auth-input {
		appearance: none;
		display: block;
		width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
		font-size: 0.875rem;
		color: var(--text-primary);
		background: var(--surface);
		transition: border-color 0.2s;
	}

	.auth-input::placeholder {
		color: #a8a39e;
	}

	.auth-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(196, 166, 124, 0.2);
	}

	.auth-input:disabled {
		opacity: 0.5;
	}

	.auth-button {
		width: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 10px 16px;
		border: none;
		border-radius: 8px;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
		background: var(--accent);
		cursor: pointer;
		transition: background 0.2s;
	}

	.auth-button:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.auth-button:focus {
		outline: none;
		box-shadow: 0 0 0 3px rgba(196, 166, 124, 0.3);
	}

	.auth-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
