<script lang="ts">
	import { PUBLIC_BASE_URL } from '$env/static/public';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import JsBarcode from 'jsbarcode';

	let { data } = $props();

	let adding = $state(false);
	let addResult = $state<{ success: boolean; message: string } | null>(null);

	// Action buttons state
	let isbnCopied = $state(false);
	let linkCopied = $state(false);
	let showBarcode = $state(false);

	// Build auth redirect URL with isbn param
	const currentUrl = $derived($page.url.pathname);
	const authUrl = $derived(
		`/auth/verify-email?redirect=${encodeURIComponent(currentUrl)}&isbn=${data.book?.isbn13 || ''}`
	);

	async function addToShelf() {
		if (!data.book || !data.currentUser) return;

		adding = true;
		addResult = null;

		try {
			const response = await fetch('/api/books/add-from-share', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isbn13: data.book.isbn13 })
			});

			const result = await response.json();

			if (response.ok) {
				addResult = { success: true, message: 'Added to your shelf!' };
				await invalidateAll();
			} else if (response.status === 409 && result.duplicate) {
				addResult = { success: false, message: 'Already on your shelf' };
			} else {
				addResult = { success: false, message: result.error || 'Failed to add book' };
			}
		} catch (e) {
			console.error('Error adding book:', e);
			addResult = { success: false, message: 'Something went wrong' };
		} finally {
			adding = false;
		}
	}

	// Sharer display name
	const sharerName = $derived(
		data.sharer.displayName || data.sharer.username || data.sharer.identifier
	);
	const sharerLink = $derived(`/${data.sharer.identifier}`);

	// Copy ISBN to clipboard
	async function copyISBN() {
		if (!data.book) return;
		try {
			await navigator.clipboard.writeText(data.book.isbn13);
			isbnCopied = true;
			setTimeout(() => (isbnCopied = false), 2000);
		} catch (err) {
			console.error('Failed to copy ISBN:', err);
		}
	}

	// Copy share link to clipboard
	async function copyShareLink() {
		try {
			const url = `${PUBLIC_BASE_URL}${currentUrl}`;
			await navigator.clipboard.writeText(url);
			linkCopied = true;
			setTimeout(() => (linkCopied = false), 2000);
		} catch (err) {
			// Fallback for browsers that don't support clipboard API
			try {
				const textArea = document.createElement('textarea');
				textArea.value = `${PUBLIC_BASE_URL}${currentUrl}`;
				textArea.style.position = 'fixed';
				textArea.style.left = '-999999px';
				document.body.appendChild(textArea);
				textArea.select();
				document.execCommand('copy');
				document.body.removeChild(textArea);
				linkCopied = true;
				setTimeout(() => (linkCopied = false), 2000);
			} catch (fallbackErr) {
				console.error('Failed to copy link:', fallbackErr);
			}
		}
	}

	// Barcode generation action
	function generateBarcode(node: HTMLCanvasElement, isbn: string) {
		const container = node.parentElement;
		if (!container) return;

		function render() {
			const containerWidth = container?.clientWidth || 200;
			const barcodeWidth = Math.min(containerWidth - 16, 280);
			const moduleWidth = barcodeWidth / 95;

			JsBarcode(node, isbn, {
				format: 'EAN13',
				width: moduleWidth,
				height: 50,
				displayValue: false,
				margin: 0,
				background: 'transparent'
			});
		}

		render();

		const resizeObserver = new ResizeObserver(() => render());
		resizeObserver.observe(container);

		return {
			destroy() {
				resizeObserver.disconnect();
			}
		};
	}
</script>

