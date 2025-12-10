<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { Card, FlipCard, Button, Input, Badge } from '$lib/components/ui';
	import JsBarcode from 'jsbarcode';
	import ClaimShelfBanner from '$lib/components/ClaimShelfBanner.svelte';
	import { browser } from '$app/environment';

	let { data }: { data: PageData } = $props();

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

	// Cover card state (for grid view with FlipCard)
	let flippedMap = $state<Map<string, boolean>>(new Map());
	let noteEditingMap = $state<Map<string, boolean>>(new Map());
	let noteExpandedMap = $state<Map<string, boolean>>(new Map());
	let descriptionOpenMap = $state<Map<string, boolean>>(new Map());
	let shelvesOpenMap = $state<Map<string, boolean>>(new Map());
	let barcodeOpenMap = $state<Map<string, boolean>>(new Map());
	let removeConfirmMap = $state<Map<string, boolean>>(new Map());
	let copiedMap = $state<Map<string, boolean>>(new Map());
	let tempNoteMap = $state<Map<string, string>>(new Map());

	// Shelf modal state
	let shelfModalBookId = $state<string | null>(null);
	let shelfModalOpen = $derived(shelfModalBookId !== null);
	let shelfModalElement: HTMLDivElement | null = null;

	// Focus modal when it opens
	$effect(() => {
		if (shelfModalOpen && shelfModalElement) {
			tick().then(() => {
				shelfModalElement?.focus();
			});
		}
	});

	// Helper to get/set flipped state for a book
	function getFlipped(bookId: string) {
		return flippedMap.get(bookId) || false;
	}

	function setFlipped(bookId: string, value: boolean) {
		const newMap = new Map(flippedMap);
		newMap.set(bookId, value);
		flippedMap = newMap;
	}

	// Shelf navigation state
	let showMoreShelves = $state(false);
	const MAX_VISIBLE_SHELVES = 3; // Show first 3 shelves, hide the rest

	// Compute which shelves should be visible (always include selected shelf)
	const visibleShelves = $derived(() => {
		const shelves = data.shelves;
		const selectedId = data.selectedShelfId;

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

	async function selectShelf(shelfId: string | null) {
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
		await goto(newUrl);
		await invalidateAll();
	}

	async function deleteShelf(shelfId: string, shelfName: string) {
		// Build confirmation message
		let message = `Delete "${shelfName}"?\n\nBooks will remain in your library, but will be removed from this shelf.`;

		// Add note about default shelf behavior
		if (data.defaultShelfId === shelfId) {
			message += '\n\nNote: This shelf is your default. After deletion, new books will go to "All Books".';
		}

		// Add note about current view if viewing this shelf
		if (data.selectedShelfId === shelfId) {
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

			// If we're currently viewing the deleted shelf, redirect to All Books
			if (data.selectedShelfId === shelfId) {
				await goto(`${window.location.pathname}?view=all`);
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
					const addedBook = data.books.find(b => b.isbn13 === book.isbn13);
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
			// Don't trigger if user is typing in an input
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
			// Close dropdown if clicking outside
			if (showMoreShelves && !target.closest('.relative')) {
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

		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('click', handleClick);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('click', handleClick);
		};
	});

	// Focus the query textarea when the modal opens
	$effect(() => {
		if (showIsbnInput) {
			setTimeout(() => { queryInput?.focus(); }, 0);
		}
	});
</script>

<div class="min-h-screen bg-gray-50">
	{#if data.isPhoneBased}
		<ClaimShelfBanner phoneNumber={data.userId} {isOwner} />
	{/if}

	<div class="py-8">
		<div class="max-w-4xl mx-auto px-4">
		<!-- Header -->
		<div class="mb-6 flex items-start justify-between">
			<div>
				<h1 class="text-3xl font-bold text-gray-900 mb-2">My Reading List</h1>
				<p class="text-gray-600">
					{data.books.length} {data.books.length === 1 ? 'book' : 'books'}
					{#if data.selectedShelfId}
						on this shelf
					{/if}
				</p>
			</div>

			<!-- View Toggle and Manual ISBN Entry -->
			<div class="flex gap-2 items-start">
				<div class="flex gap-1 border border-gray-300 rounded-lg p-1" role="group" aria-label="View mode toggle">
					<button
						onclick={() => viewMode = 'grid'}
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
						onclick={() => viewMode = 'list'}
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
					class="w-10 h-10 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-400 text-gray-600 hover:border-blue-600 hover:text-blue-600 transition-colors text-xl font-bold"
					aria-label="Add book manually by ISBN"
					title="Add book by ISBN or photo of barcode"
				>
					+
				</button>
			</div>
		</div>

		<!-- Shelf Navigation -->
		<div class="mb-6">
			<div class="flex gap-2 flex-wrap items-center">
				<!-- All Books Tab -->
				<Button
					variant={!data.selectedShelfId ? 'primary' : 'secondary'}
					size="md"
					onclick={() => selectShelf(null)}
				>
					All Books ({data.allBooks?.length || 0})
				</Button>

				<!-- Visible Shelf Tabs -->
				{#each visibleShelves() as shelf}
					{@const bookCount = data.bookShelves.filter(bs => bs.shelf_id === shelf.id).length}
					<div class="inline-flex items-center gap-0 rounded-lg overflow-hidden">
						<Button
							variant={data.selectedShelfId === shelf.id ? 'primary' : 'secondary'}
							size="md"
							onclick={() => selectShelf(shelf.id)}
							disabled={deletingShelfId === shelf.id}
							class="rounded-none cursor-pointer {data.selectedShelfId === shelf.id ? '!bg-blue-600 pr-0' : '!bg-gray-200 pl-4 pr-0'}"
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
							class="px-2 py-1.5 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer {data.selectedShelfId === shelf.id ? 'bg-blue-600 text-blue-100' : 'bg-gray-200 text-gray-700'}"
							aria-label={`Delete shelf ${shelf.name}`}
							title="Delete shelf"
						>
							×
						</button>
					</div>
				{/each}

				<!-- More Shelves Button (if there are hidden shelves) -->
				{#if hiddenShelves().length > 0}
					<div class="relative">
						<Button
							variant="secondary"
							size="md"
							onclick={() => showMoreShelves = !showMoreShelves}
							class="cursor-pointer"
						>
							More shelves ({hiddenShelves().length}) {showMoreShelves ? '▲' : '▼'}
						</Button>

						<!-- Dropdown for hidden shelves -->
						{#if showMoreShelves}
							<div class="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
								{#each hiddenShelves() as shelf}
									{@const bookCount = data.bookShelves.filter(bs => bs.shelf_id === shelf.id).length}
									<div class="flex items-center justify-between hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
										<button
											onclick={() => {
												selectShelf(shelf.id);
												showMoreShelves = false;
											}}
											disabled={deletingShelfId === shelf.id}
											class="flex-grow text-left px-4 py-2.5 text-sm {data.selectedShelfId === shelf.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'} hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{#if deletingShelfId === shelf.id}
												Deleting...
											{:else}
												{shelf.name} ({bookCount})
											{/if}
										</button>
										<button
											onclick={(e: MouseEvent) => {
												e.stopPropagation();
												deleteShelf(shelf.id, shelf.name);
											}}
											disabled={deletingShelfId === shelf.id}
											class="px-3 py-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
											aria-label={`Delete shelf ${shelf.name}`}
											title="Delete shelf"
										>
											×
										</button>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- New Shelf Button -->
				{#if !showNewShelfInput}
					<Button
						variant="ghost"
						size="md"
						class="border border-dashed border-gray-400"
						onclick={() => showNewShelfInput = true}
					>
						+ New Shelf
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
		</div>

		<!-- Error Message -->
		{#if data.error}
			<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
				<p class="text-red-800">Error: {data.error}</p>
			</div>
		{/if}

		<!-- Empty State -->
		{#if data.books.length === 0}
			<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
				<div class="text-gray-400 text-5xl mb-4">📚</div>
				<h2 class="text-xl font-semibold text-gray-900 mb-2">No books yet!</h2>
				<p class="text-gray-600 mb-4">Text an ISBN or send a photo of a barcode to your Twilio number to get started.</p>
				<div class="text-sm text-gray-500 space-y-2">
					<p>Try texting an ISBN: <code class="bg-gray-100 px-2 py-1 rounded">9780140449136</code></p>
					<p>Or send a photo of a book barcode!</p>
				</div>
			</div>
		{/if}

		<!-- Books Grid/List -->
		{#key data.selectedShelfId}
			{#if viewMode === 'grid'}
				<div
					class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6"
					in:fade={{ duration: 300, delay: 150 }}
					out:fade={{ duration: 150 }}
				>
					{#each data.books as book, index (book.id)}
					{@const flipped = getFlipped(book.id)}
					<FlipCard
						{flipped}
						class="w-full"
						ariaLabel="Flip card for {book.title}"
						autoFlipOnMount={index === 0}
						animationIndex={index}
					>
					<!-- Front: Book Cover -->
					{#snippet front()}
						<div
							class="w-full h-full bg-gray-100 flex items-center justify-center"
						>
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
						{@const isShelvesOpen = shelvesOpenMap.get(book.id) || false}
						{@const isBarcodeOpen = barcodeOpenMap.get(book.id) || false}
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
								<button
									onclick={(e) => {
										e.stopPropagation();
										setFlipped(book.id, false);
									}}
									class="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors flex-shrink-0"
									aria-label="Close details"
								>
									<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
									</svg>
								</button>
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
										onclick={() => toggleRead(book.id, book.is_read)}
										class="flex-1 text-sm font-medium py-2 rounded-lg border transition-all duration-200 ease-out {book.is_read
											? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
											: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}"
									>
										{book.is_read ? '✓ Read' : 'Unread'}
									</button>
									<button
										onclick={() => toggleOwned(book.id, book.is_owned)}
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
												}}
												class="flex-1 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition-colors"
											>
												Save
											</button>
										</div>
									</div>
								{:else}
									<button
										onclick={(e) => {
											e.stopPropagation();
											const newMap = new Map(noteExpandedMap);
											newMap.set(book.id, !isNoteExpanded);
											noteExpandedMap = newMap;
										}}
										class="w-full text-left text-sm text-stone-600 py-2 px-3 rounded-lg bg-stone-50 border border-stone-200 hover:bg-stone-100 transition-colors"
									>
										{#if isNoteExpanded}
											<span class="whitespace-pre-wrap">{book.note}</span>
										{:else}
											<span class="line-clamp-1">{book.note}</span>
										{/if}
									</button>
								{/if}

								<!-- Description disclosure button -->
								{#if book.description}
									<button
										onclick={(e) => {
											e.stopPropagation();
											const newMap = new Map(descriptionOpenMap);
											newMap.set(book.id, !isDescOpen);
											descriptionOpenMap = newMap;
										}}
										class="w-full flex items-center justify-between text-sm text-stone-600 py-2 px-3 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
									>
										<span>Description</span>
										<svg class="w-4 h-4 transition-transform" class:rotate-90={!isDescOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
										</svg>
									</button>
									{#if isDescOpen}
										<p class="text-sm text-stone-600 leading-relaxed px-3 py-2 bg-stone-50 rounded-lg -mt-1">
											{book.description}
										</p>
									{/if}
								{/if}

								<!-- Shelves button - opens modal -->
								<button
									onclick={(e) => {
										e.stopPropagation();
										shelfModalBookId = book.id;
									}}
									class="w-full flex items-center justify-between text-sm text-stone-600 py-2 px-3 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
								>
									<span>Shelves ({activeShelfCount})</span>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
									</svg>
								</button>

								<!-- Copy ISBN and Barcode buttons on same line -->
								<div class="flex gap-2">
									<button
										onclick={async (e) => {
											e.stopPropagation();
											await copyISBN(book.isbn13);
											const newMap = new Map(copiedMap);
											newMap.set(book.id, true);
											copiedMap = newMap;
											setTimeout(() => {
												const resetMap = new Map(copiedMap);
												resetMap.set(book.id, false);
												copiedMap = resetMap;
											}, 2000);
										}}
										class="flex-1 flex items-center justify-center gap-1.5 text-sm text-stone-600 py-2 px-2 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
									>
										<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
										</svg>
										<span class="truncate">{isCopied ? 'Copied!' : 'Copy ISBN'}</span>
									</button>

									<button
										onclick={(e) => {
											e.stopPropagation();
											const newMap = new Map(barcodeOpenMap);
											newMap.set(book.id, !isBarcodeOpen);
											barcodeOpenMap = newMap;
										}}
										class="flex-1 flex items-center justify-center gap-1.5 text-sm text-stone-600 py-2 px-2 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
									>
										<svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
											<path d="M2 6h2v12H2V6zm4 0h1v12H6V6zm2 0h2v12H8V6zm3 0h1v12h-1V6zm2 0h2v12h-2V6zm3 0h1v12h-1V6zm2 0h2v12h-2V6zm4 0h1v12h-1V6z"/>
										</svg>
										<span class="truncate">{isBarcodeOpen ? 'Hide' : 'Barcode'}</span>
									</button>
								</div>
								{#if isBarcodeOpen}
									<div
										class="bg-stone-50 rounded-lg p-2 -mt-1 text-center overflow-hidden"
										onclick={(e) => e.stopPropagation()}
										onkeydown={(e) => e.stopPropagation()}
										role="region"
										aria-label="Barcode display"
									>
										<p class="text-xs text-stone-500 mb-1">Scan at bookstore or library</p>
										<div class="w-full flex justify-center items-center">
											<canvas
												use:generateBarcode={book.isbn13}
												class="max-w-full h-auto mx-auto"
											></canvas>
										</div>
										<p class="text-xs font-mono text-stone-600 mt-1">{book.isbn13}</p>
									</div>
								{/if}

								<!-- Remove button with inline confirmation -->
								<button
									onclick={(e) => {
										e.stopPropagation();
										if (showRemoveConfirm) {
											deleteBook(book.id, book.title);
											const newMap = new Map(removeConfirmMap);
											newMap.set(book.id, false);
											removeConfirmMap = newMap;
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
									class="w-full flex items-center justify-center gap-2 text-sm py-2 px-3 rounded-lg border transition-colors {showRemoveConfirm
										? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
										: 'text-red-600 border-red-200 hover:bg-red-50'}"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
									</svg>
									{showRemoveConfirm ? 'Tap again to confirm' : 'Remove from shelf'}
								</button>
							</div>
						</div>
					{/snippet}
				</FlipCard>
			{/each}
		</div>
		{:else}
			<!-- List View -->
			<div
				class="flex flex-col gap-8"
				in:fade={{ duration: 300, delay: 150 }}
				out:fade={{ duration: 150 }}
			>
				{#each data.books as book (book.id)}
					<Card
						{book}
						shelves={data.shelves}
						bookShelves={data.bookShelves}
						onToggleRead={toggleRead}
						onToggleOwned={toggleOwned}
						onUpdateNote={updateNote}
						onToggleShelf={toggleBookOnShelf}
						onDelete={deleteBook}
						onEditDetails={() => {
							// TODO: Implement edit details modal
							console.log('Edit details for book:', book.id);
						}}
					/>
				{/each}
			</div>
		{/if}
	{/key}

		<!-- Multimodal Add Book Modal -->
		{#if showIsbnInput}
			<div
				class="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-20"
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
					class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
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
					<div class="flex items-start justify-between gap-4">
						<h2 id="addBookDialogTitle" class="text-xl font-semibold text-gray-900 mb-4">Add Book</h2>
						<button
							type="button"
							class="ml-auto text-gray-500 hover:text-gray-700"
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
							<span aria-hidden="true">✕</span>
						</button>
					</div>

					<div class="flex flex-col gap-4">
						<div>
							<p class="text-sm text-gray-600 mb-2">
								Enter ISBN, paste Amazon link, search "Title by Author", or upload/drop a photo. Press Enter to detect.
							</p>
							<div class="text-xs text-blue-700 bg-blue-50 border border-blue-200 p-2 rounded">
								💡 <strong>Bulk import:</strong> Upload a CSV or TXT file with ISBNs (max 50 books). Files can have one ISBN per line or include other columns.
							</div>
						</div>

						<textarea
							bind:value={inputText}
							bind:this={queryInput}
							placeholder="ISBN, Amazon URL, or Title by Author..."
							rows="3"
							class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isDetecting || isAddingBook || detectedBooks.length > 0}
							ondragover={handleDragOver}
							ondrop={handleDrop}
							onkeydown={(e: KeyboardEvent) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									if ((inputText.trim() || selectedFile) && !isDetecting && detectedBooks.length === 0) {
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

						{#if detectedBooks.length === 0}
							<div class="flex items-center gap-2">
								<div class="flex-grow border-t border-gray-300"></div>
								<span class="text-sm text-gray-500">or</span>
								<div class="flex-grow border-t border-gray-300"></div>
							</div>

							<button
								onclick={triggerFileInput}
								disabled={isDetecting || isAddingBook || detectedBooks.length > 0}
								class="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								📷 Take/Upload Photo
							</button>

							<input
								type="file"
								accept="image/*,.csv,.txt,text/plain,text/csv"
								capture="environment"
								bind:this={fileInput}
								onchange={handleFileSelect}
								hidden
							/>
						{/if}

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

						{#if detectedBooks.length > 0}
							<div class="border-t pt-4">
								<h3 class="font-semibold mb-2">Found {detectedBooks.length} book(s):</h3>

								{#if detectionMetadata}
									<div class="text-sm mb-3 space-y-1">
										<div class="text-gray-600">
											Processed {detectionMetadata.totalLines} lines, found {detectionMetadata.validIsbns} valid ISBNs
										</div>
										{#if detectionMetadata.skippedLines > 0}
											<div class="text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
												⚠️ Skipped {detectionMetadata.skippedLines} lines with invalid or missing ISBNs
											</div>
										{/if}
										{#if detectionMetadata.duplicatesRemoved && detectionMetadata.duplicatesRemoved > 0}
											<div class="text-blue-700 bg-blue-50 border border-blue-200 p-2 rounded">
												ℹ️ Removed {detectionMetadata.duplicatesRemoved} duplicate ISBN{detectionMetadata.duplicatesRemoved > 1 ? 's' : ''}
											</div>
										{/if}
									</div>
								{/if}

								<div class="space-y-2 max-h-64 overflow-y-auto">
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
									<div class="mt-4 border-t pt-4">
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

						<div class="flex gap-2 justify-end">
							<Button
								variant="ghost"
								size="md"
								disabled={isDetecting || isAddingBook}
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
								Cancel
							</Button>

							{#if detectedBooks.length === 0}
								<Button
									variant="primary"
									size="md"
									onclick={detectBooks}
									disabled={(!inputText.trim() && !selectedFile) || isDetecting || detectedBooks.length > 0}
								>
									{isDetecting ? 'Detecting...' : 'Detect'}
								</Button>
							{:else}
								<Button
									variant="primary"
									size="md"
									onclick={addSelectedBooks}
									disabled={selectedBookIds.size === 0 || isAddingBook}
								>
									{isAddingBook ? 'Adding...' : `Add ${selectedBookIds.size} Book(s)`}
								</Button>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Shelf Selection Modal -->
		{#if shelfModalOpen && shelfModalBookId}
			{@const currentBook = data.books.find(b => b.id === shelfModalBookId)}
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
										onclick={() => toggleBookOnShelf(shelfModalBookId ?? '', shelf.id, isOn)}
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

<style>
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
