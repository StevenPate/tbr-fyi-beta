<script lang="ts">
	import { fade } from 'svelte/transition';
	import JsBarcode from 'jsbarcode';

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
		onShare
	}: Props = $props();

	// State
	let descriptionOpen = $state(false);
	let linksOpen = $state(false);
	let shelvesOpen = $state(false);
	let barcodeOpen = $state(false);
	let noteEditing = $state(false);
	let noteValue = $state(book.note || '');
	let tempNoteValue = $state('');
	let menuOpen = $state(false);
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
		noteEditing = true;
	}

	function saveNote() {
		noteValue = tempNoteValue;
		noteEditing = false;
		if (onUpdateNote) {
			onUpdateNote(book.id, noteValue);
			showSavedFeedback('Note saved');
		}
	}

	function cancelNoteEdit() {
		tempNoteValue = '';
		noteEditing = false;
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
</script>

<div
	{id}
	class="relative w-full bg-[#FAFAFA] rounded-xl border border-stone-200/60 overflow-hidden hover:bg-stone-50 transition-colors duration-150"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
	ontouchmove={handleTouchMove}
>
	<!-- Main content area -->
	<div class="p-4 md:p-5">
		<div class="flex gap-3 md:gap-5">
			<!-- Book Cover -->
			<div class="flex-shrink-0">
				{#if book.cover_url}
					<img
						src={book.cover_url}
						alt={book.title}
						class="w-16 h-24 md:w-28 md:h-42 object-cover rounded-lg shadow-sm"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<!-- Placeholder cover with gradient -->
					<div class="w-16 h-24 md:w-28 md:h-42 bg-gradient-to-br from-stone-300 to-stone-400 rounded-lg shadow-sm flex flex-col justify-between p-2 md:p-3 text-white">
						<div>
							{#if book.author && book.author.length > 0}
								<div class="text-[10px] md:text-xs font-medium opacity-90 line-clamp-1">{book.author.join(', ')}</div>
							{/if}
							<div class="text-xs md:text-sm font-serif italic leading-tight mt-0.5 md:mt-1 line-clamp-2">{book.title}</div>
						</div>
						{#if book.publisher}
							<div class="text-[8px] md:text-[10px] opacity-70 hidden md:block">{book.publisher}</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Text content -->
			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<h2 class="text-base md:text-xl font-semibold text-stone-800 leading-snug line-clamp-2">{book.title}</h2>
						{#if book.author && book.author.length > 0}
							<p class="text-xs md:text-sm text-stone-400 mt-0.5 line-clamp-1">{book.author.join(', ')}</p>
						{/if}
					</div>

					<!-- Overflow menu -->
					<div class="relative menu-container flex-shrink-0">
						<button
							onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }}
							class="p-2.5 md:p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center"
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
				</div>

				<!-- Metadata line - hidden on mobile -->
				{#if book.publisher || publicationYear}
					<p class="hidden md:block text-xs text-stone-400 mt-1">
						{book.publisher}{#if publicationYear}{book.publisher ? ' · ' : ''}{publicationYear}{/if}
					</p>
				{/if}

				<!-- Status toggles - horizontal on mobile, same on desktop -->
				<div class="flex items-center gap-1.5 md:gap-2 mt-2 md:mt-3">
					<button
						onclick={() => {
							onToggleRead?.(book.id, book.is_read);
							showSavedFeedback(book.is_read ? 'Marked unread' : 'Marked as read');
						}}
						class="text-[11px] md:text-xs font-medium px-2 md:px-2.5 py-1.5 md:py-1 rounded-full border transition-all duration-200 ease-out min-h-[32px] {book.is_read
							? 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
							: 'bg-amber-50/70 text-amber-600 border-amber-200/70 hover:bg-amber-100/70'}"
					>
						{book.is_read ? '✓ Read' : 'Unread'}
					</button>
					<button
						onclick={() => {
							onToggleOwned?.(book.id, book.is_owned);
							showSavedFeedback(book.is_owned ? 'Marked not owned' : 'Marked as owned');
						}}
						class="text-[11px] md:text-xs font-medium px-2 md:px-2.5 py-1.5 md:py-1 rounded-full border transition-all duration-200 ease-out min-h-[32px] {book.is_owned
							? 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
							: 'bg-stone-50 text-stone-400 border-stone-200/70 hover:bg-stone-100'}"
					>
						{book.is_owned ? '✓ Owned' : 'Not owned'}
					</button>
				</div>
			</div>
		</div>

		<!-- Note section -->
		<div class="mt-4">
			{#if !noteValue && !noteEditing}
				<button
					onclick={startEditingNote}
					class="text-sm text-stone-400 hover:text-stone-500 transition-colors"
				>
					+ Add a note
				</button>
			{:else if noteEditing}
				<div class="relative">
					<textarea
						bind:value={tempNoteValue}
						placeholder="Why did you add this? Where did you hear about it?"
						class="w-full text-sm text-stone-600 placeholder-stone-400 border border-stone-200 rounded-lg p-3 focus:outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-200 resize-none"
						rows={2}
					></textarea>
					<div class="flex justify-end gap-2 mt-2">
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
						class="absolute top-2 right-2 p-1.5 text-stone-400 opacity-0 group-hover:opacity-100 hover:text-stone-600 transition-all"
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
		<div class="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-stone-200/50 space-y-0">
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
								class="flex items-center gap-2 py-1.5 px-1 -mx-1 rounded hover:bg-white/60 cursor-pointer group transition-colors duration-150 text-left"
								role="checkbox"
								aria-checked={isChecked}
								aria-label={`${shelf.name} shelf`}
							>
								<div class="w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ease-out {isChecked
									? 'bg-stone-700 border-stone-700'
									: 'border-stone-300 group-hover:border-stone-400'}">
									{#if isChecked}
										<svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
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

	<!-- Soft success toast -->
	{#if savedFeedback}
		<div
			class="absolute bottom-16 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-stone-800 text-white text-xs rounded-full shadow-lg pointer-events-none"
			in:fade={{ duration: 150 }}
			out:fade={{ duration: 200 }}
		>
			{savedFeedback}
		</div>
	{/if}
</div>