<svelte:head>
	{#if data.book}
		<title>{data.book.title} | TBR.fyi</title>
		<meta property="og:title" content={data.book.title} />
		<meta
			property="og:description"
			content={data.book.author?.join(', ') || 'Shared on TBR.fyi'}
		/>
		<meta property="og:image" content={data.book.cover_url || 'https://tbr.fyi/og-image.png'} />
		<meta property="og:type" content="book" />
		<meta property="og:url" content="{PUBLIC_BASE_URL}{currentUrl}" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:image" content={data.book.cover_url || 'https://tbr.fyi/og-image.png'} />
	{:else}
		<title>Book Not Found | TBR.fyi</title>
		<meta property="og:image" content="https://tbr.fyi/og-image.png" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:image" content="https://tbr.fyi/og-image.png" />
	{/if}
</svelte:head>

<div class="min-h-screen bg-stone-50">
	<div class="max-w-2xl mx-auto px-4 py-8 sm:py-12">
		{#if data.error || !data.book}
			<!-- Error state -->
			<div class="text-center py-12">
				<svg
					class="w-16 h-16 mx-auto text-stone-300 mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
					/>
				</svg>
				<h1 class="text-xl font-semibold text-stone-800 mb-2">Book Not Found</h1>
				<p class="text-stone-600 mb-6">
					This book may no longer be available or the link may be incorrect.
				</p>
				<a
					href={sharerLink}
					class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 19l-7-7m0 0l7-7m-7 7h18"
						/>
					</svg>
					View {sharerName}'s shelf
				</a>
			</div>
		{:else}
			<!-- Book display -->
			<div class="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
				<!-- Book cover and details -->
				<div class="p-6 sm:p-8">
					<div class="flex flex-col sm:flex-row gap-6">
						<!-- Cover image -->
						<div class="flex-shrink-0 mx-auto sm:mx-0">
							{#if data.book.cover_url}
								<img
									src={data.book.cover_url}
									alt={data.book.title}
									class="w-40 h-auto rounded-lg shadow-md"
								/>
							{:else}
								<div
									class="w-40 h-56 bg-gradient-to-br from-stone-200 to-stone-300 rounded-lg flex items-center justify-center"
								>
									<svg
										class="w-12 h-12 text-stone-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="1.5"
											d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
										/>
									</svg>
								</div>
							{/if}
						</div>

						<!-- Book info -->
						<div class="flex-grow text-center sm:text-left">
							<h1 class="text-2xl sm:text-3xl font-bold text-stone-900 mb-2">
								{data.book.title}
							</h1>

							{#if data.book.author && data.book.author.length > 0}
								<p class="text-lg text-stone-600 mb-3">
									by {data.book.author.join(', ')}
								</p>
							{/if}

							<div class="flex flex-wrap gap-2 justify-center sm:justify-start text-sm text-stone-500 mb-4">
								{#if data.book.publisher}
									<span>{data.book.publisher}</span>
								{/if}
								{#if data.book.publisher && data.book.publication_date}
									<span class="text-stone-300">•</span>
								{/if}
								{#if data.book.publication_date}
									<span>{data.book.publication_date}</span>
								{/if}
							</div>

							<!-- Shared by attribution -->
							<div class="flex items-center gap-2 justify-center sm:justify-start text-sm text-stone-500 mb-4">
								<span>Shared by</span>
								<a
									href={sharerLink}
									class="text-blue-600 hover:text-blue-700 transition-colors font-medium"
								>
									{sharerName}
								</a>
								{#if !data.inLibrary}
									<span
										class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700"
									>
										No longer on their shelf
									</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Description -->
					{#if data.book.description}
						<div class="mt-6 pt-6 border-t border-stone-100">
							<h2 class="text-sm font-semibold text-stone-700 mb-2">Description</h2>
							<p class="text-stone-600 leading-relaxed whitespace-pre-line">
								{data.book.description}
							</p>
						</div>
					{/if}
				</div>

				<!-- CTA section -->
				<div class="bg-stone-50 px-6 sm:px-8 py-5 border-t border-stone-100">
					{#if data.currentUser}
						<!-- Logged in: Add to shelf button -->
						{#if addResult}
							<div
								class="flex items-center justify-center gap-2 py-3 px-4 rounded-lg {addResult.success
									? 'bg-green-50 text-green-700'
									: 'bg-amber-50 text-amber-700'}"
							>
								{#if addResult.success}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M5 13l4 4L19 7"
										/>
									</svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								{/if}
								<span class="font-medium">{addResult.message}</span>
							</div>
						{:else}
							<button
								onclick={addToShelf}
								disabled={adding}
								class="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{#if adding}
									<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
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
									<span>Adding...</span>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 6v6m0 0v6m0-6h6m-6 0H6"
										/>
									</svg>
									<span>Add to my shelf</span>
								{/if}
							</button>
						{/if}
					{:else}
						<!-- Not logged in: Sign in prompt -->
						<a
							href={authUrl}
							class="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 6v6m0 0v6m0-6h6m-6 0H6"
								/>
							</svg>
							<span>Sign in to add to your shelf</span>
						</a>
						<p class="text-center text-sm text-stone-500 mt-3">
							New to TBR.fyi?
							<a href={authUrl} class="text-blue-600 hover:text-blue-700">Create a free account</a>
						</p>
					{/if}
				</div>
			</div>

			<!-- Action buttons: Copy ISBN, Barcode, Share -->
			<div class="mt-6 bg-white rounded-xl shadow-sm border border-stone-200 p-4">
				<div class="flex flex-wrap gap-2 justify-center">
					<!-- Copy ISBN -->
					<button
						onclick={copyISBN}
						class="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
					>
						{#if isbnCopied}
							<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
							<span class="text-green-600">Copied!</span>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
							</svg>
							<span>Copy ISBN</span>
						{/if}
					</button>

					<!-- Barcode toggle -->
					<button
						onclick={() => showBarcode = !showBarcode}
						class="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors {showBarcode ? 'bg-stone-100' : ''}"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
						</svg>
						<span>{showBarcode ? 'Hide Barcode' : 'Barcode'}</span>
					</button>

					<!-- Share link -->
					<button
						onclick={copyShareLink}
						class="flex items-center gap-1.5 px-3 py-2 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
					>
						{#if linkCopied}
							<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
							<span class="text-green-600">Copied!</span>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
							</svg>
							<span>Share</span>
						{/if}
					</button>
				</div>

				<!-- Barcode display (collapsible) -->
				{#if showBarcode}
					<div class="mt-4 pt-4 border-t border-stone-100 text-center">
						<p class="text-xs text-stone-500 mb-2">Scan at bookstore or library</p>
						<div class="flex justify-center">
							<canvas use:generateBarcode={data.book.isbn13} class="max-w-full h-auto"></canvas>
						</div>
						<p class="text-xs font-mono text-stone-600 mt-2">{data.book.isbn13}</p>
					</div>
				{/if}

				<!-- ISBN display when barcode hidden -->
				{#if !showBarcode}
					<p class="text-center text-xs text-stone-500 mt-3">ISBN: {data.book.isbn13}</p>
				{/if}
			</div>
		{/if}
	</div>
</div>
