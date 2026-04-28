# Shelf Kebab Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the shelf-level kebab menu (sort, export, share, bulk edit, delete shelf) fully functional.

**Architecture:** Each menu item is a self-contained feature. Export already works. Delete shelf has a backend API ready — just needs UI confirmation. Sort is client-side only. Share copies the shelf URL to clipboard. Bulk edit is the most complex: a dedicated bulk API endpoint (adapted from `docs/designs/BULK_OPERATIONS_PLAN.md` Phase 1.1), selection state on cards, and a sticky action bar.

**Tech Stack:** SvelteKit 5, Supabase, existing API endpoints, design system tokens.

**Supersedes:** The web UI bulk operations portion of `docs/designs/BULK_OPERATIONS_PLAN.md` Phase 1. That plan's backend design is sound but its frontend code references outdated file paths, auth patterns, and raw Tailwind colors.

---

### Task 1: Delete shelf

**Effort:** Low — API exists at `DELETE /api/shelves`, just needs confirmation UI.

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte`

**Step 1: Add state variables**

Near other shelf state (~line 48):

```svelte
let showDeleteShelfConfirm = $state(false);
let deletingShelf = $state(false);
```

**Step 2: Enable the delete shelf button**

Replace the disabled delete shelf button in the kebab dropdown with:

```svelte
{#if selectedShelfId}
	<div class="border-t border-[var(--border)] mt-1 pt-1">
		<button
			onclick={() => {
				shelfMenuOpen = false;
				showDeleteShelfConfirm = true;
			}}
			class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
		>
			Delete shelf
		</button>
	</div>
{/if}
```

**Step 3: Add confirmation modal**

Add near the other modals at the bottom of the component:

```svelte
{#if showDeleteShelfConfirm && selectedShelfId}
	{@const shelfToDelete = data.shelves.find(s => s.id === selectedShelfId)}
	{@const bookCount = booksForCurrentShelf.length}
	<!-- Backdrop -->
	<div class="fixed inset-0 z-40 bg-black/30" onclick={() => showDeleteShelfConfirm = false}></div>
	<!-- Modal -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div class="bg-[var(--surface)] rounded-lg shadow-xl max-w-sm w-full p-6">
			<h3 class="text-lg font-semibold text-[var(--text-primary)] mb-2">Delete "{shelfToDelete?.name}"?</h3>
			<p class="text-sm text-[var(--text-secondary)] mb-4">
				{#if bookCount > 0}
					{bookCount} {bookCount === 1 ? 'book' : 'books'} on this shelf will not be deleted — they'll remain in your collection.
				{:else}
					This shelf is empty.
				{/if}
			</p>
			<div class="flex justify-end gap-3">
				<button
					onclick={() => showDeleteShelfConfirm = false}
					class="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={deleteShelf}
					disabled={deletingShelf}
					class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
				>
					{deletingShelf ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}
```

**Step 4: Add the deleteShelf function**

```typescript
async function deleteShelf() {
	if (!selectedShelfId) return;
	deletingShelf = true;
	try {
		const response = await apiFetch('/api/shelves', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: selectedShelfId })
		});
		if (!response.ok) {
			const result = await response.json();
			console.error('Delete shelf error:', result.error);
			return;
		}
		showDeleteShelfConfirm = false;
		selectedShelfId = null;
		await invalidateAll();
		showSavedFeedback('Shelf deleted');
	} catch (error) {
		console.error('Delete shelf error:', error);
	} finally {
		deletingShelf = false;
	}
}
```

**Step 5: Verify**

- Select a shelf → kebab → Delete shelf → confirmation modal appears
- Modal shows shelf name and book count
- Confirm → shelf gone, view resets to "all shelves", books still in collection
- "All shelves" view does not show Delete shelf option
- Cancel dismisses modal without action

**Step 6: Commit**

```bash
git add "src/routes/[identifier]/+page.svelte"
git commit -m "feat: add delete shelf with confirmation dialog"
```

---

### Task 2: Share shelf

**Effort:** Low — copy shelf URL to clipboard, show toast.

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte`

**Step 1: Replace disabled Share button**

```svelte
<button
	onclick={() => {
		shelfMenuOpen = false;
		const base = window.location.origin;
		const identifier = $page.params.identifier;
		const url = selectedShelfId
			? `${base}/${identifier}?shelf=${selectedShelfId}`
			: `${base}/${identifier}`;
		navigator.clipboard.writeText(url).then(() => {
			showSavedFeedback('Link copied');
		}).catch(() => {
			prompt('Copy this link:', url);
		});
	}}
	class="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--background-alt)] transition-colors"
>
	Share
</button>
```

**Step 2: Verify**

