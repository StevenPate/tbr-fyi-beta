# Per-Shelf Export Feature Specification

**Date:** 2026-01-11
**Status:** Ready for implementation
**Context:** Extension of existing export feature (see `2025-11-16-json-export.md` for implementation details)

## Problem Statement

User needs to export subsets of their book collection filtered by shelf for external workflows:
- Export FBA shelf ISBNs → Create Amazon listings
- Export Base Weight shelf ISBNs → Upload to Ingram for wholesale pricing
- Export Kingston shelf → Print packing list for consignment

Current limitation: Can only export entire library, requiring manual CSV filtering in spreadsheet.

## Solution Overview

Add optional `shelf` query parameter to existing `/api/export` and `/api/export/csv` endpoints. Add "Export" button inline with each shelf pill in the main shelf page. Supports both JSON and CSV (Goodreads format) exports with shared filtering logic.

## Current Architecture Context

Before implementing, understand the existing structure:

| Aspect | Current State |
|--------|---------------|
| Shelf routing | Query param `?shelf={id}` handled in `src/routes/[identifier]/+page.svelte` (not separate routes) |
| Shelf identification | UUID shelf IDs, not shelf names |
| Export endpoints | `/api/export` (JSON) and `/api/export/csv` (CSV) |
| Export UI | Settings page at `/[identifier]/settings` with format selector; shelf pills inline on `/[identifier]` |
| Auth pattern | `requireUserId()` + `resolveIdentifierToUserId()` from referer |
| Error handling | Settings page uses structured `exportError` state, not `alert()` |

## Requirements

### Functional Requirements

1. **API Enhancement**
   - Both `/api/export` and `/api/export/csv` accept optional `?shelf={shelfId}` parameter
   - When shelf parameter present: filter results to only books on that shelf
   - When shelf parameter absent: return all books (existing behavior)
   - Return 400 error if shelf ID doesn't exist for user
   - Return empty results if shelf exists but has no books

2. **UI Enhancement**
   - Add export dropdown/button to individual shelf pills on main page
   - Dropdown offers CSV and JSON format options (matching settings page)
   - Export triggers download of filtered data for current shelf only
   - Filename format: `tbr-export-{shelf-name}-{YYYY-MM-DD}.{json|csv}`
   - Settings page full-library export remains unchanged

3. **Output Structure**
   - JSON: Same structure as full export, add `shelfFilter` field with shelf name
   - CSV: Same Goodreads format, filtered to shelf books only
   - `totalBooks` reflects filtered count

### Non-Functional Requirements

- Response time <2 seconds for shelves up to 100 books
- Works on mobile and desktop browsers
- Maintains existing authentication pattern
- No breaking changes to existing full export functionality

## Technical Specification

### 1. API Endpoint Modifications

**Files to modify:**
- `src/routes/api/export/+server.ts`
- `src/routes/api/export/csv/+server.ts`

**Shared filtering logic (add to both endpoints):**

```typescript
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { requireUserId, resolveIdentifierToUserId } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request, url }) => {
  try {
    // Existing auth pattern
    const identifier = requireUserId(request);
    const userId = await resolveIdentifierToUserId(identifier);
    if (!userId) {
      return json({ error: 'User not found' }, { status: 404 });
    }

    // NEW: Parse shelf filter from query params
    const shelfId = url.searchParams.get('shelf');
    let shelfName: string | null = null;
    let bookIdsOnShelf: Set<string> | null = null;

    // NEW: Resolve shelf ID to book IDs using bridge table to avoid brittle nested Supabase filters
    if (shelfId) {
      // Verify shelf exists and belongs to this user
      const { data: shelf, error: shelfError } = await supabase
        .from('shelves')
        .select('id, name')
        .eq('id', shelfId)
        .eq('user_id', userId)
        .single();

      if (shelfError || !shelf) {
        return json({ error: 'Shelf not found' }, { status: 400 });
      }

      shelfName = shelf.name;

      // Get book IDs on this shelf
      const { data: bookShelves } = await supabase
        .from('book_shelves')
        .select('book_id')
        .eq('shelf_id', shelfId);

      bookIdsOnShelf = new Set((bookShelves || []).map(bs => bs.book_id));
    }

    // Query all books with shelf data (unchanged)
    const { data: books, error } = await supabase
      .from('books')
      .select('*, book_shelves(shelf_id, shelves(name))')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Export query error:', error);
      return json({ error: 'Failed to fetch books' }, { status: 500 });
    }

    // NEW: Two-step filter: shelf ID -> book IDs -> books array
    let filteredBooks = books || [];
    if (bookIdsOnShelf) {
      filteredBooks = filteredBooks.filter(book => bookIdsOnShelf!.has(book.id));
    }

    // Generate filename with shelf name if filtered
    const date = new Date().toISOString().split('T')[0];
    const sanitizedShelfName = shelfName
      ? shelfName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : null;
    const filename = sanitizedShelfName
      ? `tbr-export-${sanitizedShelfName}-${date}`
      : `tbr-export-${date}`;

    // Transform and return (format-specific from here)
    // ... existing transform logic, using filteredBooks instead of books
    // ... add shelfFilter field to JSON output if filtering
  } catch (error) {
    // ... existing error handling
  }
};
```

