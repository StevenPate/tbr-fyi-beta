<script lang="ts">
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
		book: Book;
		shelves: Shelf[];
		bookShelves: BookShelf[];
		onToggleRead?: (bookId: string, currentStatus: boolean) => void;
		onToggleOwned?: (bookId: string, currentStatus: boolean) => void;
		onUpdateNote?: (bookId: string, note: string) => void;
		onToggleShelf?: (bookId: string, shelfId: string, isOnShelf: boolean) => void;
		onDelete?: (bookId: string, title: string) => void;
		onEditDetails?: (bookId: string) => void;
	}

	let {
		book,
		shelves,
		bookShelves,
		onToggleRead,
		onToggleOwned,
		onUpdateNote,
		onToggleShelf,
		onDelete,
		onEditDetails
	}: Props = $props();

	// State
	let descriptionOpen = $state(false);
	let shelvesOpen = $state(false);
	let barcodeOpen = $state(false);
	let noteEditing = $state(false);
	let noteValue = $state(book.note || '');
	let tempNoteValue = $state('');
	let menuOpen = $state(false);
	let copied = $state(false);
	let barcodeCanvas = $state<HTMLCanvasElement | null>(null);

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

<div class="w-full bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
	<!-- Main content area -->
	<div class="p-7">
		<div class="flex gap-6">
			<!-- Book Cover -->
			<div class="flex-shrink-0">
				{#if book.cover_url}
					<img
						src={book.cover_url}
						alt={book.title}
						class="w-32 h-48 object-cover rounded-lg shadow-md"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<!-- Placeholder cover with gradient -->
					<div class="w-32 h-48 bg-gradient-to-br from-stone-300 to-stone-400 rounded-lg shadow-md flex flex-col justify-between p-3 text-white">
						<div>
							{#if book.author && book.author.length > 0}
								<div class="text-xs font-medium opacity-90">{book.author.join(', ')}</div>
							{/if}
							<div class="text-sm font-serif italic leading-tight mt-1">{book.title}</div>
						</div>
						{#if book.publisher}
							<div class="text-[10px] opacity-70">{book.publisher}</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Text content -->
			<div class="flex-1 min-w-0">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="text-[1.75rem] font-serif text-stone-900 leading-tight">{book.title}</h2>
						{#if book.author && book.author.length > 0}
							<p class="text-lg text-stone-600 mt-1">by {book.author.join(', ')}</p>
						{/if}
					</div>

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
				</div>

				<!-- Metadata line -->
				{#if book.publisher || publicationYear}
					<p class="text-sm text-stone-400 mt-2">
						{book.publisher}{#if publicationYear}{book.publisher ? ' · ' : ''}{publicationYear}{/if}
					</p>
				{/if}

				<!-- Status toggles -->
				<div class="flex items-center gap-3 mt-4">
					<button
						onclick={() => onToggleRead?.(book.id, book.is_read)}
						class="text-sm font-medium px-3 py-1 rounded-full border transition-all duration-200 ease-out min-w-[72px] {book.is_read
							? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
							: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}"
					>
						{book.is_read ? 'Read' : 'Unread'}
					</button>
					<button
						onclick={() => onToggleOwned?.(book.id, book.is_owned)}
						class="text-sm font-medium px-3 py-1 rounded-full border transition-all duration-200 ease-out min-w-[96px] {book.is_owned
							? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
							: 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'}"
					>
						{book.is_owned ? 'Owned' : 'Not owned'}
					</button>
				</div>
			</div>
		</div>

		<!-- Note section -->
		<div class="mt-5">
			{#if !noteValue && !noteEditing}
				<button
					onclick={startEditingNote}
					class="text-base text-stone-400 hover:text-stone-600 transition-colors"
				>
					+ Add a note
				</button>
			{:else if noteEditing}
				<div class="relative">
					<textarea
						bind:value={tempNoteValue}
						placeholder="Why did you add this? Where did you hear about it?"
						class="w-full text-base text-stone-700 placeholder-stone-400 border border-stone-200 rounded-lg p-4 focus:outline-none focus:border-stone-300 focus:ring-1 focus:ring-stone-200 resize-none"
						rows={3}
					></textarea>
					<div class="flex justify-end gap-3 mt-3">
						<button
							onclick={cancelNoteEdit}
							class="px-4 py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
						>
							Cancel
						</button>
						<button
							onclick={saveNote}
							class="px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors"
						>
							Save
						</button>
					</div>
				</div>
			{:else}
				<div class="group relative bg-stone-50 rounded-lg p-4 border-l-[3px] border-stone-300">
					<p class="text-base text-stone-600 leading-relaxed pr-10">{noteValue}</p>
					<button
						onclick={startEditingNote}
						class="absolute top-3 right-3 p-2 text-stone-400 opacity-0 group-hover:opacity-100 hover:text-stone-600 transition-all"
						aria-label="Edit note"
					>
						<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
						</svg>
					</button>
				</div>
			{/if}
		</div>

		<!-- Description - collapsible -->
		{#if book.description}
			<div class="mt-5 pt-5 border-t border-stone-100">
				<button
					onclick={() => descriptionOpen = !descriptionOpen}
					class="flex items-center gap-2 text-base text-stone-500 hover:text-stone-700 transition-colors"
				>
					<svg class="w-[18px] h-[18px] transition-transform" class:rotate-90={!descriptionOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
					</svg>
					<span>Description</span>
				</button>
				{#if descriptionOpen}
					<p class="mt-4 text-base text-stone-600 leading-relaxed">
						{book.description}
					</p>
				{/if}
			</div>
		{/if}

		<!-- Shelves - collapsible -->
		<div class="mt-5">
			<button
				onclick={() => shelvesOpen = !shelvesOpen}
				class="flex items-center gap-2 text-base text-stone-500 hover:text-stone-700 transition-colors"
			>
				<svg class="w-[18px] h-[18px] transition-transform" class:rotate-90={!shelvesOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
				</svg>
				<span>Shelves</span>
				<span class="text-stone-400">({activeShelfCount()})</span>
			</button>
			{#if shelvesOpen}
				<div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
					{#each sortedShelves() as shelf}
						{@const isChecked = activeShelfIds().has(shelf.id)}
						<button
							onclick={() => onToggleShelf?.(book.id, shelf.id, isChecked)}
							class="flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg hover:bg-stone-50 cursor-pointer group transition-colors duration-150 text-left"
							role="checkbox"
							aria-checked={isChecked}
							aria-label={`${shelf.name} shelf`}
						>
							<div class="w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ease-out {isChecked
								? 'bg-stone-800 border-stone-800'
								: 'border-stone-300 group-hover:border-stone-400'}">
								{#if isChecked}
									<svg class="w-[14px] h-[14px] text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
									</svg>
								{/if}
							</div>
							<span class="text-sm transition-colors duration-150 {isChecked ? 'text-stone-800 font-medium' : 'text-stone-600'}">
								{shelf.name}
							</span>
						</button>
					{/each}
					{#if shelves.length === 0}
						<p class="text-sm text-stone-500 py-2 col-span-2">No shelves available</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Barcode - collapsible -->
		<div class="mt-5">
			<button
				onclick={() => barcodeOpen = !barcodeOpen}
				class="flex items-center gap-2 text-base text-stone-500 hover:text-stone-700 transition-colors"
			>
				<svg class="w-[18px] h-[18px] transition-transform" class:rotate-90={!barcodeOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
				</svg>
				<span>Barcode</span>
			</button>
			{#if barcodeOpen}
				<div class="mt-4 flex flex-col items-center py-5 bg-stone-50 rounded-lg">
					<p class="text-sm text-stone-500 mb-4">Scan at bookstore or library</p>
					<canvas bind:this={barcodeCanvas} class="max-w-full"></canvas>
					<p class="text-sm font-mono text-stone-600 mt-3 tracking-wider">{book.isbn13}</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Footer - metadata -->
	<div class="px-7 py-4 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-sm text-stone-400">
		<span>Added {new Date(book.added_at).toLocaleDateString()}</span>
		<button
			onclick={copyISBN}
			class="flex items-center gap-2 hover:text-stone-600 transition-colors"
		>
			{#if copied}
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
				</svg>
				<span>Copied</span>
			{:else}
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
				</svg>
				<span>ISBN {book.isbn13}</span>
			{/if}
		</button>
	</div>
</div>