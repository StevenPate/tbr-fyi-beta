# Bulk Import API Type Definitions

## Detection API Response Shape

### Current Response (for 'text' and 'image' types)
```typescript
{
  success: true,
  detected: DetectedBook[]
}
```

### Enhanced Response (for 'file' type)
```typescript
interface DetectionMetadata {
  totalLines: number;      // Total lines in file
  validIsbns: number;      // Successfully parsed ISBNs
  skippedLines: number;    // Lines with no valid ISBN
  duplicatesRemoved?: number;  // Optional: if deduplication occurred
}

interface DetectionResponse {
  success: true;
  detected: DetectedBook[];
  metadata?: DetectionMetadata;  // Only present for 'file' type
}
```

### Frontend Type Definition
**File**: `src/routes/[username]/+page.svelte`

```typescript
// Add to existing interface definitions (around line 27)
interface DetectionMetadata {
  totalLines: number;
  validIsbns: number;
  skippedLines: number;
  duplicatesRemoved?: number;
}

// Update state
let detectionMetadata = $state<DetectionMetadata | null>(null);

// Update detectBooks function to capture metadata
async function detectBooks() {
  // ... existing code ...
  const result = await response.json();
  if (!response.ok) {
    detectError = result.error || 'Detection failed';
    return;
  }
  detectedBooks = result.detected as DetectedBook[];
  detectionMetadata = result.metadata || null;  // NEW: Capture metadata
  selectedBookIds = new Set(detectedBooks.map((b) => b.isbn13));
}
```

### Backend Implementation
**File**: `src/routes/api/books/detect/+server.ts`

```typescript
// At the end of 'file' type handling (after building isbns array)
if (type === 'file') {
  // ... parsing logic ...

  isbns = Array.from(isbnSet);

  // Fetch metadata for all ISBNs
  const metadataResults = await Promise.all(
    isbns.map((isbn) => fetchBookMetadata(isbn))
  );

  const detected: DetectedBook[] = metadataResults.reduce<DetectedBook[]>(
    (acc, metadata, index) => {
      if (!metadata) return acc;
      acc.push({
        isbn13: isbns[index],
        title: metadata.title,
        author: metadata.author,
        publisher: metadata.publisher,
        publicationDate: metadata.publicationDate,
        coverUrl: metadata.coverUrl
      });
      return acc;
    },
    []
  );

  if (detected.length === 0) {
    return json({ error: 'No books found for detected ISBNs' }, { status: 404 });
  }

  // Return with metadata
  return json({
    success: true,
    detected,
    metadata: {
      totalLines: lines.length,
      validIsbns: isbnSet.size,
      skippedLines,
      duplicatesRemoved: lines.length - skippedLines - isbnSet.size  // Approximate
    }
  });
}

// For 'text' and 'image' types, maintain existing response format
// (no metadata field)
```

---

## 2. Shelf Rename Collision Prevention

### Problem
Multiple imports could create:
- `sci-fi (imported)`
- `sci-fi (imported)` ← collision!

### Solution: Incremental Suffix Strategy

**File**: `src/lib/server/goodreads-parser.ts` (new utility function)

```typescript
/**
 * Generates a unique shelf name by checking existing shelves
 * and adding incremental suffix if needed
 */
export async function generateUniqueShelfName(
  baseName: string,
  userId: string,
  supabase: any
): Promise<string> {
  // Try base name first
  const { data: existing } = await supabase
    .from('shelves')
    .select('name')
    .eq('user_id', userId)
    .eq('name', baseName)
    .single();

  if (!existing) {
    return baseName;  // Base name available
  }

  // Try with "(imported)" suffix
  const importedName = `${baseName} (imported)`;
  const { data: importedExists } = await supabase
    .from('shelves')
    .select('name')
    .eq('user_id', userId)
    .eq('name', importedName)
    .single();

  if (!importedExists) {
    return importedName;
  }

  // Try incremental suffixes: "(imported 2)", "(imported 3)", etc.
  let counter = 2;
  while (counter < 100) {  // Safety limit
    const numberedName = `${baseName} (imported ${counter})`;
    const { data: numberedExists } = await supabase
      .from('shelves')
      .select('name')
      .eq('user_id', userId)
      .eq('name', numberedName)
      .single();

    if (!numberedExists) {
      return numberedName;
    }

    counter++;
  }

  // Fallback: use timestamp
  return `${baseName} (imported ${Date.now()})`;
}
```

### Updated Import Logic
**File**: `src/routes/api/books/import-goodreads/+server.ts`

