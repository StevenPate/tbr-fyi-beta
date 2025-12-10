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

<div class="min-h-[80vh] flex items-center justify-center px-4">
	<div class="max-w-md w-full space-y-8">
		<div class="text-center">
			<h1 class="text-3xl font-bold text-gray-900">Sign in with Email</h1>
			<p class="mt-2 text-sm text-gray-600">
				We'll send you a magic link to verify your email
			</p>
		</div>

		{#if urlError && errorMessages[urlError]}
			<div class="bg-red-50 border border-red-200 rounded-md p-4">
				<p class="text-sm text-red-800">{errorMessages[urlError]}</p>
			</div>
		{/if}

		{#if status === 'sent'}
			<!-- Success message -->
			<div class="bg-green-50 border border-green-200 rounded-md p-4">
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

			<div class="text-center">
				<button
					onclick={() => (status = 'idle')}
					class="text-sm font-medium text-blue-600 hover:text-blue-500"
				>
					Use a different email
				</button>
			</div>
		{:else}
			<!-- Email form -->
			<form onsubmit={handleSubmit} class="space-y-6">
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700">
						Email Address
					</label>
					<div class="mt-1">
						<input
							id="email"
							type="email"
							bind:value={email}
							disabled={status === 'sending'}
							placeholder="you@example.com"
							class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50"
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
					class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
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

			<div class="text-center text-sm text-gray-600">
				<p>
					Have a phone-based shelf?
					<a href="/auth/verify-phone" class="font-medium text-blue-600 hover:text-blue-500">
						Sign in with phone
					</a>
				</p>
			</div>
		{/if}
	</div>
</div>
