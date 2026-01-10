<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import FeedbackModal from '$lib/components/ui/FeedbackModal.svelte';
	import SignInPromptModal from '$lib/components/SignInPromptModal.svelte';
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

<div class="app-layout">
	<main class="main-content">
		{@render children?.()}
	</main>

	<footer class="site-footer">
		<div class="footer-container">
			<div class="footer-content">
				<nav class="footer-nav">
					<a href="/" class="footer-link">Home</a>
					<span class="footer-separator">•</span>
					<a href="/about" class="footer-link">About</a>
					<span class="footer-separator">•</span>
					<a href="/help" class="footer-link">Help</a>
					<span class="footer-separator">•</span>
					<a href={currentUserId() ? `/${currentUserId()}/settings` : '/settings'} class="footer-link">Settings</a>
					<span class="footer-separator">•</span>
					<a href="https://ko-fi.com/stevenpate" target="_blank" rel="noopener noreferrer" class="footer-link">Leave me a tip</a>
				</nav>
				<div class="footer-tagline">
					TBR.FYI - Your Personal Reading Inbox
				</div>
			</div>
		</div>
	</footer>

	<!-- Floating Feedback Button (FAB) -->
	<button
		onclick={openFeedbackModal}
		class="feedback-fab"
		aria-label="Give feedback"
		title="Give Feedback"
	>
		<svg class="feedback-icon" fill="currentColor" viewBox="0 0 24 24">
			<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
		</svg>
		<span class="feedback-label">Feedback</span>
	</button>

	<!-- Feedback Modal -->
	<FeedbackModal open={feedbackModalOpen} onClose={closeFeedbackModal} userId={currentUserId()} />

	<!-- Sign-in Prompt Modal (triggered by 401 errors) -->
	<SignInPromptModal />
</div>

<style>
	.app-layout {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.main-content {
		flex-grow: 1;
	}

	.site-footer {
		background: var(--background-alt, var(--paper-light));
		border-top: 1px solid var(--border);
		margin-top: 48px;
	}

	.footer-container {
		max-width: 80rem;
		margin: 0 auto;
		padding: 24px 24px;
	}

	@media (min-width: 640px) {
		.footer-container {
			padding: 24px 32px;
		}
	}

	.footer-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	@media (min-width: 640px) {
		.footer-content {
			flex-direction: row;
		}
	}

	.footer-nav {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-wrap: wrap;
		justify-content: center;
	}

	.footer-link {
		color: var(--text-secondary);
		transition: color 0.2s;
		white-space: nowrap;
	}

	.footer-link:hover {
		color: var(--accent);
	}

	.footer-separator {
		color: var(--border);
	}

	.footer-tagline {
		color: var(--text-secondary);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.feedback-fab {
		position: fixed;
		bottom: 24px;
		right: 24px;
		background: var(--accent);
		color: white;
		border: none;
		border-radius: 9999px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		cursor: pointer;
		transition: all 0.2s;
		z-index: 40;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
	}

	@media (min-width: 640px) {
		.feedback-fab {
			padding: 16px 20px;
		}
	}

	.feedback-fab:hover {
		background: var(--accent-hover);
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	}

	.feedback-icon {
		width: 20px;
		height: 20px;
	}

	@media (min-width: 640px) {
		.feedback-icon {
			width: 24px;
			height: 24px;
		}
	}

	.feedback-label {
		display: none;
		font-weight: 500;
		font-size: 0.875rem;
	}

	@media (min-width: 640px) {
		.feedback-label {
			display: inline;
		}
	}
</style>
