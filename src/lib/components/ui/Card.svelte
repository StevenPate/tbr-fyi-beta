<script lang="ts">
	import { fade, slide } from 'svelte/transition';
	import JsBarcode from 'jsbarcode';
	import ReactionChips from './ReactionChips.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import { composeNote } from './reaction-chips';

	interface Book {
		id: string;
		isbn13: string;
		title: string;
		author?: string[];
		publisher?: string;
		publication_date?: string;
		description?: string;
		cover_url?: string;
		is_read: boolean;
		is_owned: boolean;
		note?: string | null;
		added_at: string;
	}

	interface Shelf {
		id: string;
		name: string;
	}

	interface BookShelf {
		book_id: string;
		shelf_id: string;
	}

	interface Props {
		id?: string;
		book: Book;
		shelves: Shelf[];
		bookShelves: BookShelf[];
		onToggleRead?: (bookId: string, currentStatus: boolean) => void;
		onToggleOwned?: (bookId: string, currentStatus: boolean) => void;
		onUpdateNote?: (bookId: string, note: string) => void;
		onToggleShelf?: (bookId: string, shelfId: string, isOnShelf: boolean) => void;
		onDelete?: (bookId: string, title: string) => void;
		onEditDetails?: (bookId: string) => void;
		onShare?: (book: { isbn13: string; title: string }) => void;
		expanded?: boolean;
		onToggleExpand?: (bookId: string, isExpanded: boolean) => void;
		onClose?: () => void;
	}

	let {
		id,
		book,
		shelves,
		bookShelves,
		onToggleRead,
		onToggleOwned,
		onUpdateNote,
		onToggleShelf,
		onDelete,
		onEditDetails,
		onShare,
		expanded = $bindable(false),
		onToggleExpand,
		onClose
	}: Props = $props();

	// State for expandable sections (only used when expanded)
	let descriptionOpen = $state(false);
	let linksOpen = $state(false);
	let shelvesOpen = $state(false);
	let barcodeOpen = $state(false);
	let noteEditing = $state(false);
	let noteValue = $state(book.note || '');
	let tempNoteValue = $state('');
	let selectedChips = $state<Set<string>>(new Set());
	let menuOpen = $state(false);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);

	// Track what the server's note value is, so we know when it changes
	let lastServerNote = $state(book.note);
	let lastBookId = $state(book.id);

	// Sync noteValue with book.note when it changes externally (e.g., after invalidateAll)
	// Only sync if: not editing AND (server note changed OR different book)
	$effect(() => {
		const serverNote = book.note;
		const bookChanged = book.id !== lastBookId;

		if (bookChanged) {
			// Different book - always sync
			noteValue = serverNote || '';
			lastServerNote = serverNote;
			lastBookId = book.id;
		} else if (!noteEditing && serverNote !== lastServerNote) {
			// Same book, server note updated - sync if not editing
			noteValue = serverNote || '';
			lastServerNote = serverNote;
		}
	});
	let copied = $state(false);
	let barcodeCanvas = $state<HTMLCanvasElement | null>(null);

	// Soft success feedback
	let savedFeedback = $state<string | null>(null);
	let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

	function showSavedFeedback(message: string = 'Saved') {
		// Subtle haptic
		if ('vibrate' in navigator) {
			navigator.vibrate(10);
		}
		// Show brief message
		if (feedbackTimeout) clearTimeout(feedbackTimeout);
		savedFeedback = message;
		feedbackTimeout = setTimeout(() => {
			savedFeedback = null;
		}, 1500);
	}

	// One-at-a-time expandable sections (mobile-friendly)
	function toggleSection(section: 'description' | 'links' | 'shelves' | 'barcode') {
		const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

		if (section === 'description') {
			descriptionOpen = !descriptionOpen;
			if (isMobile && descriptionOpen) { linksOpen = false; shelvesOpen = false; barcodeOpen = false; }
		} else if (section === 'links') {
			linksOpen = !linksOpen;
			if (isMobile && linksOpen) { descriptionOpen = false; shelvesOpen = false; barcodeOpen = false; }
		} else if (section === 'shelves') {
			shelvesOpen = !shelvesOpen;
			if (isMobile && shelvesOpen) { descriptionOpen = false; linksOpen = false; barcodeOpen = false; }
		} else if (section === 'barcode') {
			barcodeOpen = !barcodeOpen;
			if (isMobile && barcodeOpen) { descriptionOpen = false; linksOpen = false; shelvesOpen = false; }
		}
	}

	// Long-press to open menu (mobile-native feel)
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;

	function handleTouchStart(e: TouchEvent) {
		// Don't trigger on interactive elements
		const target = e.target as HTMLElement;
		if (target.closest('button, a, input, textarea')) return;

		longPressTimer = setTimeout(() => {
			menuOpen = true;
			// Subtle haptic feedback if available
			if ('vibrate' in navigator) {
				navigator.vibrate(10);
			}
		}, 500);
	}

	function handleTouchEnd() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function handleTouchMove() {
		// Cancel long-press if user moves finger
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	// Compute active shelves for this book
	const activeShelfIds = $derived(() => {
		return new Set(bookShelves.filter(bs => bs.book_id === book.id).map(bs => bs.shelf_id));
	});

	const activeShelfCount = $derived(() => {
		return activeShelfIds().size;
	});

	// Get the active shelf names for badge display
	const activeShelfNames = $derived(() => {
		const ids = activeShelfIds();
		return shelves.filter(s => ids.has(s.id)).map(s => s.name);
	});

	// Shelf badge text
	const shelfBadgeText = $derived(() => {
		const names = activeShelfNames();
		if (names.length === 0) return null;
		if (names.length === 1) return names[0];
		return `On ${names.length} shelves`;
	});

	// Keep shelves in their original order (no reordering on selection)
	const sortedShelves = $derived(() => {
		return shelves;
	});

	// Get publication year from date string
	function getPublicationYear(dateStr?: string | null): string | null {
		if (!dateStr) return null;
		// Handle YYYY-MM-DD or just YYYY format
		const match = dateStr.match(/^(\d{4})/);
		return match ? match[1] : null;
	}

	const publicationYear = $derived(getPublicationYear(book.publication_date));

	// Handle note editing
	function startEditingNote() {
		tempNoteValue = noteValue;
		selectedChips = new Set();
		noteEditing = true;
	}

	function saveNote() {
		// Compose final note from chips + custom text
		const finalNote = composeNote(selectedChips, tempNoteValue);
		noteValue = finalNote;
		noteEditing = false;
		selectedChips = new Set();
		if (onUpdateNote) {
			onUpdateNote(book.id, noteValue);
			showSavedFeedback('Note saved');
		}
	}

	function cancelNoteEdit() {
		tempNoteValue = '';
		selectedChips = new Set();
		noteEditing = false;
	}

	function toggleChip(chipId: string) {
		const newSet = new Set(selectedChips);
		if (newSet.has(chipId)) {
			newSet.delete(chipId);
		} else {
			newSet.add(chipId);
		}
		selectedChips = newSet;
	}

	function focusTextarea() {
		textareaRef?.focus();
	}

	// Copy ISBN
	async function copyISBN() {
		try {
			await navigator.clipboard.writeText(book.isbn13);
			copied = true;
			setTimeout(() => copied = false, 2000);
		} catch (err) {
			console.error('Failed to copy ISBN:', err);
		}
	}

	// Generate barcode when opened
	$effect(() => {
		if (barcodeOpen && barcodeCanvas) {
			try {
				JsBarcode(barcodeCanvas, book.isbn13, {
					format: 'EAN13',
					width: 1.5,
					height: 60,
					displayValue: false,
					background: '#f5f5f4',
					lineColor: '#1c1917'
				});
			} catch (error) {
				console.error('Error generating barcode:', error);
			}
		}
	});

	// Close menu when clicking outside
	function handleDocumentClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.menu-container')) {
			menuOpen = false;
		}
	}

	$effect(() => {
		if (menuOpen) {
			document.addEventListener('click', handleDocumentClick);
			return () => document.removeEventListener('click', handleDocumentClick);
		}
	});

	// Toggle expand/collapse
	function toggleExpanded() {
		expanded = !expanded;
		onToggleExpand?.(book.id, expanded);
	}
