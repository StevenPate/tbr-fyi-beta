<script lang="ts">
	import { onMount } from 'svelte';

	interface Book {
		id: string;
		isbn13: string;
		title: string;
		author?: string[];
		cover_url?: string;
		note?: string | null;
		is_read: boolean;
		is_owned: boolean;
	}

	interface Props {
		books: Book[];
		expanded?: boolean;
		query?: string;
		onSelect?: (book: Book) => void;
		onQueryChange?: (query: string) => void;
		onAddBook?: (query: string) => void;
	}

	let {
		books,
		expanded = $bindable(false),
		query = $bindable(''),
		onSelect,
		onQueryChange,
		onAddBook
	}: Props = $props();

	let inputEl: HTMLInputElement | null = null;
	let highlightedIndex = $state(0);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let dropdownPosition = $state({ top: 0, left: 0 });

	// Portal action to render dropdown at body level (escapes all stacking contexts)
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

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
	function updateDropdownPosition() {
		if (inputEl) {
			const rect = inputEl.getBoundingClientRect();
			// Viewport coordinates for fixed positioning
			dropdownPosition = {
				top: rect.bottom + 4,
				left: rect.left
			};
		}
	}

	// Update position when dropdown should be visible
	$effect(() => {
		if (expanded && query.trim() && inputEl) {
			requestAnimationFrame(() => {
				updateDropdownPosition();
			});
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
			debounceTimer = null;
		}, 150);
	}

	// Clear debounce timer and reset search state
	function closeSearch() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
		expanded = false;
		query = '';
		onQueryChange?.('');
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!expanded) return;

		if (e.key === 'Escape') {
			e.preventDefault();
			closeSearch();
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
		closeSearch();
	}

	function toggle() {
		if (expanded) {
			closeSearch();
		} else {
			expanded = true;
		}
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		const inSearchContainer = target.closest('.search-container');
		const inSearchDropdown = target.closest('.search-dropdown-portal');

		if (!inSearchContainer && !inSearchDropdown) {
			closeSearch();
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div class="search-container relative flex items-center">
	<!-- Search icon button -->
	<button
		onclick={toggle}
		class="p-2 rounded transition-colors {expanded
			? 'text-[var(--accent)] bg-[var(--background-alt)] hover:bg-[var(--paper-dark)]'
			: 'text-[var(--text-secondary)] hover:bg-[var(--background-alt)]'}"
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
				class="w-48 sm:w-64 px-3 py-1.5 text-sm border border-[var(--border)] rounded focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
			/>
			{#if query}
				<button
					onclick={() => { query = ''; onQueryChange?.(''); inputEl?.focus(); }}
					class="ml-1 p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
					aria-label="Clear search"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			{/if}
		</div>

		<!-- Dropdown results (portaled to body to escape all stacking contexts) -->
		{#if query.trim()}
			<div
				use:portal
				class="search-dropdown-portal fixed w-72 sm:w-80 bg-[var(--surface)] border border-[var(--border)] rounded shadow-xl max-h-96 overflow-y-auto"
				style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px; z-index: 99999;"
			>
				{#if matchingBooks.length === 0}
					<div class="px-4 py-3 text-sm text-[var(--text-tertiary)]">
						No books match "{query}"
					</div>
					{#if onAddBook}
						<button
							onclick={() => { onAddBook?.(query); closeSearch(); }}
							class="w-full px-4 py-2.5 text-sm text-left text-[var(--accent)] hover:bg-[var(--background-alt)] transition-colors border-t border-[var(--border)] flex items-center gap-2"
						>
							<span class="text-base leading-none">+</span>
							Search to add "{query}"
						</button>
					{/if}
				{:else}
					{#each matchingBooks as book, i}
						<button
							onclick={() => selectBook(book)}
							class="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--background-alt)] transition-colors {i === highlightedIndex ? 'bg-[var(--background-alt)]' : ''}"
						>
							{#if book.cover_url}
								<img
									src={book.cover_url}
									alt=""
									class="w-8 h-12 object-cover rounded flex-shrink-0"
								/>
							{:else}
								<div class="w-8 h-12 bg-[var(--background-alt)] rounded flex items-center justify-center flex-shrink-0">
									<span class="text-[var(--text-tertiary)] text-xs">?</span>
								</div>
							{/if}
							<div class="flex-1 min-w-0">
								<div class="font-medium text-sm text-[var(--text-primary)] truncate">{book.title}</div>
								{#if book.author && book.author.length > 0}
									<div class="text-xs text-[var(--text-tertiary)] truncate">{book.author.join(', ')}</div>
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
