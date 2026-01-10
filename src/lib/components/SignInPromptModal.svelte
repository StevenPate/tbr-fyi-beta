<script lang="ts">
	import { authPrompt } from '$lib/stores/auth-prompt';
	import { auth } from '$lib/stores/auth';

	let email = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);

	// Subscribe to store
	let storeState = $state<{ show: boolean; message?: string }>({ show: false });
	authPrompt.subscribe((value) => {
		storeState = value;
		// Reset form state when modal opens
		if (value.show) {
			email = '';
			error = null;
			success = false;
			loading = false;
		}
	});

	async function handleSignIn(e: Event) {
		e.preventDefault();
		error = null;
		loading = true;

		try {
			await auth.signInWithEmail(email);
			success = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send magic link';
		} finally {
			loading = false;
		}
	}

	function handleDismiss() {
		email = '';
		error = null;
		success = false;
		loading = false;
		authPrompt.dismiss();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleDismiss();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleDismiss();
		}
	}
</script>

{#if storeState.show}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="signin-prompt-title"
	>
		<div
			class="bg-white rounded-lg shadow-xl max-w-md w-full"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-start justify-between p-5 border-b border-gray-200">
				<div>
					<h2 id="signin-prompt-title" class="text-xl font-semibold text-gray-900">
						Sign in required
					</h2>
					<p class="text-sm text-gray-600 mt-1">
						{storeState.message || 'Your session has expired. Please sign in to continue.'}
					</p>
				</div>
				<button
					onclick={handleDismiss}
					class="text-gray-400 hover:text-gray-600 p-1 -mt-1 -mr-1"
					aria-label="Close"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="p-5">
				{#if success}
					<div class="bg-green-50 border border-green-200 rounded-lg p-4">
						<h3 class="text-sm font-medium text-green-800">Check your email!</h3>
						<p class="mt-1 text-sm text-green-700">
							We've sent a magic link to <strong>{email}</strong>. Click the link to sign in.
						</p>
					</div>
					<div class="mt-4">
						<button
							onclick={handleDismiss}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
						>
							Close
						</button>
					</div>
				{:else}
					<form onsubmit={handleSignIn} class="space-y-4">
						{#if error}
							<div class="bg-red-50 border border-red-200 rounded-lg p-3">
								<p class="text-sm text-red-700">{error}</p>
							</div>
						{/if}

						<div>
							<label for="signin-email" class="block text-sm font-medium text-gray-700 mb-1">
								Email address
							</label>
							<input
								id="signin-email"
								type="email"
								bind:value={email}
								required
								disabled={loading}
								placeholder="you@example.com"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
							/>
						</div>

						<div class="flex gap-3 pt-2">
							<button
								type="button"
								onclick={handleDismiss}
								disabled={loading}
								class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={loading || !email.trim()}
								class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
							>
								{#if loading}
									<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Sending...
								{:else}
									Send magic link
								{/if}
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
	</div>
{/if}
