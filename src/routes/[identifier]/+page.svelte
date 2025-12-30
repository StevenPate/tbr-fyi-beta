<script lang="ts">
	import type { PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { Card, FlipCard, Button, Input, Badge, SearchBar } from '$lib/components/ui';
	import ShareModal from '$lib/components/ui/ShareModal.svelte';
	import JsBarcode from 'jsbarcode';
	import ClaimShelfBanner from '$lib/components/ClaimShelfBanner.svelte';
	import { browser } from '$app/environment';

	let { data }: { data: PageData } = $props();

	// Local shelf selection state for instant filtering (no server round-trip)
	let selectedShelfId = $state<string | null>(data.selectedShelfId);

	// Sync with server data on navigation (e.g., browser back/forward)
	$effect(() => {
		selectedShelfId = data.selectedShelfId;
	});

	let newShelfName = $state('');
	let showNewShelfInput = $state(false);
	let creatingShelf = $state(false);
	let selectedBookForShelfMenu = $state<string | null>(null);

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

	// View mode state (default to list)
	let viewMode = $state<'grid' | 'list'>('list');

	// Shelf pills scroll container ref
	let shelfScrollContainer: HTMLDivElement | null = null;

	// Scroll to selected shelf pill when selection changes
	$effect(() => {
		if (!browser || !shelfScrollContainer || !selectedShelfId) return;

		// Small delay to ensure DOM is ready
		setTimeout(() => {
			const selectedPill = shelfScrollContainer?.querySelector(`[data-shelf-id="${selectedShelfId}"]`);
			if (selectedPill) {
				selectedPill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
			}
		}, 100);
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

	// Filter books by selected shelf (client-side for instant switching)
	const booksForCurrentShelf = $derived(() => {
		if (!selectedShelfId) {
			// "All Books" view
			return data.allBooks;
		}
		// Filter to books on the selected shelf
		const bookIdsOnShelf = new Set(
			data.bookShelves
				.filter(bs => bs.shelf_id === selectedShelfId)
				.map(bs => bs.book_id)
		);
		return data.allBooks.filter(book => bookIdsOnShelf.has(book.id));
	});

	// Then apply search filter
	const displayedBooks = $derived(
		searchQuery.trim()
			? booksForCurrentShelf().filter(b => matchesSearchQuery(b, searchQuery))
			: booksForCurrentShelf()
	);

	// Scroll to and highlight a book, expand/flip it based on view mode
	function scrollToBook(book: { id: string }) {
		// Small delay to let DOM settle after search clears
		requestAnimationFrame(() => {
			const element = document.getElementById(`book-${book.id}`);
			if (element) {
				element.scrollIntoView({ behavior: 'smooth', block: 'center' });
				element.classList.add('highlight-pulse');
				setTimeout(() => element.classList.remove('highlight-pulse'), 1000);
			}
			// Flip or expand the card based on view mode
			if (viewMode === 'grid') {
				flippedBookId = book.id;
			} else {
				expandedCardId = book.id;
			}
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
	let fileInput: HTMLInputElement | null = null;
	let queryInput: HTMLTextAreaElement | null = null;

	// Delete shelf state
	let deletingShelfId = $state<string | null>(null);

	// Cover card state (for grid view with FlipCard) - only one card flipped at a time
	let flippedBookId = $state<string | null>(null);

	// Expanded card state (for list view) - only one card expanded at a time
	let expandedCardId = $state<string | null>(null);

	// Grid flip hint (one-time for new users)
	let showFlipHint = $state(false);
	let flipHintTimeout: ReturnType<typeof setTimeout> | null = null;

	function dismissFlipHint() {
		showFlipHint = false;
		if (flipHintTimeout) {
			clearTimeout(flipHintTimeout);
			flipHintTimeout = null;
		}
		if (browser) {
			localStorage.setItem('tbr-flip-hint-dismissed', 'true');
		}
	}
	let noteEditingMap = $state<Map<string, boolean>>(new Map());
	let noteExpandedMap = $state<Map<string, boolean>>(new Map());
	let descriptionOpenMap = $state<Map<string, boolean>>(new Map());
	let linksOpenMap = $state<Map<string, boolean>>(new Map());
	let shelvesOpenMap = $state<Map<string, boolean>>(new Map());
	let barcodeOpenMap = $state<Map<string, boolean>>(new Map());
	let menuOpenMap = $state<Map<string, boolean>>(new Map());
	let removeConfirmMap = $state<Map<string, boolean>>(new Map());
	let copiedMap = $state<Map<string, boolean>>(new Map());
	let tempNoteMap = $state<Map<string, string>>(new Map());

	// Soft success feedback (for FlipCard actions)
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

	// Detail modal state (for FlipCard "View Details")
	let detailModalBookId = $state<string | null>(null);
	let detailModalBook = $derived(detailModalBookId ? data.allBooks.find(b => b.id === detailModalBookId) : null);
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

	// Show flip hint when entering grid view (first time only)
	$effect(() => {
		if (viewMode === 'grid' && browser) {
			const dismissed = localStorage.getItem('tbr-flip-hint-dismissed');
			if (!dismissed && data.allBooks.length > 0) {
				showFlipHint = true;
				// Auto-dismiss after 3 seconds
				flipHintTimeout = setTimeout(() => {
					dismissFlipHint();
				}, 3000);
			}
		} else {
			// Hide hint when leaving grid view
			if (showFlipHint) {
				showFlipHint = false;
				if (flipHintTimeout) {
					clearTimeout(flipHintTimeout);
					flipHintTimeout = null;
				}
			}
		}
	});

	// Helper to get/set flipped state for a book (only one at a time)
	function getFlipped(bookId: string) {
		return flippedBookId === bookId;
	}

	function setFlipped(bookId: string, value: boolean) {
		flippedBookId = value ? bookId : null;
		// Dismiss hint on any card interaction
		if (showFlipHint) {
			dismissFlipHint();
		}
	}

	// Close flipped card when clicking outside
	function handleGridClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		// Check if click is outside any flip-card
		if (!target.closest('.flip-card')) {
			flippedBookId = null;
		}
	}

	// Shelf navigation state
	let showMoreShelves = $state(false);
	const MAX_VISIBLE_SHELVES = 3; // Show first 3 shelves, hide the rest

	// Compute which shelves should be visible (always include selected shelf)
	const visibleShelves = $derived(() => {
		const shelves = data.shelves;
		const selectedId = selectedShelfId;

		// If we have fewer shelves than max, show all
		if (shelves.length <= MAX_VISIBLE_SHELVES) {
			return shelves;
		}

		// Get first N shelves
		const topShelves = shelves.slice(0, MAX_VISIBLE_SHELVES);

		// Check if selected shelf is already in top N
		const selectedInTop = !selectedId || topShelves.some(s => s.id === selectedId);

		if (selectedInTop) {
			// Selected is already visible, just return top N
			return topShelves;
		}

		// Selected shelf is hidden - show top (N-1) + selected shelf
		const selectedShelf = shelves.find(s => s.id === selectedId);
		if (selectedShelf) {
			return [...shelves.slice(0, MAX_VISIBLE_SHELVES - 1), selectedShelf];
		}

		return topShelves;
	});

	// Compute which shelves should be in the "More" dropdown
	const hiddenShelves = $derived(() => {
		const visible = visibleShelves();
		const visibleIds = new Set(visible.map(s => s.id));
		return data.shelves.filter(s => !visibleIds.has(s.id));
	});

	// Description collapse state
	let expandedDescriptions = $state<Set<string>>(new Set());

	function toggleDescription(bookId: string) {
		const newSet = new Set(expandedDescriptions);
		if (newSet.has(bookId)) {
			newSet.delete(bookId);
		} else {
			newSet.add(bookId);
		}
		expandedDescriptions = newSet;
	}

	// Barcode generation state
	let showBarcodeForBook = $state<string | null>(null);

	function toggleBarcode(bookId: string) {
		showBarcodeForBook = showBarcodeForBook === bookId ? null : bookId;
	}

	// ISBN copy state
	let copiedIsbn = $state<string | null>(null);

	async function copyISBN(isbn: string) {
		try {
			await navigator.clipboard.writeText(isbn);
			copiedIsbn = isbn;
			setTimeout(() => {
				copiedIsbn = null;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy ISBN:', err);
		}
	}

	// Svelte action for responsive barcode generation
	function generateBarcode(node: HTMLCanvasElement, isbn: string) {
		// Calculate responsive width based on container with minimal padding
		const containerWidth = node.parentElement?.clientWidth || 300;
		// Use most of the available width - only subtract minimal padding
		const targetWidth = Math.max(150, containerWidth - 12); // Only 12px padding total

		// EAN-13 has 95 bars total
		// Use larger bar widths for better visibility
		const barWidth = targetWidth < 200 ? 1.5 : targetWidth < 280 ? 2.0 : 2.5;

		// Scale font size and height proportionally - make it bigger
		const scale = targetWidth / 300;
		const fontSize = Math.max(10, Math.floor(14 * scale));
		const height = Math.max(50, Math.floor(65 * scale));

		JsBarcode(node, isbn, {
			format: 'EAN13',
			width: barWidth,
			height: height,
			displayValue: true,
			fontSize: fontSize,
			margin: 0,
			marginTop: 0,
			marginBottom: 0,
			marginLeft: 0,
			marginRight: 0,
			textMargin: 0,
			flat: true  // Remove extra padding/quiet zones
		});

		// Explicitly set canvas styling for proper centering
		node.style.maxWidth = '100%';
		node.style.height = 'auto';
		node.style.display = 'block';

		// Regenerate barcode on resize for proper scaling
		function regenerate() {
			const containerWidth = node.parentElement?.clientWidth || 300;
			const targetWidth = Math.max(150, containerWidth - 12);
			const barWidth = targetWidth < 200 ? 1.5 : targetWidth < 280 ? 2.0 : 2.5;
			const scale = targetWidth / 300;
			const fontSize = Math.max(10, Math.floor(14 * scale));
			const height = Math.max(50, Math.floor(65 * scale));

			JsBarcode(node, isbn, {
				format: 'EAN13',
				width: barWidth,
				height: height,
				displayValue: true,
				fontSize: fontSize,
				margin: 0,
				marginTop: 0,
				marginBottom: 0,
				marginLeft: 0,
				marginRight: 0,
				textMargin: 0,
				flat: true
			});

			node.style.maxWidth = '100%';
			node.style.height = 'auto';
			node.style.display = 'block';
		}

		// Use ResizeObserver for container size changes
		const resizeObserver = new ResizeObserver(() => {
			regenerate();
		});

		// Observe the parent container
		if (node.parentElement) {
			resizeObserver.observe(node.parentElement);
		}

		return {
			update(newIsbn: string) {
				isbn = newIsbn;
				regenerate();
			},
			destroy() {
				resizeObserver.disconnect();
			}
		};
	}

	// Extract year from publication date (YYYY or YYYY-MM-DD)
	function getPublicationYear(dateString: string | null | undefined): string | null {
		if (!dateString) return null;
		const yearMatch = dateString.match(/^\d{4}/);
		return yearMatch ? yearMatch[0] : null;
	}

	// Helper to get shelves for a book
	function getBookShelves(bookId: string) {
		return data.bookShelves
			.filter(bs => bs.book_id === bookId)
			.map(bs => data.shelves.find(s => s.id === bs.shelf_id))
			.filter(s => s !== undefined);
	}

	// Check if book is on a shelf
	function isBookOnShelf(bookId: string, shelfId: string) {
		return data.bookShelves.some(bs => bs.book_id === bookId && bs.shelf_id === shelfId);
	}

	async function toggleRead(bookId: string, currentValue: boolean) {
		try {
			const response = await fetch('/api/books/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: bookId,
					is_read: !currentValue
				})
			});

			if (response.ok) {
				await invalidateAll();
			}
		} catch (error) {
			console.error('Error toggling read:', error);
		}
	}

	async function toggleOwned(bookId: string, currentValue: boolean) {
		try {
			const response = await fetch('/api/books/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: bookId,
					is_owned: !currentValue
				})
			});

			if (response.ok) {
				await invalidateAll();
			}
		} catch (error) {
			console.error('Error toggling owned:', error);
		}
	}

	async function updateNote(bookId: string, note: string) {
		try {
			await fetch('/api/books/update', {
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
			const response = await fetch('/api/shelves', {
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
			} else {
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
		try {
			const response = await fetch('/api/books/shelves', {
				method: isOn ? 'DELETE' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					book_id: bookId,
					shelf_id: shelfId
				})
			});

			if (response.ok) {
				await invalidateAll();
			}
		} catch (error) {
			console.error('Error toggling book on shelf:', error);
		}
	}

	async function deleteBook(bookId: string, title: string) {
		if (!confirm(`Remove "${title}" from your shelf?`)) {
			return;
		}

		try {
			const response = await fetch('/api/books/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ bookId })
			});

			if (response.ok) {
				await invalidateAll();
			} else {
				alert('Failed to delete book. Please try again.');
			}
		} catch (error) {
			console.error('Error deleting book:', error);
			alert('Failed to delete book. Please try again.');
		}
	}

	function selectShelf(shelfId: string | null) {
		// Update local state immediately (instant UI response)
		selectedShelfId = shelfId;

		// Update URL for bookmarkability/sharing (shallow - no server round-trip)
		const params = new URLSearchParams(window.location.search);
		if (shelfId) {
			params.set('shelf', shelfId);
			params.delete('view');
		} else {
			params.delete('shelf');
			params.set('view', 'all');
		}
		const queryString = params.toString();
		const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

		// Use replaceState for shallow URL update (supports back/forward via popstate)
		history.pushState({}, '', newUrl);
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
			const response = await fetch('/api/shelves', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: shelfId })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to delete shelf');
			}

			// If we're currently viewing the deleted shelf, switch to All Books
			if (selectedShelfId === shelfId) {
				selectedShelfId = null;
				history.replaceState({}, '', `${window.location.pathname}?view=all`);
			}

			// Refresh the page data to update shelf list
			await invalidateAll();
		} catch (error) {
			alert(`Error deleting shelf: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			deletingShelfId = null;
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

			const response = await fetch('/api/books/detect', {
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
			for (const book of booksToAdd) {
				const resp = await fetch('/api/books/add', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ isbn: book.isbn13 })
				});
				if (!resp.ok) {
					console.error('Failed to add book', book);
				}
			}

			// Refresh data to get book IDs
			await invalidateAll();

			// Add books to selected shelves if any were chosen
			if (selectedShelfIds.size > 0) {
				for (const book of booksToAdd) {
					// Find the book in the updated data
					const addedBook = data.allBooks.find(b => b.isbn13 === book.isbn13);
					if (addedBook) {
						// Add to each selected shelf
						for (const shelfId of selectedShelfIds) {
							try {
								await fetch('/api/books/shelves', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										book_id: addedBook.id,
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
			const response = await fetch('/api/books/add', {
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
				showIsbnInput = true;
			}
		};

		// Click outside handler for "More shelves" dropdown
		const handleClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			// Close dropdown if clicking outside the more-shelves container
			if (showMoreShelves && !target.closest('.more-shelves-container')) {
				showMoreShelves = false;
			}
		};

		// If URL contains ?q=, auto-open modal, prefill, and run detection
		try {
			const searchParams = $page.url.searchParams;
			const q = searchParams.get('q');
			if (q) {
				showIsbnInput = true;
				inputText = q;
				// Delay to allow modal to mount
				setTimeout(() => { void detectBooks(); }, 0);
			}
		} catch (e) {
			console.warn('Failed to parse query params', e);
		}

		// Handle browser back/forward for shelf navigation
		const handlePopState = () => {
			const params = new URLSearchParams(window.location.search);
			const shelfParam = params.get('shelf');
			const viewParam = params.get('view');

			if (viewParam === 'all') {
				selectedShelfId = null;
			} else if (shelfParam) {
				// Validate shelf exists
				const shelfExists = data.shelves.some(s => s.id === shelfParam);
				selectedShelfId = shelfExists ? shelfParam : null;
			} else {
				// No params - use default shelf if available
				selectedShelfId = data.defaultShelfId || null;
			}
		};

		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('click', handleClick);
		window.addEventListener('popstate', handlePopState);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('click', handleClick);
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
	<title>{data.username ? `${data.username}'s Reading List` : 'Reading List'} | TBR.fyi</title>
	<meta name="description" content="{data.allBooks.length} {data.allBooks.length === 1 ? 'book' : 'books'} on {data.username ? `${data.username}'s` : 'this'} reading list" />
</svelte:head>

<div class="min-h-screen bg-gray-100">
	{#if data.isPhoneBased}
		<ClaimShelfBanner phoneNumber={data.userId} {isOwner} />
	{/if}

	<div class="py-8">
		<div class="max-w-4xl mx-auto px-4">
		<!-- Header - slides up/down based on scroll direction (mobile only) -->
		<div
			class="sticky top-0 z-30 -mx-4 px-4 bg-gray-100 border-b border-gray-200/50 transition-transform duration-200 ease-out md:static md:mx-0 md:px-0 md:bg-transparent md:border-0 md:translate-y-0 {headerVisible ? 'translate-y-0' : '-translate-y-full'}"
			style="will-change: transform;"
		>
			<div class="py-2 md:py-0">
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<h1 class="text-xl md:text-3xl font-bold text-gray-900 truncate">{data.username ? `${data.username}'s Reading List` : 'Reading List'}</h1>
						<p class="text-xs md:text-sm text-gray-400 font-normal">
							<span class="font-semibold text-gray-600">{booksForCurrentShelf().length}</span> {booksForCurrentShelf().length === 1 ? 'book' : 'books'}{#if selectedShelfId} on this shelf{/if}
						</p>
					</div>

					<!-- Search, View Toggle and Manual ISBN Entry -->
					<div class="flex gap-1 md:gap-2 items-start flex-shrink-0">
						<!-- Search -->
						<SearchBar
							books={booksForCurrentShelf()}
							bind:expanded={searchExpanded}
							bind:query={searchQuery}
							onSelect={scrollToBook}
							onQueryChange={(q) => searchQuery = q}
						/>

						<div class="flex gap-1 border border-gray-300 rounded-lg p-1 bg-white md:bg-transparent" role="group" aria-label="View mode toggle">
							<button
								onclick={() => {
									viewMode = 'grid';
									umami?.track('view-mode-change', { mode: 'grid' });
								}}
								class="px-3 py-1.5 rounded text-sm font-medium transition-colors {viewMode === 'grid'
									? 'bg-blue-600 text-white'
									: 'text-gray-700 hover:bg-gray-100'}"
								aria-label="Grid view"
								aria-pressed={viewMode === 'grid'}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
								</svg>
							</button>
							<button
								onclick={() => {
									viewMode = 'list';
									umami?.track('view-mode-change', { mode: 'list' });
								}}
								class="px-3 py-1.5 rounded text-sm font-medium transition-colors {viewMode === 'list'
									? 'bg-blue-600 text-white'
									: 'text-gray-700 hover:bg-gray-100'}"
								aria-label="List view"
								aria-pressed={viewMode === 'list'}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
								</svg>
							</button>
						</div>

						<!-- Manual ISBN Entry Button -->
						<button
							onclick={() => {
								showIsbnInput = true;
								addBookError = null;
								addBookSuccess = false;
							}}
							class="w-10 h-10 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-400 text-gray-600 hover:border-blue-600 hover:text-blue-600 transition-colors text-xl font-bold bg-white md:bg-transparent"
							aria-label="Add book manually by ISBN"
							title="Add book by ISBN or photo of barcode"
						>
							+
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Shelf Navigation - separate sticky element, always visible -->
		<!-- On mobile: positioned below header when header is visible, at top when header is hidden -->
		<div
			class="sticky z-20 -mx-4 px-4 bg-gray-100/95 backdrop-blur-sm transition-[top] duration-200 md:static md:mx-0 md:px-0 md:bg-transparent md:backdrop-blur-none md:top-0 mt-3 md:mt-5 mb-4 md:mb-6"
			style="top: {headerVisible ? '60px' : '0px'};"
		>
			<div class="relative py-2 md:py-0">
			<!-- Fade gradient on right edge (mobile) -->
			<div class="absolute right-4 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100/95 to-transparent pointer-events-none z-10 md:hidden"></div>

			<div
				bind:this={shelfScrollContainer}
				class="flex gap-2 items-center overflow-x-auto pb-1 md:pb-0 md:flex-wrap scrollbar-hide snap-x snap-mandatory scroll-smooth pr-8 md:pr-0"
			>
				<!-- All Books Tab -->
				<Button
					variant={!selectedShelfId ? 'primary' : 'secondary'}
					size="md"
					onclick={() => selectShelf(null)}
					class="flex-shrink-0 snap-start"
				>
					All ({data.allBooks?.length || 0})
				</Button>

				<!-- Visible Shelf Tabs -->
				{#each visibleShelves() as shelf}
					{@const bookCount = data.bookShelves.filter(bs => bs.shelf_id === shelf.id).length}
					<div
						data-shelf-id={shelf.id}
						class="group inline-flex items-center gap-0 rounded-lg overflow-hidden flex-shrink-0 snap-start"
					>
						<Button
							variant={selectedShelfId === shelf.id ? 'primary' : 'secondary'}
							size="md"
							onclick={() => selectShelf(shelf.id)}
							disabled={deletingShelfId === shelf.id}
							class="rounded-none cursor-pointer whitespace-nowrap {selectedShelfId === shelf.id ? 'pr-0' : 'pl-4 pr-0'}"
						>
							{#if deletingShelfId === shelf.id}
								Deleting...
							{:else}
								{shelf.name} ({bookCount})
							{/if}
						</Button>
						<button
							onclick={(e: MouseEvent) => {
								e.stopPropagation();
								deleteShelf(shelf.id, shelf.name);
							}}
							disabled={deletingShelfId === shelf.id}
							class="px-2 py-1.5 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer {selectedShelfId === shelf.id ? 'bg-stone-800 text-stone-300 group-hover:bg-stone-700' : 'bg-stone-100 text-stone-400 group-hover:bg-stone-200'}"
							aria-label={`Delete shelf ${shelf.name}`}
							title="Delete shelf"
						>
							×
						</button>
					</div>
				{/each}

				<!-- More Shelves Button (if there are hidden shelves) -->
				{#if hiddenShelves().length > 0}
					<div class="more-shelves-container flex-shrink-0 snap-start">
						<Button
							variant="secondary"
							size="md"
							onclick={() => showMoreShelves = !showMoreShelves}
							class="cursor-pointer whitespace-nowrap"
						>
							More ({hiddenShelves().length}) {showMoreShelves ? '▲' : '▼'}
						</Button>
					</div>
				{/if}

				<!-- New Shelf Button -->
				{#if !showNewShelfInput}
					<Button
						variant="ghost"
						size="sm"
						class="border border-dashed border-stone-300 text-stone-400 hover:border-stone-400 flex-shrink-0 snap-start"
						onclick={() => showNewShelfInput = true}
					>
						<span class="md:hidden">+ New</span>
						<span class="hidden md:inline">+ New Shelf</span>
					</Button>
				{:else}
					<div class="flex gap-2">
						<Input
							size="md"
							type="text"
							bind:value={newShelfName}
							placeholder="Shelf name"
							onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && createShelf()}
							class="w-48"
						/>
						<Button variant="primary" size="md" onclick={createShelf}>
							Create
						</Button>
						<Button
							variant="secondary"
							size="md"
							onclick={() => { showNewShelfInput = false; newShelfName = ''; }}
						>
							Cancel
						</Button>
					</div>
				{/if}
			</div>

			<!-- More Shelves Dropdown (positioned outside scroll container to avoid clipping) -->
			{#if showMoreShelves && hiddenShelves().length > 0}
				<div class="more-shelves-container absolute right-4 top-full mt-1 bg-white rounded-lg shadow-lg border border-stone-200 py-1 min-w-[180px] z-[100]">
					{#each hiddenShelves() as shelf}
						{@const bookCount = data.bookShelves.filter(bs => bs.shelf_id === shelf.id).length}
						<button
							onclick={() => {
								selectShelf(shelf.id);
								showMoreShelves = false;
							}}
							class="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
						>
							<span class="truncate">{shelf.name}</span>
							<span class="text-stone-400 text-xs flex-shrink-0">({bookCount})</span>
						</button>
					{/each}
				</div>
			{/if}
			</div>
		</div>

		<!-- Error Message -->
		{#if data.error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
				<p class="text-red-800">Error: {data.error}</p>
			</div>
		{/if}

		<!-- Empty State -->
		{#if data.allBooks.length === 0}
			<!-- No books at all -->
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
				<div class="text-gray-400 text-5xl mb-4">📚</div>
				<h2 class="text-xl font-semibold text-gray-900 mb-2">No books yet!</h2>
				<p class="text-gray-600 mb-4">Text an ISBN or send a photo of a barcode to (360) 504-4327 to get started.</p>
				<div class="text-sm text-gray-500 space-y-2">
					<p>Try texting an ISBN: <code class="bg-gray-100 px-2 py-1 rounded">9780140449136</code></p>
					<p>Or send a photo of a book barcode!</p>
				</div>
			</div>
		{:else if displayedBooks.length === 0}
			<!-- Shelf is empty but user has books -->
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
				<div class="text-gray-400 text-5xl mb-4">📖</div>
				<h2 class="text-xl font-semibold text-gray-900 mb-2">No books on this shelf</h2>
				<p class="text-gray-600">Add books to this shelf from your library, or switch to "All" to see all your books.</p>
			</div>
		{/if}

		<!-- Books Grid/List -->
		{#key selectedShelfId}
			{#if viewMode === 'grid'}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="relative" onclick={handleGridClick}>
				<!-- Flip hint tooltip anchored to first card -->
				{#if showFlipHint && displayedBooks.length > 0}
					<div
						class="absolute top-2 left-2 z-20 max-w-[200px] px-3 py-2 bg-stone-800/90 text-white text-xs rounded-lg shadow-sm"
						in:fade={{ duration: 150 }}
						out:fade={{ duration: 100 }}
					>
						Tap any book to flip it over for notes, status, and details.
					</div>
				{/if}
				<div
					class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"
					in:fade={{ duration: 300, delay: 150 }}
					out:fade={{ duration: 150 }}
				>
					{#each displayedBooks as book, index (book.id)}
					{@const flipped = getFlipped(book.id)}
					<FlipCard
							id="book-{book.id}"
							{flipped}
							onflip={(isFlipped) => setFlipped(book.id, isFlipped)}
							class="w-full"
							ariaLabel="Flip card for {book.title}"
							autoFlipOnMount={index === 0}
						animationIndex={index}
					>
					<!-- Front: Book Cover -->
					{#snippet front()}
						<div
							class="relative w-full h-full bg-gray-100 flex items-center justify-center"
						>
							<!-- Corner fold hint -->
							<div class="absolute top-0 right-0 w-6 h-6 pointer-events-none z-10">
								<div class="absolute top-0 right-0 w-0 h-0 border-t-[24px] border-t-white/90 border-l-[24px] border-l-transparent"></div>
								<div class="absolute top-0 right-0 w-6 h-6 bg-gradient-to-br from-stone-200/50 to-transparent"></div>
							</div>
							{#if book.cover_url}
								<img
									src={book.cover_url}
									alt={book.title}
									class="w-full h-full object-cover"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<div class="w-full h-full bg-gradient-to-br from-stone-300 to-stone-400 flex flex-col justify-between p-4 text-white">
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
					{/snippet}

					<!-- Back: Book Details with full-width button layout -->
					{#snippet back()}
						{@const isEditingNote = noteEditingMap.get(book.id) || false}
						{@const isNoteExpanded = noteExpandedMap.get(book.id) || false}
						{@const tempNote = tempNoteMap.get(book.id) || book.note || ''}
						{@const isDescOpen = descriptionOpenMap.get(book.id) || false}
						{@const isLinksOpen = linksOpenMap.get(book.id) || false}
						{@const isShelvesOpen = shelvesOpenMap.get(book.id) || false}
						{@const isBarcodeOpen = barcodeOpenMap.get(book.id) || false}
						{@const isMenuOpen = menuOpenMap.get(book.id) || false}
						{@const showRemoveConfirm = removeConfirmMap.get(book.id) || false}
						{@const isCopied = copiedMap.get(book.id) || false}
						{@const activeShelfCount = data.bookShelves.filter(bs => bs.book_id === book.id).length}

						<div
							class="w-full h-full bg-white flex flex-col overflow-hidden"
						>
							<!-- Header with title/author and close button -->
							<div class="flex items-start justify-between p-3 border-b border-stone-100">
								<div class="flex-1 min-w-0 pr-2">
									<h2 class="text-base font-serif text-stone-900 leading-tight line-clamp-2">{book.title}</h2>
									{#if book.author && book.author.length > 0}
										<p class="text-sm text-stone-500 mt-0.5 line-clamp-1">{book.author.join(', ')}</p>
									{/if}
								</div>
								<!-- Overflow menu -->
								<div class="relative flex-shrink-0">
									<button
										onclick={(e) => {
											e.stopPropagation();
											const newMap = new Map(menuOpenMap);
											newMap.set(book.id, !isMenuOpen);
											menuOpenMap = newMap;
										}}
										class="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
										aria-label="More options"
									>
										<svg class="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
											<circle cx="12" cy="5" r="2"/>
											<circle cx="12" cy="12" r="2"/>
											<circle cx="12" cy="19" r="2"/>
										</svg>
									</button>
									{#if isMenuOpen}
										<div
											class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-stone-200 py-1 min-w-[140px] z-10"
											onclick={(e) => e.stopPropagation()}
											onkeydown={(e) => e.stopPropagation()}
											role="menu"
											tabindex="-1"
										>
											<button
												onclick={() => {
													shareModalBook = { isbn13: book.isbn13, title: book.title };
													const newMap = new Map(menuOpenMap);
													newMap.set(book.id, false);
													menuOpenMap = newMap;
												}}
												class="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
												role="menuitem"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
												</svg>
												Share
											</button>
											<button
												onclick={() => {
													if (showRemoveConfirm) {
														deleteBook(book.id, book.title);
														const newMap = new Map(removeConfirmMap);
														newMap.set(book.id, false);
														removeConfirmMap = newMap;
														const menuMap = new Map(menuOpenMap);
														menuMap.set(book.id, false);
														menuOpenMap = menuMap;
													} else {
														const newMap = new Map(removeConfirmMap);
														newMap.set(book.id, true);
														removeConfirmMap = newMap;
														setTimeout(() => {
															const resetMap = new Map(removeConfirmMap);
															resetMap.set(book.id, false);
															removeConfirmMap = resetMap;
														}, 3000);
													}
												}}
												class="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors {showRemoveConfirm
													? 'bg-red-600 text-white hover:bg-red-700'
													: 'text-red-600 hover:bg-red-50'}"
												role="menuitem"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
												</svg>
												{showRemoveConfirm ? 'Tap to confirm' : 'Remove'}
											</button>
										</div>
									{/if}
								</div>
							</div>

							<!-- Scrollable content area -->
							<div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2">

								<!-- Status toggles - side by side -->
								<div
									class="flex items-center gap-2"
									onclick={(e) => e.stopPropagation()}
									onkeydown={(e) => e.stopPropagation()}
									role="group"
									aria-label="Status toggles"
								>
									<button
										onclick={() => {
											toggleRead(book.id, book.is_read);
											showSavedFeedback(book.is_read ? 'Marked unread' : 'Marked as read');
										}}
										class="flex-1 text-sm font-medium py-2 rounded-lg border transition-all duration-200 ease-out {book.is_read
											? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
											: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}"
									>
										{book.is_read ? '✓ Read' : 'Unread'}
									</button>
									<button
										onclick={() => {
											toggleOwned(book.id, book.is_owned);
											showSavedFeedback(book.is_owned ? 'Marked not owned' : 'Marked as owned');
										}}
										class="flex-1 text-sm font-medium py-2 rounded-lg border transition-all duration-200 ease-out {book.is_owned
											? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
											: 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'}"
									>
										{book.is_owned ? '✓ Owned' : 'Not owned'}
									</button>
								</div>

								<!-- Note - button or expandable preview -->

								{#if !book.note && !isEditingNote}
									<button
										onclick={(e) => {
											e.stopPropagation();
											const editMap = new Map(noteEditingMap);
											editMap.set(book.id, true);
											noteEditingMap = editMap;

											const tempMap = new Map(tempNoteMap);
											tempMap.set(book.id, book.note || '');
											tempNoteMap = tempMap;
										}}
										class="w-full text-left text-sm text-stone-400 py-2 px-3 rounded-lg border border-dashed border-stone-300 hover:border-stone-400 hover:text-stone-500 transition-colors"
									>
										+ Add a note
									</button>
								{:else if isEditingNote}
									<div
										class="space-y-2"
										onclick={(e) => e.stopPropagation()}
										onkeydown={(e) => e.stopPropagation()}
										role="group"
										aria-label="Note editing"
									>
										<textarea
											value={tempNote}
											oninput={(e) => {
												const newMap = new Map(tempNoteMap);
												newMap.set(book.id, e.currentTarget.value);
												tempNoteMap = newMap;
											}}
											placeholder="Why did you add this?"
											class="w-full text-sm text-stone-700 placeholder-stone-400 border border-stone-200 rounded-lg p-2.5 focus:outline-none focus:border-stone-400 resize-none"
											rows={2}
										></textarea>
										<div class="flex gap-2">
											<button
												onclick={() => {
													const editMap = new Map(noteEditingMap);
													editMap.set(book.id, false);
													noteEditingMap = editMap;

													const tempMap = new Map(tempNoteMap);
													tempMap.delete(book.id);
													tempNoteMap = tempMap;
												}}
												class="flex-1 py-1.5 text-sm text-stone-500 hover:text-stone-700 border border-stone-200 rounded-lg transition-colors"
											>
												Cancel
											</button>
											<button
												onclick={async () => {
													const newNote = tempNoteMap.get(book.id) || '';
													await updateNote(book.id, newNote);

													const editMap = new Map(noteEditingMap);
													editMap.set(book.id, false);
													noteEditingMap = editMap;

													const tempMap = new Map(tempNoteMap);
													tempMap.delete(book.id);
													tempNoteMap = tempMap;

													showSavedFeedback('Note saved');
												}}
												class="flex-1 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors"
											>
												Save
											</button>
										</div>
									</div>
								{:else}
									<div class="flex-1 min-h-0 relative bg-stone-50 border border-stone-200 rounded-lg flex flex-col">
										<div class="flex-1 min-h-0 overflow-hidden py-2 px-3 pr-10">
											<p class="text-sm text-stone-600 whitespace-pre-wrap line-clamp-[8]">{book.note}</p>
										</div>
										<button
											onclick={(e) => {
												e.stopPropagation();
												const editMap = new Map(noteEditingMap);
												editMap.set(book.id, true);
												noteEditingMap = editMap;

												const tempMap = new Map(tempNoteMap);
												tempMap.set(book.id, book.note || '');
												tempNoteMap = tempMap;
											}}
											class="absolute top-2 right-2 p-1.5 text-stone-400 hover:text-stone-600 active:text-stone-700 transition-colors"
											aria-label="Edit note"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
											</svg>
										</button>
									</div>
								{/if}

								<!-- View Details button -->
								<button
									onclick={(e) => {
										e.stopPropagation();
										detailModalBookId = book.id;
									}}
									class="w-full flex items-center justify-center gap-2 text-sm text-stone-600 py-2 px-3 rounded-lg border border-stone-200 hover:bg-stone-50 active:bg-stone-100 transition-colors"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
									</svg>
									<span>View Details</span>
								</button>
							</div>
						</div>
					{/snippet}
				</FlipCard>
			{/each}
				</div>
			</div>
		{:else}
			<!-- List View -->
			<div
				class="flex flex-col gap-6"
				in:fade={{ duration: 300, delay: 150 }}
				out:fade={{ duration: 150 }}
			>
				{#each displayedBooks as book (book.id)}
					{@const isExpanded = expandedCardId === book.id}
					<Card
						id="book-{book.id}"
						{book}
						shelves={data.shelves}
						bookShelves={data.bookShelves}
						expanded={isExpanded}
						onToggleRead={toggleRead}
						onToggleOwned={toggleOwned}
						onUpdateNote={updateNote}
						onToggleShelf={toggleBookOnShelf}
						onDelete={deleteBook}
						onEditDetails={() => {
							// TODO: Implement edit details modal
							console.log('Edit details for book:', book.id);
						}}
						onShare={(b: { isbn13: string; title: string }) => shareModalBook = b}
						onToggleExpand={(bookId, isNowExpanded) => {
							expandedCardId = isNowExpanded ? bookId : null;
						}}
					/>
				{/each}
			</div>
		{/if}
	{/key}

		<!-- Multimodal Add Book Modal -->
		{#if showIsbnInput}
			<div
				class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
				role="button"
				tabindex="0"
				aria-label="Close add book dialog"
				onclick={(e: MouseEvent) => {
					// Close only when clicking the overlay, not the dialog content
					if (e.target !== e.currentTarget) return;
					showIsbnInput = false;
					inputText = '';
					selectedFile = null;
					detectedBooks = [];
					selectedBookIds = new Set();
					selectedShelfIds = new Set();
					showShelfSelection = false;
					detectError = null;
					addBookSuccess = false;
				}}
				onkeydown={(e: KeyboardEvent) => {
					// Only close on Escape to avoid intercepting Space in textarea
					if (e.key === 'Escape') {
						showIsbnInput = false;
						inputText = '';
						selectedFile = null;
						detectedBooks = [];
						selectedBookIds = new Set();
						selectedShelfIds = new Set();
						showShelfSelection = false;
						detectError = null;
						addBookSuccess = false;
					}
				}}
			>
				<div
					class="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
					role="dialog"
					aria-modal="true"
					aria-labelledby="addBookDialogTitle"
					onkeydown={(e: KeyboardEvent) => {
						if (e.key === 'Escape') {
							showIsbnInput = false;
							inputText = '';
							selectedFile = null;
							detectedBooks = [];
							selectedBookIds = new Set();
							detectError = null;
							addBookSuccess = false;
						}
					}}
				>
					<!-- Header - Fixed at top -->
					<div class="flex items-center justify-between gap-4 p-4 border-b border-gray-200">
						{#if detectedBooks.length > 0}
							<button
								type="button"
								class="text-gray-600 hover:text-gray-800 flex items-center gap-1"
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
							<h2 id="addBookDialogTitle" class="text-lg font-semibold text-gray-900">
								Select Books ({selectedBookIds.size}/{detectedBooks.length})
							</h2>
						{:else}
							<h2 id="addBookDialogTitle" class="text-lg font-semibold text-gray-900">Add Book</h2>
						{/if}
						<button
							type="button"
							class="ml-auto text-gray-500 hover:text-gray-700 p-1"
							aria-label="Close"
							onclick={() => {
								showIsbnInput = false;
								inputText = '';
								selectedFile = null;
								detectedBooks = [];
								selectedBookIds = new Set();
								selectedShelfIds = new Set();
								showShelfSelection = false;
								detectError = null;
								addBookSuccess = false;
							}}
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>

					<!-- Scrollable Content -->
					<div class="flex-1 overflow-y-auto p-4">
						{#if detectedBooks.length === 0}
							<!-- Search Input Section -->
							<div class="space-y-4">
								<textarea
									bind:value={inputText}
									bind:this={queryInput}
									placeholder="ISBN, Amazon URL, Title by Author, or paste CSV/TXT for bulk import..."
									rows="3"
									aria-label="Book search input. Enter ISBN, Amazon URL, book title and author, paste CSV or TXT content for bulk import, or drag and drop an image"
									class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
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
									<div class="flex-grow border-t border-gray-300"></div>
									<span class="text-sm text-gray-500">or</span>
									<div class="flex-grow border-t border-gray-300"></div>
								</div>

								<button
									onclick={triggerFileInput}
									disabled={isDetecting || isAddingBook}
									class="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								>
									📷 Take/Upload Photo or CSV
								</button>

								<input
									type="file"
									accept="image/*,.csv,.txt,text/plain,text/csv"
									capture="environment"
									bind:this={fileInput}
									onchange={handleFileSelect}
									hidden
								/>

								<p class="text-xs text-gray-500 text-center">
									💡 Tip: Upload CSV/TXT files with ISBNs for bulk import (max 50)
								</p>
							</div>

							{#if isDetecting}
								<div class="flex items-center gap-2 text-sm text-gray-600 p-3 bg-blue-50 rounded-lg">
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

								{#if detectionMetadata}
									<div class="text-sm space-y-1">
										<div class="text-gray-600">
											Processed {detectionMetadata.totalLines} lines, found {detectionMetadata.validIsbns} valid ISBNs
										</div>
										{#if detectionMetadata.skippedLines > 0}
											<div class="text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded text-xs">
												⚠️ Skipped {detectionMetadata.skippedLines} lines with invalid ISBNs
											</div>
										{/if}
										{#if detectionMetadata.duplicatesRemoved && detectionMetadata.duplicatesRemoved > 0}
											<div class="text-blue-700 bg-blue-50 border border-blue-200 p-2 rounded text-xs">
												ℹ️ Removed {detectionMetadata.duplicatesRemoved} duplicate{detectionMetadata.duplicatesRemoved > 1 ? 's' : ''}
											</div>
										{/if}
									</div>
								{/if}

								<!-- Book Selection List -->
								<div class="space-y-2">
									{#each detectedBooks as book}
										<label class="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
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
												<div class="w-12 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
													<span class="text-gray-400 text-xl">📖</span>
												</div>
											{/if}
											<div class="flex-grow min-w-0">
												<div class="font-medium text-sm line-clamp-2">{book.title}</div>
												{#if book.author && book.author.length > 0}
													<div class="text-xs text-gray-600 line-clamp-1">
														{book.author.join(', ')}
													</div>
												{/if}
												{#if book.publisher || book.publicationDate}
													{@const year = getPublicationYear(book.publicationDate)}
													<div class="text-xs text-gray-500 line-clamp-1">
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
											class="w-full flex items-center justify-between text-sm text-gray-700 py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
										>
											<span class="font-medium">Add to shelves (optional)</span>
											<svg class="w-4 h-4 transition-transform" class:rotate-180={showShelfSelection} fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
											</svg>
										</button>

										{#if showShelfSelection}
											<div class="mt-2 space-y-1 max-h-32 overflow-y-auto">
												{#each data.shelves as shelf}
													<label class="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
														<input
															type="checkbox"
															checked={selectedShelfIds.has(shelf.id)}
															onchange={() => toggleShelfSelection(shelf.id)}
														/>
														<span class="text-sm text-gray-700">{shelf.name}</span>
													</label>
												{/each}
											</div>
											<p class="text-xs text-gray-500 mt-2">
												Books will be added to your library and assigned to selected shelves.
											</p>
										{/if}
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Fixed Footer with Actions - Away from bottom edge -->
					<div class="border-t border-gray-200 bg-gray-50 p-4 pb-6 flex gap-2 justify-end">
						{#if detectedBooks.length === 0}
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
								class="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
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
			{@const currentBook = data.allBooks.find(b => b.id === shelfModalBookId)}
			{#if currentBook}
				<div
					class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
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
						class="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
						onclick={(e) => e.stopPropagation()}
						role="dialog"
						aria-modal="true"
						aria-labelledby="shelf-modal-title"
						tabindex="-1"
					>
						<!-- Modal Header -->
						<div class="flex items-center justify-between p-4 border-b border-stone-200">
							<div>
								<h2 id="shelf-modal-title" class="text-lg font-semibold text-stone-900">Manage Shelves</h2>
								<p class="text-sm text-stone-500 mt-0.5">{currentBook.title}</p>
							</div>
							<button
								onclick={() => shelfModalBookId = null}
								class="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
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
									{@const bookCount = data.bookShelves.filter(bs => bs.shelf_id === shelf.id).length}
									<button
										onclick={() => {
											toggleBookOnShelf(shelfModalBookId ?? '', shelf.id, isOn);
											showSavedFeedback(isOn ? `Removed from ${shelf.name}` : `Added to ${shelf.name}`);
										}}
										class="flex items-center gap-3 w-full py-2.5 px-3 rounded-lg hover:bg-stone-50 transition-colors group"
									>
										<div class="w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 {isOn
											? 'bg-stone-800 border-stone-800'
											: 'border-stone-300 group-hover:border-stone-400'}">
											{#if isOn}
												<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
												</svg>
											{/if}
										</div>
										<span class="text-sm flex-1 text-left {isOn ? 'text-stone-900 font-medium' : 'text-stone-600'}">
											{shelf.name}
										</span>
										<span class="text-xs text-stone-400">{bookCount}</span>
									</button>
								{/each}
							</div>

							<!-- New Shelf Button -->
							<div class="mt-4 pt-4 border-t border-stone-200">
								{#if !showNewShelfInput}
									<button
										onclick={() => showNewShelfInput = true}
										class="w-full text-left text-sm text-stone-500 py-2 px-3 rounded-lg border border-dashed border-stone-300 hover:border-stone-400 hover:text-stone-600 transition-colors"
									>
										+ Create new shelf
									</button>
								{:else}
									<div class="flex gap-2">
										<input
											type="text"
											bind:value={newShelfName}
											placeholder="Shelf name"
											class="flex-1 text-sm px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400"
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
											class="px-3 py-2 text-sm text-stone-500 hover:text-stone-700 transition-colors"
										>
											Cancel
										</button>
										<button
											onclick={createShelf}
											disabled={!newShelfName.trim() || creatingShelf}
											class="px-4 py-2 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
										>
											{creatingShelf ? 'Creating...' : 'Create'}
										</button>
									</div>
								{/if}
							</div>
						</div>

						<!-- Modal Footer -->
						<div class="p-4 border-t border-stone-200">
							<button
								onclick={() => shelfModalBookId = null}
								class="w-full py-2 text-sm text-stone-600 font-medium hover:bg-stone-50 rounded-lg transition-colors"
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
		class="fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-stone-800 text-white text-sm rounded-full shadow-lg z-50 pointer-events-none"
		in:fade={{ duration: 150 }}
		out:fade={{ duration: 200 }}
	>
		{savedFeedback}
	</div>
{/if}

<!-- Book Detail Modal (from FlipCard "View Details") -->
{#if detailModalBook}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={() => detailModalBookId = null}
		onkeydown={(e) => e.key === 'Escape' && (detailModalBookId = null)}
		role="dialog"
		aria-modal="true"
		aria-label="Book details"
		tabindex="-1"
		in:fade={{ duration: 150 }}
		out:fade={{ duration: 100 }}
	>
		<div
			class="w-full max-w-lg max-h-[90vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
		>
			<Card
				book={detailModalBook}
				shelves={data.shelves}
				bookShelves={data.bookShelves}
				expanded={true}
				onToggleRead={(bookId, current) => toggleRead(bookId, current)}
				onToggleOwned={(bookId, current) => toggleOwned(bookId, current)}
				onUpdateNote={(bookId, note) => updateNote(bookId, note)}
				onToggleShelf={(bookId, shelfId, isOn) => toggleBookOnShelf(bookId, shelfId, isOn)}
				onDelete={(bookId, title) => deleteBook(bookId, title)}
				onShare={(book) => shareModalBook = book}
				onClose={() => detailModalBookId = null}
			/>
		</div>
	</div>
{/if}

<style>
	/* Highlight pulse animation for search jump-to */
	:global(.highlight-pulse) {
		animation: pulse 0.6s ease-out;
	}

	@keyframes pulse {
		0% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5);
		}
		70% {
			box-shadow: 0 0 0 12px rgba(59, 130, 246, 0);
		}
		100% {
			box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
		}
	}

	/* Always show scrollbar on description text */
	.description-scroll {
		scrollbar-width: thin;
		scrollbar-color: rgb(203 213 225) rgb(241 245 249);
		scrollbar-gutter: stable;
	}

	.description-scroll::-webkit-scrollbar {
		width: 10px;
		-webkit-appearance: none;
	}

	.description-scroll::-webkit-scrollbar-track {
		background: rgb(241 245 249);
		border-radius: 4px;
	}

	.description-scroll::-webkit-scrollbar-thumb {
		background-color: rgb(203 213 225);
		border-radius: 4px;
		border: 2px solid rgb(241 245 249);
	}

	.description-scroll::-webkit-scrollbar-thumb:hover {
		background-color: rgb(148 163 184);
	}
</style>
