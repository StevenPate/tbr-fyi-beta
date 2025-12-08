<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let phoneNumber = $state(data.phoneNumber || '');
	let verificationCode = $state('');
	let status = $state<'idle' | 'sending' | 'verifying' | 'error'>('idle');
	let errorMessage = $state('');
	let codeSent = $state(false);

	onMount(async () => {
		// Check localStorage for phone number if not in database
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

<div class="min-h-[80vh] flex items-center justify-center px-4">
	<div class="max-w-md w-full space-y-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-gray-900">Verify Your Phone</h1>
			<p class="mt-2 text-sm text-gray-600">
				We need to verify ownership of your TBR shelf
			</p>
		</div>

		{#if !codeSent}
			<!-- Enter phone number -->
			<form onsubmit={handlePhoneSubmit} class="space-y-6">
				<div>
					<label for="phone" class="block text-sm font-medium text-gray-700">
						Phone Number
					</label>
					<div class="mt-1">
						<input
							id="phone"
							type="tel"
							bind:value={phoneNumber}
							disabled={status === 'sending'}
							placeholder="+1 (555) 123-4567"
							class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
							required
						/>
					</div>
					<p class="mt-1 text-xs text-gray-500">
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
					class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
			<div class="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
				<p class="text-sm text-green-800">
					We sent a 6-digit code to <strong>{phoneNumber}</strong>
				</p>
			</div>

			<form onsubmit={handleVerify} class="space-y-6">
				<div>
					<label for="code" class="block text-sm font-medium text-gray-700">
						Verification Code
					</label>
					<div class="mt-1">
						<input
							id="code"
							type="text"
							inputmode="numeric"
							pattern="[0-9]{6}"
							maxlength="6"
							bind:value={verificationCode}
							disabled={status === 'verifying'}
							class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 text-center text-2xl tracking-widest"
							placeholder="000000"
							required
						/>
					</div>
					<p class="mt-1 text-xs text-gray-500">
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
					class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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
						class="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50"
					>
						Resend code
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>