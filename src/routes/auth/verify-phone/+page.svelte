<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let phoneNumber = $state('');
	let verificationCode = $state('');
	let status = $state<'idle' | 'sending' | 'verifying' | 'error'>('idle');
	let errorMessage = $state('');
	let codeSent = $state(false);

	onMount(async () => {
		// Check URL query param first (for SMS links)
		const phoneFromUrl = $page.url.searchParams.get('p');
		if (phoneFromUrl) {
			phoneNumber = decodeURIComponent(phoneFromUrl);
		}

		// Fallback to localStorage for phone number
		if (!phoneNumber) {
			const storedPhone = localStorage.getItem('tbr-claim-phone');
			if (storedPhone) {
				phoneNumber = storedPhone;
			}
		}

		// Auto-send code if we have a phone number
		if (phoneNumber && !codeSent) {
			await sendCode();
		}
	});

	async function sendCode() {
		if (!phoneNumber) {
			errorMessage = 'Please enter a phone number';
			status = 'error';
			return;
		}

		status = 'sending';
		errorMessage = '';

		try {
			await auth.sendPhoneVerification(phoneNumber);
			codeSent = true;
			status = 'idle';
		} catch (err) {
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Failed to send verification code';
		}
	}

	async function handleVerify(e: Event) {
		e.preventDefault();

		if (verificationCode.length !== 6) {
			errorMessage = 'Please enter a 6-digit code';
			status = 'error';
			return;
		}

		status = 'verifying';
		errorMessage = '';

		try {
			await auth.verifyPhone(phoneNumber, verificationCode);

			// Clear stored phone from localStorage
			localStorage.removeItem('tbr-claim-phone');

			// Redirect to username setup
			goto('/auth/username');
		} catch (err) {
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Invalid or expired code';
		}
	}

	async function handlePhoneSubmit(e: Event) {
		e.preventDefault();
		await sendCode();
	}
</script>

<svelte:head>
	<title>Verify Phone - TBR.FYI</title>
</svelte:head>

<div class="auth-page">
	<div class="auth-container">
		<div class="text-center">
			<h1 class="auth-title">Verify Your Phone</h1>
			<p class="auth-subtitle">
				We need to verify ownership of your TBR shelf
			</p>
		</div>

		{#if !codeSent}
			<!-- Enter phone number -->
			<form onsubmit={handlePhoneSubmit} class="space-y-6 mt-8">
				<div>
					<label for="phone" class="block text-sm font-medium text-[var(--text-primary)]">
						Phone Number
					</label>
					<div class="mt-1">
						<input
							id="phone"
							type="tel"
							bind:value={phoneNumber}
							disabled={status === 'sending'}
							placeholder="+1 (555) 123-4567"
							class="auth-input"
							required
						/>
					</div>
					<p class="mt-1 text-xs text-[var(--text-secondary)]">
						Enter the phone number associated with your TBR shelf
					</p>
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
						<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Sending code...
					{:else}
						Send verification code
					{/if}
				</button>
			</form>
		{:else}
			<!-- Enter verification code -->
			<div class="bg-green-50 border border-green-200 rounded-md p-4 mt-8 mb-6">
				<p class="text-sm text-green-800">
					We sent a 6-digit code to <strong>{phoneNumber}</strong>
				</p>
			</div>

			<form onsubmit={handleVerify} class="space-y-6">
				<div>
					<label for="code" class="block text-sm font-medium text-[var(--text-primary)]">
						Verification Code
					</label>
					<div class="mt-1">
						<input
							id="code"
							type="text"
							inputmode="numeric"
							maxlength="6"
							bind:value={verificationCode}
							disabled={status === 'verifying'}
							class="auth-input text-center text-2xl tracking-widest"
							placeholder="000000"
							oninput={(e) => {
								const target = e.target as HTMLInputElement;
								verificationCode = target.value.replace(/\D/g, '');
							}}
							required
						/>
					</div>
					<p class="mt-1 text-xs text-[var(--text-secondary)]">
						Enter the 6-digit code from your SMS
					</p>
					{#if status === 'error' && errorMessage}
						<p class="mt-2 text-sm text-red-600">
							{errorMessage}
						</p>
					{/if}
				</div>

				<button
					type="submit"
					disabled={status === 'verifying' || verificationCode.length !== 6}
					class="auth-button"
				>
					{#if status === 'verifying'}
						<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Verifying...
					{:else}
						Verify code
					{/if}
				</button>

				<div class="text-center">
					<button
						type="button"
						onclick={sendCode}
						disabled={status === 'sending'}
						class="text-sm font-medium auth-link disabled:opacity-50"
					>
						Resend code
					</button>
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