- Click Share → URL copied, toast shows "Link copied"
- With shelf selected → URL includes `?shelf=` param
- Without shelf selected → URL is just the identifier page
- Clipboard fallback works on older browsers

**Step 3: Commit**

```bash
git add "src/routes/[identifier]/+page.svelte"
git commit -m "feat: add share shelf (copy link to clipboard)"
```

---

### Task 3: Sort

**Effort:** Medium — client-side sort, submenu UI, interaction with temporal grouping.

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte`

**Step 1: Add sort state**

```svelte
let sortBy = $state<'added' | 'title' | 'author'>('added');
let sortDirection = $state<'desc' | 'asc'>('desc');
```

**Step 2: Add sort logic**

Create a derived that sorts `booksForCurrentShelf`. Important: temporal grouping (this-week, this-month, older) only applies when `sortBy === 'added'`. For title/author, render a flat list.

```typescript
const sortedBooks = $derived.by(() => {
	const books = [...booksForCurrentShelf];
	switch (sortBy) {
		case 'title':
			books.sort((a, b) => {
				const cmp = a.title.localeCompare(b.title);
				return sortDirection === 'asc' ? cmp : -cmp;
			});
			return books;
		case 'author':
			books.sort((a, b) => {
				const authorA = a.author?.[0] || '';
				const authorB = b.author?.[0] || '';
				const cmp = authorA.localeCompare(authorB);
				return sortDirection === 'asc' ? cmp : -cmp;
			});
			return books;
		case 'added':
		default:
			books.sort((a, b) => {
				const dateA = new Date(a.added_at).getTime();
				const dateB = new Date(b.added_at).getTime();
				return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
			});
			return books;
	}
});
```

**Step 3: Replace the disabled Sort button with a submenu**

When user clicks Sort in the kebab, show a nested submenu (or expand inline) with options:
- Date added (default) — toggles asc/desc on re-click
- Title (A–Z) — toggles direction on re-click
- Author (A–Z) — toggles direction on re-click

Show a checkmark next to the active sort. Show ↑/↓ arrow for direction.

```svelte
<button
	onclick={() => { sortBy = 'added'; sortDirection = sortBy === 'added' ? (sortDirection === 'desc' ? 'asc' : 'desc') : 'desc'; shelfMenuOpen = false; }}
	class="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--background-alt)] transition-colors flex justify-between"