```typescript
import { generateUniqueShelfName } from '$lib/server/goodreads-parser';

// In shelf creation loop
for (const shelfName of uniqueShelves) {
  const strategy = options.shelfStrategies?.[shelfName] || 'merge';

  let finalName: string;

  if (strategy === 'skip') {
    continue;
  } else if (strategy === 'rename') {
    // Generate unique name (prevents collisions)
    finalName = await generateUniqueShelfName(shelfName, userId, supabase);
  } else {
    // 'merge' strategy - use existing or create with original name
    finalName = shelfName;
  }

  const { data: shelf, error } = await supabase
    .from('shelves')
    .upsert(
      { user_id: userId, name: finalName },
      { onConflict: 'user_id,name', ignoreDuplicates: false }
    )
    .select()
    .single();

  if (!error && shelf) {
    shelfMap.set(shelfName, shelf.id);
    results.shelvesCreated.push(finalName);
  }
}
```

### UI Feedback
Show the actual name that will be created:

```svelte
{#each conflictingShelves as shelf}
  <div class="flex items-center gap-2 mb-2">
    <span class="text-sm">"{shelf.name}" already exists</span>
    <select bind:value={shelf.strategy} class="text-xs border rounded px-2 py-1">
      <option value="merge">Merge into existing</option>
      <option value="rename">
        Create "{shelf.name} (imported)"
        {#if shelf.renameSuffix}
          or "{shelf.name} (imported {shelf.renameSuffix})"
        {/if}
      </option>
      <option value="skip">Skip this shelf</option>
    </select>
  </div>
{/each}
```

---

## 3. Logtail Queries File Integration

### Update Existing Queries File
**File**: `docs/logtail-queries.md`

Add new section at the end:

```markdown
## Bulk Import Queries

**All bulk import attempts:**
```sql
SELECT dt, validIsbns, skippedLines, totalLines, userId
FROM {{source:tbr-delta}}
WHERE event = 'bulk_import'
ORDER BY dt DESC
LIMIT 100
```

**Bulk import success rate by day:**
```sql
SELECT
  DATE_TRUNC('day', dt) as day,
  COUNT(*) as total_imports,
  AVG(validIsbns) as avg_books_per_import,
  AVG(skippedLines) as avg_skipped_lines,
  ROUND(100.0 * AVG(validIsbns) / AVG(totalLines), 2) as parse_success_rate_pct
FROM {{source:tbr-delta}}
WHERE event = 'bulk_import'
GROUP BY day
ORDER BY day DESC;
```

**Imports with high skip rates (potential parsing issues):**
```sql
SELECT dt, totalLines, validIsbns, skippedLines, userId,
  ROUND(100.0 * skippedLines / totalLines, 2) as skip_rate_pct
FROM {{source:tbr-delta}}
WHERE event = 'bulk_import'
  AND skippedLines > 5
  AND (skippedLines / totalLines) > 0.2  -- More than 20% skipped
ORDER BY skip_rate_pct DESC
LIMIT 50;
```

## Goodreads Import Queries

**All Goodreads import attempts:**
```sql
SELECT dt, phase, totalBooks, imported, skipped, failed, durationMs, userId
FROM {{source:tbr-delta}}
WHERE event = 'goodreads_import'
ORDER BY dt DESC
LIMIT 100
```

**Goodreads import success metrics:**
```sql
SELECT
  COUNT(*) as total_imports,
  AVG(totalBooks) as avg_books_per_import,
  AVG(imported) as avg_imported,
  AVG(failed) as avg_failed,
  AVG(skipped) as avg_skipped,
  AVG(durationMs) as avg_duration_ms,
  ROUND(100.0 * AVG(imported) / AVG(totalBooks), 2) as import_success_rate_pct
FROM {{source:tbr-delta}}
WHERE event = 'goodreads_import' AND phase = 'complete';
```

**Failed Goodreads imports for investigation:**
```sql
SELECT dt, totalBooks, imported, failed, skipped, durationMs, userId
FROM {{source:tbr-delta}}
WHERE event = 'goodreads_import'
  AND phase = 'complete'
  AND failed > 0
ORDER BY failed DESC, dt DESC
LIMIT 50;
```

**Slow imports (performance investigation):**
```sql
SELECT dt, totalBooks, imported, durationMs, userId,
  ROUND(durationMs / totalBooks, 0) as ms_per_book
FROM {{source:tbr-delta}}
WHERE event = 'goodreads_import'
  AND phase = 'complete'
  AND durationMs > 30000  -- Longer than 30 seconds
ORDER BY durationMs DESC
LIMIT 50;
```

**Shelf creation patterns:**
```sql
SELECT dt, totalBooks, imported, shelvesCreated, createShelves, userId
FROM {{source:tbr-delta}}
WHERE event = 'goodreads_import'
  AND phase = 'complete'
