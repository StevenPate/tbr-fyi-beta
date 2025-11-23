# Book Card Hybrid Design - Implementation Plan

**Date:** 2025-11-01
**Goal:** Adopt prototype visual treatment while keeping current UX patterns
**Scope:** List view card redesign with bookstore availability stub

---

## Design Goals

1. ✅ Keep all current interactions (direct toggles, visible actions)
2. ✅ Adopt prototype visual styling (colors, spacing, typography)
3. ✅ Improve information hierarchy and organization
4. ✅ De-emphasize destructive actions
5. ✅ Future-proof for bookstore integration

---

## Implementation Phases

### Phase 1: Typography & Visual Hierarchy

**File:** `src/routes/[username]/+page.svelte` (lines ~940-1135)

#### Changes:
- **Title:** `text-xl` → `text-2xl font-bold` with better line height
- **Author:** `text-base` → `text-lg` with `text-gray-700` (darker)
- **Publisher/year:** Keep `text-sm text-gray-500`
- **Card padding:** Increase to `p-6` (from `p-4`)
- **Section spacing:** Add clear visual breaks between sections

```svelte
<!-- Title and Author -->
<div class="mb-3">
  <h3 class="text-2xl font-bold text-gray-900 leading-tight mb-1 line-clamp-2">
    {book.title}
  </h3>
  {#if book.author && book.author.length > 0}
    <p class="text-lg text-gray-700 mb-1 line-clamp-1">
      {book.author.join(', ')}
    </p>
  {/if}
  {#if book.publisher || book.publication_date}
    {@const year = getPublicationYear(book.publication_date)}
    <p class="text-sm text-gray-500 line-clamp-1">
      {book.publisher}{#if year}{book.publisher ? ' ' : ''}({year}){/if}
    </p>
  {/if}
</div>
```

---

### Phase 2: Status Badge Refinement

**File:** `src/routes/[username]/+page.svelte` (lines ~997-1014)

#### Changes:
- Add amber/yellow styling for "Unread" state
- Add subtle borders to all badge variants
- Make badges slightly smaller and more refined

**New Badge Variants Needed:**
```svelte
<!-- Unread badge: amber/yellow with border -->
<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-colors">
  Unread
</span>

<!-- Read badge: green (keep current success variant) -->
<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors">
  ✓ Read
</span>

<!-- Not Owned badge: gray with border -->
<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
  Not Owned
</span>

<!-- Owned badge: blue (keep current info variant) -->
<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors">
  ✓ Owned
</span>
```

**Implementation approach:** Update Badge component props or add inline styles

---

### Phase 3: Bookstore Availability Stub

**File:** `src/routes/[username]/+page.svelte` (insert after status badges, before notes)

#### Markup (conditional, hidden by default):
```svelte
<!-- Bookstore Availability (future feature) -->
{#if book.bookstore_availability}
  <div class="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
    <div class="flex items-start gap-3">
      <div class="bg-emerald-100 p-2 rounded-lg flex-shrink-0">
        <svg class="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <p class="text-sm font-semibold text-emerald-900">
            {book.bookstore_availability.store_name}
          </p>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-600 text-white">
            In Stock
          </span>
        </div>
        <p class="text-xs text-emerald-700 mb-2">
          {book.bookstore_availability.copies} {book.bookstore_availability.copies === 1 ? 'copy' : 'copies'} available
          {#if book.bookstore_availability.location}
            • {book.bookstore_availability.location}
          {/if}
        </p>
        <a
          href={book.bookstore_availability.directions_url}
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-emerald-700 font-medium hover:text-emerald-800 underline"
        >
          Get directions →
        </a>
      </div>
    </div>
  </div>
{/if}
```

**TypeScript type addition:**
```typescript
// In PageData type or Book type
interface BookstoreAvailability {
  store_name: string;
  copies: number;
  location?: string;
  directions_url?: string;
}

// Add to Book interface:
bookstore_availability?: BookstoreAvailability;
```

---

### Phase 4: Notes Section Styling

**File:** `src/routes/[username]/+page.svelte` (lines ~1017-1025)

#### Changes:
```svelte
<!-- Note Field -->
<div class="mb-4">
  <textarea
    value={book.note || ''}
    placeholder="Add note..."
    aria-label="Book note for {book.title}"
    onblur={(e: FocusEvent) => updateNote(book.id, (e.target as HTMLTextAreaElement).value)}
    class="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
    rows="2"
  />
</div>
```

**Key changes:**
- Switch from `<Input>` to `<textarea>` for multi-line support
- Add `rounded-xl` (more rounded)
- Add explicit focus states
- Remove `resize-none` if users want to expand

---

### Phase 5: Metadata Footer

**File:** `src/routes/[username]/+page.svelte` (lines ~1096-1131)