</script>

<div
	{id}
	class="relative w-full rounded-xl border border-stone-200/60 overflow-hidden transition-all duration-200 {expanded ? 'bg-white shadow-md' : 'bg-white/50 hover:bg-white hover:shadow-sm'}"
>
	<!-- Close button for modal mode -->
	{#if onClose}
		<button
			onclick={onClose}
			class="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 hover:text-stone-700 transition-colors"
			aria-label="Close"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	{/if}

	<!-- Header row (always visible, clickable to expand unless in modal mode) -->
	<div
		class="py-5 px-5 md:p-4 flex items-start gap-3 {onClose ? '' : 'cursor-pointer'}"
		onclick={(e) => {
			// In modal mode, don't toggle expand/collapse
			if (onClose) return;

			// Don't toggle if clicking on interactive elements
			const target = e.target as HTMLElement;
			if (target.closest('button, a, input, textarea')) return;

			// Don't toggle if user is selecting text
			const selection = window.getSelection();
			if (selection && selection.toString().length > 0) return;

			toggleExpanded();
		}}
		onkeydown={(e) => {
			if (onClose) return;
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggleExpanded();
			}
		}}
		role={onClose ? undefined : 'button'}
		tabindex={onClose ? undefined : 0}
		aria-expanded={onClose ? undefined : expanded}
		aria-label={onClose ? undefined : (expanded ? `Collapse ${book.title}` : `Expand ${book.title}`)}
	>
		<!-- Cover -->
		<div class="flex-shrink-0 relative">
			{#if book.cover_url}
				<img
					src={book.cover_url}
					alt={book.title}
					class="object-cover rounded-md shadow-sm transition-all duration-200 {expanded ? 'w-20 h-28 md:w-28 md:h-42' : 'w-20 h-28 md:w-14 md:h-21'}"
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<!-- Placeholder cover -->
				<div
					class="bg-gradient-to-br from-stone-300 to-stone-400 rounded-md shadow-sm flex flex-col justify-center p-1.5 text-white transition-all duration-200 {expanded ? 'w-20 h-28 md:w-28 md:h-42' : 'w-20 h-28 md:w-14 md:h-21'}"
				>
					<div class="text-[8px] md:text-[10px] font-serif italic leading-tight line-clamp-3">{book.title}</div>
				</div>
			{/if}

			<!-- Status badges -->
			{#if book.is_read}
				<StatusBadge status="read" />
			{/if}
			{#if book.is_owned}
				<StatusBadge status="owned" stacked={book.is_read} />
			{/if}

			<!-- Screen reader status announcement -->
			{#if book.is_read || book.is_owned}
				<span class="sr-only">
					Status: {[book.is_read && 'Read', book.is_owned && 'Owned'].filter(Boolean).join(', ')}
				</span>
			{/if}
		</div>

		<!-- Content area -->
		<div class="flex-1 min-w-0 flex flex-col">
			<!-- Title and author -->
			<h2 class="text-lg md:text-base font-semibold text-stone-800 leading-snug line-clamp-2">{book.title}</h2>
			{#if book.author && book.author.length > 0}
				<p class="text-base md:text-sm text-stone-400 mt-0.5 line-clamp-1">{book.author.join(', ')}</p>
			{/if}

			<!-- Note preview (collapsed only) -->
			{#if !expanded && book.note}
				<p class="text-sm text-stone-500 mt-1.5 line-clamp-1 italic">
					"{book.note}"
				</p>
			{/if}

			<!-- Publisher/year and status (only when expanded) -->
			{#if expanded}
				{#if book.publisher || publicationYear}
					<p class="text-xs text-stone-400 mt-1.5">
						{book.publisher}{#if publicationYear}{book.publisher ? ' · ' : ''}{publicationYear}{/if}
					</p>
				{/if}

				<!-- Status toggles -->
				<div class="flex items-center gap-1.5 md:gap-2 mt-2">
					<button
						onclick={(e) => {
							e.stopPropagation();
							onToggleRead?.(book.id, book.is_read);
							showSavedFeedback(book.is_read ? 'Marked unread' : 'Marked as read');
						}}
						class="text-[11px] md:text-xs font-medium px-2 md:px-2.5 py-1.5 md:py-1 rounded-lg border transition-all duration-150 ease-out active:scale-[0.97] min-h-[32px] {book.is_read
							? 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
							: 'bg-amber-50/70 text-amber-600 border-amber-200/70 hover:bg-amber-100/70'}"
					>
						{book.is_read ? '✓ Read' : 'Unread'}
					</button>
					<button
						onclick={(e) => {
							e.stopPropagation();
							onToggleOwned?.(book.id, book.is_owned);
							showSavedFeedback(book.is_owned ? 'Marked not owned' : 'Marked as owned');
						}}
						class="text-[11px] md:text-xs font-medium px-2 md:px-2.5 py-1.5 md:py-1 rounded-lg border transition-all duration-150 ease-out active:scale-[0.97] min-h-[32px] {book.is_owned
							? 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
							: 'bg-stone-50 text-stone-400 border-stone-200/70 hover:bg-stone-100'}"
					>
						{book.is_owned ? '✓ Owned' : 'Not owned'}
					</button>
				</div>
			{/if}
		</div>

		<!-- Right side: shelf badge + chevron (compact) or menu + chevron (expanded) -->
		<div class="flex-shrink-0 flex items-start gap-2">
			{#if !expanded && shelfBadgeText()}
				<span class="inline-flex items-center px-4 py-2.5 md:px-3 md:py-1 rounded-lg text-sm md:text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200/50">
					{shelfBadgeText()}
				</span>
			{/if}

			{#if expanded}
				<!-- Overflow menu -->
				<div class="relative menu-container">
					<button
						onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }}
						class="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
						aria-label="More options"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12h.01M12 12h.01M18 12h.01"/>
						</svg>
					</button>
					{#if menuOpen}
						<div class="absolute right-0 top-10 bg-white border border-stone-200 rounded-lg shadow-lg py-1.5 z-10 flex flex-col">
							{#if onEditDetails}
								<button
									onclick={() => { menuOpen = false; onEditDetails?.(book.id); }}
									class="px-4 py-2.5 text-left text-base text-stone-700 hover:bg-stone-100 transition-colors whitespace-nowrap"
								>
									Edit book details
								</button>
							{/if}
							{#if onDelete}
								<button
									onclick={() => { menuOpen = false; onDelete?.(book.id, book.title); }}
									class="px-4 py-2.5 text-left text-base text-red-600 hover:bg-stone-100 transition-colors whitespace-nowrap"
								>
									Remove from library
								</button>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Chevron indicator -->
			<div class="p-1 text-stone-400">
				<svg
					class="w-6 h-6 md:w-5 md:h-5 transition-transform duration-200"
					class:rotate-180={expanded}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
				</svg>
			</div>
		</div>
	</div>

	<!-- Expanded content (note, sections, footer) -->
	{#if expanded}
		<div
			class="border-t border-stone-200/50"
			transition:slide={{ duration: 200 }}
			ontouchstart={handleTouchStart}
			ontouchend={handleTouchEnd}
			ontouchmove={handleTouchMove}
		>
			<div class="p-4 md:p-5">
				<!-- Note section -->
				<div class="mb-4">
					{#if !noteValue && !noteEditing}
						<button
							onclick={startEditingNote}
							class="text-sm text-stone-400 hover:text-stone-500 transition-colors"
						>
							+ Add a note for future you
						</button>
					{:else if noteEditing}
						<div class="relative space-y-4">
							<ReactionChips
								selected={selectedChips}
								onToggle={toggleChip}
								onOtherClick={focusTextarea}
							/>
							<textarea
								bind:this={textareaRef}
								bind:value={tempNoteValue}
								placeholder="What caught your attention about this one?"
								class="w-full text-sm text-stone-600 placeholder-stone-400 border border-stone-200 rounded-lg p-3 focus:outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-200 resize-none"
								rows={2}
							></textarea>
							<div class="flex justify-end gap-2">
								<button
									onclick={cancelNoteEdit}
									class="px-3 py-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors"
								>
									Cancel
								</button>
								<button
									onclick={saveNote}
									class="px-3 py-1.5 text-xs bg-stone-800 text-white rounded-md hover:bg-stone-700 transition-colors"
								>
									Save
								</button>
							</div>
						</div>
					{:else}
						<div class="group relative bg-white/60 rounded-lg p-3 border-l-2 border-stone-300">
							<p class="text-sm text-stone-500 leading-relaxed pr-8">{noteValue}</p>
							<button
								onclick={startEditingNote}
								class="absolute top-2 right-2 p-1.5 text-stone-400 md:opacity-0 md:group-hover:opacity-100 hover:text-stone-600 active:text-stone-700 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1.5 -mt-1.5"
								aria-label="Edit note"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
								</svg>
							</button>
						</div>
					{/if}
				</div>

				<!-- Expandable sections grouped -->
				<div class="pt-3 border-t border-stone-200/50 space-y-0">
					<!-- Description - collapsible -->
					<div>
						<button
							onclick={() => toggleSection('description')}
							class="w-full flex items-center justify-between py-3 md:py-2 px-1 text-sm text-stone-500 hover:text-stone-600 hover:bg-stone-100/50 active:bg-stone-100 transition-colors rounded min-h-[44px]"
						>
							<span>Description</span>
							<svg class="w-4 h-4 transition-transform duration-200" class:rotate-180={descriptionOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
							</svg>
						</button>
						{#if descriptionOpen}
							{#if book.description}
								<p class="px-1 pb-3 text-sm text-stone-500 leading-relaxed">
									{book.description}
								</p>
							{:else}
								<p class="px-1 pb-3 text-sm text-stone-400 italic">
									No description available
								</p>
							{/if}
						{/if}
					</div>

					<!-- Find Elsewhere - collapsible -->
					<div>
						<button
							onclick={() => toggleSection('links')}
							class="w-full flex items-center justify-between py-3 md:py-2 px-1 text-sm text-stone-500 hover:text-stone-600 hover:bg-stone-100/50 active:bg-stone-100 transition-colors rounded min-h-[44px]"
						>
							<span>Find Elsewhere</span>
							<svg class="w-4 h-4 transition-transform duration-200" class:rotate-180={linksOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
							</svg>
						</button>
						{#if linksOpen}
							<div class="px-1 pb-3 flex flex-wrap gap-x-4 gap-y-1">
								<a
									href={`https://www.google.com/books/edition/_/${book.isbn13}`}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm text-stone-500 hover:text-stone-700 transition-colors"
								>
									Google Books ↗
								</a>
								<a
									href={`https://bookshop.org/a/5733/${book.isbn13}`}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm text-stone-500 hover:text-stone-700 transition-colors"
								>
									Bookshop.org ↗
								</a>
								<a
									href={`https://www.powells.com/book/-${book.isbn13}`}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm text-stone-500 hover:text-stone-700 transition-colors"
								>
									Powell's ↗
								</a>
								<a
									href={`https://www.portbooknews.com/book/${book.isbn13}`}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm text-stone-500 hover:text-stone-700 transition-colors"
								>
									Port Book & News ↗
								</a>
								<a
									href={`https://search.worldcat.org/search?q=bn:${book.isbn13}`}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm text-stone-500 hover:text-stone-700 transition-colors"
								>
									WorldCat ↗
								</a>
							</div>
						{/if}
					</div>

					<!-- Shelves - collapsible -->
					<div>
						<button
							onclick={() => toggleSection('shelves')}
							class="w-full flex items-center justify-between py-3 md:py-2 px-1 text-sm text-stone-500 hover:text-stone-600 hover:bg-stone-100/50 active:bg-stone-100 transition-colors rounded min-h-[44px]"
						>
							<span>Shelves <span class="text-stone-400">({activeShelfCount()})</span></span>
							<svg class="w-4 h-4 transition-transform duration-200" class:rotate-180={shelvesOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
							</svg>
						</button>
						{#if shelvesOpen}
							<div class="px-1 pb-3 grid grid-cols-2 gap-x-4 gap-y-0.5">
								{#each sortedShelves() as shelf}
									{@const isChecked = activeShelfIds().has(shelf.id)}
									<button
										onclick={() => {
											onToggleShelf?.(book.id, shelf.id, isChecked);
											showSavedFeedback(isChecked ? `Removed from ${shelf.name}` : `Added to ${shelf.name}`);
										}}
										class="flex items-center gap-2 py-1.5 px-1 -mx-1 rounded hover:bg-white/60 active:scale-[0.98] cursor-pointer group transition-all duration-150 text-left"
										role="checkbox"
										aria-checked={isChecked}
										aria-label={`${shelf.name} shelf`}
									>
										<div class="w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ease-out {isChecked
											? 'bg-stone-700 border-stone-700 scale-100'
											: 'border-stone-300 group-hover:border-stone-400 group-active:scale-95'}">
											{#if isChecked}
												<svg
													class="w-3 h-3 text-white animate-check-pop"
													fill="none"
													stroke="currentColor"
													stroke-width="3"
													viewBox="0 0 24 24"
												>
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
												</svg>
											{/if}
										</div>
										<span class="text-xs transition-colors duration-150 {isChecked ? 'text-stone-700 font-medium' : 'text-stone-500'}">
											{shelf.name}
										</span>
									</button>
								{/each}
								{#if shelves.length === 0}
									<p class="text-xs text-stone-400 italic py-1 col-span-2">No shelves yet</p>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Barcode - collapsible -->
					<div>
						<button
							onclick={() => toggleSection('barcode')}
							class="w-full flex items-center justify-between py-3 md:py-2 px-1 text-sm text-stone-500 hover:text-stone-600 hover:bg-stone-100/50 active:bg-stone-100 transition-colors rounded min-h-[44px]"
						>
							<span>Barcode</span>
							<svg class="w-4 h-4 transition-transform duration-200" class:rotate-180={barcodeOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
							</svg>
						</button>
						{#if barcodeOpen}
							<div class="px-1 pb-3 flex flex-col items-center py-4 bg-white/60 rounded-lg">
								<p class="text-xs text-stone-400 mb-3">Scan at bookstore or library</p>
								<canvas bind:this={barcodeCanvas} class="max-w-full"></canvas>
								<p class="text-xs font-mono text-stone-500 mt-2 tracking-wider">{book.isbn13}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Footer - metadata -->
			<div class="px-5 py-3 border-t border-stone-200/40 flex items-center justify-between text-xs text-stone-400">
				<span>Added {new Date(book.added_at).toLocaleDateString()}</span>
				<div class="flex items-center gap-3">
					<button
						onclick={copyISBN}
						class="flex items-center gap-1.5 hover:text-stone-500 transition-colors"
					>
						{#if copied}
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
							</svg>
							<span>Copied</span>
						{:else}
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
							</svg>
							<span>{book.isbn13}</span>
						{/if}
					</button>
					{#if onShare}
						<button
							onclick={() => onShare?.({ isbn13: book.isbn13, title: book.title })}
							class="flex items-center gap-1.5 hover:text-stone-500 transition-colors"
						>
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
							</svg>
							<span>Share</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Soft success toast -->
	{#if savedFeedback}
		<div
			class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-stone-800 text-white text-xs rounded-full shadow-lg pointer-events-none z-20"
			in:fade={{ duration: 150 }}
			out:fade={{ duration: 200 }}
		>
			{savedFeedback}
		</div>
	{/if}
</div>
