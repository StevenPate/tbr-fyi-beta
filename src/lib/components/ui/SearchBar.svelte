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

	type ReadFilter = 'all' | 'read' | 'unread';
	type OwnedFilter = 'all' | 'owned' | 'not-owned';

	interface Props {
		books: Book[];
		expanded?: boolean;
		query?: string;
		onSelect?: (book: Book) => void;
		onQueryChange?: (query: string) => void;
		readFilter?: ReadFilter;
		ownedFilter?: OwnedFilter;
		onReadFilterChange?: (filter: ReadFilter) => void;
		onOwnedFilterChange?: (filter: OwnedFilter) => void;
	}

	let {
		books,
		expanded = $bindable(false),
		query = $bindable(''),
		onSelect,
		onQueryChange,
		readFilter = 'all',
		ownedFilter = 'all',
		onReadFilterChange,
		onOwnedFilterChange
	}: Props = $props();

	let inputEl: HTMLInputElement | null = null;
	let filterButtonEl: HTMLButtonElement | null = null;
	let highlightedIndex = $state(0);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	let dropdownPosition = $state({ top: 0, left: 0 });
	let filterDropdownOpen = $state(false);
	let filterDropdownPosition = $state({ top: 0, left: 0 });

	// Check if any filters are active
	const hasActiveFilters = $derived(readFilter !== 'all' || ownedFilter !== 'all');

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

	// Apply status filters to books
	const filteredBooks = $derived(() => {
		let result = books;
		if (readFilter !== 'all') {
			result = result.filter(b => readFilter === 'read' ? b.is_read : !b.is_read);
		}
		if (ownedFilter !== 'all') {
			result = result.filter(b => ownedFilter === 'owned' ? b.is_owned : !b.is_owned);
		}
		return result;
	});

	const matchingBooks = $derived(
		query.trim() ? filteredBooks().filter(b => matchesQuery(b, query)).slice(0, 7) : []
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

	// Update filter dropdown position
	function updateFilterDropdownPosition() {
		if (filterButtonEl) {
			const rect = filterButtonEl.getBoundingClientRect();
			filterDropdownPosition = {
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

	// Update filter dropdown position when open
	$effect(() => {
		if (filterDropdownOpen && filterButtonEl) {
			requestAnimationFrame(() => {
				updateFilterDropdownPosition();
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
		filterDropdownOpen = false;
	}

	// Toggle filter dropdown
	function toggleFilterDropdown() {
		filterDropdownOpen = !filterDropdownOpen;
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
		// Check search container, search dropdown, and filter dropdown
		const inSearchContainer = target.closest('.search-container');
		const inSearchDropdown = target.closest('.search-dropdown-portal');
		const inFilterDropdown = target.closest('.filter-dropdown-portal');

		if (!inSearchContainer && !inSearchDropdown && !inFilterDropdown) {
			closeSearch();
		} else if (filterDropdownOpen && !inFilterDropdown && !target.closest('.filter-toggle-btn')) {
			// Close filter dropdown if clicking outside of it (but not on the toggle button)
			filterDropdownOpen = false;
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

	<!-- Filter toggle button - visible when expanded OR when filters are active -->
	{#if expanded || hasActiveFilters}
		<button
			bind:this={filterButtonEl}
			onclick={(e) => {
				// If not expanded, expand first then open filter
				if (!expanded) {
					expanded = true;
					// Small delay to let input render, then open filter dropdown
					setTimeout(() => {
						filterDropdownOpen = true;
						updateFilterDropdownPosition();
					}, 50);
				} else {
					toggleFilterDropdown();
				}
			}}
			class="filter-toggle-btn ml-1 p-1.5 relative rounded-lg transition-colors {filterDropdownOpen
				? 'text-blue-600 bg-blue-50'
				: hasActiveFilters
					? 'text-blue-600 hover:bg-blue-50'
					: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}"
			aria-label="Filter books"
			aria-expanded={filterDropdownOpen}
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
			</svg>
			{#if hasActiveFilters}
				<span class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full"></span>
			{/if}
		</button>
	{/if}

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

		<!-- Dropdown results (portaled to body to escape all stacking contexts) -->
		{#if query.trim()}
			<div
				use:portal
				class="search-dropdown-portal fixed w-72 sm:w-80 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto"
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

	<!-- Filter dropdown (portaled to body) - outside expanded block so it works when filters active but search collapsed -->
	{#if filterDropdownOpen}
		<div
			use:portal
			class="filter-dropdown-portal fixed bg-white border border-gray-200 rounded-lg shadow-xl p-3"
			style="top: {filterDropdownPosition.top}px; left: {filterDropdownPosition.left}px; z-index: 99999;"
		>
			<!-- Read filter -->
			<div class="flex items-center gap-2 mb-2">
				<span class="text-xs text-gray-500 w-12">Read:</span>
				<div class="flex gap-1">
					{#each [['all', 'All'], ['read', 'Read'], ['unread', 'Unread']] as [value, label]}
						<button
							onclick={() => onReadFilterChange?.(value as ReadFilter)}
							class="px-2 py-1 text-xs rounded transition-colors {readFilter === value
								? 'bg-stone-700 text-white'
								: 'bg-stone-100 text-stone-600 hover:bg-stone-200'}"
						>
							{label}
						</button>
					{/each}
				</div>
			</div>
			<!-- Owned filter -->
			<div class="flex items-center gap-2">
				<span class="text-xs text-gray-500 w-12">Owned:</span>
				<div class="flex gap-1">
					{#each [['all', 'All'], ['owned', 'Owned'], ['not-owned', 'Not Owned']] as [value, label]}
						<button
							onclick={() => onOwnedFilterChange?.(value as OwnedFilter)}
							class="px-2 py-1 text-xs rounded transition-colors {ownedFilter === value
								? 'bg-stone-700 text-white'
								: 'bg-stone-100 text-stone-600 hover:bg-stone-200'}"
						>
							{label}
						</button>
					{/each}
				</div>
			</div>
		</div>
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