#### Complete restructure:
```svelte
<!-- Metadata Footer -->
<div class="mt-4 pt-4 border-t border-gray-100 bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-lg">
  <!-- Top row: shelf count, added date, barcode toggle -->
  <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
    <div class="flex items-center gap-4">
      {@const bookShelves = getBookShelves(book.id)}
      <button
        onclick={() => selectedBookForShelfMenu = selectedBookForShelfMenu === book.id ? null : book.id}
        class="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
        {#if bookShelves.length === 0}
          Add to shelf
        {:else}
          On {bookShelves.length} {bookShelves.length === 1 ? 'shelf' : 'shelves'}
        {/if}
      </button>
      <span class="flex items-center gap-1">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Added {new Date(book.added_at).toLocaleDateString()}
      </span>
    </div>
    <button
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        toggleBarcode(book.id);
      }}
      class="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M2 6h2v12H2V6zm4 0h1v12H6V6zm2 0h2v12H8V6zm3 0h1v12h-1V6zm2 0h2v12h-2V6zm3 0h1v12h-1V6zm2 0h2v12h-2V6zm4 0h1v12h-1V6z"/>
      </svg>
      {showBarcodeForBook === book.id ? 'Hide' : 'Show'} barcode
    </button>
  </div>

  <!-- Bottom row: ISBN with copy button -->
  <div class="flex items-center justify-between">
    <div class="text-xs text-gray-400 font-mono">
      ISBN: {book.isbn13}
    </div>
    <button
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        copyISBN(book.isbn13);
      }}
      class="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
    >
      {#if copiedIsbn === book.isbn13}
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        Copied!
      {:else}
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        Copy
      {/if}
    </button>
  </div>
</div>

<!-- Shelf menu (if open) - moved outside footer -->
{#if selectedBookForShelfMenu === book.id}
  <div class="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-sm">
    {#each data.shelves as shelf}
      {@const isOn = isBookOnShelf(book.id, shelf.id)}
      <label class="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-100 px-1 rounded">
        <input
          type="checkbox"
          checked={isOn}
          onchange={() => toggleBookOnShelf(book.id, shelf.id, isOn)}
          class="rounded border-gray-300"
        />
        <span>{shelf.name}</span>
      </label>
    {/each}
    {#if data.shelves.length === 0}
      <p class="text-gray-500 py-1">No shelves yet!</p>
    {/if}
  </div>
{/if}

<!-- Barcode (if open) -->
{#if showBarcodeForBook === book.id}
  <div class="mt-3 bg-white border border-gray-300 rounded-lg p-4">
    <p class="text-xs text-gray-500 text-center mb-3">
      Scan at bookstore or library
    </p>
    <div class="flex justify-center">
      <canvas
        use:generateBarcode={book.isbn13}
        class="max-w-full"
      ></canvas>
    </div>
  </div>
{/if}
```

**Key changes:**
- Negative margins (`-mx-6 -mb-6`) to extend to card edges
- Gray background (`bg-gray-50`)
- Border top for separation
- Icons for "On shelves" and "Added" metadata
- Smaller, more refined copy button
- Barcode toggle moved to top row

---

### Phase 6: Delete Action De-emphasis

**File:** `src/routes/[username]/+page.svelte` (current lines ~1124-1130)

#### Changes:
```svelte
<!-- Remove action (de-emphasized) -->
<div class="mt-4 pt-3 border-t border-gray-100 text-center">
  <button
    onclick={() => deleteBook(book.id, book.title)}
    class="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
  >
    Remove from shelf
  </button>
</div>
```

**Key changes:**
- Remove `<Button variant="danger">` component
- Use text-only button
- Add top border for separation
- Center align
- Smaller text (`text-sm`)
- Subtle hover state

---

## Implementation Order

### Step 1: Typography (15 min)
- Update title, author, publisher font sizes
- Adjust card padding

### Step 2: Badge Styling (20 min)
- Add amber/yellow styles for "Unread"
- Add borders to all badge variants
- Test badge interactions

### Step 3: Bookstore Stub (15 min)
- Add TypeScript types
- Add conditional markup
- Test with dummy data (manually toggle in dev tools)

### Step 4: Notes Textarea (10 min)
- Replace Input with textarea
- Update styling
- Test blur handler

### Step 5: Metadata Footer (45 min)
- Restructure footer with negative margins
- Add icons to metadata
- Move shelf/barcode buttons
- Reposition expandable sections
- Test all interactions

### Step 6: Delete Button (5 min)
- Replace Button component with text-only
- Add separator border
- Test deletion flow

### Step 7: Polish & Testing (20 min)
- Verify all interactions work
- Test mobile responsiveness
- Check accessibility (focus states, aria labels)
- Verify grid view unchanged (only list view modified)

**Total estimated time:** ~2.5 hours

---

## Testing Checklist

- [ ] Title/author/publisher display correctly
- [ ] Badge toggles work (Read/Unread, Owned/Not Owned)
- [ ] Notes save on blur
- [ ] Shelf menu opens/closes, checkboxes work
- [ ] Barcode toggle shows/hides properly
- [ ] ISBN copy button works
- [ ] Delete button confirms and removes book
- [ ] Description toggle works
- [ ] All hover states functional
- [ ] Mobile responsive (test <640px)
- [ ] Keyboard navigation works
- [ ] Screen reader accessibility

---

## Future Integration Points

### Bookstore Availability
When implementing real bookstore data:

1. Add to book fetching logic (Google Books API response or separate API)
2. Store in `books` table as JSONB column
3. Conditional render already in place
4. Consider caching strategy (bookstore data changes frequently)

### Possible data sources:
- Independent bookstore APIs (Bookshop.org)
- Library availability (WorldCat)
- Local bookstore integrations
- Manual user entry

---

## Rollback Plan

If issues arise:
1. Git stash changes
2. Test in dev environment first
3. Deploy to preview branch before main
4. Keep current implementation tagged as `pre-hybrid-design`

---

## Notes

- Grid view (flip cards) intentionally left unchanged
- Focus is on list view only
- All current functionality preserved
- No breaking changes to data model
- Bookstore feature opt-in (requires data)