**Key implementation notes:**

1. **Shelf ID, not name**: Query param is `?shelf={uuid}` not `?shelf={name}` - matches existing URL pattern (`?shelf=abc-123-uuid`)
2. **Two-step filtering**: First resolve shelf ID → book IDs, then filter books. Avoids Supabase's brittle nested filter syntax (`filter('book_shelves.shelves.name', 'eq', ...)`)
3. **Shelf validation**: Verify shelf belongs to user before filtering
4. **Preserve shelves array**: Even when filtering by shelf, output includes all shelves each book is on (not just the filtered shelf)

### 2. JSON Endpoint Specific Changes

**File:** `src/routes/api/export/+server.ts`

Add `shelfFilter` field to export data when filtering:

```typescript
const exportData = {
  exportedAt: new Date().toISOString(),
  userId: userId,
  // NEW: Include shelf filter info if present
  ...(shelfName && { shelfFilter: shelfName }),
  totalBooks: filteredBooks.length,
  books: filteredBooks.map(book => ({
    // ... existing transform
  }))
};

return new Response(JSON.stringify(exportData, null, 2), {
  headers: {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="${filename}.json"`
  }
});
```

### 3. CSV Endpoint Specific Changes

**File:** `src/routes/api/export/csv/+server.ts`

Apply the shared filtering helper (imported from JSON endpoint file or extracted utility) so both endpoints stay in sync:

```typescript
const csv = generateGoodreadsCSV(filteredBooks as BookRow[]);

