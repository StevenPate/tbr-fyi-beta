<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';

	let email = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);

	async function handleSignUp(e: Event) {
		e.preventDefault();
		error = null;
		loading = true;

		try {
			await auth.signUpWithEmail(email);
			success = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send magic link';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign Up - TBR.FYI</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-container">
		<div>
			<h2 class="auth-title">
				Create your account
			</h2>
			<p class="auth-subtitle">
				Join TBR.FYI to secure your reading list and unlock new features
			</p>
		</div>

		{#if success}
			<div class="rounded-md bg-green-50 border border-green-200 p-4 mt-6">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-green-800">Check your email!</h3>
						<div class="mt-2 text-sm text-green-700">
							<p>
								We've sent a magic link to <strong>{email}</strong>.
								Click the link in the email to complete your sign up.
							</p>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<form class="mt-8 space-y-6" onsubmit={handleSignUp}>
				{#if error}
					<div class="rounded-md bg-red-50 border border-red-200 p-4">
						<div class="text-sm text-red-700">{error}</div>
					</div>
				{/if}

				<div class="benefits-box">
					<h3 class="text-sm font-medium text-[var(--text-primary)] mb-2">Account benefits:</h3>
					<ul class="text-sm text-[var(--text-secondary)] space-y-1">
						<li class="flex items-start">
							<svg class="h-4 w-4 text-[var(--accent)] mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
							<span>Get a custom username (@yourusername)</span>
						</li>
						<li class="flex items-start">
							<svg class="h-4 w-4 text-[var(--accent)] mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
							<span>Make your shelves private or public</span>
						</li>
						<li class="flex items-start">
							<svg class="h-4 w-4 text-[var(--accent)] mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
							<span>Access from any device</span>
						</li>
						<li class="flex items-start">
							<svg class="h-4 w-4 text-[var(--accent)] mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
							</svg>
							<span>Keep using SMS to add books</span>
						</li>
					</ul>
				</div>

				<div>
					<label for="email" class="block text-sm font-medium text-[var(--text-primary)]">
						Email address
					</label>
					<div class="mt-1">
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							disabled={loading}
							class="auth-input"
							placeholder="you@example.com"
						/>
					</div>
				</div>

				<div>
					<button
						type="submit"
						disabled={loading}
						class="auth-button"
					>
						{#if loading}
							<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Creating account...
						{:else}
							Create account
						{/if}
					</button>
				</div>

				<div class="text-sm text-center">
					<span class="text-[var(--text-secondary)]">Already have an account? </span>
					<a href="/auth/signin" class="auth-link">
						Sign in
					</a>
				</div>
			</form>
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
		text-align: center;
		font-size: 1.875rem;
		font-weight: 700;
		color: var(--text-primary);
	}

	.auth-subtitle {
		margin-top: 8px;
		text-align: center;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.auth-link {
		font-weight: 500;
		color: var(--accent);
		transition: color 0.2s;
	}

	.auth-link:hover {
		color: var(--accent-hover);
	}

	.benefits-box {
		background: var(--paper-light);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 16px;
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
		cursor: not-allowed;
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
