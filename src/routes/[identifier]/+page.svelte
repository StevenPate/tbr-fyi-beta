<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { Card, Button, SearchBar } from '$lib/components/ui';
	import ShareModal from '$lib/components/ui/ShareModal.svelte';
	import NLPFilter from '$lib/components/ui/NLPFilter.svelte';
	import ClaimShelfBanner from '$lib/components/ClaimShelfBanner.svelte';
	import { browser } from '$app/environment';
	import { apiFetch } from '$lib/utils/api';
	import { authPrompt } from '$lib/stores/auth-prompt';

	let { data }: { data: PageData } = $props();

	// Local shelf selection state for instant filtering (no server round-trip)
	let selectedShelfId = $state<string | null>(data.selectedShelfId);

	// Local bookShelves state for optimistic updates (instant checkbox feedback)
	type BookShelf = { book_id: string; shelf_id: string };
	let localBookShelves = $state<BookShelf[]>([...data.bookShelves]);

	// Local books state for optimistic updates (instant read/owned toggling)
	let localBooks = $state([...data.allBooks]);

	// Track userId to detect actual page navigation vs data refresh from invalidateAll()
	let previousUserId = data.userId;

	// Sync with server data on navigation (e.g., navigating to a different user's shelf)
	// Only reset shelf selection when the page identity changes, not on data refreshes
	$effect(() => {
		if (data.userId !== previousUserId) {
			selectedShelfId = data.selectedShelfId;
			previousUserId = data.userId;
		}
		localBookShelves = [...data.bookShelves];
		localBooks = [...data.allBooks];
	});

	let newShelfName = $state('');
	let showNewShelfInput = $state(false);
	let creatingShelf = $state(false);
	// Export state
	let exportingShelfId = $state<string | null>(null);
	let exportError = $state<string | null>(null);

	// Shelf kebab menu
	let shelfMenuOpen = $state(false);

	// Detect if current visitor is likely the shelf owner
	let isOwner = $state(false);

	onMount(() => {
		if (browser && data.isPhoneBased) {
			// Check if localStorage indicates this user owns the shelf
			const storedUserId = localStorage.getItem('tbr-userId');
			isOwner = storedUserId === data.userId;

			// Also check if they recently added a book (referer-based)
			const recentActivity = sessionStorage.getItem('tbr-recent-activity');
			if (recentActivity === data.userId) {
				isOwner = true;
			}
		}
	});

	// NLP filter state (synced to URL)
	let nlpStatus = $state<'all' | 'unread' | 'read' | 'without-notes'>((data.initialStatus as any) || 'all');
	let nlpView = $state<'books' | 'notes'>((data.initialViewMode as any) || 'books');

	// URL sync: push state on any NLP filter change
	let isInitialLoad = true;
	function updateFilterUrl() {
		const params = new URLSearchParams(window.location.search);
		// Clear filter params before re-setting — other params (like ?q=) are preserved
		params.delete('shelf');
		params.delete('status');
		params.delete('view');
		if (selectedShelfId) {
			params.set('shelf', selectedShelfId);
		}
		if (nlpStatus !== 'all') {
			params.set('status', nlpStatus);
		}
		if (nlpView !== 'books') {
			params.set('view', nlpView);
		}
		const queryString = params.toString();
		const newUrl = queryString
			? `${window.location.pathname}?${queryString}`
			: window.location.pathname;
		history.pushState({}, '', newUrl);
	}

	$effect(() => {
		// Track all three filter variables
		void nlpStatus;
		void nlpView;
		void selectedShelfId;
		// Skip the initial render - URL already reflects server state
		if (isInitialLoad) {
			isInitialLoad = false;
			return;
		}
		updateFilterUrl();
	});

	// Smart sticky header - show on scroll up, hide on scroll down
	let lastScrollY = $state(0);
	let headerVisible = $state(true);
	const SCROLL_THRESHOLD = 80; // Pixels before header starts hiding

	$effect(() => {
		if (!browser) return;

		function handleScroll() {
			const currentScrollY = window.scrollY;
			const isScrollingUp = currentScrollY < lastScrollY;

			// Near top of page - always show header
			if (currentScrollY <= SCROLL_THRESHOLD) {
				headerVisible = true;
			} else if (isScrollingUp) {
				// Scrolling up - show header
				headerVisible = true;
			} else if (currentScrollY > lastScrollY + 5) {
				// Scrolling down (with small threshold to avoid jitter) - hide header
				headerVisible = false;
			}

			lastScrollY = currentScrollY;
		}

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	});

	// Search state
	let searchExpanded = $state(false);
	let searchQuery = $state('');

	// Search matching logic
	function matchesSearchQuery(book: { title: string; author?: string[]; note?: string | null }, query: string): boolean {
		if (!query.trim()) return true;
		const q = query.toLowerCase();
		const titleMatch = book.title?.toLowerCase().includes(q) ?? false;
		const authorMatch = book.author?.some(a => a.toLowerCase().includes(q)) ?? false;
		const noteMatch = book.note?.toLowerCase().includes(q) ?? false;
		return titleMatch || authorMatch || noteMatch;
	}

	// Time grouping for temporal texture
	type TimeGroup = 'this-week' | 'this-month' | 'older';

	function getTimeGroup(addedAt: string): TimeGroup {
		const days = (Date.now() - new Date(addedAt).getTime()) / (1000 * 60 * 60 * 24);
		if (days <= 7) return 'this-week';
		if (days <= 30) return 'this-month';
		return 'older';
	}

	const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
		'this-week': 'THIS WEEK',
		'this-month': 'EARLIER THIS MONTH',
		'older': 'A WHILE AGO',
	};

	// Deterministic daily seed for lifted item selection
	function simpleHash(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) - hash) + str.charCodeAt(i);
			hash |= 0;
		}
		return Math.abs(hash);
	}

	function seededRandom(seed: number): () => number {
		let s = seed;
		return () => {
			s = (s * 1664525 + 1013904223) & 0x7fffffff;
			return s / 0x7fffffff;
		};
	}

	type BookWithNote = { id: string; added_at: string; note?: string | null };

	function selectLiftedItems(books: BookWithNote[], dateStr: string): Set<string> {
		const now = Date.now();
		const DAY = 1000 * 60 * 60 * 24;

		// Eligible pool: 14-90 days old, has non-empty note
		const eligible = books
			.map((book, index) => ({ book, index }))
			.filter(({ book }) => {
				const age = (now - new Date(book.added_at).getTime()) / DAY;
				return age >= 14 && age <= 90 && book.note && book.note.trim().length > 0;
			});

		if (eligible.length === 0) return new Set();

		// ~1 per 20 books, minimum 1
		const count = Math.max(1, Math.round(books.length / 20));

		// Seeded shuffle
		const rng = seededRandom(simpleHash(dateStr));
		const shuffled = [...eligible];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}

		// Pick non-adjacent items, allowing 1 in the first 10
		const selected = new Set<string>();
		const selectedIndices = new Set<number>();
		let earlySlotUsed = false;

		for (const item of shuffled) {
			if (selected.size >= count) break;

			// Allow 1 item in first 10 positions
			const isEarly = item.index < 10;
			if (isEarly && earlySlotUsed) continue;

			let adjacent = false;
			for (const idx of selectedIndices) {
				if (Math.abs(item.index - idx) <= 1) { adjacent = true; break; }
			}
			if (!adjacent) {
				selected.add(item.book.id);
				selectedIndices.add(item.index);
				if (isEarly) earlySlotUsed = true;
			}
		}

		return selected;
	}

	// Filter books by selected shelf (client-side for instant switching)
	const booksForCurrentShelf = $derived.by(() => {
		if (!selectedShelfId) {
			// "All Books" view
			return localBooks;
		}
		// Filter to books on the selected shelf
		const bookIdsOnShelf = new Set(
			localBookShelves
				.filter(bs => bs.shelf_id === selectedShelfId)
				.map(bs => bs.book_id)
		);
		return localBooks.filter(book => bookIdsOnShelf.has(book.id));
	});

	// Apply NLP status filter to shelf-filtered books
	const booksFilteredByStatus = $derived.by(() => {
		let result = booksForCurrentShelf;
		switch (nlpStatus) {
			case 'read':
				result = result.filter(b => b.is_read);
				break;
			case 'unread':
				result = result.filter(b => !b.is_read);
				break;
			case 'without-notes':
				result = result.filter(b => !b.note);
				break;
			// 'all' — no filtering
		}
		return result;
	});

	// Apply Notes view filtering (hides books without notes when in notes view)
	const booksForView = $derived.by(() => {
		if (nlpView === 'notes') {
			return booksFilteredByStatus.filter(b => b.note);
		}
		return booksFilteredByStatus;
	});

	// Count of hidden books in notes view
	const hiddenNoteCount = $derived(
		nlpView === 'notes'
			? booksFilteredByStatus.filter(b => !b.note).length
			: 0
	);

	// Then apply search filter
	const displayedBooks = $derived.by(() => {
		return searchQuery.trim()
			? booksForView.filter(b => matchesSearchQuery(b, searchQuery))
			: booksForView;
	});

	// Dynamic book count label that mirrors the NLP sentence language
	const bookCountLabel = $derived.by(() => {
		const count = displayedBooks.length;
		const noun = count === 1 ? 'book' : 'books';
		const statusText = nlpStatus === 'all' ? '' : nlpStatus === 'without-notes' ? 'without notes ' : nlpStatus + ' ';

		const shelfName = selectedShelfId
			? data.shelves.find(s => s.id === selectedShelfId)?.name || ''
			: '';

		if (nlpView === 'notes') {
			const noteNoun = count === 1 ? 'note' : 'notes';
			return shelfName
				? `${count} ${statusText}${noteNoun} in ${shelfName}`
				: `${count} ${statusText}${noteNoun}`;
		}

		return shelfName
			? `${count} ${statusText}${noun} in ${shelfName}`
			: `${count} ${statusText}${noun}`;
	});

	// Scroll to and highlight a book, then expand it
	function scrollToBook(book: { id: string }) {
		// Small delay to let DOM settle after search clears
		requestAnimationFrame(() => {
			const element = document.getElementById(`book-${book.id}`);
			if (element) {
				element.scrollIntoView({ behavior: 'smooth', block: 'center' });
				element.classList.add('highlight-pulse');
				setTimeout(() => element.classList.remove('highlight-pulse'), 1000);
			}
			expandedCardId = book.id;
		});
	}

	// Manual ISBN entry state (kept for backward-compat, modal replaced below)
	let showIsbnInput = $state(false);
	let manualIsbn = $state('');
	let isAddingBook = $state(false);
	let addBookError = $state<string | null>(null);
	let addBookSuccess = $state(false);

	// Multimodal input state for new detect flow
	interface DetectedBook {
		isbn13: string;
		title: string;
		author: string[];
		publisher?: string;
		publicationDate?: string;
		coverUrl?: string;
	}
	interface DetectionMetadata {
		totalLines: number;
		validIsbns: number;
		skippedLines: number;
		duplicatesRemoved?: number;
	}
	let inputText = $state('');
	let selectedFile = $state<File | null>(null);
	let detectedBooks = $state<DetectedBook[]>([]);
	let detectionMetadata = $state<DetectionMetadata | null>(null);
	let selectedBookIds = $state<Set<string>>(new Set());
	let selectedShelfIds = $state<Set<string>>(new Set());
	let showShelfSelection = $state(false);
	let isDetecting = $state(false);
	let detectError = $state<string | null>(null);

	// Note step state (for single book adds)
	let showNoteStep = $state(false);
	let addedBookForNote = $state<DetectedBook | null>(null);
	let addedBookId = $state<string | null>(null);
	let noteText = $state('');
	let noteTextarea: HTMLTextAreaElement | null = null;
	let currentPrompt = $state<{ promptId: string; text: string; subtext?: string } | null>(null);
	let fileInput: HTMLInputElement | null = null;
	let queryInput: HTMLTextAreaElement | null = null;

	// Delete shelf state
	let deletingShelfId = $state<string | null>(null);

	// Claim shelf prompt state (shown when ?q= present but user not authenticated)
	let showClaimPrompt = $state(false);
	let pendingSearchQuery = $state<string | null>(null);

	// Expanded card state - only one card expanded at a time
	let expandedCardId = $state<string | null>(null);

	// Resurfacing state
	let settledBookIds = $state(new Set<string>());
	const todayStr = new Date().toISOString().slice(0, 10);

	const liftedBookIds = $derived.by(() => {
		const baseSet = selectLiftedItems(displayedBooks, todayStr);
		const active = new Set<string>();
		for (const id of baseSet) {
			if (!settledBookIds.has(id)) active.add(id);
		}
		return active;
	});

	function settleBook(bookId: string) {
		settledBookIds = new Set([...settledBookIds, bookId]);
	}

	// Soft success feedback (toast for status/shelf changes)
	let savedFeedback = $state<string | null>(null);
	let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

	function showSavedFeedback(message: string = 'Saved') {
		// Subtle haptic
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			navigator.vibrate(10);
		}
		// Show brief message
		if (feedbackTimeout) clearTimeout(feedbackTimeout);
		savedFeedback = message;
		feedbackTimeout = setTimeout(() => {
			savedFeedback = null;
		}, 1500);
	}

	// Shelf modal state
	let shelfModalBookId = $state<string | null>(null);
	let shelfModalOpen = $derived(shelfModalBookId !== null);
	let shelfModalElement: HTMLDivElement | null = null;

	// Share modal state
	let shareModalBook = $state<{ isbn13: string; title: string } | null>(null);

	let shareModalOpen = $derived(shareModalBook !== null);
	// Canonical identifier for share URLs: prefer username if available
	const canonicalIdentifier = $derived(data.username || data.userId);

	// Focus modal when it opens
	$effect(() => {
		if (shelfModalOpen && shelfModalElement) {
			tick().then(() => {
				shelfModalElement?.focus();
			});
		}
	});


	// Extract year from publication date (YYYY or YYYY-MM-DD)
	function getPublicationYear(dateString: string | null | undefined): string | null {
		if (!dateString) return null;
		const yearMatch = dateString.match(/^\d{4}/);
		return yearMatch ? yearMatch[0] : null;
	}

	// Check if book is on a shelf
	function isBookOnShelf(bookId: string, shelfId: string) {
		return localBookShelves.some(bs => bs.book_id === bookId && bs.shelf_id === shelfId);
	}

	async function toggleRead(bookId: string, currentValue: boolean) {
		// Optimistic update - full array reassignment guarantees Svelte reactivity
		localBooks = localBooks.map(b => b.id === bookId ? { ...b, is_read: !currentValue } : b);

		try {
			const response = await apiFetch('/api/books/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: bookId,
					is_read: !currentValue
				})
			});

			if (!response.ok) {
				localBooks = localBooks.map(b => b.id === bookId ? { ...b, is_read: currentValue } : b);
			}
		} catch (error) {
			localBooks = localBooks.map(b => b.id === bookId ? { ...b, is_read: currentValue } : b);
			console.error('Error toggling read:', error);
		}
	}

	async function toggleOwned(bookId: string, currentValue: boolean) {
		// Optimistic update - full array reassignment guarantees Svelte reactivity
		localBooks = localBooks.map(b => b.id === bookId ? { ...b, is_owned: !currentValue } : b);

		try {
			const response = await apiFetch('/api/books/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: bookId,
					is_owned: !currentValue
				})
			});

			if (!response.ok) {
				localBooks = localBooks.map(b => b.id === bookId ? { ...b, is_owned: currentValue } : b);
			}
		} catch (error) {
			localBooks = localBooks.map(b => b.id === bookId ? { ...b, is_owned: currentValue } : b);
			console.error('Error toggling owned:', error);
		}
	}

	async function updateNote(bookId: string, note: string) {
		try {
			await apiFetch('/api/books/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: bookId,
					note
				})
			});
		} catch (error) {
			console.error('Error updating note:', error);
		}
	}

	async function createShelf() {
		const trimmedName = newShelfName.trim();
		if (!trimmedName) return;

		// Check for duplicate shelf names
		if (data.shelves.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
			alert('A shelf with this name already exists');
			return;
		}

		creatingShelf = true;
		try {
			const response = await apiFetch('/api/shelves', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: trimmedName
				})
			});

			if (response.ok) {
				newShelfName = '';
				showNewShelfInput = false;
				await invalidateAll();
			} else if (response.status !== 401) {
				// Only show alert for non-auth errors (401 handled by apiFetch)
				const result = await response.json();
				alert(result.error || 'Failed to create shelf');
			}
		} catch (error) {
			console.error('Error creating shelf:', error);
		} finally {
			creatingShelf = false;
		}
	}

	async function toggleBookOnShelf(bookId: string, shelfId: string, isOn: boolean) {
		// Optimistic update - modify local state immediately
		if (isOn) {
			// Remove from shelf
			localBookShelves = localBookShelves.filter(
				bs => !(bs.book_id === bookId && bs.shelf_id === shelfId)
			);
		} else {
			// Add to shelf
			localBookShelves = [...localBookShelves, { book_id: bookId, shelf_id: shelfId }];
		}

		try {
			const response = await apiFetch('/api/books/shelves', {
				method: isOn ? 'DELETE' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					book_id: bookId,
					shelf_id: shelfId
				})
			});

			if (!response.ok) {
				// Revert on failure - re-sync from server
				await invalidateAll();
			}
		} catch (error) {
			console.error('Error toggling book on shelf:', error);
			// Revert on error - re-sync from server
			await invalidateAll();
		}
	}

	async function deleteBook(bookId: string, title: string) {
		if (!confirm(`Remove "${title}" from your shelf?`)) {
			return;
		}

		try {
			const response = await apiFetch('/api/books/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bookId })
			});

			if (response.ok) {
				await invalidateAll();
			} else if (response.status !== 401) {
				// Only show alert for non-auth errors (401 handled by apiFetch)
				alert('Failed to delete book. Please try again.');
			}
		} catch (error) {
			console.error('Error deleting book:', error);
			alert('Failed to delete book. Please try again.');
		}
	}

	async function deleteShelf(shelfId: string, shelfName: string) {
		// Build confirmation message
		let message = `Delete "${shelfName}"?\n\nBooks will remain in your library, but will be removed from this shelf.`;

		// Add note about default shelf behavior
		if (data.defaultShelfId === shelfId) {
			message += '\n\nNote: This shelf is your default. After deletion, new books will go to "All Books".';
		}

		// Add note about current view if viewing this shelf
		if (selectedShelfId === shelfId) {
			message += '\n\nYou are currently viewing this shelf. After deletion, you will be redirected to "All Books".';
		}

		// Confirmation dialog
		if (!confirm(message)) {
			return;
		}

		// Set loading state
		deletingShelfId = shelfId;

		try {
			const response = await apiFetch('/api/shelves', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: shelfId })
			});

			// 401 is handled by apiFetch, just return early
			if (response.status === 401) {
				return;
			}

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to delete shelf');
			}

			// If we're currently viewing the deleted shelf, switch to All Books
			if (selectedShelfId === shelfId) {
				selectedShelfId = null;
				// URL will be updated automatically by the $effect
			}

			// Refresh the page data to update shelf list
			await invalidateAll();
		} catch (error) {
			alert(`Error deleting shelf: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			deletingShelfId = null;
		}
	}

	async function exportShelf(shelfId: string, shelfName: string, format: 'csv' | 'json' = 'csv') {
		exportingShelfId = shelfId;
		exportError = null;

		const endpoint =
			format === 'csv' ? `/api/export/csv?shelf=${shelfId}` : `/api/export?shelf=${shelfId}`;
		const sanitizedName = shelfName
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		const defaultFilename =
			format === 'csv' ? `tbr-export-${sanitizedName}.csv` : `tbr-export-${sanitizedName}.json`;

		try {
			const response = await apiFetch(endpoint);

			if (!response.ok) {
				const result = await response.json();
				exportError = result.error || 'Export failed';
				return;
			}

			// Trigger download
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;

			const contentDisposition = response.headers.get('Content-Disposition');
			const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
			const filename = filenameMatch?.[1] || defaultFilename;

			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);

			showSavedFeedback(`Exported ${shelfName}`);
		} catch (error) {
			console.error('Export error:', error);
			exportError = 'Export failed. Please try again.';
		} finally {
			exportingShelfId = null;
		}
	}

	function detectInputType(text: string, file: File | null): 'text' | 'image' | 'file' | 'invalid' {
		if (file) {
			const fileName = file.name.toLowerCase();
			// Check if it's a text file (CSV/TXT)
			if (file.type === 'text/plain' || file.type === 'text/csv' || fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
				return 'file';
			}
			// Check if it's an image
			if (file.type.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) {
				return 'image';
			}
			// Unknown file type - reject it
			return 'invalid';
		}
		const cleaned = text.trim();
		if (!cleaned) return 'invalid';
		// Treat any non-empty text as 'text' to allow free-text search; server will route ISBN/URL/query
		return 'text';
	}

	async function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const base64 = (reader.result as string).split(',')[1];
				resolve(base64);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function fileToText(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				resolve(reader.result as string);
			};
			reader.onerror = reject;
			reader.readAsText(file);
		});
	}

	async function detectBooks() {
		detectError = null;
		detectedBooks = [];
		detectionMetadata = null;
		selectedBookIds = new Set();

		const inputType = detectInputType(inputText, selectedFile);
		if (inputType === 'invalid') {
			detectError = 'Please enter a valid ISBN, Amazon URL, upload an image, or upload a CSV/TXT file';
			return;
		}
		isDetecting = true;
		try {
			let content: string;
			if (inputType === 'image' && selectedFile) {
				content = await fileToBase64(selectedFile);
			} else if (inputType === 'file' && selectedFile) {
				content = await fileToText(selectedFile);
			} else {
				content = inputText.trim();
			}

			const response = await apiFetch('/api/books/detect', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: inputType, content })
			});
			const result = await response.json();
			if (!response.ok) {
				detectError = result.error || 'Detection failed';
				return;
			}
			detectedBooks = result.detected as DetectedBook[];
			detectionMetadata = result.metadata || null;
			// Only auto-select if exactly one book is detected (avoid anti-pattern for multiple results)
			selectedBookIds = detectedBooks.length === 1
				? new Set(detectedBooks.map((b) => b.isbn13))
				: new Set();
		} catch (error) {
			console.error('Detection error:', error);
			detectError = 'Network error. Please try again.';
		} finally {
			isDetecting = false;
		}
	}

	function toggleBookSelection(isbn13: string) {
		const next = new Set(selectedBookIds);
		if (next.has(isbn13)) next.delete(isbn13); else next.add(isbn13);
		selectedBookIds = next;
	}

	function toggleShelfSelection(shelfId: string) {
		const next = new Set(selectedShelfIds);
		if (next.has(shelfId)) next.delete(shelfId); else next.add(shelfId);
		selectedShelfIds = next;
	}

	function triggerFileInput() { fileInput?.click(); }
	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			selectedFile = target.files[0];
			inputText = '';
			detectBooks();
		}
	}
	function handleDragOver(e: DragEvent) { e.preventDefault(); }
	function handleDrop(e: DragEvent) {
		e.preventDefault();
		if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
			selectedFile = e.dataTransfer.files[0];
			inputText = '';
			detectBooks();
		}
	}
	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	async function addSelectedBooks() {
		const booksToAdd = detectedBooks.filter((b) => selectedBookIds.has(b.isbn13));
		if (booksToAdd.length === 0) return;
		isAddingBook = true;
		detectError = null;
		try {
			// Add books to library
			let addedCount = 0;
			const addedBookIds: Map<string, string> = new Map(); // isbn13 -> bookId
			for (const book of booksToAdd) {
				const resp = await apiFetch('/api/books/add', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ isbn: book.isbn13 })
				});
				if (!resp.ok) {
					const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
					if (resp.status === 401) {
						authPrompt.trigger('Sign in to add books to your shelf.');
						return;
					}
					if (resp.status === 409) {
						// Duplicate - count as added since it's already there
						if (errorData.book?.id) {
							addedBookIds.set(book.isbn13, errorData.book.id);
						}
						addedCount++;
						continue;
					}
					detectError = errorData.error || 'Failed to add book. Please try again.';
					return;
				}
				const result = await resp.json();
				if (result.book?.id) {
					addedBookIds.set(book.isbn13, result.book.id);
				}
				addedCount++;
			}

			if (addedCount === 0) {
				detectError = 'No books were added. Please try again.';
				return;
			}

			// Refresh data to get book IDs
			await invalidateAll();

			// Add books to selected shelves if any were chosen
			if (selectedShelfIds.size > 0) {
				for (const book of booksToAdd) {
					// Use the book ID from the add response, or find in updated data
					const bookId = addedBookIds.get(book.isbn13) || localBooks.find(b => b.isbn13 === book.isbn13)?.id;
					if (bookId) {
						// Add to each selected shelf
						for (const shelfId of selectedShelfIds) {
							try {
								await apiFetch('/api/books/shelves', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										book_id: bookId,
										shelf_id: shelfId
									})
								});
							} catch (err) {
								console.error('Failed to add book to shelf', err);
							}
						}
					}
				}
				// Refresh again to show shelf assignments
				await invalidateAll();
			}

			// For single book adds, show note step
			// For multi-book adds, skip note step entirely (avoid friction)
			if (booksToAdd.length === 1) {
				// Use book ID from add response (more reliable than searching allBooks)
				const bookId = addedBookIds.get(booksToAdd[0].isbn13);
				if (bookId) {
					addedBookForNote = booksToAdd[0];
					addedBookId = bookId;
					noteText = '';

					// Fetch the appropriate note prompt
					try {
						const promptResp = await apiFetch('/api/books/note-prompt', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ bookId })
						});
						if (promptResp.ok) {
							currentPrompt = await promptResp.json();
						} else {
							// API returned error - use default prompt
							currentPrompt = {
								promptId: 'default',
								text: 'What caught your attention about this one?'
							};
						}
					} catch {
						// Network/fetch error - use default prompt
						currentPrompt = {
							promptId: 'default',
							text: 'What caught your attention about this one?'
						};
					}

					showNoteStep = true;
				} else {
					// Couldn't find added book, just close
					addBookSuccess = true;
					setTimeout(() => {
						showIsbnInput = false;
						inputText = '';
						selectedFile = null;
						detectedBooks = [];
						selectedBookIds = new Set();
						selectedShelfIds = new Set();
						showShelfSelection = false;
						addBookSuccess = false;
						detectError = null;
					}, 2000);
				}
			} else {
				// Multi-book add: show success and close
				addBookSuccess = true;
				setTimeout(() => {
					showIsbnInput = false;
					inputText = '';
					selectedFile = null;
					detectedBooks = [];
					selectedBookIds = new Set();
					selectedShelfIds = new Set();
					showShelfSelection = false;
					addBookSuccess = false;
					detectError = null;
				}, 2000);
			}
		} catch (error) {
			console.error('Error adding books:', error);
			detectError = 'Failed to add books. Please try again.';
		} finally {
			isAddingBook = false;
		}
	}

	async function addBookManually() {
		// Clear previous errors
		addBookError = null;
		addBookSuccess = false;

		// Validate ISBN
		const cleaned = manualIsbn.trim().replace(/[^0-9Xx]/g, '');
		if (!cleaned || (cleaned.length !== 10 && cleaned.length !== 13)) {
			addBookError = 'Please enter a valid 10 or 13 digit ISBN';
			return;
		}

		isAddingBook = true;

		try {
			const response = await apiFetch('/api/books/add', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					isbn: cleaned
					// Note: userId is derived server-side from referer for security
				})
			});

			const result = await response.json();

			if (!response.ok) {
				addBookError = result.error || 'Failed to add book';
				return;
			}

			// Success!
			addBookSuccess = true;
			manualIsbn = '';

			// Refresh the shelf
			await invalidateAll();

			// Auto-close after 2 seconds
			setTimeout(() => {
				showIsbnInput = false;
				addBookSuccess = false;
			}, 2000);
		} catch (error) {
			console.error('Error adding book:', error);
			addBookError = 'Network error. Try again?';
		} finally {
			isAddingBook = false;
		}
	}

	// Note step helpers
	async function saveAddedBookNote() {
		if (!addedBookId) return;

		const finalNote = noteText.trim();
		if (finalNote) {
			try {
				await apiFetch('/api/books/update', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: addedBookId,
						note: finalNote
					})
				});

				// Record prompt response (fire and forget)
				fetch('/api/books/note-prompt', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						bookId: addedBookId,
						responded: true,
						noteLength: finalNote.length
					})
				}).catch(() => {}); // Ignore analytics errors

				await invalidateAll();
			} catch (err) {
				console.error('Failed to save note:', err);
			}
		}
		closeAddModal();
	}

	function skipAddedBookNote() {
		// Record that user skipped (fire and forget)
		if (addedBookId) {
			fetch('/api/books/note-prompt', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					bookId: addedBookId,
					responded: false,
					noteLength: 0
				})
			}).catch(() => {}); // Ignore analytics errors
		}
		closeAddModal();
	}

	function closeAddModal() {
		showIsbnInput = false;
		showNoteStep = false;
		inputText = '';
		selectedFile = null;
		detectedBooks = [];
		selectedBookIds = new Set();
		selectedShelfIds = new Set();
		showShelfSelection = false;
		addBookSuccess = false;
		detectError = null;
		addedBookForNote = null;
		addedBookId = null;
		noteText = '';
		currentPrompt = null;
	}


	// Global keyboard shortcut: press "+" to open ISBN entry
	onMount(() => {
		// Save user ID to localStorage for quick access from homepage
		const identifier = $page.params.identifier;
		if (identifier) {
			localStorage.setItem('tbr-userId', identifier);
		}

		const handleKeydown = (e: KeyboardEvent) => {
			// Cmd+K / Ctrl+K toggles search (works even in inputs)
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault();
				searchExpanded = !searchExpanded;
				if (!searchExpanded) {
					searchQuery = '';
				}
				return;
			}

			// Don't trigger other shortcuts if user is typing in an input
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			if (e.key === '+' || e.key === '=') {
				e.preventDefault();
				if (!data.isAuthenticatedOwner) {
					authPrompt.trigger('Sign in to add books to your shelf.');
					return;
				}
				showIsbnInput = true;
			}
		};

		// If URL contains ?q=, check auth status before opening add modal
		try {
			const searchParams = $page.url.searchParams;
			const q = searchParams.get('q');
			if (q) {
				if (data.isAuthenticatedOwner) {
					// User is signed in and owns this shelf - open add modal
					showIsbnInput = true;
					inputText = q;
					// Delay to allow modal to mount
					setTimeout(() => { void detectBooks(); }, 0);
				} else {
					// User not authenticated - show claim prompt
					pendingSearchQuery = q;
					showClaimPrompt = true;
				}
			}
		} catch (e) {
			console.warn('Failed to parse query params', e);
		}

		// Handle browser back/forward for all filter state
		const handlePopState = () => {
			// Temporarily disable URL sync to avoid double-push
			isInitialLoad = true;

			const params = new URLSearchParams(window.location.search);
			const shelfParam = params.get('shelf');
			const statusParam = params.get('status');
			const viewParam = params.get('view');

			// Restore shelf — ?view=all is legacy for "no shelf", otherwise use ?shelf param
			if (viewParam === 'all') {
				selectedShelfId = null;
			} else if (shelfParam) {
				const shelfExists = data.shelves.some(s => s.id === shelfParam);
				selectedShelfId = shelfExists ? shelfParam : (data.defaultShelfId || null);
			} else {
				selectedShelfId = data.defaultShelfId || null;
			}

			// Restore status
			const validStatuses = ['all', 'unread', 'read', 'without-notes'];
			nlpStatus = (validStatuses.includes(statusParam || '') ? statusParam : 'all') as typeof nlpStatus;

			// Restore view — ?view=all is legacy (maps to 'books'), otherwise validate
			if (viewParam && viewParam !== 'all' && ['books', 'notes'].includes(viewParam)) {
				nlpView = viewParam as typeof nlpView;
			} else {
				nlpView = 'books';
			}

			// Canonicalize contradictory combos
			if (nlpView === 'notes' && nlpStatus === 'without-notes') {
				nlpStatus = 'all';
			}

			// Re-enable URL sync after this tick
			setTimeout(() => { isInitialLoad = false; }, 0);
		};

		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('popstate', handlePopState);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('popstate', handlePopState);
		};
	});

	// Focus the query textarea when the modal opens
	$effect(() => {
		if (showIsbnInput) {
			setTimeout(() => { queryInput?.focus(); }, 0);
		}
	});
</script>

<svelte:head>
	<title>{data.username ? `${data.username}'s Shelves` : 'Shelves'} | TBR.fyi</title>
	<meta name="description" content="{data.allBooks.length} {data.allBooks.length === 1 ? 'book' : 'books'} on {data.username ? `${data.username}'s` : 'this'} reading list" />
	<meta property="og:title" content="{data.username ? `${data.username}'s Shelves` : 'Shelves'} | TBR.fyi" />
	<meta property="og:description" content="{data.allBooks.length} {data.allBooks.length === 1 ? 'book' : 'books'} on {data.username ? `${data.username}'s` : 'this'} reading list" />
	<meta property="og:image" content="https://tbr.fyi/og-image.png" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content="https://tbr.fyi/og-image.png" />
</svelte:head>

<div class="min-h-screen shelf-page">
	{#if data.isPhoneBased}
		<ClaimShelfBanner phoneNumber={data.userId} {isOwner} />
	{/if}

	<div class="py-8">
		<div class="max-w-[var(--content-width)] mx-auto px-4">
		<!-- Header - slides up/down based on scroll direction (mobile only) -->
		<div
			class="sticky top-0 z-30 -mx-4 px-4 bg-[var(--background)] border-b border-[var(--border)] transition-transform duration-200 ease-out md:static md:mx-0 md:px-0 md:bg-transparent md:border-0 md:translate-y-0 {headerVisible ? 'translate-y-0' : '-translate-y-full'}"
			style="will-change: transform;"
		>
			<div class="py-3 md:py-0">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0 group/title">
						<div class="flex items-center gap-2">
							<h1 class="text-xl font-semibold text-[var(--text-primary)] truncate">{data.username ? `${data.username}'s Shelves` : 'Shelves'}</h1>
							<a
								href="/{$page.params.identifier}/settings"
								class="settings-gear opacity-40 md:opacity-0 md:group-hover/title:opacity-40 hover:!opacity-100 transition-opacity"
								aria-label="Settings"
								title="Settings"
							>
								<svg class="w-5 h-5 md:w-6 md:h-6 text-[var(--text-secondary)]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
									<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
								</svg>
							</a>
						</div>
						<p class="text-xs md:text-sm text-[var(--text-secondary)] font-normal" aria-live="polite">
							{bookCountLabel}
						</p>
					</div>

					<!-- Search, View Toggle and Manual ISBN Entry -->
					<div class="flex gap-1 md:gap-2 items-start flex-shrink-0">
						<!-- Search -->
						<SearchBar
							books={booksForCurrentShelf}
							bind:expanded={searchExpanded}
							bind:query={searchQuery}
							onSelect={scrollToBook}
							onQueryChange={(q) => searchQuery = q}
						/>

						<!-- Manual ISBN Entry Button -->
						<button
							onclick={() => {
								if (!data.isAuthenticatedOwner) {
									authPrompt.trigger('Sign in to add books to your shelf.');
									return;
								}
								showIsbnInput = true;
								addBookError = null;
								addBookSuccess = false;
							}}
							class="w-10 h-10 flex items-center justify-center rounded-lg border-2 border-dashed border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-xl font-bold bg-[var(--surface)] md:bg-transparent"
							aria-label="Add book"
							title="Add book by cover photo, ISBN, or title"
						>
							+
						</button>

						<!-- Shelf kebab menu -->
						<div class="relative">
							<button
								onclick={() => shelfMenuOpen = !shelfMenuOpen}
								class="w-10 h-10 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--background-alt)] transition-colors"
								aria-label="More options"
								title="More options"
							>
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
									<circle cx="12" cy="5" r="1.5"/>
									<circle cx="12" cy="12" r="1.5"/>
									<circle cx="12" cy="19" r="1.5"/>
								</svg>
							</button>

							{#if shelfMenuOpen}
								<!-- Backdrop -->
								<button
									class="fixed inset-0 z-10"
									onclick={() => shelfMenuOpen = false}
									aria-label="Close menu"
								></button>
								<!-- Dropdown -->
								<div class="absolute right-0 top-full mt-1 z-20 bg-[var(--surface)] rounded-lg shadow-lg border border-[var(--border)] min-w-[160px] py-1">
									<button
										disabled
										class="w-full text-left px-4 py-2 text-sm text-[var(--paper-dark)] cursor-not-allowed"
									>
										Sort
									</button>
									<button
										onclick={() => {
											shelfMenuOpen = false;
											const shelf = data.shelves.find(s => s.id === selectedShelfId);
											exportShelf(selectedShelfId || 'all', shelf?.name || 'all-books');
										}}
										class="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--background-alt)] transition-colors"
									>
										Export
									</button>
									<button
										disabled
										class="w-full text-left px-4 py-2 text-sm text-[var(--paper-dark)] cursor-not-allowed"
									>
										Share
									</button>
									<button
										disabled
										class="w-full text-left px-4 py-2 text-sm text-[var(--paper-dark)] cursor-not-allowed"
									>
										Bulk edit
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- NLP Filter sentence -->
		<div class="mt-3 md:mt-5 mb-4 md:mb-6">
			<NLPFilter
				bind:status={nlpStatus}
				bind:view={nlpView}
				bind:shelfId={selectedShelfId}
				shelves={data.shelves}
				defaultShelfId={data.defaultShelfId}
				onCreateShelf={() => { showNewShelfInput = true; }}
			/>
		</div>

		{#if hiddenNoteCount > 0}
			<p class="text-sm text-[var(--text-secondary)] mb-4 font-sans">
				Hiding {hiddenNoteCount} {hiddenNoteCount === 1 ? 'book' : 'books'} without notes.
				<button
					class="underline decoration-dotted underline-offset-2 hover:text-[var(--text-primary)] transition-colors"
					onclick={() => { nlpStatus = 'without-notes'; nlpView = 'books'; }}
				>Show them</button>
			</p>
		{/if}

		<!-- Error Message -->
		{#if data.error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
				<p class="text-red-800">Error: {data.error}</p>
			</div>
		{/if}

		<!-- Export Error Message -->
		{#if exportError}
			<div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4" role="alert" transition:fade={{ duration: 200 }}>
				<div class="flex items-center justify-between gap-2">
					<p class="text-sm text-red-800">{exportError}</p>
					<button
						onclick={() => exportError = null}
						class="text-xs text-red-600 hover:text-red-800 underline"
					>
						Dismiss
					</button>
				</div>
			</div>
		{/if}

		<!-- Empty State -->
		{#if localBooks.length === 0}
			<!-- No books at all -->
			<div class="text-center py-16">
				<p class="font-serif italic text-xl text-[var(--text-primary)] mb-4">
					Your shelf is empty
				</p>
				<p class="text-sm text-[var(--text-secondary)]">
					Snap a cover photo or text an ISBN to get started.
				</p>
			</div>
		{:else if displayedBooks.length === 0 && nlpStatus === 'without-notes' && nlpView === 'notes'}
			<!-- Contradictory filter: "without notes" + "notes" view -->
			<div class="text-center py-12">
				<p class="text-[var(--text-secondary)] text-sm">No notes yet.</p>
			</div>
		{:else if displayedBooks.length === 0}
			<!-- Shelf is empty but user has books -->
			<div class="text-center py-16">
				<p class="font-serif italic text-xl text-[var(--text-primary)] mb-4">
					Nothing here yet
				</p>
				<p class="text-sm text-[var(--text-secondary)]">
					Add books to this shelf, or switch to "All" to see your full collection.
				</p>
			</div>
		{/if}

		<!-- Books List -->
		{#key selectedShelfId}
			<div
				class="flex flex-col gap-6"
				in:fade={{ duration: 300, delay: 150 }}
				out:fade={{ duration: 150 }}
			>
				{#each displayedBooks as book, i (book.id)}
					{@const isExpanded = expandedCardId === book.id}
					{@const isLifted = liftedBookIds.has(book.id)}
					{@const group = getTimeGroup(book.added_at)}
					{@const prevGroup = i > 0 ? getTimeGroup(displayedBooks[i - 1].added_at) : null}

					<!-- Time group marker -->
					{#if group !== prevGroup}
						<p class="text-xs text-[var(--warm-gray)] uppercase tracking-widest mt-6 mb-0 pl-16 select-none">
							{TIME_GROUP_LABELS[group]}
						</p>
					{/if}

					<Card
						id="book-{book.id}"
						{book}
						shelves={data.shelves}
						bookShelves={localBookShelves}
						expanded={isExpanded}
						lifted={isLifted}
						viewMode={nlpView}
						onToggleRead={toggleRead}
						onToggleOwned={toggleOwned}
						onUpdateNote={updateNote}
						onToggleShelf={toggleBookOnShelf}
						onDelete={deleteBook}
						onEditDetails={() => {
							console.log('Edit details for book:', book.id);
						}}
						onShare={(b: { isbn13: string; title: string }) => shareModalBook = b}
						onToggleExpand={(bookId, isNowExpanded) => {
							expandedCardId = isNowExpanded ? bookId : null;
						}}
						onSettle={settleBook}
					/>
				{/each}
			</div>
	{/key}

	
		<!-- Claim Shelf Prompt Modal (shown when ?q= but not authenticated) -->
		{#if showClaimPrompt}
			<div
				class="fixed inset-0 bg-[var(--charcoal)]/50 flex items-center justify-center z-50 p-4"
				role="button"
				tabindex="0"
				aria-label="Close claim shelf dialog"
				onclick={(e: MouseEvent) => {
					if (e.target !== e.currentTarget) return;
					showClaimPrompt = false;
					pendingSearchQuery = null;
				}}
				onkeydown={(e: KeyboardEvent) => {
					if (e.key === 'Escape') {
						showClaimPrompt = false;
						pendingSearchQuery = null;
					}
				}}
			>
				<div
					class="bg-[var(--surface)] rounded-lg shadow-xl w-full max-w-md overflow-hidden"
					role="dialog"
					aria-modal="true"
					aria-labelledby="claim-prompt-title"
				>
					<!-- Header -->
					<div class="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
						<h2 id="claim-prompt-title" class="text-lg font-semibold text-[var(--text-primary)]">
							Sign in to add books
						</h2>
						<button
							onclick={() => {
								showClaimPrompt = false;
								pendingSearchQuery = null;
							}}
							class="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--background)]"
							aria-label="Close"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Content -->
					<div class="p-5">
						<p class="text-[var(--text-secondary)] mb-4">
							To add books from the web, verify your phone number first. This links your SMS shelf to your browser.
						</p>

						{#if pendingSearchQuery}
							<div class="bg-[var(--background-alt)] rounded-lg px-4 py-3 mb-4">
								<p class="text-sm text-[var(--text-secondary)]">You searched for:</p>
								<p class="font-medium text-[var(--text-primary)] mt-1">"{pendingSearchQuery}"</p>
							</div>
						{/if}

						<div class="space-y-3">
							<a
								href="/auth/verify-phone"
								class="block w-full px-4 py-3 bg-[var(--accent)] text-white text-center font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
								onclick={() => {
									// Store phone for auto-fill
									if (typeof localStorage !== 'undefined' && data.userId.startsWith('+')) {
										localStorage.setItem('tbr-claim-phone', data.userId);
									}
								}}
							>
								Verify Phone Number
							</a>

							<p class="text-center text-sm text-[var(--text-secondary)]">
								Or reply <span class="font-mono bg-[var(--background)] px-1.5 py-0.5 rounded">ADD</span> to your SMS to add via text
							</p>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Multimodal Add Book Modal -->
		{#if showIsbnInput}
			<div
				class="fixed inset-0 bg-[var(--charcoal)]/50 flex items-center justify-center z-50 p-4"
				role="button"
				tabindex="0"
				aria-label="Close add book dialog"
				onclick={(e: MouseEvent) => {
					// Close only when clicking the overlay, not the dialog content
					if (e.target !== e.currentTarget) return;
					closeAddModal();
				}}
				onkeydown={(e: KeyboardEvent) => {
					// Only close on Escape to avoid intercepting Space in textarea
					if (e.key === 'Escape') {
						closeAddModal();
					}
				}}
			>
				<div
					class="bg-[var(--surface)] rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
					role="dialog"
					aria-modal="true"
					aria-labelledby="addBookDialogTitle"
					onkeydown={(e: KeyboardEvent) => {
						if (e.key === 'Escape') {
							closeAddModal();
						}
					}}
				>
					<!-- Header - Fixed at top -->
					<div class="flex items-center justify-between gap-4 p-4 border-b border-[var(--border)]">
						{#if showNoteStep}
							<h2 id="addBookDialogTitle" class="text-lg font-semibold text-[var(--text-primary)]">Add Note</h2>
						{:else if detectedBooks.length > 0}
							<button
								type="button"
								class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
								aria-label="Back to search"
								onclick={() => {
									detectedBooks = [];
									selectedBookIds = new Set();
									selectedShelfIds = new Set();
									showShelfSelection = false;
									detectError = null;
									inputText = '';
									selectedFile = null;
								}}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
								</svg>
								<span>Back</span>
							</button>
							<h2 id="addBookDialogTitle" class="text-lg font-semibold text-[var(--text-primary)]">
								Select Books ({selectedBookIds.size}/{detectedBooks.length})
							</h2>
						{:else}
							<h2 id="addBookDialogTitle" class="text-lg font-semibold text-[var(--text-primary)]">Add Book</h2>
						{/if}
						<button
							type="button"
							class="ml-auto text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1"
							aria-label="Close"
							onclick={closeAddModal}
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Scrollable Content -->
					<div class="flex-1 overflow-y-auto p-4">
						{#if showNoteStep && addedBookForNote}
							<!-- Note Step - streamlined -->
							<div class="space-y-4">
								<!-- Success message -->
								<div class="text-center py-2">
									<p class="text-green-600 font-medium">✓ Added to your shelf</p>
									<p class="text-sm text-[var(--text-secondary)] mt-1 line-clamp-1">{addedBookForNote.title}</p>
								</div>

								<!-- Note prompt -->
								<div class="space-y-3">
									<p class="text-sm text-[var(--text-secondary)] text-center">Quick note for future you?</p>

									<textarea
										bind:this={noteTextarea}
										bind:value={noteText}
										placeholder={currentPrompt?.text || "What caught your attention about this one?"}
										class="w-full p-3 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] resize-none"
										rows={3}
									></textarea>

									{#if currentPrompt?.subtext}
										<p class="text-xs text-[var(--text-tertiary)] text-center">{currentPrompt.subtext}</p>
									{/if}
								</div>
							</div>
						{:else if detectedBooks.length === 0}
							<!-- Search Input Section -->
							<div class="space-y-4">
								<textarea
									bind:value={inputText}
									bind:this={queryInput}
									placeholder="ISBN, Amazon URL, Title by Author, or paste CSV/TXT for bulk import..."
									rows="3"
									aria-label="Book search input. Enter ISBN, Amazon URL, book title and author, paste CSV or TXT content for bulk import, or drag and drop an image"
									class="w-full p-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] disabled:bg-[var(--paper-light)] disabled:cursor-not-allowed disabled:opacity-60"
									disabled={isDetecting || isAddingBook}
									ondragover={handleDragOver}
									ondrop={handleDrop}
									onkeydown={(e: KeyboardEvent) => {
										if (e.key === 'Enter' && !e.shiftKey) {
											e.preventDefault();
											if ((inputText.trim() || selectedFile) && !isDetecting) {
												detectBooks();
											}
										}
									}}
								></textarea>

								{#if selectedFile && selectedFile.size > 3 * 1024 * 1024}
									<div class="text-sm text-yellow-600">
										⚠️ Large file ({formatFileSize(selectedFile.size)}). Consider resizing for faster upload.
									</div>
								{/if}

								<div class="flex items-center gap-2">
									<div class="flex-grow border-t border-[var(--border)]"></div>
									<span class="text-sm text-[var(--text-secondary)]">or</span>
									<div class="flex-grow border-t border-[var(--border)]"></div>
								</div>

								<button
									onclick={triggerFileInput}
									disabled={isDetecting || isAddingBook}
									class="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-[var(--border)] rounded-lg hover:border-[var(--accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								>
									📷 Snap a Cover, Barcode, or Upload CSV
								</button>

								<input
									type="file"
									accept="image/*,.csv,.txt,text/plain,text/csv"
									capture="environment"
									bind:this={fileInput}
									onchange={handleFileSelect}
									hidden
								/>

								<p class="text-xs text-[var(--text-secondary)] text-center">
									💡 Cover photos, barcodes, and CSV/TXT bulk imports all work here
								</p>
							</div>

							{#if isDetecting}
								<div class="flex items-center gap-2 text-sm text-[var(--text-secondary)] p-3 bg-[var(--paper-light)] rounded-lg">
									<span class="animate-spin">⏳</span>
									<span>Detecting books...</span>
								</div>
							{/if}

							{#if detectError}
								<div
									class="text-sm text-red-600 bg-red-50 px-4 py-3 rounded border border-red-200"
									role="alert"
								>
									{detectError}
								</div>
							{/if}

							{#if addBookSuccess}
								<div
									class="text-sm text-green-600 bg-green-50 px-4 py-3 rounded border border-green-200"
									role="status"
								>
									Book(s) added successfully!
								</div>
							{/if}
						{:else}
							<!-- Books Results Section -->
							<div class="space-y-4">

								{#if detectError}
									<div
										class="text-sm text-red-600 bg-red-50 px-4 py-3 rounded border border-red-200"
										role="alert"
									>
										{detectError}
									</div>
								{/if}

								{#if detectionMetadata}
									<div class="text-sm space-y-1">
										<div class="text-[var(--text-secondary)]">
											Processed {detectionMetadata.totalLines} lines, found {detectionMetadata.validIsbns} valid ISBNs
										</div>
										{#if detectionMetadata.skippedLines > 0}
											<div class="text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded text-xs">
												⚠️ Skipped {detectionMetadata.skippedLines} lines with invalid ISBNs
											</div>
										{/if}
										{#if detectionMetadata.duplicatesRemoved && detectionMetadata.duplicatesRemoved > 0}
											<div class="text-[var(--accent)] bg-[var(--paper-light)] border border-[var(--border)] p-2 rounded text-xs">
												ℹ️ Removed {detectionMetadata.duplicatesRemoved} duplicate{detectionMetadata.duplicatesRemoved > 1 ? 's' : ''}
											</div>
										{/if}
									</div>
								{/if}

								<!-- Book Selection List -->
								<div class="space-y-2">
									{#each detectedBooks as book}
										<label class="flex items-start gap-3 p-2 hover:bg-[var(--paper-light)] rounded cursor-pointer">
											<input
												type="checkbox"
												checked={selectedBookIds.has(book.isbn13)}
												onchange={() => toggleBookSelection(book.isbn13)}
												class="mt-1"
											/>
											{#if book.coverUrl}
												<img
													src={book.coverUrl}
													alt={book.title}
													class="w-12 h-16 object-cover rounded flex-shrink-0"
												/>
											{:else}
												<div class="w-12 h-16 bg-[var(--paper-dark)] rounded flex items-center justify-center flex-shrink-0">
													<span class="text-[var(--text-tertiary)] text-xl">📖</span>
												</div>
											{/if}
											<div class="flex-grow min-w-0">
												<div class="font-medium text-sm line-clamp-2">{book.title}</div>
												{#if book.author && book.author.length > 0}
													<div class="text-xs text-[var(--text-secondary)] line-clamp-1">
														{book.author.join(', ')}
													</div>
												{/if}
												{#if book.publisher || book.publicationDate}
													{@const year = getPublicationYear(book.publicationDate)}
													<div class="text-xs text-[var(--text-secondary)] line-clamp-1">
														{book.publisher}{#if year}{book.publisher ? ' ' : ''}({year}){/if}
													</div>
												{/if}
											</div>
										</label>
									{/each}
								</div>

								<!-- Shelf selection (collapsible) -->
								{#if data.shelves.length > 0}
									<div class="border-t pt-4">
										<button
											onclick={() => showShelfSelection = !showShelfSelection}
											class="w-full flex items-center justify-between text-sm text-[var(--text-primary)] py-2 px-3 rounded-lg border border-[var(--border)] hover:bg-[var(--paper-light)] transition-colors"
										>
											<span class="font-medium">Add to shelves (optional)</span>
											<svg class="w-4 h-4 transition-transform" class:rotate-180={showShelfSelection} fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
											</svg>
										</button>

										{#if showShelfSelection}
											<div class="mt-2 space-y-1 max-h-32 overflow-y-auto">
												{#each data.shelves as shelf}
													<label class="flex items-center gap-2 p-2 hover:bg-[var(--paper-light)] rounded cursor-pointer">
														<input
															type="checkbox"
															checked={selectedShelfIds.has(shelf.id)}
															onchange={() => toggleShelfSelection(shelf.id)}
														/>
														<span class="text-sm text-[var(--text-primary)]">{shelf.name}</span>
													</label>
												{/each}
											</div>
											<p class="text-xs text-[var(--text-secondary)] mt-2">
												Books will be added to your library and assigned to selected shelves.
											</p>
										{/if}
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Fixed Footer with Actions - Away from bottom edge -->
					<div class="border-t border-[var(--border)] bg-[var(--paper-light)] p-4 pb-6 flex gap-2 justify-end">
						{#if showNoteStep}
							<button
								type="button"
								class="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
								onclick={skipAddedBookNote}
							>
								Skip
							</button>
							<Button
								variant="primary"
								size="md"
								onclick={saveAddedBookNote}
							>
								Save
							</Button>
						{:else if detectedBooks.length === 0}
							<Button
								variant="primary"
								size="md"
								onclick={detectBooks}
								disabled={(!inputText.trim() && !selectedFile) || isDetecting}
							>
								{isDetecting ? 'Detecting...' : 'Search'}
							</Button>
						{:else}
							<button
								type="button"
								class="px-4 py-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium"
								onclick={() => {
									selectedBookIds = new Set();
									selectedShelfIds = new Set();
									showShelfSelection = false;
								}}
							>
								Clear Selection
							</button>
							<Button
								variant="primary"
								size="md"
								onclick={addSelectedBooks}
								disabled={selectedBookIds.size === 0 || isAddingBook}
							>
								{isAddingBook ? 'Adding...' : `Add ${selectedBookIds.size} Book${selectedBookIds.size === 1 ? '' : 's'}`}
							</Button>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Shelf Selection Modal -->
		{#if shelfModalOpen && shelfModalBookId}
			{@const currentBook = localBooks.find(b => b.id === shelfModalBookId)}
			{#if currentBook}
				<div
					class="fixed inset-0 bg-[var(--charcoal)]/50 z-50 flex items-center justify-center p-4"
					onclick={() => shelfModalBookId = null}
					onkeydown={(e) => {
						if (e.key === 'Escape') {
							shelfModalBookId = null;
						}
					}}
					role="presentation"
				>
					<div
						bind:this={shelfModalElement}
						class="bg-[var(--surface)] rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
						onclick={(e) => e.stopPropagation()}
						role="dialog"
						aria-modal="true"
						aria-labelledby="shelf-modal-title"
						tabindex="-1"
					>
						<!-- Modal Header -->
						<div class="flex items-center justify-between p-4 border-b border-[var(--border)]">
							<div>
								<h2 id="shelf-modal-title" class="text-lg font-semibold text-[var(--text-primary)]">Manage Shelves</h2>
								<p class="text-sm text-[var(--text-secondary)] mt-0.5">{currentBook.title}</p>
							</div>
							<button
								onclick={() => shelfModalBookId = null}
								class="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--paper-light)] rounded-lg transition-colors"
								aria-label="Close modal"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
								</svg>
							</button>
						</div>

						<!-- Scrollable Shelf List -->
						<div class="flex-1 overflow-y-auto p-4">
							<div class="space-y-1">
								{#each data.shelves as shelf}
									{@const isOn = isBookOnShelf(shelfModalBookId ?? '', shelf.id)}
									{@const bookCount = localBookShelves.filter(bs => bs.shelf_id === shelf.id).length}
									<button
										onclick={() => {
											toggleBookOnShelf(shelfModalBookId ?? '', shelf.id, isOn);
											showSavedFeedback(isOn ? `Removed from ${shelf.name}` : `Added to ${shelf.name}`);
										}}
										class="flex items-center gap-3 w-full py-2.5 px-3 rounded-lg hover:bg-[var(--paper-light)] transition-colors group"
									>
										<div class="w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 {isOn
											? 'bg-[var(--surface-dark)] border-[var(--surface-dark)]'
											: 'border-[var(--border)] group-hover:border-[var(--warm-gray)]'}">
											{#if isOn}
												<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
												</svg>
											{/if}
										</div>
										<span class="text-sm flex-1 text-left {isOn ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}">
											{shelf.name}
										</span>
										<span class="text-xs text-[var(--text-tertiary)]">{bookCount}</span>
									</button>
								{/each}
							</div>

							<!-- New Shelf Button -->
							<div class="mt-4 pt-4 border-t border-[var(--border)]">
								{#if !showNewShelfInput}
									<button
										onclick={() => showNewShelfInput = true}
										class="w-full text-left text-sm text-[var(--text-secondary)] py-2 px-3 rounded-lg border border-dashed border-[var(--border)] hover:border-[var(--warm-gray)] hover:text-[var(--text-primary)] transition-colors"
									>
										+ Create new shelf
									</button>
								{:else}
									<div class="flex gap-2">
										<input
											type="text"
											bind:value={newShelfName}
											placeholder="Shelf name"
											class="flex-1 text-sm px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
											onkeydown={(e) => {
												if (e.key === 'Enter' && newShelfName.trim()) {
													createShelf();
												}
												if (e.key === 'Escape') {
													showNewShelfInput = false;
													newShelfName = '';
												}
											}}
										/>
										<button
											onclick={() => {
												showNewShelfInput = false;
												newShelfName = '';
											}}
											class="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
										>
											Cancel
										</button>
										<button
											onclick={createShelf}
											disabled={!newShelfName.trim() || creatingShelf}
											class="px-4 py-2 text-sm bg-[var(--surface-dark)] text-white rounded-lg hover:bg-[var(--surface-dark-secondary)] transition-colors disabled:opacity-50"
										>
											{creatingShelf ? 'Creating...' : 'Create'}
										</button>
									</div>
								{/if}
							</div>
						</div>

						<!-- Modal Footer -->
						<div class="p-4 border-t border-[var(--border)]">
							<button
								onclick={() => shelfModalBookId = null}
								class="w-full py-2 text-sm text-[var(--text-secondary)] font-medium hover:bg-[var(--paper-light)] rounded-lg transition-colors"
							>
								Done
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/if}
		</div>
	</div>
</div>

<!-- Share Modal -->
{#if shareModalBook}
	<ShareModal
		book={shareModalBook}
		identifier={canonicalIdentifier}
		open={shareModalOpen}
		onClose={() => shareModalBook = null}
	/>
{/if}

<!-- Global soft success toast -->
{#if savedFeedback}
	<div
		class="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-[var(--charcoal)] text-white text-sm rounded-full shadow-lg z-50 pointer-events-none"
		in:fade={{ duration: 150 }}
		out:fade={{ duration: 200 }}
	>
		{savedFeedback}
	</div>
{/if}


<style>
	/* Shelf page design system overrides */
	.shelf-page {
		font-family: var(--font-sans);
		background: var(--background);
		color: var(--text-primary);
	}

	/* Book title styling - Lora italic */
	.shelf-page :global(.book-title),
	.shelf-page :global(.font-serif) {
		font-family: var(--font-serif);
		font-style: italic;
	}

	/* Highlight pulse animation for search jump-to */
	:global(.highlight-pulse) {
		animation: pulse 0.6s ease-out;
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(196, 166, 124, 0.5);
		}
		70% {
			box-shadow: 0 0 0 12px rgba(196, 166, 124, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(196, 166, 124, 0);
		}
	}

</style>
