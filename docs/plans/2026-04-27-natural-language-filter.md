# Natural Language Filter — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the shelf tab row and filter dropdown with a single interactive sentence: "I'm looking at [status] [view] in [shelf]."

**Architecture:** The NLP filter is a new Svelte component (`NLPFilter.svelte`) that owns three state variables (status, view, shelf) and exposes them via bindable props. A new `Popover.svelte` component provides the tap-to-open menus. The existing derived filter chain in `+page.svelte` is rewired to consume these three variables instead of the old `readFilter`/`ownedFilter`/`selectedShelfId`. The Card component gets a new `viewMode` prop to switch between book-primary and note-primary collapsed layouts.

**Tech Stack:** SvelteKit 5 (runes mode: `$state`, `$derived`, `$bindable`), Tailwind CSS, CSS custom properties from app.css

**Design Spec:** `docs/designs/NATURAL_LANGUAGE_FILTERING_SPEC.md`

---

## Task 1: Create Popover Component

**Files:**
- Create: `src/lib/components/ui/Popover.svelte`

This project has no existing popover/dropdown component. Build one that works as both a desktop dropdown (anchored to trigger) and a mobile bottom sheet.

**Props:**
```ts
interface Props {
  open: boolean;           // bindable
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  anchorEl?: HTMLElement;  // for desktop positioning
}
```

**Step 1: Create the component file**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    open: boolean;
    options: { value: string; label: string }[];
    selected: string;
    onSelect: (value: string) => void;
    anchorEl?: HTMLElement;
  }

  let { open = $bindable(), options, selected, onSelect, anchorEl }: Props = $props();

  let isMobile = $state(false);
  let position = $state({ top: 0, left: 0 });

  function updatePosition() {
    if (!anchorEl || isMobile) return;
    const rect = anchorEl.getBoundingClientRect();
    position = {
      top: rect.bottom + 4,
      left: rect.left
    };
  }

  $effect(() => {
    if (open && anchorEl) updatePosition();
  });

  function handleSelect(value: string) {
    onSelect(value);
    open = false;
  }

  function handleBackdropClick() {
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
    }
  }

  onMount(() => {
    isMobile = window.innerWidth < 640;
    const mql = window.matchMedia('(max-width: 639px)');
    const handler = (e: MediaQueryListEvent) => { isMobile = e.matches; };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  });
