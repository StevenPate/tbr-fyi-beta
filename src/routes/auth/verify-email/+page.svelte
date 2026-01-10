<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { page } from '$app/stores';

	let email = $state('');
	let status = $state<'idle' | 'sending' | 'sent' | 'error'>('idle');
	let errorMessage = $state('');

	// Check for error from redirect
	const urlError = $derived($page.url.searchParams.get('error'));
	const errorMessages: Record<string, string> = {
		invalid_link: 'Invalid verification link. Please request a new one.',
		invalid_or_expired: 'Verification link has expired. Please request a new one.',
		server_error: 'An error occurred. Please try again.'
	};

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!email) {
			errorMessage = 'Please enter your email address';
			status = 'error';
			return;
		}

		status = 'sending';
		errorMessage = '';

		try {
			await auth.signInWithEmail(email);
			status = 'sent';
		} catch (err) {
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to send verification email';
		}
	}
</script>

<svelte:head>
	<title>Verify Email - TBR.FYI</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-container">
		<div class="text-center">
			<h1 class="auth-title">Sign in with Email</h1>
			<p class="auth-subtitle">
				We'll send you a magic link to verify your email
			</p>
		</div>

		{#if urlError && errorMessages[urlError]}
			<div class="bg-red-50 border border-red-200 rounded-md p-4 mt-6">
				<p class="text-sm text-red-800">{errorMessages[urlError]}</p>
			</div>
		{/if}

		{#if status === 'sent'}
			<!-- Success message -->
			<div class="bg-green-50 border border-green-200 rounded-md p-4 mt-6">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clip-rule="evenodd"
							/>
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-green-800">Check your email!</h3>
						<div class="mt-2 text-sm text-green-700">
							<p>
								We sent a verification link to <strong>{email}</strong>. Click the link in
								the email to continue.
							</p>
							<p class="mt-2 text-xs">The link will expire in 10 minutes.</p>
						</div>
					</div>
				</div>
			</div>

			<div class="text-center mt-4">
				<button
					onclick={() => (status = 'idle')}
					class="text-sm font-medium auth-link"
				>
					Use a different email
				</button>
			</div>
		{:else}
			<!-- Email form -->
			<form onsubmit={handleSubmit} class="space-y-6 mt-8">
				<div>
					<label for="email" class="block text-sm font-medium text-[var(--text-primary)]">
						Email Address
					</label>
					<div class="mt-1">
						<input
							id="email"
							type="email"
							bind:value={email}
							disabled={status === 'sending'}
							placeholder="you@example.com"
							class="auth-input"
							required
						/>
					</div>
					{#if status === 'error' && errorMessage}
						<p class="mt-2 text-sm text-red-600">
							{errorMessage}
						</p>
					{/if}
				</div>

				<button
					type="submit"
					disabled={status === 'sending'}
					class="auth-button"
				>
					{#if status === 'sending'}
						<svg
							class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Sending magic link...
					{:else}
						Send magic link
					{/if}
				</button>
			</form>

			<div class="text-center text-sm text-[var(--text-secondary)] mt-6">
				<p>
					Have a phone-based shelf?
					<a href="/auth/verify-phone" class="font-medium auth-link">
						Sign in with phone
					</a>
				</p>
			</div>
		{/if}
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

	.auth-link {
		color: var(--accent);
		transition: color 0.2s;
	}

	.auth-link:hover {
		color: var(--accent-hover);
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
