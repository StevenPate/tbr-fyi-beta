<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	interface Props {
		phoneNumber: string;
		isOwner?: boolean;
	}

	let { phoneNumber, isOwner = false }: Props = $props();

	let dismissed = $state(false);
	let dismissedUntil = $state<Date | null>(null);

	const STORAGE_KEY = 'tbr-claim-banner-dismissed';
	const OWNER_STORAGE_KEY = 'tbr-claim-banner-owner-dismissed';

	onMount(() => {
		if (!browser) return;

		// Check if banner was previously dismissed
		const storageKey = isOwner ? OWNER_STORAGE_KEY : STORAGE_KEY;
		const dismissedData = localStorage.getItem(storageKey);

		if (dismissedData) {
			try {
				const parsed = JSON.parse(dismissedData);
				const dismissedDate = new Date(parsed.dismissedUntil);

				// Check if dismissal has expired
				if (dismissedDate > new Date()) {
					dismissed = true;
					dismissedUntil = dismissedDate;
				} else {
					// Clear expired dismissal
					localStorage.removeItem(storageKey);
				}
			} catch {
				// Invalid data, clear it
				localStorage.removeItem(storageKey);
			}
		}
	});

	function handleDismiss(duration: 'temporary' | 'long') {
		if (!browser) return;

		const now = new Date();
		let until: Date;

		if (duration === 'temporary') {
			// Dismiss for 7 days
			until = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
		} else {
			// Dismiss for 30 days
			until = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
		}

		const storageKey = isOwner ? OWNER_STORAGE_KEY : STORAGE_KEY;
		localStorage.setItem(storageKey, JSON.stringify({
			dismissedAt: now.toISOString(),
			dismissedUntil: until.toISOString(),
			phoneNumber
		}));

		dismissed = true;
		dismissedUntil = until;
	}

	function handleClaimClick() {
		// Navigate to claim page with phone pre-filled
		const encodedPhone = encodeURIComponent(phoneNumber);
		window.location.href = `/auth/claim?p=${encodedPhone}`;
	}
</script>

{#if !dismissed}
	{#if isOwner}
		<!-- Banner for shelf owner -->
		<div class="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between py-3">
					<div class="flex items-start flex-1">
						<div class="flex-shrink-0">
							<svg class="h-6 w-6 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
							</svg>
						</div>
						<div class="ml-3 flex-1">
							<p class="text-sm font-medium text-gray-900">
								Is this your shelf? Secure it with a free account
							</p>
							<div class="mt-1 text-sm text-gray-600">
								<ul class="list-disc list-inside space-y-0.5">
									<li>Get a custom username</li>
									<li>Make shelves private</li>
									<li>Access from any device</li>
								</ul>
							</div>
							<div class="mt-3 flex items-center gap-3">
								<button
									onclick={handleClaimClick}
									class="inline-flex items-center px-4 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
								>
									Create Account
								</button>
								<button
									onclick={() => handleDismiss('temporary')}
									class="text-sm text-gray-500 hover:text-gray-700"
								>
									Maybe Later
								</button>
							</div>
						</div>
					</div>
					<div class="ml-4 flex-shrink-0">
						<button
							onclick={() => handleDismiss('long')}
							class="text-gray-400 hover:text-gray-500"
							aria-label="Dismiss"
						>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Banner for other visitors -->
		<div class="bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between py-3">
					<div class="flex items-center flex-1">
						<div class="flex-shrink-0">
							<svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
							</svg>
						</div>
						<div class="ml-3 flex-1">
							<p class="text-sm font-medium text-gray-900">
								Start your own reading list!
							</p>
							<p class="mt-1 text-sm text-gray-600">
								Text any book ISBN to get started
							</p>
						</div>
						<div class="ml-4 flex items-center gap-3">
							<a
								href="/about"
								class="text-sm font-medium text-green-600 hover:text-green-500"
							>
								Learn More
							</a>
							<button
								onclick={() => handleDismiss('long')}
								class="text-gray-400 hover:text-gray-500"
								aria-label="Dismiss"
							>
								<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}