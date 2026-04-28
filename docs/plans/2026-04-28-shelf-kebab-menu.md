# Shelf Kebab Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the shelf-level kebab menu (sort, export, share, bulk edit, delete shelf) fully functional.

**Architecture:** Each menu item is a self-contained feature. Export already works. Delete shelf has a backend API ready — just needs UI confirmation. Sort is client-side only. Share reuses the existing ShareModal pattern. Bulk edit is the most complex, requiring selection state and batch API calls.

**Tech Stack:** SvelteKit 5, Supabase, existing API endpoints, design system tokens.

---

### Task 1: Delete shelf (lowest effort — API exists)

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte` (kebab menu area ~line 1336, plus new confirmation modal)

**Step 1: Enable the delete shelf button and add confirmation state**

Add state variables near other shelf state (~line 48):

```svelte
let showDeleteShelfConfirm = $state(false);
let deletingShelf = $state(false);
```

Replace the disabled delete shelf button (~line 1338) with a functional one:

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

**Step 2: Add confirmation modal**

Add a confirmation modal near the other modals at the bottom of the component. Keep it simple — shelf name, book count, warning that books won't be deleted, Cancel/Delete buttons.

**Step 3: Wire up the delete action**

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
			// show error
			return;
		}
		showDeleteShelfConfirm = false;
		selectedShelfId = null; // go back to "all shelves"
		await invalidateAll();
		showSavedFeedback('Shelf deleted');
	} catch (error) {
		console.error('Delete shelf error:', error);
	} finally {
		deletingShelf = false;
	}
}
```

**Step 4: Verify**

- Select a shelf → kebab → Delete shelf → confirm → shelf disappears, books remain
- "All shelves" view should not show delete option
- Default shelf deletion should clear `default_shelf_id`

**Step 5: Commit**

```bash
git add "src/routes/[identifier]/+page.svelte"
git commit -m "feat: add delete shelf with confirmation dialog"
```

---