ORDER BY shelvesCreated DESC
LIMIT 50;
```

**Import performance over time:**
```sql
SELECT
  DATE_TRUNC('day', dt) as day,
  COUNT(*) as imports,
  AVG(totalBooks) as avg_books,
  AVG(durationMs) as avg_duration_ms,
  AVG(durationMs / totalBooks) as avg_ms_per_book
FROM {{source:tbr-delta}}
WHERE event = 'goodreads_import' AND phase = 'complete'
GROUP BY day
ORDER BY day DESC;
```

## Notes

- **Import Types**: Use `event` field to distinguish:
  - `bulk_import` = CSV/TXT file detection
  - `goodreads_import` = Full Goodreads import with shelves
- **Phase Field**: Goodreads imports have `phase`:
  - `start` = Import initiated
  - `complete` = Import finished (check `imported`/`failed` counts)
- **User Privacy**: `userId` is phone number - use carefully in queries
- **Performance**: `durationMs` helps identify timeout risks
```

---

## Implementation Checklist Updates

### Phase 1 Additional Tasks

Add to `docs/designs/BULK_IMPORT_PLAN.md`:

```markdown
### 1.1.5 Backend: Define Response Types (10 min)

**Create type definitions file**:
```typescript
// src/lib/server/types/bulk-import.ts
export interface DetectionMetadata {
  totalLines: number;
  validIsbns: number;
  skippedLines: number;
  duplicatesRemoved?: number;
}

export interface DetectionResponse {
  success: true;
  detected: DetectedBook[];
  metadata?: DetectionMetadata;
}
```

**Update detect endpoint** to return typed response with metadata
**Update frontend** to capture and display metadata

---

### 2.1.5 Backend: Add Shelf Name Collision Prevention (20 min)

**Create utility**: `generateUniqueShelfName()` in `goodreads-parser.ts`
**Update import endpoint**: Use unique name generator for 'rename' strategy
**Add tests**: Verify collision prevention works correctly
```

---

## Summary of Wiring Tasks

### 1. Detection Metadata Plumbing ✅ Specified
- [ ] Define `DetectionMetadata` interface
- [ ] Update backend to return metadata in response
- [ ] Update frontend to capture metadata state
- [ ] Add UI warning component for `skippedLines > 0`

### 2. Shelf Rename Collision Prevention ✅ Specified
- [ ] Create `generateUniqueShelfName()` utility
- [ ] Handle incremental suffixes: "(imported 2)", "(imported 3)"
- [ ] Update import endpoint to use unique name generator
- [ ] Add UI preview showing actual name that will be created
- [ ] Test collision scenarios

### 3. Logtail Queries Integration ✅ Specified
- [ ] Add bulk import queries to `docs/logtail-queries.md`
- [ ] Add Goodreads import queries
- [ ] Add performance monitoring queries
- [ ] Test queries in Logtail dashboard
- [ ] Document query usage in import endpoints

---

## Testing Strategy

### Detection Metadata Testing
```typescript
// Test file: src/routes/api/books/detect/__tests__/file-detection.test.ts

describe('File Detection with Metadata', () => {
  it('returns metadata for valid CSV', async () => {
    const csv = `ISBN\n9780547928227\n9780140449136\ninvalid-isbn`;
    const response = await POST({ type: 'file', content: csv });

    expect(response.metadata).toEqual({
      totalLines: 4,
      validIsbns: 2,
      skippedLines: 1
    });
  });

  it('counts duplicates correctly', async () => {
    const csv = `9780547928227\n9780547928227\n9780140449136`;
    const response = await POST({ type: 'file', content: csv });

    expect(response.metadata.validIsbns).toBe(2);  // Deduplicated
    expect(response.metadata.duplicatesRemoved).toBe(1);
  });
});
```

### Shelf Collision Testing
```typescript
// Test file: src/lib/server/__tests__/shelf-naming.test.ts

describe('generateUniqueShelfName', () => {
  it('returns base name if available', async () => {
    const name = await generateUniqueShelfName('sci-fi', userId, supabase);
    expect(name).toBe('sci-fi');
  });

  it('adds (imported) suffix if base exists', async () => {
    // Setup: create 'sci-fi' shelf
    await createShelf('sci-fi', userId);

    const name = await generateUniqueShelfName('sci-fi', userId, supabase);
    expect(name).toBe('sci-fi (imported)');
  });

  it('adds incremental suffix if (imported) exists', async () => {
    // Setup: create both 'sci-fi' and 'sci-fi (imported)'
    await createShelf('sci-fi', userId);
    await createShelf('sci-fi (imported)', userId);

    const name = await generateUniqueShelfName('sci-fi', userId, supabase);
    expect(name).toBe('sci-fi (imported 2)');
  });
});
```

---

All three implementation details are now fully specified and ready to wire up during implementation! 🎯