>
	<span>Date added</span>
	{#if sortBy === 'added'}<span class="text-[var(--text-tertiary)]">{sortDirection === 'desc' ? '↓' : '↑'}</span>{/if}
</button>
<!-- Similar for title, author -->
```

**Step 4: Update book list rendering**

Replace references to the unsorted book list with `sortedBooks` in the rendering section. When `sortBy !== 'added'`, skip temporal grouping headers and render a flat list of cards.

Find the temporal grouping logic (the `groupBooksByTime` function or inline grouping) and wrap it:

```svelte
{#if sortBy === 'added'}
	<!-- Existing temporal grouping (this week, this month, older) -->
{:else}
	<!-- Flat list -->
	{#each sortedBooks as book, index (book.id)}
		<Card {book} ... />
	{/each}
{/if}
```

**Step 5: Verify**

- Sort by title → books reorder alphabetically, no time group headers
- Sort by author → books reorder by first author surname
- Sort by date added → restores temporal grouping
- Click same sort option again → direction toggles
- Sort persists while switching shelves
- Default sort is date added, descending (newest first)

**Step 6: Commit**

```bash
git add "src/routes/[identifier]/+page.svelte"
git commit -m "feat: add client-side sort (date, title, author)"
```

---

### Task 4: Bulk edit — backend

**Effort:** Medium — new API endpoint, adapted from `BULK_OPERATIONS_PLAN.md` Phase 1.1.

**Files:**
- Create: `src/routes/api/books/bulk/+server.ts`

**Step 1: Create the bulk operations endpoint**

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireSessionUserId } from '$lib/server/auth';

type BulkOperation = 'delete' | 'update' | 'move_to_shelf';

interface BulkRequest {
	book_ids: string[];
	operation: BulkOperation;
	updates?: {
		is_read?: boolean;
		is_owned?: boolean;
	};
	shelf_id?: string;
}

export const POST: RequestHandler = async (event) => {
	try {
		const userId = requireSessionUserId(event);
		const body: BulkRequest = await event.request.json();

		if (!body.book_ids || body.book_ids.length === 0) {
			return json({ error: 'No books selected' }, { status: 400 });
		}
		if (body.book_ids.length > 500) {
			return json({ error: 'Maximum 500 books per operation' }, { status: 400 });
		}

		// Verify all books belong to the user
		const { data: ownedBooks, error: verifyError } = await supabase
			.from('books')
			.select('id')
			.eq('user_id', userId)
			.in('id', body.book_ids);

		if (verifyError) {
			return json({ error: 'Failed to verify book ownership' }, { status: 500 });
		}

		const ownedBookIds = new Set(ownedBooks?.map(b => b.id) || []);
		const unauthorizedCount = body.book_ids.filter(id => !ownedBookIds.has(id)).length;
		if (unauthorizedCount > 0) {
			return json({ error: `Access denied to ${unauthorizedCount} book(s)` }, { status: 403 });
		}

		let processed = 0;

		switch (body.operation) {
			case 'delete': {
				const { error } = await supabase
					.from('books')
					.delete()
					.in('id', body.book_ids)
					.eq('user_id', userId);
				if (error) return json({ error: 'Failed to delete books' }, { status: 500 });
				processed = body.book_ids.length;
				break;
			}
			case 'update': {
				if (!body.updates || Object.keys(body.updates).length === 0) {
					return json({ error: 'No updates provided' }, { status: 400 });
				}
				const { error } = await supabase
					.from('books')
					.update(body.updates)
					.in('id', body.book_ids)
					.eq('user_id', userId);
				if (error) return json({ error: 'Failed to update books' }, { status: 500 });
				processed = body.book_ids.length;
				break;
			}
			case 'move_to_shelf': {
				if (!body.shelf_id) {
					return json({ error: 'Shelf ID required' }, { status: 400 });
				}
				const { data: shelf, error: shelfError } = await supabase
					.from('shelves')
					.select('id')
					.eq('id', body.shelf_id)
					.eq('user_id', userId)
					.maybeSingle();
				if (shelfError || !shelf) {
					return json({ error: 'Shelf not found or access denied' }, { status: 404 });
				}
				const bookShelfRelations = body.book_ids.map(book_id => ({
					book_id,
					shelf_id: body.shelf_id!
				}));
				const { error } = await supabase
					.from('book_shelves')
					.upsert(bookShelfRelations, {
						onConflict: 'book_id,shelf_id',
						ignoreDuplicates: true
					});
				if (error) return json({ error: 'Failed to move books to shelf' }, { status: 500 });
				processed = body.book_ids.length;
				break;
			}
			default:
				return json({ error: 'Invalid operation' }, { status: 400 });
		}

		return json({ success: true, processed });
	} catch (error) {
		if (error instanceof Error && error.message.includes('Authentication')) {
			return json({ error: 'Authentication required' }, { status: 401 });
		}
		console.error('Bulk operation error:', error);
		return json({ error: 'Something went wrong' }, { status: 500 });
	}
};
```

**Step 2: Verify**

- Type check passes
- Endpoint handles all three operation types
- Ownership verification prevents cross-user access
- 500 book limit enforced

**Step 3: Commit**

```bash
git add src/routes/api/books/bulk/+server.ts
git commit -m "feat: add bulk operations API endpoint (delete, update, move_to_shelf)"
```

---

### Task 5: Bulk edit — frontend

**Effort:** High — selection state, Card changes, sticky action bar, batch calls.

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte`
- Modify: `src/lib/components/ui/Card.svelte`

**Step 1: Add selection state to shelf page**

```svelte
let bulkEditMode = $state(false);
let selectedBookIds = $state<Set<string>>(new Set());
let isBulkProcessing = $state(false);
```

**Step 2: Enable bulk edit mode from kebab**

Replace disabled Bulk edit button:

```svelte
<button
	onclick={() => {
		shelfMenuOpen = false;
		bulkEditMode = true;
		selectedBookIds = new Set();
	}}
	class="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--background-alt)] transition-colors"
>
	Bulk edit
</button>
```

**Step 3: Add selection props to Card.svelte**

Add to the props destructure:

```svelte
let {
	// ... existing props
	selectable = false,
	selected = false,
	onToggleSelect,
}: {
	// ... existing types
	selectable?: boolean;
	selected?: boolean;
	onToggleSelect?: (bookId: string) => void;
} = $props();
```

When `selectable` is true, add a checkbox to the left of the cover in the collapsed card. Clicking anywhere on the card toggles selection instead of expanding.

```svelte
{#if selectable}
	<div class="flex-shrink-0 flex items-center">
		<input
			type="checkbox"
			checked={selected}
			onchange={() => onToggleSelect?.(book.id)}
			onclick={(e) => e.stopPropagation()}
			class="w-5 h-5 accent-[var(--accent)] cursor-pointer"
		/>
	</div>
{/if}
```

Override the card's click handler when selectable: instead of expanding, toggle selection.

**Step 4: Pass selection props from shelf page**

```svelte
<Card
	{book}
	selectable={bulkEditMode}
	selected={selectedBookIds.has(book.id)}
	onToggleSelect={(id) => {
		const next = new Set(selectedBookIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		selectedBookIds = next;
	}}
	...
/>
```

**Step 5: Add sticky bulk action bar**

```svelte
{#if bulkEditMode}
	<div class="fixed bottom-0 left-0 right-0 z-30 bg-[var(--surface)] border-t border-[var(--border)] shadow-lg px-4 py-3">
		<div class="max-w-[var(--content-width)] mx-auto flex items-center justify-between gap-3">
			<div class="flex items-center gap-3">
				<span class="text-sm text-[var(--text-secondary)]">
					{selectedBookIds.size} selected
				</span>
				<button
					onclick={() => {
						const all = sortedBooks.map(b => b.id);
						selectedBookIds = selectedBookIds.size === all.length ? new Set() : new Set(all);
					}}
					class="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)]"
				>
					{selectedBookIds.size === sortedBooks.length ? 'Deselect all' : 'Select all'}
				</button>
			</div>
			<div class="flex gap-2 items-center">
				{#if selectedBookIds.size > 0}
					<button onclick={() => bulkUpdate({ is_read: true })} disabled={isBulkProcessing}
						class="text-sm px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--background-alt)] disabled:opacity-50">
						Mark read
					</button>
					<button onclick={() => bulkUpdate({ is_owned: true })} disabled={isBulkProcessing}
						class="text-sm px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--background-alt)] disabled:opacity-50">
						Mark owned
					</button>
					<button onclick={bulkDelete} disabled={isBulkProcessing}
						class="text-sm px-3 py-1.5 rounded text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50">
						Delete
					</button>
				{/if}
				<button
					onclick={() => { bulkEditMode = false; selectedBookIds = new Set(); }}
					class="text-sm px-3 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
				>
					Done
				</button>
			</div>
		</div>
	</div>
{/if}
```

**Step 6: Implement batch operation functions**

Use the bulk API endpoint from Task 4:

```typescript
async function bulkUpdate(updates: { is_read?: boolean; is_owned?: boolean }) {
	isBulkProcessing = true;
	try {
		const response = await apiFetch('/api/books/bulk', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				book_ids: Array.from(selectedBookIds),
				operation: 'update',
				updates
			})
		});
		if (!response.ok) {
			const result = await response.json();
			console.error('Bulk update error:', result.error);
			return;
		}
		const count = selectedBookIds.size;
		await invalidateAll();
		selectedBookIds = new Set();
		bulkEditMode = false;
		showSavedFeedback(`Updated ${count} books`);
	} catch (error) {
		console.error('Bulk update error:', error);
	} finally {
		isBulkProcessing = false;
	}
}

async function bulkDelete() {
	const count = selectedBookIds.size;
	if (!confirm(`Delete ${count} book${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
	isBulkProcessing = true;
	try {
		const response = await apiFetch('/api/books/bulk', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				book_ids: Array.from(selectedBookIds),
				operation: 'delete'
			})
		});
		if (!response.ok) {
			const result = await response.json();
			console.error('Bulk delete error:', result.error);
			return;
		}
		await invalidateAll();
		selectedBookIds = new Set();
		bulkEditMode = false;
		showSavedFeedback(`Deleted ${count} books`);
	} catch (error) {
		console.error('Bulk delete error:', error);
	} finally {
		isBulkProcessing = false;
	}
}
```

**Step 7: Verify**

- Kebab → Bulk edit → cards show checkboxes, card click toggles selection
- Select multiple → action bar shows count + actions
- Select all / Deselect all works
- Mark read → all selected books updated → toast → exits bulk mode
- Mark owned → same
- Delete → confirmation prompt → books deleted → toast
- Done button exits bulk mode, clears selection
- Bulk mode doesn't interfere with search or NLP filter

**Step 8: Commit**

```bash
git add "src/routes/[identifier]/+page.svelte" "src/lib/components/ui/Card.svelte" src/routes/api/books/bulk/+server.ts
git commit -m "feat: add bulk edit UI with selection and batch operations"
```

---

## Implementation Order

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 1 | Delete shelf | Low | API exists, just confirmation UI |
| 2 | Share shelf | Low | Copy URL + toast |
| 3 | Sort | Medium | Client-side, interaction with temporal grouping |
| 4 | Bulk edit — backend | Medium | New `/api/books/bulk` endpoint |
| 5 | Bulk edit — frontend | High | Card changes, selection state, action bar |

Export is already working — no changes needed.

**Reference:** `docs/designs/BULK_OPERATIONS_PLAN.md` Phase 1.1 (backend design, adapted for current auth patterns). Phase 2 (SMS multi-photo) and Phase 3 (export, SMS commands) are separate efforts not covered here.