</script>

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="presentation"
  ></div>

  {#if isMobile}
    <!-- Bottom sheet -->
    <div class="fixed inset-x-0 bottom-0 z-50 bg-[var(--surface)] rounded-t-2xl shadow-lg px-4 pt-3 pb-6"
         style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom));">
      <!-- Drag handle -->
      <div class="w-10 h-1 bg-[var(--border)] rounded-full mx-auto mb-4"></div>
      <div class="flex flex-col gap-1">
        {#each options as option}
          <button
            class="text-left px-4 py-3 rounded-lg text-base transition-colors
              {option.value === selected
                ? 'bg-[var(--background)] text-[var(--text-primary)] font-medium'
                : 'text-[var(--text-secondary)] active:bg-[var(--background-alt)]'}"
            onclick={() => handleSelect(option.value)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <!-- Desktop dropdown -->
    <div
      class="fixed z-50 bg-[var(--surface)] rounded-lg shadow-lg border border-[var(--border)] py-1 min-w-[160px]"
      style="top: {position.top}px; left: {position.left}px;"
    >
      {#each options as option}
        <button
          class="w-full text-left px-4 py-2 text-sm transition-colors
            {option.value === selected
              ? 'bg-[var(--background)] text-[var(--text-primary)] font-medium'
              : 'text-[var(--text-secondary)] hover:bg-[var(--background-alt)]'}"
          onclick={() => handleSelect(option.value)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  {/if}
{/if}
```

**Step 2: Verify manually**

Import into `+page.svelte` temporarily with a test button to confirm:
- Desktop: dropdown appears below trigger
- Mobile (resize to <640px): bottom sheet slides up
- Clicking option fires `onSelect` and closes
- Clicking backdrop closes
- Escape key closes

**Step 3: Commit**

```
feat: add Popover component with desktop dropdown and mobile bottom sheet
```

---

## Task 2: Create NLPFilter Component

**Files:**
- Create: `src/lib/components/ui/NLPFilter.svelte`

The interactive sentence that replaces all filter controls.

**Props:**
```ts
interface Props {
  status: 'all' | 'unread' | 'read' | 'without-notes';  // bindable
  view: 'books' | 'notes';                                // bindable
  shelfId: string | null;                                  // bindable
  shelves: Shelf[];
  defaultShelfId: string | null;
}
```

**Step 1: Create the component**

```svelte
<script lang="ts">
  import Popover from './Popover.svelte';

  interface Shelf {
    id: string;
    name: string;
  }

  interface Props {
    status: 'all' | 'unread' | 'read' | 'without-notes';
    view: 'books' | 'notes';
    shelfId: string | null;
    shelves: Shelf[];
    defaultShelfId: string | null;
  }

  let { status = $bindable(), view = $bindable(), shelfId = $bindable(), shelves, defaultShelfId }: Props = $props();

  let statusOpen = $state(false);
  let viewOpen = $state(false);
  let shelfOpen = $state(false);

  let statusEl: HTMLButtonElement | undefined = $state();
  let viewEl: HTMLButtonElement | undefined = $state();
  let shelfEl: HTMLButtonElement | undefined = $state();

  // First-run hint
  let showHint = $state(false);
  import { onMount } from 'svelte';
  onMount(() => {
    if (!localStorage.getItem('nlp-filter-dismissed')) {
      showHint = true;
    }
  });
  function dismissHint() {
    showHint = false;
    localStorage.setItem('nlp-filter-dismissed', '1');
  }

  const statusOptions = [
    { value: 'all', label: 'all' },
    { value: 'unread', label: 'unread' },
    { value: 'read', label: 'read' },
    { value: 'without-notes', label: 'without notes' },
  ];

  const viewOptions = [
    { value: 'books', label: 'books' },
    { value: 'notes', label: 'notes' },
  ];

  const shelfOptions = $derived(() => {
    const opts: { value: string; label: string }[] = [];
    for (const shelf of shelves) {
      opts.push({ value: shelf.id, label: shelf.name });
    }
    return opts;
  });

  // Resolve current shelf name for display
  const currentShelfName = $derived(() => {
    if (!shelfId) return 'all shelves';
    const shelf = shelves.find(s => s.id === shelfId);
    return shelf?.name || 'all shelves';
  });

  // Build the sentence parts based on collapse rules
  const statusLabel = $derived(() => {
    return statusOptions.find(o => o.value === status)?.label || 'all';
  });

  const viewLabel = $derived(() => {
    return viewOptions.find(o => o.value === view)?.label || 'books';
  });

  function handleStatusSelect(value: string) {
    status = value as typeof status;
    if (showHint) dismissHint();
  }

  function handleViewSelect(value: string) {
    view = value as typeof view;
    if (showHint) dismissHint();
  }

  function handleShelfSelect(value: string) {
    shelfId = value;
    if (showHint) dismissHint();
  }
</script>

<div class="font-serif text-2xl md:text-3xl text-[var(--text-primary)] leading-snug tracking-tight">
  I'm looking at

  <!-- Status + View combined naturally -->
  {#if status === 'without-notes' && view === 'books'}
    <button
      bind:this={viewEl}
      onclick={() => { viewOpen = !viewOpen; }}
      class="underline decoration-dotted decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)] transition-colors cursor-pointer"
    >books</button>

    without

    <button
      bind:this={statusEl}
      onclick={() => { statusOpen = !statusOpen; }}
      class="underline decoration-dotted decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)] transition-colors cursor-pointer"
    >notes</button>
  {:else}
    <button
      bind:this={statusEl}
      onclick={() => { statusOpen = !statusOpen; }}
      class="underline decoration-dotted decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)] transition-colors cursor-pointer"
    >{statusLabel()}</button>

    <button
      bind:this={viewEl}
      onclick={() => { viewOpen = !viewOpen; }}
      class="underline decoration-dotted decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)] transition-colors cursor-pointer"
    >{viewLabel()}</button>
  {/if}

  in

  <button
    bind:this={shelfEl}
    onclick={() => { shelfOpen = !shelfOpen; }}
    class="underline decoration-dotted decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)] transition-colors cursor-pointer max-w-[40%] truncate inline-block align-bottom"
  >{currentShelfName()}</button>.
</div>

{#if showHint}
  <p class="text-xs text-[var(--text-secondary)] mt-2 font-sans">
    Tap an underlined word to filter.
    <button class="underline ml-1" onclick={dismissHint}>Got it</button>
  </p>
{/if}

<Popover bind:open={statusOpen} options={statusOptions} selected={status} onSelect={handleStatusSelect} anchorEl={statusEl} />
<Popover bind:open={viewOpen} options={viewOptions} selected={view} onSelect={handleViewSelect} anchorEl={viewEl} />
<Popover bind:open={shelfOpen} options={shelfOptions()} selected={shelfId || ''} onSelect={handleShelfSelect} anchorEl={shelfEl} />
```

**Step 2: Verify manually**

Import into `+page.svelte` above the book list temporarily. Confirm:
- Sentence renders in Lora serif at heading size
- Tapping each underlined word opens the correct popover
- Selecting an option updates the sentence text
- "books without notes" collapse rule works (renders as "books without notes" not "without-notes books")
- Long shelf names truncate with ellipsis
- First-run hint appears, dismisses on click, doesn't reappear on reload

**Step 3: Commit**

```
feat: add NLPFilter sentence component with popover interactions
```

---

## Task 3: Rewire Filter State in +page.svelte

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte`
- Modify: `src/routes/[identifier]/+page.server.ts`

Replace old filter variables with NLP filter state, update the derived filter chain, and wire up URL sync.

**Step 1: Update server-side URL param handling**

In `+page.server.ts`, add `status` and `view` params alongside existing `shelf`/`view` handling (lines 61-63):

```ts
// Add after existing param reads
const statusParam = url.searchParams.get('status'); // 'all' | 'unread' | 'read' | 'without-notes'
const viewModeParam = url.searchParams.get('view');  // 'books' | 'notes' — replaces old 'all' usage
```

Update the return object to pass these through:

```ts
return {
  // ... existing fields ...
  initialStatus: statusParam || 'all',
  initialViewMode: viewModeParam || 'books',
};
```

Note: The existing `viewParam === 'all'` logic (line 77) uses `view` param to mean "show all books." This conflicts with the new `view` param meaning "books vs notes." Migrate: treat `?view=all` as `?shelf=` (no shelf selected) for backward compatibility, then use `?view=books|notes` for the new meaning.

**Step 2: Replace filter state variables in +page.svelte**

Remove the old filter variables (lines 68-76):

```ts
// REMOVE these:
let readFilter = $state<'all' | 'read' | 'unread'>('all');
let ownedFilter = $state<'all' | 'owned' | 'not-owned'>('all');
const hasActiveFilters = $derived(readFilter !== 'all' || ownedFilter !== 'all');
let filterDropdownOpen = $state(false);
let filterButtonEl: HTMLButtonElement | undefined = $state();
let filterDropdownPosition = $state({ top: 0, right: 0 });
```

Add new NLP filter state:

```ts
let nlpStatus = $state<'all' | 'unread' | 'read' | 'without-notes'>(data.initialStatus as any || 'all');
let nlpView = $state<'books' | 'notes'>(data.initialViewMode as any || 'books');
// selectedShelfId already exists at line 18 — keep it
```

**Step 3: Update the derived filter chain**

Replace `booksFilteredByStatus` (lines 243-252) to use `nlpStatus` instead of `readFilter`/`ownedFilter`:

```ts
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
```

Add a derived for Notes view filtering (hides books without notes):

```ts
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
```

Update `displayedBooks` to use `booksForView` instead of `booksFilteredByStatus`:

```ts
const displayedBooks = $derived.by(() => {
  return searchQuery.trim()
    ? booksForView.filter(b => matchesSearchQuery(b, searchQuery))
    : booksForView;
});
```

**Step 4: Update URL sync**

Replace the `selectShelf` function (lines 704-722) with a unified `updateFilterUrl`:

```ts
function updateFilterUrl() {
  const params = new URLSearchParams();
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
```

Add an effect to sync URL on any filter change:

```ts
let isInitialLoad = true;
$effect(() => {
  // Track all three variables
  void nlpStatus;
  void nlpView;
  void selectedShelfId;
  // Skip the initial render — URL already reflects server state
  if (isInitialLoad) {
    isInitialLoad = false;
    return;
  }
  updateFilterUrl();
});
```

Update the `popstate` handler (lines 1328-1343) to restore all three variables:

```ts
const handlePopState = () => {
  const params = new URLSearchParams(window.location.search);
  const shelfParam = params.get('shelf');
  const statusParam = params.get('status');
  const viewParam = params.get('view');

  selectedShelfId = shelfParam
    ? (data.shelves.some(s => s.id === shelfParam) ? shelfParam : (data.defaultShelfId || null))
    : (data.defaultShelfId || null);
  nlpStatus = (['all', 'unread', 'read', 'without-notes'].includes(statusParam || '')
    ? statusParam : 'all') as typeof nlpStatus;
  nlpView = (['books', 'notes'].includes(viewParam || '')
    ? viewParam : 'books') as typeof nlpView;
};
```

**Step 5: Verify manually**

- Change status filter → URL updates with `?status=unread`
- Change view → URL updates with `?view=notes`
- Change shelf → URL updates with `?shelf={id}`
- Browser back/forward restores filter state
- Direct URL access (paste `?status=read&view=notes`) loads correct state
- `?view=all` backward compat still works (loads without a shelf selected)

**Step 6: Commit**

```
feat: rewire filter state for NLP filter with URL sync
```

---

## Task 4: Wire NLPFilter Component Into Page

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte`

Replace the old shelf tab row and filter UI with the NLPFilter component.

**Step 1: Add NLPFilter import and placement**

Add import at top of script:

```ts
import NLPFilter from '$lib/components/ui/NLPFilter.svelte';
```

Replace the book count display (around line 1406) and the shelf tab row (lines 1464-1631) with:

```svelte
<NLPFilter
  bind:status={nlpStatus}
  bind:view={nlpView}
  bind:shelfId={selectedShelfId}
  shelves={data.shelves}
  defaultShelfId={data.defaultShelfId}
/>
```

**Step 2: Update the dynamic book count**

Replace the existing count (line 1406) with a derived that mirrors the sentence language:

```ts
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
```

Render it:

```svelte
<p class="text-xs md:text-sm text-[var(--text-secondary)] font-normal">
  {bookCountLabel}
</p>
```

**Step 3: Remove old filter UI**

Delete from the template:
- The filter button and its blue dot indicator (lines ~1422-1440)
- The filter dropdown portal at the bottom of the template (lines ~2297-2336)
- The shelf tab row `<div>` (lines ~1464-1631)
- The `toggleFilterDropdown` function and related positioning code
- The `showMoreShelves`, `moreButtonRef`, `dropdownLeft`, `shelfScrollContainer` state variables
- The `filterDropdownOpen`, `filterButtonEl`, `filterDropdownPosition` state variables (already removed in Task 3)

Keep:
- Search bar (Cmd+K)
- "+" add button
- "..." menu

**Step 4: Add "Hiding N books" message for Notes view**

Below the book list, when in notes view with hidden books:

```svelte
{#if hiddenNoteCount > 0}
  <p class="text-center text-sm text-[var(--text-secondary)] py-4 font-sans">
    Hiding {hiddenNoteCount} {hiddenNoteCount === 1 ? 'book' : 'books'} without notes.
    <button
      class="underline decoration-dotted underline-offset-2 hover:text-[var(--text-primary)] transition-colors"
      onclick={() => { nlpStatus = 'without-notes'; nlpView = 'books'; }}
    >Show them</button>
  </p>
{/if}
```

**Step 5: Verify manually**

- Page loads with NLP sentence instead of shelf tabs
- All three popovers work (status, view, shelf)
- Book count updates dynamically: "23 unread books in TBR"
- Notes view shows "Hiding N books without notes" with tappable link
- Tapping "Show them" switches to without-notes + books view
- Search still works alongside NLP filters
- "+" button and "..." menu still present and functional
- No remnants of old filter UI visible

**Step 6: Commit**

```
feat: replace shelf tabs and filter dropdown with NLP filter sentence
```

---

## Task 5: Notes View Card Layout

**Files:**
- Modify: `src/lib/components/ui/Card.svelte`
- Modify: `src/routes/[identifier]/+page.svelte` (pass viewMode prop)

Add a `viewMode` prop to Card that switches the collapsed layout to note-primary.

**Step 1: Add viewMode prop to Card**

In Card.svelte props interface (line ~30), add:

```ts
viewMode?: 'books' | 'notes';
```

Destructure with default:

```ts
let { ..., viewMode = 'books', ... }: Props = $props();
```

**Step 2: Add note-primary collapsed layout**

In the collapsed view section of Card.svelte, add an alternate layout when `viewMode === 'notes'`:

```svelte
{#if !expanded && viewMode === 'notes' && book.note}
  <!-- Notes view: note-primary collapsed card -->
  <div
    class="px-4 py-4 cursor-pointer hover:bg-[var(--background-alt)] transition-colors"
    onclick={toggleExpanded}
    role="button"
    tabindex="0"
  >
    <!-- Note text as primary content -->
    <p class="font-serif italic text-lg md:text-xl text-[var(--text-primary)] leading-relaxed mb-2">
      {book.note}
    </p>
    <!-- Book citation -->
    <div class="flex items-center gap-3">
      {#if book.cover_url}
        <img
          src={book.cover_url}
          alt=""
          class="w-6 h-9 object-cover rounded-sm flex-shrink-0"
        />
      {/if}
      <p class="text-sm text-[var(--text-secondary)]">
        {book.title}{#if book.author?.length} — {book.author.join(', ')}{/if}
      </p>
    </div>
  </div>
{:else if !expanded}
  <!-- Standard books view: existing collapsed layout (unchanged) -->
  <!-- ... existing code ... -->
{/if}
```

The expanded view stays identical regardless of viewMode — tapping a note card expands to the same full detail view.

**Step 3: Pass viewMode from +page.svelte**

Where Card is rendered (around line 1698), add the prop:

```svelte
<Card
  {book}
  viewMode={nlpView}
  ...other existing props...
/>
```

**Step 4: Add expand/collapse animation**

For the transition from note-primary collapsed to expanded, add a CSS transition. The existing `transition:slide` on the expanded section handles most of this. Test that the visual transition from note-text-as-hero to expanded-detail feels smooth. If the jump is too abrupt, wrap the collapsed content in a `div` with `transition:fade={{ duration: 150 }}` to crossfade.

**Step 5: Verify manually**

- Switch to Notes view → cards show note text as primary, book as citation
- Books without notes don't appear (filtered out by Task 3)
- Tap a note card → expands to same detail view as Books mode
- Switch back to Books view → standard card layout returns
- Lifted books in Books view still show correctly (their existing lifted layout is unaffected)
- The expanded state persists correctly when switching views

**Step 6: Commit**

```
feat: add note-primary card layout for Notes view mode
```

---

## Task 6: Handle Edge Cases and Polish

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte`
- Modify: `src/lib/components/ui/NLPFilter.svelte`

**Step 1: Empty state for "without notes" + "notes" view**

In `+page.svelte`, add an empty state when this contradictory combination produces zero results:

```svelte
{#if displayedBooks.length === 0 && nlpStatus === 'without-notes' && nlpView === 'notes'}
  <div class="text-center py-12">
    <p class="text-[var(--text-secondary)] text-sm">No notes yet.</p>
  </div>
{/if}
```

**Step 2: Shelf creation from NLP filter**

The old shelf tab row had a "+ New Shelf" button. This functionality needs to remain accessible. Add it to the shelf popover options list in `NLPFilter.svelte` — a "New shelf..." option at the bottom of the shelf list that emits an event:

Add to NLPFilter props:

```ts
onCreateShelf?: () => void;
```

In the shelf options, append a divider and create option after the shelf list. Or, since creating shelves is a less common action, leave it in the "..." kebab menu which already exists. Confirm which approach — the simpler path is to rely on the existing "..." menu.

**Decision:** Shelf creation stays in the "..." menu. The NLP filter is for filtering, not shelf management. No changes needed.

**Step 3: Delete shelf still works**

The old "More" dropdown had "Delete shelf" and "Export CSV" actions. Verify these remain accessible through the "..." menu. If not already there, add them.

**Step 4: Backward-compatible URL handling**

In `+page.server.ts`, ensure `?view=all` (old URL format) still works:

```ts
// Backward compat: ?view=all meant "show all books (no shelf selected)"
if (viewModeParam === 'all') {
  selectedShelfId = null;
  // Don't pass 'all' as the view mode — it means 'books'
  initialViewMode = 'books';
}
```

**Step 5: Verify manually**

- Visit `?status=without-notes&view=notes` → shows "No notes yet" empty state
- Visit old URL `?view=all` → loads correctly, shows all books
- Shelf delete/export still accessible from "..." menu
- No console errors in any filter combination
- Mobile bottom sheet works correctly for all three popovers
- Filter state resets correctly when navigating between different users' shelves

**Step 6: Commit**

```
feat: handle edge cases for NLP filter (empty states, backward compat)
```

---

## Task 7: Cleanup Dead Code

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte`

**Step 1: Remove unused imports, functions, and variables**

Do a thorough cleanup pass:
- Remove `toggleFilterDropdown` function
- Remove `portal` action import if no longer used (check if other elements use it)
- Remove shelf tab row helper functions (`showMoreShelves` toggle, dropdown positioning)
- Remove any CSS that only applied to the removed components
- Remove the `ownedFilter` related code paths if any remain

**Step 2: Verify the page still works end-to-end**

Full smoke test:
- Load shelf page fresh
- Try each status filter
- Try each view mode
- Switch shelves
- Expand/collapse cards
- Add a book via "+"
- Search with Cmd+K
- Back/forward browser navigation
- Mobile viewport

**Step 3: Commit**

```
refactor: remove dead filter and shelf tab code
```

---

## Summary of Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/components/ui/Popover.svelte` | Create | Desktop dropdown + mobile bottom sheet |
| `src/lib/components/ui/NLPFilter.svelte` | Create | Interactive sentence filter component |
| `src/routes/[identifier]/+page.svelte` | Modify | Rewire filter state, replace shelf tabs, add viewMode to cards |
| `src/routes/[identifier]/+page.server.ts` | Modify | Add status/view URL params |
| `src/lib/components/ui/Card.svelte` | Modify | Add note-primary collapsed layout |

**Estimated scope:** ~7 tasks, primarily modifying 3 existing files and creating 2 new components. The bulk of the work is in Task 3 (rewiring state) and Task 4 (removing old UI and wiring new component).
