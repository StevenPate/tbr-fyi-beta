<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import FeedbackModal from '$lib/components/ui/FeedbackModal.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { children, data } = $props();

	let feedbackModalOpen = $state(false);
	let userId = $state<string | null>(null);

	onMount(() => {
		// Try to detect userId from localStorage (for legacy users)
		const stored = localStorage.getItem('tbr-userId');
		if (stored) {
			userId = stored;
		}
	});

	// Derived userId from current page URL or localStorage
	const currentUserId = $derived(() => {
		// Check if we're on a shelf page (/{phoneNumber})
		const pathname = $page.url.pathname;
		const match = pathname.match(/^\/(\+\d+)$/);
		if (match) {
			return decodeURIComponent(match[1]);
		}
		// Fall back to localStorage
		return userId;
	});

	function openFeedbackModal() {
		feedbackModalOpen = true;
	}

	function closeFeedbackModal() {
		feedbackModalOpen = false;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen flex flex-col">
	<main class="flex-grow">
		{@render children?.()}
	</main>

	<footer class="bg-gray-50 border-t border-gray-200 mt-12">
		<div class="max-w-7xl mx-auto px-6 sm:px-8 py-6">
			<div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
				<div class="flex items-center gap-4 flex-wrap justify-center">
					<a href="/" class="hover:text-blue-600 transition-colors whitespace-nowrap">
						Home
					</a>
					<span class="text-gray-400">•</span>
					<a href="/about" class="hover:text-blue-600 transition-colors whitespace-nowrap">
						About
					</a>
					<span class="text-gray-400">•</span>
					<a href="/help" class="hover:text-blue-600 transition-colors whitespace-nowrap">
						Help
					</a>
					<span class="text-gray-400">•</span>
					<a href={currentUserId() ? `/${currentUserId()}/settings` : '/settings'} class="hover:text-blue-600 transition-colors whitespace-nowrap">
						Settings
					</a>
					<span class="text-gray-400">•</span>
					<a href="https://ko-fi.com/stevenpate" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600 transition-colors whitespace-nowrap">
						Leave me a tip
					</a>
				</div>
				<div class="text-gray-500 text-xs whitespace-nowrap">
					TBR.FYI - Your Personal Reading Inbox
				</div>
			</div>
		</div>
	</footer>

	<!-- Floating Feedback Button (FAB) -->
	<button
		onclick={openFeedbackModal}
		class="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:shadow-xl z-40 flex items-center gap-2 px-4 py-3 sm:px-5 sm:py-4"
		aria-label="Give feedback"
		title="Give Feedback"
	>
		<svg class="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
			<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
		</svg>
		<span class="hidden sm:inline font-medium text-sm">Feedback</span>
	</button>

	<!-- Feedback Modal -->
	<FeedbackModal open={feedbackModalOpen} onClose={closeFeedbackModal} userId={currentUserId()} />
</div>
