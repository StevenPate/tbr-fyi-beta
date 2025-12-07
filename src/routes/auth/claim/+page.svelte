<script lang="ts">
	import { auth } from '$lib/stores/auth';
	import { supabase } from '$lib/supabase';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// States for the multi-step flow
	let currentStep = $state<'email' | 'verify-email' | 'verify-phone' | 'username' | 'complete'>('email');
	let email = $state('');
	let phoneNumber = $state('');
	let verificationCode = $state('');
	let username = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let emailVerified = $state(false);

	// Pre-fill phone number from URL or localStorage
	onMount(() => {
		// First check URL parameter
		const urlPhone = new URL(window.location.href).searchParams.get('p');
		if (urlPhone) {
			phoneNumber = decodeURIComponent(urlPhone);
		} else {
			// Fall back to localStorage if URL param not present
			const storedPhone = localStorage.getItem('tbr-claim-phone');
			if (storedPhone) {
				phoneNumber = storedPhone;
			}
		}

		// Start async initialization (fire and forget)
		const initAuth = async () => {
			// Initialize auth and watch for session changes
			await auth.initialize();

			// Listen for auth state changes via Supabase
			const { data: authListener } = supabase.auth.onAuthStateChange(async (_, session) => {
				if (session) {
					emailVerified = true;
					// If we verified email and have phone number, go to phone verification
					if (currentStep === 'verify-email' && phoneNumber) {
						// Auto-proceed to phone verification
						await sendVerificationCode();
					}
				}
			});

			// Return cleanup function
			return () => {
				authListener?.subscription.unsubscribe();
			};
		};

		// Execute init and store cleanup handler
		let unsubscribe: (() => void) | undefined;

		initAuth().then((cleanup) => {
			unsubscribe = cleanup;
		}).catch((err) => {
			console.error('Error initializing auth:', err);
		});

		// Return cleanup function for onMount
		return () => {
			unsubscribe?.();
		};
	});

	// Step 1: Submit email for magic link
	async function handleEmailSubmit(e: Event) {
		e.preventDefault();
		error = null;
		loading = true;

		try {
			// Store phone number in localStorage so it survives the magic link redirect
			if (phoneNumber) {
				localStorage.setItem('tbr-claim-phone', phoneNumber);
			}

			await auth.signUpWithEmail(email);
			// After magic link is sent, show email verification message
			currentStep = 'verify-email';
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send magic link';
			loading = false;
		}
	}

	// Step 2: Send verification code to phone
	async function sendVerificationCode() {
		error = null;
		loading = true;

		try {
			await auth.sendPhoneVerification(phoneNumber);
			currentStep = 'verify-phone';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send verification code';
		} finally {
			loading = false;
		}
	}

	// Step 3: Verify phone ownership
	async function handlePhoneVerification(e: Event) {
		e.preventDefault();
		error = null;
		loading = true;

		try {
			await auth.verifyPhone(phoneNumber, verificationCode);

			// Both branches move to username selection
			// Phone verification succeeded, move forward
			currentStep = 'username';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Invalid or expired code';
		} finally {
			loading = false;
		}
	}

	// Step 4: Set username
	async function handleUsernameSubmit(e: Event) {
		e.preventDefault();
		error = null;
		loading = true;

		try {
			await auth.setUsername(username);
			currentStep = 'complete';

			// Redirect to their new username URL
			setTimeout(() => {
				goto(`/@${username}`);
			}, 2000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to set username';
		} finally {
			loading = false;
		}
	}

	// Check username availability
	let checkingUsername = $state(false);
	let usernameAvailable = $state<boolean | null>(null);
	let checkTimeout: number;

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

	$effect(() => {
		if (username) {
			checkUsernameAvailability();
		}
	});
</script>

<svelte:head>
	<title>Claim Your Shelf - TBR.FYI</title>
</svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4">
	<div class="max-w-md w-full space-y-8">
		{#if currentStep === 'email'}
			<div>
				<h2 class="text-center text-3xl font-bold text-gray-900">
					Claim Your Shelf
				</h2>
				<p class="mt-2 text-center text-sm text-gray-600">
					Secure your reading list with a free account
				</p>
			</div>

			{#if phoneNumber}
				<div class="bg-blue-50 border border-blue-200 rounded-md p-4">
					<p class="text-sm text-blue-800">
						Claiming shelf for: <strong>{phoneNumber}</strong>
					</p>
				</div>
			{/if}

			<form onsubmit={handleEmailSubmit} class="space-y-6">
				{#if error}
					<div class="rounded-md bg-red-50 border border-red-200 p-4">
						<div class="text-sm text-red-700">{error}</div>
					</div>
				{/if}

				<div>
					<label for="email" class="block text-sm font-medium text-gray-700">
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
							class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
							placeholder="you@example.com"
						/>
					</div>
					<p class="mt-1 text-xs text-gray-500">
						We'll send you a magic link to verify your email
					</p>
				</div>

				{#if phoneNumber}
					<div>
						<label for="phone" class="block text-sm font-medium text-gray-700">
							Phone number
						</label>
						<div class="mt-1">
							<input
								id="phone"
								name="phone"
								type="tel"
								required
								bind:value={phoneNumber}
								disabled={loading}
								class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
								placeholder="+1 (555) 123-4567"
							/>
						</div>
						<p class="mt-1 text-xs text-gray-500">
							We'll text you a code to verify ownership
						</p>
					</div>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
				>
					{#if loading}
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Sending magic link...
					{:else}
						Continue
					{/if}
				</button>
			</form>

		{:else if currentStep === 'verify-email'}
			<div>
				<h2 class="text-center text-3xl font-bold text-gray-900">
					Check Your Email
				</h2>
				<p class="mt-2 text-center text-sm text-gray-600">
					We sent a magic link to <strong>{email}</strong>
				</p>
			</div>

			<div class="bg-green-50 border border-green-200 rounded-md p-4">
				<h3 class="text-sm font-medium text-green-800 mb-2">Next steps:</h3>
				<ol class="text-sm text-green-700 space-y-1 list-decimal list-inside">
					<li>Check your email for the magic link</li>
					<li>Click the link to verify your email</li>
					<li>Return here to verify your phone number</li>
				</ol>
			</div>

			<div class="space-y-4">
				<button
					onclick={sendVerificationCode}
					disabled={loading || !emailVerified}
					class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
				>
					{#if loading}
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Sending verification code...
					{:else}
						I've verified my email, continue
					{/if}
				</button>

				<div class="text-center">
					<p class="text-sm text-gray-600">
						Didn't receive the email?
					</p>
					<button
						onclick={() => currentStep = 'email'}
						class="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500"
					>
						Try again
					</button>
				</div>
			</div>

		{:else if currentStep === 'verify-phone'}
			<div>
				<h2 class="text-center text-3xl font-bold text-gray-900">
					Verify Your Phone
				</h2>
				<p class="mt-2 text-center text-sm text-gray-600">
					We sent a verification code to <strong>{phoneNumber}</strong>
				</p>
			</div>

			<form onsubmit={handlePhoneVerification} class="space-y-6">
				{#if error}
					<div class="rounded-md bg-red-50 border border-red-200 p-4">
						<div class="text-sm text-red-700">{error}</div>
					</div>
				{/if}

				<div>
					<label for="code" class="block text-sm font-medium text-gray-700">
						Verification Code
					</label>
					<div class="mt-1">
						<input
							id="code"
							name="code"
							type="text"
							inputmode="numeric"
							pattern="[0-9]{6}"
							maxlength="6"
							required
							bind:value={verificationCode}
							disabled={loading}
							class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 text-center text-2xl tracking-widest"
							placeholder="000000"
						/>
					</div>
					<p class="mt-1 text-xs text-gray-500">
						Enter the 6-digit code from your SMS
					</p>
				</div>

				<button
					type="submit"
					disabled={loading || verificationCode.length !== 6}
					class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
				>
					{#if loading}
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Verifying...
					{:else}
						Verify Code
					{/if}
				</button>

				<div class="text-center">
					<button
						type="button"
						onclick={sendVerificationCode}
						disabled={loading}
						class="text-sm font-medium text-blue-600 hover:text-blue-500 disabled:opacity-50"
					>
						Resend code
					</button>
				</div>
			</form>

		{:else if currentStep === 'username'}
			<div>
				<h2 class="text-center text-3xl font-bold text-gray-900">
					Choose Your Username
				</h2>
				<p class="mt-2 text-center text-sm text-gray-600">
					This will be your custom URL: tbr.fyi/@{username || 'username'}
				</p>
			</div>

			<form onsubmit={handleUsernameSubmit} class="space-y-6">
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
						Complete Setup
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

		{:else if currentStep === 'complete'}
			<div class="text-center">
				<div class="rounded-full bg-green-100 h-12 w-12 flex items-center justify-center mx-auto mb-4">
					<svg class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
				</div>
				<h2 class="text-2xl font-semibold text-gray-900">Account Created!</h2>
				<p class="mt-2 text-sm text-gray-600">
					Your shelf is now secure. Redirecting to @{username}...
				</p>
			</div>
		{/if}
	</div>
</div>