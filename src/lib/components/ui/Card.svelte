<script lang="ts">
	import { fade, slide } from 'svelte/transition';
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
	let descriptionExpanded = $state(false);
	let menuOpen = $state(false);
	let noteFocused = $state(false);
	let linksOpen = $state(false);
	let copied = $state(false);
	let barcodeCanvas = $state<HTMLCanvasElement | null>(null);

	// Track what the server's note value is, so we know when it changes
	let lastServerNote = $state(book.note);
	let lastBookId = $state(book.id);

	// Sync noteValue with book.note when it changes externally (e.g., after invalidateAll)
	$effect(() => {
		const serverNote = book.note;
		const bookChanged = book.id !== lastBookId;

		if (bookChanged) {
			noteValue = serverNote || '';
			lastServerNote = serverNote;
			lastBookId = book.id;
		} else if (!noteEditing && serverNote !== lastServerNote) {
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

	// Compute active shelves for this book
	const activeShelfIds = $derived(() => {
		return new Set(bookShelves.filter(bs => bs.book_id === book.id).map(bs => bs.shelf_id));
	});

	const activeShelfCount = $derived(() => {
		return activeShelfIds().size;
	});

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

	const metaParts = $derived(
		[book.publisher, publicationYear].filter(Boolean) as string[]
	);

	const addedDate = $derived(
		new Date(book.added_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
	);

	// Handle note editing
	function startEditingNote() {
		if (noteEditing) return;
		tempNoteValue = noteValue;
		noteEditing = true;
	}

	function saveNote() {
		noteValue = tempNoteValue.trim();
		noteEditing = false;
		if (onUpdateNote) {
			onUpdateNote(book.id, noteValue);
			showSavedFeedback('Note saved');
		}
		if (lifted) setTimeout(() => onSettle?.(book.id), 200);
	}

	function cancelNoteEdit() {
		tempNoteValue = '';
		noteEditing = false;
	}

	function saveInlineNote() {
		const trimmed = tempNoteValue.trim();
		if (!trimmed) return;
		noteValue = trimmed;
		tempNoteValue = '';
		noteFocused = false;
		if (onUpdateNote) {
			onUpdateNote(book.id, noteValue);
			showSavedFeedback('Note saved');
		}
		if (lifted) setTimeout(() => onSettle?.(book.id), 200);
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
		if (menuOpen && barcodeCanvas) {
			try {
				JsBarcode(barcodeCanvas, book.isbn13, {
					format: 'EAN13',
					width: 1.5,
					height: 60,
					displayValue: false,
					background: '#ffffff',
					lineColor: '#3d3d3d'
				});
			} catch (error) {
				console.error('Error generating barcode:', error);
			}
		}
	});

	// Toggle expand/collapse
	function toggleExpanded() {
		expanded = !expanded;
		onToggleExpand?.(book.id, expanded);
		if (!expanded) {
			noteFocused = false;
			if (lifted) onSettle?.(book.id);
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
		{expanded ? 'bg-[var(--surface)]' : 'hover:bg-[var(--background-alt)]'}
		{lifted && !expanded ? 'py-3 bg-[var(--paper-light)]/30' : ''}
		border-b border-[var(--border)]"
>
	{#if onClose}
		<!-- Close button for modal mode -->
		<button
			onclick={onClose}
			class="absolute top-2 right-2 z-10 p-1.5 rounded bg-[var(--background-alt)] hover:bg-[var(--paper-dark)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
			aria-label="Close"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	{:else if expanded}
		<!-- Kebab menu -->
		<button
			onclick={() => menuOpen = !menuOpen}
			class="absolute top-3 right-3 z-10 p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
			aria-label="More options"
		>
			<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
				<circle cx="12" cy="5" r="1.5"/>
				<circle cx="12" cy="12" r="1.5"/>
				<circle cx="12" cy="19" r="1.5"/>
			</svg>
		</button>
	{/if}

	<!-- Header row (identical in all states — no badges, no menus, no timestamps) -->
	{#if onClose}
		<div class="py-3 px-4 flex gap-3 {expanded ? 'items-start' : 'items-center'}">
			<!-- Cover 40×60 -->
			<div class="flex-shrink-0">
				{#if book.cover_url}
					<img
						src={book.cover_url}
						alt={book.title}
						class="{expanded ? 'w-20 h-[120px]' : 'w-10 h-[60px]'} object-cover rounded-sm shadow-sm transition-all duration-200 ease-out"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<div
						class="{expanded ? 'w-20 h-[120px]' : 'w-10 h-[60px]'} bg-gradient-to-br from-[var(--paper-dark)] to-[var(--warm-gray)] rounded-sm shadow-sm flex flex-col justify-center p-2 text-white transition-all duration-200 ease-out"
					>
						<div class="text-[7px] font-serif italic leading-tight line-clamp-3">{book.title}</div>
					</div>
				{/if}
			</div>

			<!-- Title + Author -->
			<div class="flex-1 min-w-0">
				<h2 class="font-serif italic text-lg text-[var(--text-primary)] leading-snug line-clamp-2">{book.title}{#if book.is_read}<span class="text-sm not-italic text-[var(--text-tertiary)]"> ✓</span>{/if}</h2>
				{#if book.author && book.author.length > 0}
					<p class="text-sm text-[var(--warm-gray)]/70 mt-1 line-clamp-1">{book.author.join(', ')}</p>
				{/if}
			</div>

			<!-- Screen reader status (no visual indicator in header) -->
			{#if book.is_read || book.is_owned}
				<span class="sr-only">
					Status: {[book.is_read && 'Read', book.is_owned && 'Owned'].filter(Boolean).join(', ')}
				</span>
			{/if}
		</div>
	{:else}
		<!-- Interactive header (button role) -->
		<div
			class="py-3 px-4 flex gap-3 {expanded ? 'items-start' : 'items-center'} cursor-pointer"
			onclick={(e) => {
				const target = e.target as HTMLElement;
				if (target.closest('button, a, input, textarea')) return;
				const selection = window.getSelection();
				if (selection && selection.toString().length > 0) return;
				toggleExpanded();
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleExpanded();
				}
			}}
			role="button"
			tabindex="0"
			aria-expanded={expanded}
			aria-label={expanded ? `Collapse ${book.title}` : `Expand ${book.title}`}
		>
			<!-- Cover 40×60 -->
			<div class="flex-shrink-0">
				{#if book.cover_url}
					<img
						src={book.cover_url}
						alt={book.title}
						class="{expanded ? 'w-20 h-[120px]' : 'w-10 h-[60px]'} object-cover rounded-sm shadow-sm transition-all duration-200 ease-out"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<div
						class="{expanded ? 'w-20 h-[120px]' : 'w-10 h-[60px]'} bg-gradient-to-br from-[var(--paper-dark)] to-[var(--warm-gray)] rounded-sm shadow-sm flex flex-col justify-center p-2 text-white transition-all duration-200 ease-out"
					>
						<div class="text-[7px] font-serif italic leading-tight line-clamp-3">{book.title}</div>
					</div>
				{/if}
			</div>

			<!-- Title + Author -->
			<div class="flex-1 min-w-0">
				<h2 class="font-serif italic text-lg text-[var(--text-primary)] leading-snug line-clamp-2">{book.title}{#if book.is_read}<span class="text-sm not-italic text-[var(--text-tertiary)]"> ✓</span>{/if}</h2>
				{#if book.author && book.author.length > 0}
					<p class="text-sm text-[var(--warm-gray)]/70 mt-1 line-clamp-1">{book.author.join(', ')}</p>
				{/if}
			</div>

			<!-- Screen reader status (no visual indicator in header) -->
			{#if book.is_read || book.is_owned}
				<span class="sr-only">
					Status: {[book.is_read && 'Read', book.is_owned && 'Owned'].filter(Boolean).join(', ')}
				</span>
			{/if}
		</div>
	{/if}

	<!-- Lifted note zone: recognition + meaning (persists during expansion) -->
	{#if lifted && (noteValue || noteEditing) && !onClose}
		<div class="{expanded ? 'pl-[108px]' : 'pl-[68px]'} pr-4 {expanded ? '' : 'pb-3'} transition-[padding] duration-200 ease-out"
			style="{expanded ? 'margin-top: calc(var(--spacing) * -15)' : ''}"
		>
			{#if noteEditing}
				<div class="relative space-y-2 mt-3">
					<textarea
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
				<p class="text-base text-[var(--text-secondary)] leading-relaxed mt-1 italic">{noteValue}</p>
				{#if !expanded}
					<p class="text-xs text-[var(--warm-gray)] mt-1.5">added {relativeTime(book.added_at)}</p>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Expanded content: act on the book -->
	{#if expanded}
		<div transition:slide={{ duration: lifted ? 100 : 150 }}>
			<div class="pb-4" style="{lifted && (noteValue || noteEditing) ? '' : 'margin-top: calc(var(--spacing) * -15)'}">
				<!-- Note -->
				{#if lifted && noteEditing}
					<!-- Lifted zone above handles edit form -->
				{:else if !lifted && noteEditing}
					<div class="mb-3 pl-[108px] pr-4">
						<div class="relative space-y-3">
							<textarea
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
					</div>
				{:else if noteValue}
					<div class="mb-3 pl-[108px] pr-4">
						{#if lifted}
							<button
								onclick={startEditingNote}
								class="flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
								</svg>
								<span>Edit note</span>
							</button>
						{:else}
							<div class="flex items-start gap-2">
								<p class="text-base text-[var(--text-secondary)] leading-relaxed italic flex-1">{noteValue}</p>
								<button
									onclick={startEditingNote}
									class="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors mt-0.5"								aria-label="Edit note"								>
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
									</svg>
								</button>
							</div>
						{/if}
					</div>
				{:else}
					<div class="mb-3 pl-[108px] pr-4"
						onfocusin={() => noteFocused = true}
						onfocusout={(e) => {
							const related = (e as FocusEvent).relatedTarget as HTMLElement | null;
							if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
								if (!tempNoteValue.trim()) noteFocused = false;
							}
						}}
					>
						<div class="flex gap-2 items-stretch">
							<textarea
								bind:value={tempNoteValue}
								placeholder="Write a note…"
								class="flex-1 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)]/50 rounded-md px-3 py-2 resize-none bg-transparent border border-[var(--border)]/30 focus:border-[var(--border)]/60 focus:bg-[var(--surface)]/50 focus:outline-none transition-all duration-150"
								rows={1}
							></textarea>
							{#if noteFocused || tempNoteValue.trim()}
								<button
									onclick={saveInlineNote}
									class="flex-shrink-0 px-3 text-xs rounded bg-[var(--background-alt)] text-[var(--text-secondary)] hover:bg-[var(--paper-dark)] hover:text-[var(--text-primary)] transition-all duration-150"
								>
									Save
								</button>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Description -->
				{#if book.description}
					<div class="mt-3 mb-5 pl-[108px] pr-4">
						<p class="text-sm text-[var(--text-tertiary)] leading-relaxed {descriptionExpanded ? '' : 'line-clamp-3'}">
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

				<!-- Metadata line -->
				{#if metaParts.length > 0}
					<div class="pl-[108px] pr-4 text-xs text-[var(--text-tertiary)]">
						<p>{#each metaParts as part, i}{#if i > 0} &ensp;&middot;&ensp; {/if}{part}{/each}</p>
					</div>
				{/if}

				<!-- Zone 2: Control Panel -->
				<div class="mt-5 mx-3 mb-1 rounded-lg border-t border-[var(--border)]/40 bg-[var(--background)]/50 pt-2.5 pb-2.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]">

				<!-- Status pills -->
				<div class="pl-[96px] pr-3 flex gap-2 mb-1.5">
					<button
						onclick={(e) => {
							e.stopPropagation();
							onToggleRead?.(book.id, book.is_read);
							showSavedFeedback(book.is_read ? 'Marked unread' : 'Marked as read');
							if (lifted) setTimeout(() => onSettle?.(book.id), 200);
						}}
						class="px-3 py-1 text-[11px] rounded-full border transition-all duration-150 {book.is_read
							? 'bg-[var(--charcoal)] text-white border-[var(--charcoal)]'
							: 'bg-transparent text-[var(--text-tertiary)] border-[var(--paper-dark)] hover:border-[var(--warm-gray)] hover:text-[var(--text-secondary)]'}"
					>
						{book.is_read ? '✓ Read' : 'Read'}
					</button>
					<button
						onclick={(e) => {
							e.stopPropagation();
							onToggleOwned?.(book.id, book.is_owned);
							showSavedFeedback(book.is_owned ? 'Marked not owned' : 'Marked as owned');
						}}
						class="px-3 py-1 text-[11px] rounded-full border transition-all duration-150 {book.is_owned
							? 'bg-[var(--charcoal)] text-white border-[var(--charcoal)]'
							: 'bg-transparent text-[var(--text-tertiary)] border-[var(--paper-dark)] hover:border-[var(--warm-gray)] hover:text-[var(--text-secondary)]'}"
					>
						{book.is_owned ? '✓ Owned' : 'Owned'}
					</button>
				</div>

				<!-- Shelves -->
				<div class="pl-[96px] pr-3 mb-0.5">
					<button
						onclick={() => shelvesOpen = !shelvesOpen}
						class="py-1 text-[11px] text-left text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1.5"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
						</svg>
						<span>Shelves ({activeShelfCount()})</span>
						<svg class="w-3.5 h-3.5 transition-transform duration-150" class:rotate-180={shelvesOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
						</svg>
					</button>
					{#if shelvesOpen}
						<div class="mt-1 mb-2">
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
						</div>
					{/if}
				</div>

				<!-- Find Elsewhere -->
				<div class="pl-[96px] pr-3 mb-0.5">
					<button
						onclick={() => linksOpen = !linksOpen}
						class="py-1 text-[11px] text-left text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex items-center gap-1.5"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
						</svg>
						<span>Find Elsewhere</span>
						<svg class="w-3.5 h-3.5 transition-transform duration-150" class:rotate-180={linksOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
						</svg>
					</button>
					{#if linksOpen}
						<div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 pb-1">
							<a href={`https://www.google.com/search?tbm=bks&q=isbn:${book.isbn13}`} target="_blank" rel="noopener noreferrer" class="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">Google Books ↗</a>
							<a href={`https://bookshop.org/a/5733/${book.isbn13}`} target="_blank" rel="noopener noreferrer" class="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">Bookshop.org ↗</a>
							<a href={`https://www.powells.com/book/-${book.isbn13}`} target="_blank" rel="noopener noreferrer" class="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">Powell's ↗</a>
							<a href={`https://www.portbooknews.com/book/${book.isbn13}`} target="_blank" rel="noopener noreferrer" class="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">Port Book & News ↗</a>
							<a href={`https://search.worldcat.org/search?q=bn:${book.isbn13}`} target="_blank" rel="noopener noreferrer" class="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">WorldCat ↗</a>
						</div>
					{/if}
				</div>

					</div>
			</div>
		</div>
	{/if}

	<!-- More menu overlay -->
	{#if menuOpen}
		<!-- Backdrop -->
		<button
			class="fixed inset-0 z-10"
			onclick={() => menuOpen = false}
			aria-label="Close menu"
		></button>
		<!-- Full-card on mobile, dropdown on desktop -->
		<div
			class="absolute inset-0 z-20 bg-[var(--surface)] flex flex-col items-center pt-10
				sm:inset-auto sm:top-10 sm:right-3 sm:rounded-lg sm:shadow-lg sm:border sm:border-[var(--border)] sm:pt-1 sm:items-stretch sm:min-w-[140px]"
			transition:fade={{ duration: 80 }}
		>
			<!-- Close button (mobile only) -->
			<button
				onclick={() => menuOpen = false}
				class="absolute top-3 right-3 p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors sm:hidden"
				aria-label="Close menu"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
			{#if onEditDetails}
				<button
					onclick={() => { menuOpen = false; onEditDetails?.(book.id); }}
					class="w-full text-center sm:text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--background-alt)] transition-colors"
				>
					Edit details
				</button>
			{/if}
			{#if onShare}
				<button
					onclick={() => { menuOpen = false; onShare?.({ isbn13: book.isbn13, title: book.title }); }}
					class="w-full text-center sm:text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--background-alt)] transition-colors"
				>
					Share
				</button>
			{/if}
			{#if onDelete}
				<button
					onclick={() => { menuOpen = false; onDelete?.(book.id, book.title); }}
					class="w-full text-center sm:text-left px-4 py-2 text-sm text-red-400/80 hover:bg-[var(--background-alt)] hover:text-red-500 transition-colors sm:border-t sm:border-[var(--border)] sm:mt-1 sm:pt-3"
				>
					Remove
				</button>
			{/if}
			<!-- Added date -->
			<p class="w-full text-center sm:text-left px-4 py-2 text-xs text-[var(--text-tertiary)]">Added {addedDate}</p>
			<!-- Barcode + ISBN -->
			<div class="flex-1 flex flex-col items-center justify-center w-full px-4 py-4 sm:py-3 sm:border-t sm:border-[var(--border)] sm:mt-1">
				<canvas bind:this={barcodeCanvas} class="max-w-full"></canvas>
				<button
					onclick={copyISBN}
					class="inline-flex items-center gap-1 mt-1.5 text-[10px] font-mono text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors cursor-pointer tracking-wider"
				>
					{#if copied}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
						Copied
					{:else}
						{book.isbn13}
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
					{/if}
				</button>
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