return new Response(csv, {
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}.csv"`
  }
});
```

### 4. Shelf Page UI Addition

**File:** `src/routes/[identifier]/+page.svelte`

**Location:** Add export dropdown to each shelf pill (next to the delete × button, inline with existing pill controls)

**New state and handler:**

```svelte
<script lang="ts">
  // ... existing imports and state

  // NEW: Export state
  let exportingShelfId = $state<string | null>(null);
  let exportError = $state<string | null>(null);

  // NEW: Export handler (matching settings page pattern)
  async function exportShelf(shelfId: string, shelfName: string, format: 'csv' | 'json') {
    exportingShelfId = shelfId;
    exportError = null;

    const endpoint = format === 'csv'
      ? `/api/export/csv?shelf=${shelfId}`
      : `/api/export?shelf=${shelfId}`;
    const defaultFilename = format === 'csv'
      ? `tbr-export-${shelfName.toLowerCase().replace(/\s+/g, '-')}.csv`
      : `tbr-export-${shelfName.toLowerCase().replace(/\s+/g, '-')}.json`;

    try {
      const response = await fetch(endpoint);

      if (!response.ok) {
        const result = await response.json();
        exportError = result.error || 'Export failed';
        return;
      }

      // Trigger download (same pattern as settings page)
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
</script>
```

**UI option A: Export dropdown on shelf pill**

Add after the delete button in each shelf pill:

```svelte
<!-- Inside the shelf pill div, after delete button -->
<div class="relative group/export">
  <button
    onclick={(e) => {
      e.stopPropagation();
      // Toggle dropdown or show inline options
    }}
    disabled={exportingShelfId === shelf.id}
    class="px-2 self-stretch flex items-center hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 cursor-pointer {selectedShelfId === shelf.id ? 'bg-stone-800 text-stone-300' : 'bg-stone-100 text-stone-400'}"
    aria-label={`Export shelf ${shelf.name}`}
    title="Export shelf"
  >
    {#if exportingShelfId === shelf.id}
      <!-- Spinner -->
      <svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
    {:else}
      ↓
    {/if}
  </button>

  <!-- Dropdown menu (appears on click) -->
  <!-- ... format options CSV/JSON -->
</div>
```

**UI option B: Split buttons per format**

If dropdown interaction feels heavy, render two inline icon buttons (CSV, JSON) that both live inside the pill so users still get one-click access to either format.

### 5. Error Display

Add error display near shelf navigation (not `alert()`):

```svelte
{#if exportError}
  <div class="mx-4 mt-2 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
    <p class="text-sm text-red-800">{exportError}</p>
    <button
      onclick={() => exportError = null}
      class="text-xs text-red-600 underline mt-1"
    >
      Dismiss
    </button>
  </div>
{/if}
```

## Data Flow

### Full Library Export (existing, unchanged)
```
1. User navigates to /[identifier]/settings
2. User selects format (CSV or JSON)
3. User clicks "Download Export"
4. Browser: GET /api/export or /api/export/csv
5. Server: Fetches all books for userId
6. Browser: Downloads tbr-export-2026-01-11.{csv|json}
```

### Per-Shelf Export (new)
```
1. User views /[identifier]?shelf={shelfId}
2. User clicks export button on shelf pill
3. Browser: GET `/api/export/csv?shelf={shelfId}` or `/api/export?shelf={shelfId}`
4. Server: Validates shelf exists for userId
5. Server: Fetches book IDs on shelf
6. Server: Fetches all books, filters by book IDs
7. Server: Transforms and returns filtered data
8. Browser: Downloads `tbr-export-{shelf-name}-2026-01-11.{csv|json}`
```

## JSON Output Examples

### Filtered Export (new)
```json
{
  "exportedAt": "2026-01-11T18:30:00Z",
  "userId": "+15551234567",
  "shelfFilter": "FBA-2026-01-11",
  "totalBooks": 12,
  "books": [
    {
      "isbn13": "9781442442031",
      "title": "Hatchet",
      "author": ["Gary Paulsen"],
      "shelves": ["FBA-2026-01-11", "To Sell"],
      ...
    }
  ]
}
```

Note: `shelves` array includes ALL shelves the book is on, not just the filtered shelf.

### Full Export (unchanged)
```json
{
  "exportedAt": "2026-01-11T18:30:00Z",
  "userId": "+15551234567",
  "totalBooks": 147,
  "books": [...]
}
```

## Error Handling

### Client-Side Errors (structured, not alert())

| Error | Display |
|-------|---------|
| Export failed | Red banner near shelf nav with dismiss button |
| Slow network | Loading spinner on export button |
| No JavaScript | Export buttons don't appear (graceful degradation) |

### Server-Side Errors

| Status | Response | Cause |
|--------|----------|-------|
| 400 | `{"error": "Shelf not found"}` | Invalid shelf ID or shelf belongs to different user |
| 401 | `{"error": "User ID required"}` | Missing/invalid referer header |
| 404 | `{"error": "User not found"}` | Identifier doesn't resolve to user |
| 500 | `{"error": "Failed to fetch books"}` | Database error (logged server-side) |

### Edge Cases

| Case | Behavior |
|------|----------|
| Shelf exists but has 0 books | Valid export: empty books array, `totalBooks: 0` |
| Shelf name with special chars | Sanitized in filename, preserved in `shelfFilter` field |
| Very long shelf name (50+ chars) | Truncated in filename, preserved in JSON |
| User exports while viewing "All Books" | Use settings page full export instead |
| Concurrent shelf deletion | 400 error - acceptable |

## Testing Plan

### Manual Testing Checklist

**Setup:**
1. Create test user with 3 shelves: "TBR" (5 books), "FBA-2026-01-11" (3 books), "Empty" (0 books)
2. Add 2 books that appear on multiple shelves

**Test Cases:**

- [ ] **Full export still works**: Settings page CSV/JSON export unchanged
- [ ] **Single shelf CSV export**: Click export on "TBR" shelf, verify 5 books in CSV
- [ ] **Single shelf JSON export**: Export "TBR" as JSON, verify `shelfFilter` field present
- [ ] **Empty shelf export**: Export "Empty" shelf, verify empty results (not error)
- [ ] **Multi-shelf books**: Verify filtered export includes all shelves in `shelves` array
- [ ] **Shelf name sanitization**: Shelf "Test Shelf!" → filename `tbr-export-test-shelf-2026-01-11.csv`
- [ ] **Invalid shelf ID**: Manual URL `/api/export?shelf=invalid-uuid` returns 400
- [ ] **Loading state**: Export button shows spinner during request
- [ ] **Error display**: Force error, verify red banner appears (not alert)
- [ ] **Mobile**: Test export button tap targets on mobile

### Browser Compatibility

- [ ] Chrome: Auto-download works
- [ ] Safari: Auto-download works
- [ ] Firefox: Auto-download works
- [ ] iOS Safari: Downloads to Files app
- [ ] Android Chrome: Downloads to Downloads folder

## Implementation Sequence

1. **Modify JSON endpoint** (`src/routes/api/export/+server.ts`)
   - Add shelf ID parsing from URL
   - Add shelf validation query
   - Add book ID lookup for shelf
   - Filter books by book IDs
   - Add `shelfFilter` field to output
   - Update filename generation

2. **Modify CSV endpoint** (`src/routes/api/export/csv/+server.ts`)
   - Same filtering logic as JSON
   - Update filename generation

3. **Add UI to shelf page** (`src/routes/[identifier]/+page.svelte`)
   - Add export state variables
   - Add `exportShelf()` handler
   - Add export button to shelf pills
   - Add error display component
   - Style to match design system

4. **Manual testing** (use checklist above)

## Success Criteria

- [ ] User can export any shelf as CSV in 2 clicks
- [ ] Exported data is valid and contains only books on that shelf
- [ ] Filename clearly indicates which shelf was exported
- [ ] Works on mobile and desktop browsers
- [ ] No breaking changes to existing settings page export
- [ ] Error states display in UI (no alert boxes)
- [ ] Both JSON and CSV formats supported for per-shelf export

## Resolution Summary

| Concern from original spec | Updated resolution |
|----------------------------|--------------------|
| Filtering relied on nested Supabase `filter()` syntax | Two-step lookup: shelf ID → book IDs via `book_shelves` → filter books array |
| Only JSON endpoint documented | Both `/api/export` (JSON) and `/api/export/csv` share the same filtering helper and filename generation |
| Shelf page path unclear | Confirmed exports live in `src/routes/[identifier]/+page.svelte` with query param `?shelf={uuid}` |
| Exports triggered with `alert()`/redirect patterns | UI keeps `exportError` state and dismissible banner consistent with settings page |
| Export button location ambiguous | Buttons live inline with shelf pills (after delete control) for quick access |
| Spinner/error feedback missing | Export button shows spinner per shelf; banner provides dismissible error feedback |

## Questions Resolved from Original Spec

| Original Question | Answer |
|-------------------|--------|
| Exact file path for shelf page | `/src/routes/[identifier]/+page.svelte` (single page with query param, not separate routes) |
| Shelf identification | UUID shelf IDs via `?shelf={id}`, not names |
| Design system components | Use existing Button, match shelf pill styling |
| Preferred button location | Inline with shelf pill (after delete button) |
| Supabase filter syntax | Avoid nested filters - resolve shelf → book IDs first |
| Error handling | Use structured error state, not `alert()` |
| Format support | Both CSV and JSON (matching settings page) |

## Dependencies

**Existing code:**
- `src/routes/api/export/+server.ts` (JSON export)
- `src/routes/api/export/csv/+server.ts` (CSV export)
- `src/lib/server/auth.ts` (`requireUserId`, `resolveIdentifierToUserId`)
- `src/routes/[identifier]/+page.svelte` (shelf page)
- `src/routes/[identifier]/settings/+page.svelte` (reference for error handling pattern)

**No new dependencies required**