### Task 2: Sort (client-side)

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte` (sort state, sort logic, submenu UI)

**Step 1: Add sort state**

Near other state variables:

```svelte
let sortBy = $state<'added' | 'title' | 'author'>('added');
let sortDirection = $state<'desc' | 'asc'>('desc');
```

**Step 2: Add sort logic**

Create a derived or function that sorts `booksForCurrentShelf` based on the selected sort. The current temporal grouping (this-week, this-month, older) should only apply when sorted by `added` date. For title/author sort, show a flat list.

```typescript
const sortedBooks = $derived(() => {
	const books = [...booksForCurrentShelf];
	switch (sortBy) {
		case 'title':
			books.sort((a, b) => a.title.localeCompare(b.title));
			if (sortDirection === 'desc') books.reverse();
			return books;
		case 'author':
			books.sort((a, b) => {
				const authorA = a.author?.[0] || '';
				const authorB = b.author?.[0] || '';
				return authorA.localeCompare(authorB);
			});
			if (sortDirection === 'desc') books.reverse();
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

**Step 3: Replace the disabled Sort button with a submenu or inline options**

When the user clicks Sort, show a submenu with the options. Options: Date Added, Title (A–Z), Author (A–Z). Each option toggles direction if already selected.

**Step 4: Update the book list rendering**

Replace references to the current book list with `sortedBooks`. When sorting by title or author, skip temporal grouping and render a flat list.

**Step 5: Verify**

- Sort by title → books reorder alphabetically, no time groups
- Sort by author → books reorder by first author
- Sort by date added → restores temporal grouping
- Sort persists while navigating shelves
- Clicking same sort option toggles asc/desc

**Step 6: Commit**

```bash
git add "src/routes/[identifier]/+page.svelte"
git commit -m "feat: add client-side sort (date, title, author)"
```

---

### Task 3: Share shelf

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte` (share button handler, reuse ShareModal or inline copy)

**Step 1: Enable the Share button**

Replace the disabled Share button with a functional one that copies the shelf URL to clipboard:

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
			// fallback: prompt user
			prompt('Copy this link:', url);
		});
	}}
	class="w-full text-left px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--background-alt)] transition-colors"
>
	Share
</button>
```

This is simpler than opening a full modal — just copy the URL and show a toast.

**Step 2: Verify**

- Click Share → URL copied to clipboard, toast shows "Link copied"
- With shelf selected → URL includes `?shelf=` param
- Without shelf → URL is just the identifier page

**Step 3: Commit**

```bash
git add "src/routes/[identifier]/+page.svelte"
git commit -m "feat: add share shelf (copy link to clipboard)"
```

---

### Task 4: Bulk edit

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte` (selection state, bulk action bar, batch operations)
- Modify: `src/lib/components/ui/Card.svelte` (selection checkbox on each card)

This is the most complex feature. Break into sub-steps.

**Step 1: Add selection state**

```svelte
let bulkEditMode = $state(false);
let selectedBookIds = $state<Set<string>>(new Set());
```

**Step 2: Enable bulk edit mode from kebab**

Replace disabled button:

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

**Step 3: Add selection UI to Card component**

Pass `selectable` and `selected` props to Card. When `selectable` is true, show a checkbox on the left side of the collapsed card. Clicking the card toggles selection instead of expanding.

In Card.svelte, add props:

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

When `selectable`, show checkbox and intercept click:

```svelte
{#if selectable}
	<div class="flex-shrink-0 flex items-center pl-2">
		<input
			type="checkbox"
			checked={selected}
			onchange={() => onToggleSelect?.(book.id)}
			class="w-5 h-5 accent-[var(--accent)]"
		/>
	</div>
{/if}
```

**Step 4: Add sticky bulk action bar**

When `bulkEditMode && selectedBookIds.size > 0`, show a sticky bar at the bottom:

```svelte
{#if bulkEditMode}
	<div class="fixed bottom-0 left-0 right-0 z-30 bg-[var(--surface)] border-t border-[var(--border)] shadow-lg px-4 py-3">
		<div class="max-w-[var(--content-width)] mx-auto flex items-center justify-between">
			<span class="text-sm text-[var(--text-secondary)]">
				{selectedBookIds.size} selected
			</span>
			<div class="flex gap-2">
				<button onclick={bulkMarkRead} class="text-sm px-3 py-1.5 ...">Mark read</button>
				<button onclick={bulkAddToShelf} class="text-sm px-3 py-1.5 ...">Add to shelf</button>
				<button onclick={bulkDelete} class="text-sm px-3 py-1.5 text-red-600 ...">Delete</button>
				<button onclick={() => { bulkEditMode = false; selectedBookIds = new Set(); }}>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}
```

**Step 5: Implement batch operations**

Each bulk action iterates over `selectedBookIds` and calls the existing per-book API endpoints. Show progress feedback. Add confirmation for destructive actions (delete).

```typescript
async function bulkMarkRead() {
	for (const id of selectedBookIds) {
		await apiFetch('/api/books/update', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, is_read: true })
		});
	}
	await invalidateAll();
	showSavedFeedback(`${selectedBookIds.size} books marked as read`);
	bulkEditMode = false;
	selectedBookIds = new Set();
}
```

**Step 6: Verify**

- Kebab → Bulk edit → cards show checkboxes
- Select multiple → action bar appears
- Mark read / Add to shelf / Delete work on all selected
- Cancel exits bulk edit mode, clears selection
- Destructive actions show confirmation

**Step 7: Commit**

```bash
git add "src/routes/[identifier]/+page.svelte" "src/lib/components/ui/Card.svelte"
git commit -m "feat: add bulk edit with selection and batch operations"
```

---

## Implementation Order

| Priority | Task | Effort | Dependencies |
|----------|------|--------|--------------|
| 1 | Delete shelf | Low | API exists, just UI |
| 2 | Share shelf | Low | Copy URL pattern |
| 3 | Sort | Medium | Client-side only |
| 4 | Bulk edit | High | Card changes + batch ops |

Export is already done — no work needed.
