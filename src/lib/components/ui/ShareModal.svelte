<script lang="ts">
	import { PUBLIC_BASE_URL } from '$env/static/public';

	interface Book {
		isbn13: string;
		title: string;
	}

	interface Props {
		book: Book;
		identifier: string;
		open: boolean;
		onClose: () => void;
	}

	let { book, identifier, open, onClose }: Props = $props();

	let copied = $state(false);

	// Compute share URL from current props
	function getShareUrl(): string {
		return `${PUBLIC_BASE_URL}/${encodeURIComponent(identifier)}/book/${book.isbn13}`;
	}

	async function copyToClipboard() {
		const url = getShareUrl();
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (e) {
			// Fallback for browsers that don't support clipboard API
			console.error('Clipboard API failed, trying fallback:', e);
			try {
				const textArea = document.createElement('textarea');
				textArea.value = url;
				textArea.style.position = 'fixed';
				textArea.style.left = '-999999px';
				textArea.style.top = '-999999px';
				document.body.appendChild(textArea);
				textArea.focus();
				textArea.select();
				document.execCommand('copy');
				document.body.removeChild(textArea);
				copied = true;
				setTimeout(() => {
					copied = false;
				}, 2000);
			} catch (fallbackError) {
				console.error('Fallback copy also failed:', fallbackError);
			}
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
		onclick={handleBackdropClick}
	>
		<div
			class="bg-white rounded-xl shadow-xl w-full max-w-md"
			role="dialog"
			aria-modal="true"
			aria-labelledby="share-modal-title"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-stone-100">
				<h2 id="share-modal-title" class="text-lg font-semibold text-stone-900">
					Share Book
				</h2>
				<button
					onclick={onClose}
					class="p-1 text-stone-400 hover:text-stone-600 transition-colors rounded-lg hover:bg-stone-100"
					aria-label="Close"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="p-5">
				<p class="text-sm text-stone-600 mb-4">
					Share <span class="font-medium text-stone-900">"{book.title}"</span> with others:
				</p>

				<!-- URL input -->
				<div class="flex gap-2">
					<input
						type="text"
						readonly
						value={getShareUrl()}
						class="flex-grow px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						onclick={(e) => e.currentTarget.select()}
					/>
					<button
						onclick={copyToClipboard}
						class="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors min-w-[90px] justify-center"
					>
						{#if copied}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
							<span>Copied!</span>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
								/>
							</svg>
							<span>Copy</span>
						{/if}
					</button>
				</div>

				<p class="text-xs text-stone-500 mt-3">
					Anyone with this link can view the book and add it to their own shelf.
				</p>
			</div>
		</div>
	</div>
{/if}
