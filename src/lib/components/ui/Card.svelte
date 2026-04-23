<script lang="ts">
	import { fade, slide } from 'svelte/transition';
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
		lifted?: boolean;
		onToggleExpand?: (bookId: string, isExpanded: boolean) => void;
		onSettle?: (bookId: string) => void;
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
		lifted = false,
		onToggleExpand,
		onSettle,
		onClose
	}: Props = $props();

	// State
	let shelvesOpen = $state(false);
	let noteEditing = $state(false);
	let noteValue = $state(book.note || '');
	let tempNoteValue = $state('');
	let selectedChips = $state<Set<string>>(new Set());
	let menuOpen = $state(false);
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let descriptionExpanded = $state(false);

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

	// Soft success feedback
	let savedFeedback = $state<string | null>(null);
	let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

	function showSavedFeedback(message: string = 'Saved') {
		if ('vibrate' in navigator) {
			navigator.vibrate(10);
		}
		if (feedbackTimeout) clearTimeout(feedbackTimeout);
		savedFeedback = message;
		feedbackTimeout = setTimeout(() => {
			savedFeedback = null;
		}, 1500);
	}

	// Long-press to open menu (mobile-native feel)
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;

	function handleTouchStart(e: TouchEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('button, a, input, textarea')) return;

		longPressTimer = setTimeout(() => {
			menuOpen = true;
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
		const match = dateStr.match(/^(\d{4})/);
		return match ? match[1] : null;
	}

	const publicationYear = $derived(getPublicationYear(book.publication_date));

	// Recency indicator: books added within last 24 hours
	const isRecentlyAdded = $derived(() => {
		const addedAt = new Date(book.added_at);
		const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		return addedAt > dayAgo;
	});

	// Handle note editing
	function startEditingNote() {
		tempNoteValue = noteValue;
		selectedChips = new Set();
		noteEditing = true;
	}

	function saveNote() {
		const finalNote = composeNote(selectedChips, tempNoteValue);
		noteValue = finalNote;
		noteEditing = false;
		selectedChips = new Set();
		if (onUpdateNote) {
			onUpdateNote(book.id, noteValue);
			showSavedFeedback('Note saved');
		}
		if (lifted) onSettle?.(book.id);
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
		// Settle lifted items when collapsed after interaction
		if (!expanded && lifted) {
			onSettle?.(book.id);
		}
	}

	// Relative time for lifted items
	function relativeTime(addedAt: string): string {
		const days = Math.floor((Date.now() - new Date(addedAt).getTime()) / (1000 * 60 * 60 * 24));
		if (days < 7) return `${days} days ago`;
		const weeks = Math.floor(days / 7);
		if (weeks <= 8) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
		const months = Math.floor(days / 30);
		return `${months} month${months > 1 ? 's' : ''} ago`;
	}
</script>

<div
	{id}
	class="relative w-full transition-all duration-150
		{isRecentlyAdded() ? 'border-l-2 border-l-[var(--accent)]' : ''}
		{expanded ? 'bg-[var(--surface)]' : 'hover:bg-[var(--background-alt)]'}
		{lifted && !expanded ? 'py-2' : ''}
		border-b border-[var(--border)]"
>
	<!-- Close button for modal mode -->
	{#if onClose}
		<button
			onclick={onClose}
			class="absolute top-2 right-2 z-10 p-1.5 rounded bg-[var(--background-alt)] hover:bg-[var(--paper-dark)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
			aria-label="Close"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	{/if}

	<!-- Header row (always visible, clickable to expand unless in modal mode) -->
	<div
		class="py-3 px-4 flex items-center gap-3 {onClose ? '' : 'cursor-pointer'}"
		onclick={(e) => {
			if (onClose) return;
			const target = e.target as HTMLElement;
			if (target.closest('button, a, input, textarea')) return;
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
					class="w-12 h-[72px] object-cover rounded-sm shadow-sm"
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<!-- Placeholder cover -->
				<div
					class="w-12 h-[72px] bg-gradient-to-br from-[var(--paper-dark)] to-[var(--warm-gray)] rounded-sm shadow-sm flex flex-col justify-center p-1 text-white"
				>
					<div class="text-[7px] font-serif italic leading-tight line-clamp-3">{book.title}</div>
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
		<div class="flex-1 min-w-0">
			<h2 class="font-serif italic text-lg text-[var(--text-primary)] leading-snug line-clamp-2">{book.title}</h2>
			{#if book.author && book.author.length > 0}
				<p class="text-sm text-[var(--text-secondary)] mt-0.5 line-clamp-1">{book.author.join(', ')}</p>
			{/if}
		</div>

		<!-- Right side: menu when expanded -->
		{#if expanded}
			<div class="flex-shrink-0 flex items-start">
				<!-- Overflow menu -->
				<div class="relative menu-container">
					<button
						onclick={(e) => { e.stopPropagation(); menuOpen = !menuOpen; }}
						class="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--background-alt)] rounded transition-colors"
						aria-label="More options"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12h.01M12 12h.01M18 12h.01"/>
						</svg>
					</button>
					{#if menuOpen}
						<div class="absolute right-0 top-10 bg-[var(--surface)] border border-[var(--border)] rounded shadow-lg py-1.5 z-10 flex flex-col">
							{#if onEditDetails}
								<button
									onclick={() => { menuOpen = false; onEditDetails?.(book.id); }}
									class="px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--background-alt)] transition-colors whitespace-nowrap"
								>
									Edit book details
								</button>
							{/if}
							{#if onShare}
								<button
									onclick={() => { menuOpen = false; onShare?.({ isbn13: book.isbn13, title: book.title }); }}
									class="px-4 py-2.5 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--background-alt)] transition-colors whitespace-nowrap"
								>
									Share
								</button>
							{/if}
							{#if onDelete}
								<button
									onclick={() => { menuOpen = false; onDelete?.(book.id, book.title); }}
									class="px-4 py-2.5 text-left text-sm text-red-600 hover:bg-[var(--background-alt)] transition-colors whitespace-nowrap"
								>
									Remove from library
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Lifted note zone: visible when lifted, stays during expansion -->
	{#if lifted && (noteValue || noteEditing) && !onClose}
		<div class="pl-[60px] px-4 {expanded ? '' : 'pb-2'}">
			{#if noteEditing}
				<div class="relative space-y-3">
					<ReactionChips
						selected={selectedChips}
						onToggle={toggleChip}
						onOtherClick={focusTextarea}
					/>
					<textarea
						bind:this={textareaRef}
						bind:value={tempNoteValue}
						placeholder="What caught your attention?"
						class="w-full text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] border border-[var(--border)] rounded p-3 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] resize-none bg-[var(--surface)]"
						rows={2}
					></textarea>
					<div class="flex justify-end gap-2">
						<button
							onclick={cancelNoteEdit}
							class="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
						>
							Cancel
						</button>
						<button
							onclick={saveNote}
							class="px-3 py-1.5 text-xs bg-[var(--surface-dark)] text-[var(--text-on-dark)] rounded hover:bg-[var(--surface-dark-secondary)] transition-colors"
						>
							Save
						</button>
					</div>
				</div>
			{:else}
				<div class="group relative">
					<p class="text-sm text-[var(--text-secondary)] leading-relaxed italic pr-8">"{noteValue}"</p>
					{#if expanded}
						<button
							onclick={startEditingNote}
							class="absolute top-0 right-0 p-1.5 text-[var(--text-tertiary)] md:opacity-0 md:group-hover:opacity-100 hover:text-[var(--text-secondary)] active:text-[var(--text-primary)] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1.5 -mt-1.5"
							aria-label="Edit note"
						>
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
							</svg>
						</button>
					{/if}
				</div>
				{#if !expanded}
					<p class="text-xs text-[var(--warm-gray)] mt-1">added {relativeTime(book.added_at)}</p>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Expanded content -->
	{#if expanded}
		<div
			transition:slide={{ duration: lifted ? 100 : 150 }}
			ontouchstart={handleTouchStart}
			ontouchend={handleTouchEnd}
			ontouchmove={handleTouchMove}
		>
			<div class="px-0 pb-4 pt-1">
				<!-- Note section: skip if lifted (already showing in lifted zone) -->
				{#if !lifted || !noteValue}
				<div class="mb-4 pl-[60px]">
					{#if !noteValue && !noteEditing}
						<button
							onclick={startEditingNote}
							class="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
						>
							+ Add a note
						</button>
					{:else if noteEditing}
						<div class="relative space-y-3">
							<ReactionChips
								selected={selectedChips}
								onToggle={toggleChip}
								onOtherClick={focusTextarea}
							/>
							<textarea
								bind:this={textareaRef}
								bind:value={tempNoteValue}
								placeholder="What caught your attention?"
								class="w-full text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] border border-[var(--border)] rounded p-3 focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] resize-none bg-[var(--surface)]"
								rows={2}
							></textarea>
							<div class="flex justify-end gap-2">
								<button
									onclick={cancelNoteEdit}
									class="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
								>
									Cancel
								</button>
								<button
									onclick={saveNote}
									class="px-3 py-1.5 text-xs bg-[var(--surface-dark)] text-[var(--text-on-dark)] rounded hover:bg-[var(--surface-dark-secondary)] transition-colors"
								>
									Save
								</button>
							</div>
						</div>
					{:else}
						<div class="group relative">
							<p class="text-sm text-[var(--text-secondary)] leading-relaxed italic pr-8">"{noteValue}"</p>
							<button
								onclick={startEditingNote}
								class="absolute top-0 right-0 p-1.5 text-[var(--text-tertiary)] md:opacity-0 md:group-hover:opacity-100 hover:text-[var(--text-secondary)] active:text-[var(--text-primary)] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center -mr-1.5 -mt-1.5"
								aria-label="Edit note"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
								</svg>
							</button>
						</div>
					{/if}
				</div>
				{/if}

				<!-- Description (show first 3 lines with "more" link) -->
				{#if book.description}
					<div class="mb-4 pl-[60px]">
						<p class="text-sm text-[var(--text-secondary)] leading-relaxed {descriptionExpanded ? '' : 'line-clamp-3'}">
							{book.description}
						</p>
						{#if !descriptionExpanded && book.description.length > 200}
							<button
								onclick={() => descriptionExpanded = true}
								class="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] mt-1 transition-colors"
							>
								more
							</button>
						{/if}
					</div>
				{/if}

				<!-- Publisher/year metadata -->
				{#if book.publisher || publicationYear}
					<div class="mb-3 pl-[60px]">
						<p class="text-xs text-[var(--text-tertiary)]">
							{book.publisher}{#if publicationYear}{book.publisher ? ' · ' : ''}{publicationYear}{/if}
						</p>
					</div>
				{/if}

				<!-- Status toggles as subtle text links -->
				<div class="flex items-center gap-4 mb-4 pl-[60px]">
					<button
						onclick={(e) => {
							e.stopPropagation();
							onToggleRead?.(book.id, book.is_read);
							showSavedFeedback(book.is_read ? 'Marked unread' : 'Marked as read');
							if (lifted) onSettle?.(book.id);
						}}
						class="text-xs transition-colors {book.is_read
							? 'text-[var(--status-read)]'
							: 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}"
					>
						{book.is_read ? 'Read \u2713' : 'Mark as read'}
					</button>
					<button
						onclick={(e) => {
							e.stopPropagation();
							onToggleOwned?.(book.id, book.is_owned);
							showSavedFeedback(book.is_owned ? 'Marked not owned' : 'Marked as owned');
						}}
						class="text-xs transition-colors {book.is_owned
							? 'text-[var(--status-owned)]'
							: 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}"
					>
						{book.is_owned ? 'Owned \u2713' : 'Mark as owned'}
					</button>
				</div>

				<!-- Shelves section -->
				<div class="pl-[60px]">
					<button
						onclick={() => shelvesOpen = !shelvesOpen}
						class="flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mb-2"
					>
						<span>Shelves</span>
						<span class="text-[var(--text-tertiary)]">({activeShelfCount()})</span>
						<svg class="w-3 h-3 transition-transform duration-150" class:rotate-180={shelvesOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
						</svg>
					</button>
					{#if shelvesOpen}
						<div class="grid grid-cols-2 gap-x-4 gap-y-0.5">
							{#each sortedShelves() as shelf}
								{@const isChecked = activeShelfIds().has(shelf.id)}
								<button
									onclick={() => {
										onToggleShelf?.(book.id, shelf.id, isChecked);
										showSavedFeedback(isChecked ? `Removed from ${shelf.name}` : `Added to ${shelf.name}`);
									}}
									class="flex items-center gap-2 py-1.5 px-1 -mx-1 rounded hover:bg-[var(--background-alt)] active:scale-[0.98] cursor-pointer group transition-all duration-150 text-left"
									role="checkbox"
									aria-checked={isChecked}
									aria-label={`${shelf.name} shelf`}
								>
									<div class="w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 ease-out {isChecked
										? 'bg-[var(--surface-dark)] border-[var(--surface-dark)] scale-100'
										: 'border-[var(--paper-dark)] group-hover:border-[var(--warm-gray)] group-active:scale-95'}">
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
									<span class="text-xs transition-colors duration-150 {isChecked ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}">
										{shelf.name}
									</span>
								</button>
							{/each}
							{#if shelves.length === 0}
								<p class="text-xs text-[var(--text-tertiary)] italic py-1 col-span-2">No shelves yet</p>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Footer - metadata -->
				<div class="mt-4 pl-[60px] flex items-center text-xs text-[var(--text-tertiary)]">
					<span>Added {new Date(book.added_at).toLocaleDateString()}</span>
					{#if isRecentlyAdded()}
						<span class="ml-2">· Just added</span>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- Soft success toast -->
	{#if savedFeedback}
		<div
			class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-[var(--surface-dark)] text-[var(--text-on-dark)] text-xs rounded shadow-lg pointer-events-none z-20"
			in:fade={{ duration: 150 }}
			out:fade={{ duration: 200 }}
		>
			{savedFeedback}
		</div>
	{/if}
</div>
