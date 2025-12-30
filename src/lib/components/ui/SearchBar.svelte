<script lang="ts">
	import { onMount } from 'svelte';

	interface Book {
		id: string;
		isbn13: string;
		title: string;
		author?: string[];
		cover_url?: string;
		note?: string | null;
	}

	interface Props {
		books: Book[];
		expanded?: boolean;
		query?: string;
		onSelect?: (book: Book) => void;
		onQueryChange?: (query: string) => void;
	}

	let {
		books,
		expanded = $bindable(false),
		query = $bindable(''),
		onSelect,
		onQueryChange
	}: Props = $props();

	let inputEl: HTMLInputElement | null = null;
	let containerEl: HTMLDivElement | null = null;
	let highlightedIndex = $state(0);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let dropdownPosition = $state({ top: 0, left: 0 });


	// Search matching logic
	function matchesQuery(book: Book, q: string): boolean {
		if (!q.trim()) return false;
		const query = q.toLowerCase();
		const titleMatch = book.title?.toLowerCase().includes(query) ?? false;
		const authorMatch = book.author?.some(a => a.toLowerCase().includes(query)) ?? false;
		const noteMatch = book.note?.toLowerCase().includes(query) ?? false;
		return titleMatch || authorMatch || noteMatch;
	}

	const matchingBooks = $derived(
		query.trim() ? books.filter(b => matchesQuery(b, query)).slice(0, 7) : []
	);

	// Reset highlight when results change
	$effect(() => {
		if (matchingBooks.length > 0) {
			highlightedIndex = 0;
		}
	});

	// Update dropdown position when visible
	$effect(() => {
		if (expanded && query.trim() && inputEl) {
			const inputRect = inputEl.getBoundingClientRect();
			// Get dropdown width (320px on sm screens, 288px on mobile)
			const dropdownWidth = window.innerWidth >= 640 ? 320 : 288;
			// Right-align with input since dropdown is wider than input
			const left = Math.max(8, inputRect.right - dropdownWidth);
			dropdownPosition = {
				top: inputRect.bottom + 4,
				left: left
			};
		}
	});

	// Focus input when expanded
	$effect(() => {
		if (expanded && inputEl) {
			setTimeout(() => inputEl?.focus(), 50);
		}
	});

	function handleInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;

		// Debounce the query update
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			query = value;
			onQueryChange?.(value);
		}, 150);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!expanded) return;

		if (e.key === 'Escape') {
			e.preventDefault();
			expanded = false;
			query = '';
			onQueryChange?.('');
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (matchingBooks.length > 0) {
				highlightedIndex = (highlightedIndex + 1) % matchingBooks.length;
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (matchingBooks.length > 0) {
				highlightedIndex = highlightedIndex <= 0 ? matchingBooks.length - 1 : highlightedIndex - 1;
			}
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (matchingBooks.length > 0 && matchingBooks[highlightedIndex]) {
				selectBook(matchingBooks[highlightedIndex]);
			}
		}
	}

	function selectBook(book: Book) {
		onSelect?.(book);
		// Keep search results visible - just close dropdown
		// User can clear search manually to see all books
		expanded = false;
	}

	function toggle() {
		expanded = !expanded;
		if (!expanded) {
			query = '';
			onQueryChange?.('');
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.search-container')) {
			expanded = false;
			query = '';
			onQueryChange?.('');
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div bind:this={containerEl} class="search-container relative flex items-center">
	<!-- Search icon button -->
	<button
		onclick={toggle}
		class="p-2 rounded-lg transition-colors {expanded
			? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
			: 'text-gray-600 hover:bg-gray-100'}"
		aria-label={expanded ? 'Close search' : 'Open search'}
		aria-expanded={expanded}
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
		</svg>
	</button>

	<!-- Expandable input -->
	{#if expanded}
		<div class="flex items-center ml-2 animate-expand">
			<input
				bind:this={inputEl}
				type="text"
				value={query}
				oninput={handleInput}
				onkeydown={handleKeydown}
				placeholder="Search title, author, notes..."
				class="w-48 sm:w-64 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			/>
			{#if query}
				<button
					onclick={() => { query = ''; onQueryChange?.(''); inputEl?.focus(); }}
					class="ml-1 p-1 text-gray-400 hover:text-gray-600"
					aria-label="Clear search"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			{/if}
		</div>

		<!-- Dropdown results (fixed position to escape stacking contexts) -->
		{#if query.trim()}
			<div
				class="fixed w-72 sm:w-80 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto"
				style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; z-index: 99999;"
			>
				{#if matchingBooks.length === 0}
					<div class="px-4 py-3 text-sm text-gray-500">
						No books match "{query}"
					</div>
				{:else}
					{#each matchingBooks as book, i}
						<button
							onclick={() => selectBook(book)}
							class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors {i === highlightedIndex ? 'bg-blue-50' : ''}"
						>
							{#if book.cover_url}
								<img
									src={book.cover_url}
									alt=""
									class="w-8 h-12 object-cover rounded flex-shrink-0"
								/>
							{:else}
								<div class="w-8 h-12 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
									<span class="text-gray-400 text-xs">?</span>
								</div>
							{/if}
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm text-gray-900 truncate">{book.title}</div>
								{#if book.author && book.author.length > 0}
									<div class="text-xs text-gray-500 truncate">{book.author.join(', ')}</div>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.animate-expand {
		animation: expand 0.2s ease-out;
	}

	@keyframes expand {
		from {
			opacity: 0;
			width: 0;
		}
		to {
			opacity: 1;
			width: auto;
		}
	}
</style>
