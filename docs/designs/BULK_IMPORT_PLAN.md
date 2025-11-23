# Bulk ISBN Import Implementation Plan

## Overview
Allow users to import multiple books at once via CSV/TXT files or pasted text containing ISBNs.

**Target Use Case**: Goodreads migration (but works for any ISBN list)

---

## Phase 1: Simple Bulk Import (MVP)
**Goal**: Import books from CSV/TXT files containing ISBNs
**Time**: ~2 hours
**Complexity**: Low

### Features
- ✅ Accept CSV and TXT file uploads
- ✅ Parse ISBNs from any column/line
- ✅ Skip invalid ISBNs automatically
- ✅ Batch import up to 100 books
- ✅ Show progress indicator
- ✅ Report success/failure counts

### Implementation Steps

#### **1.1 Backend: Add File Type to Detect API** (30 min)
**File**: `src/routes/api/books/detect/+server.ts`

**Changes**:
```typescript
// Add after line 102 (after image type handling)
else if (type === 'file') {
	const text = content as string;

	// Parse file for ISBNs (handles CSV, TXT, newline/comma/semicolon separated)
	const lines = text.split(/[\n\r]+/);
	const isbnSet = new Set<string>(); // O(1) lookups for deduplication
	const headerRegex = /^(isbn|title|author|book)/i; // Compile once
	let skippedLines = 0;

	for (const line of lines) {
		// Skip empty lines and common CSV headers
		const trimmed = line.trim();
		if (!trimmed) continue;
		if (headerRegex.test(trimmed)) continue;

		// Extract all potential ISBNs from the line (handles CSV columns)
		const tokens = trimmed.split(/[,;\t|]/);
		let foundValidIsbn = false;

		for (const token of tokens) {
			const cleaned = token.replace(/[^0-9Xx]/g, '');
			if (cleaned.length === 10 || cleaned.length === 13) {
				try {
					const isbn13 = toISBN13(cleaned);
					isbnSet.add(isbn13); // Automatic deduplication via Set
					foundValidIsbn = true;
				} catch {
					// Invalid ISBN checksum - continue checking other tokens
				}
			}
		}

		// Track lines with no valid ISBNs for user feedback
		if (!foundValidIsbn && trimmed.length > 5) {
			skippedLines++;
		}
	}

	if (isbnSet.size === 0) {
		return json({ error: 'No valid ISBNs found in file' }, { status: 400 });
	}

	// Limit to prevent abuse and timeout
	if (isbnSet.size > 100) {
		return json({
			error: `Too many ISBNs (${isbnSet.size}). Maximum is 100 per import.`,
			count: isbnSet.size
		}, { status: 400 });
	}

	isbns = Array.from(isbnSet);

	// Return metadata about parsing for user feedback
	return json({
		success: true,
		detected: await fetchMetadataForISBNs(isbns),
		metadata: {
			totalLines: lines.length,
			validIsbns: isbnSet.size,
			skippedLines
		}
	});
}
```

**Edge Cases**:
- ✅ Deduplicates ISBNs automatically
- ✅ Skips invalid ISBNs without failing entire import
- ✅ Handles various separators (comma, semicolon, pipe, tab, newline)
- ✅ Ignores common CSV headers
- ✅ Limits to 100 books to prevent timeout/abuse

---

#### **1.2 Frontend: Update File Type Detection** (15 min)
**File**: `src/routes/[username]/+page.svelte`

**Changes**:
```typescript
// Update detectInputType function (around line 337)
function detectInputType(text: string, file: File | null): 'text' | 'image' | 'file' | 'invalid' {
	if (file) {
		// Check file type
		if (file.type.startsWith('image/')) return 'image';

		// Accept CSV and text files
		if (file.type === 'text/csv' ||
			file.type === 'text/plain' ||
			file.name.endsWith('.csv') ||
			file.name.endsWith('.txt')) {
			return 'file';
		}

		return 'invalid';
	}
	const cleaned = text.trim();
	if (!cleaned) return 'invalid';
	return 'text';
}
```

---

#### **1.3 Frontend: Add Text File Reader** (15 min)
**File**: `src/routes/[username]/+page.svelte`

**Changes**:
```typescript
// Add after fileToBase64 function (around line 355)
async function fileToText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsText(file, 'UTF-8');
	});
}
```

---

#### **1.4 Frontend: Update detectBooks Function** (15 min)
**File**: `src/routes/[username]/+page.svelte`

**Changes**:
```typescript
// Update detectBooks function (around line 357)
async function detectBooks() {
	detectError = null;
	detectedBooks = [];
	selectedBookIds = new Set();

	const inputType = detectInputType(inputText, selectedFile);
	if (inputType === 'invalid') {
		detectError = selectedFile
			? 'Please upload a valid image, CSV, or TXT file'
			: 'Please enter a valid ISBN, Amazon URL, or text query';
		return;
	}

	isDetecting = true;
	try {
		let content: string;
		if (inputType === 'image') {
			content = await fileToBase64(selectedFile!);
		} else if (inputType === 'file') {
			content = await fileToText(selectedFile!);
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
		selectedBookIds = new Set(detectedBooks.map((b) => b.isbn13));
	} catch (error) {
		console.error('Detection error:', error);
		detectError = 'Network error. Please try again.';
	} finally {
		isDetecting = false;
	}
}
```

---

#### **1.5 Frontend: Update File Input Accept Attribute** (5 min)
**File**: `src/routes/[username]/+page.svelte`

**Changes**:
```svelte
<!-- Update file input (search for: type="file") -->
<input
	type="file"
	accept="image/*,.csv,.txt"
	class="hidden"
	bind:this={fileInput}
	onchange={handleFileSelect}
/>
```

---

#### **1.6 Frontend: Add Format Hints in UI** (10 min)
**File**: `src/routes/[username]/+page.svelte`

**Changes**:
```svelte
<!-- Add after the file upload drop zone (search for: "Drop image here") -->
<div class="mt-3 text-xs text-gray-600 space-y-2">
	<p class="font-medium">Supported formats:</p>
	<ul class="list-disc list-inside ml-2 space-y-1">
		<li>Images: Photos of book barcodes (JPEG, PNG)</li>
		<li>CSV/TXT files: One ISBN per line or Goodreads export</li>
		<li>Text: ISBN, Amazon URL, or book title/author</li>
	</ul>
	<p class="text-gray-500 italic">
		💡 Tip: Export your Goodreads library and upload the CSV!
	</p>
</div>
```

---

#### **1.7 Testing** (30 min)

**Test Cases**:

1. **Simple text file**:
```txt
9780547928227
9780140449136
9780061120084
```

2. **CSV with one column**:
```csv
ISBN
9780547928227
9780140449136
9780061120084
```

3. **CSV with multiple columns**:
```csv
Title,ISBN13,Author
The Hobbit,9780547928227,Tolkien
The Odyssey,9780140449136,Homer
```

4. **Goodreads export** (truncated):
```csv
Book Id,Title,Author,ISBN,ISBN13
13278990,The Housing Monster,prole.info,160486530X,9781604865301
7805,Pale Fire,Vladimir Nabokov,0141185260,9780141185262
```

5. **Mixed valid/invalid**:
```txt
9780547928227
not-an-isbn
9780140449136
12345
```

**Expected Results**:
- ✅ Valid ISBNs detected and metadata fetched
- ✅ Invalid ISBNs skipped silently
- ✅ Books appear in selection modal
- ✅ User can select/deselect books
- ✅ Selected books added successfully

---

### Phase 1 Complete Checklist
- [ ] Backend accepts `type: 'file'`
- [ ] Backend parses ISBNs from any format
- [ ] Backend deduplicates ISBNs
- [ ] Backend limits to 100 books
- [ ] Frontend detects CSV/TXT files
- [ ] Frontend reads text file contents
- [ ] Frontend file input accepts `.csv,.txt`
- [ ] UI shows format hints
- [ ] Tested with sample files
- [ ] Tested with Goodreads export
- [ ] Updated DEVLOG.md

---

## Critical Issues & Solutions

### Issue 1: O(n²) Deduplication Performance
**Problem**: Using `parsedIsbns.includes(isbn13)` in loop causes O(n²) complexity
**Solution**: Use `Set<string>` for O(1) lookups (implemented above)
**Impact**: 1000-ISBN file: ~500ms vs ~5000ms

### Issue 2: Silent Row Skipping
**Problem**: Invalid rows vanish without user feedback
**Solution**: Track `skippedLines` and return in response metadata
**UI Update Required**:
```svelte
{#if detectionMetadata?.skippedLines > 0}
  <div class="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 mb-2">
    ⚠️ Skipped {detectionMetadata.skippedLines} lines with invalid ISBNs
  </div>
{/if}
```

### Issue 3: Rate Limiting Causes Timeouts
**Problem**: 100 books × 1 sec = 100+ seconds, Vercel timeout = 10s
**Solution Phase 1.5**: Batch metadata fetching (5-10 parallel requests)
**Solution Phase 2**: Background job for imports >20 books

**Immediate Fix** (Add to Phase 1):
```typescript
// Batch metadata fetching with concurrency limit
async function fetchMetadataInBatches(
  isbns: string[],
  concurrency = 5
): Promise<BookMetadata[]> {
  const results: BookMetadata[] = [];

  for (let i = 0; i < isbns.length; i += concurrency) {
    const batch = isbns.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(isbn => fetchBookMetadata(isbn))
    );
    results.push(...batchResults.filter(Boolean));

    // Small delay between batches to respect rate limits
    if (i + concurrency < isbns.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}
```

**Revised Limits**:
- Phase 1: 50 books max (safe for 10s timeout)
- Phase 2: Background job for 50+ books

### Issue 4: CSV Parsing Edge Cases
**Problem**: Current parser assumes simple quoting, may break on:
- Escaped quotes: `"Title with ""quotes"""`
- Goodreads quirks: `="9780547928227"`
- Multi-line quoted fields

**Solution**: Add unit tests + robust CSV parser

**Test File** (`src/lib/server/__tests__/csv-parser.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { parseCSVLine } from '../goodreads-parser';

describe('CSV Line Parser', () => {
  it('handles simple comma-separated values', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('handles escaped quotes', () => {
    expect(parseCSVLine('a,"b""c",d')).toEqual(['a', 'b"c', 'd']);
  });

  it('handles Goodreads ISBN format', () => {
    expect(parseCSVLine('123,="9780547928227",Title'))
      .toEqual(['123', '="9780547928227"', 'Title']);
    // Then clean in caller: .replace(/^="?/, '').replace(/"?$/, '')
  });

  it('handles trailing commas', () => {
    expect(parseCSVLine('a,b,c,')).toEqual(['a', 'b', 'c', '']);
  });
});
```

### Issue 5: Shelf Name Conflicts
**Problem**: User has existing "read" shelf; Goodreads also has "read"
**Solution**: Shelf merge strategy with user control

**UI Update**:
```svelte
{#if conflictingShelves.length > 0}
  <div class="bg-amber-50 border border-amber-200 rounded p-3 mb-3">
    <p class="text-sm font-medium text-amber-800 mb-2">
      ⚠️ Shelf Conflicts Detected
    </p>
    {#each conflictingShelves as shelf}
      <div class="flex items-center gap-2 mb-2">
        <span class="text-sm">"{shelf.name}" already exists</span>
        <select bind:value={shelf.strategy} class="text-xs border rounded px-2 py-1">
          <option value="merge">Merge books into existing</option>
          <option value="rename">Create "{shelf.name} (imported)"</option>
          <option value="skip">Skip this shelf</option>
        </select>
      </div>
    {/each}
  </div>
{/if}
```

**Backend Logic**:
```typescript
// In Goodreads import endpoint
for (const shelfName of uniqueShelves) {
  const strategy = options.shelfStrategies?.[shelfName] || 'merge';

  let finalName = shelfName;
  if (strategy === 'rename') {
    finalName = `${shelfName} (imported)`;
  } else if (strategy === 'skip') {
    continue;
  }

  const { data: shelf } = await supabase
    .from('shelves')
    .upsert(
      { user_id: userId, name: finalName },
      { onConflict: 'user_id,name', ignoreDuplicates: false }
    )
    .select()
    .single();

  shelfMap.set(shelfName, shelf.id);
}
```

### Issue 6: Sequential Supabase Inserts
**Problem**: 100 books = 100+ round trips = slow + timeout risk
**Solution**: Batch inserts using Supabase batch operations

**Optimized Insert** (Phase 2):
```typescript
// Batch insert books (up to 1000 per batch)
const booksToInsert = metadataResults.map((meta, i) => ({
  user_id: userId,
  isbn13: isbns[i],
  title: meta.title,
  author: meta.author,
  publisher: meta.publisher,
  publication_date: meta.publicationDate,
  description: meta.description,
  cover_url: meta.coverUrl,
  is_read: preserveReadStatus ? goodreadsBooks[i]?.isRead : false
}));

// Single batch insert
const { data: insertedBooks, error } = await supabase
  .from('books')
  .upsert(booksToInsert, { onConflict: 'user_id,isbn13' })
  .select();

// Batch insert book_shelves relationships
const bookShelfRelations = [];
insertedBooks.forEach((book, i) => {
  const goodreadsBook = goodreadsBooks[i];
  goodreadsBook.shelves.forEach(shelfName => {
    const shelfId = shelfMap.get(shelfName);
    if (shelfId) {
      bookShelfRelations.push({
        book_id: book.id,
        shelf_id: shelfId
      });
    }
  });
});

await supabase
  .from('book_shelves')
  .upsert(bookShelfRelations, { onConflict: 'book_id,shelf_id', ignoreDuplicates: true });
```

**Performance Improvement**:
- Before: 100 books = 200+ queries = 10-20 seconds
- After: 100 books = 3 queries = <2 seconds

### Issue 7: Observable Metrics & Instrumentation
**Problem**: No visibility into import success rates post-release
**Solution**: Add structured logging + metrics

**Logging Integration**:
```typescript
import { logger } from '$lib/server/logging';

// In detect endpoint
logger.info('file_import_detected', {
  event: 'bulk_import',
  type: 'detect',
  totalLines: lines.length,
  validIsbns: isbnSet.size,
  skippedLines,
  source: 'web',
  userId: request.headers.get('x-user-id') // from session
});

// In Goodreads import endpoint
logger.info('goodreads_import_started', {
  event: 'goodreads_import',
  phase: 'start',
  totalBooks: goodreadsBooks.length,
  createShelves: options.createShelves,
  userId: options.userId
});

// After completion
logger.info('goodreads_import_completed', {
  event: 'goodreads_import',
  phase: 'complete',
  totalBooks: goodreadsBooks.length,
  imported: results.imported,
  skipped: results.skipped,
  failed: results.failed,
  shelvesCreated: results.shelvesCreated.length,
  durationMs: Date.now() - startTime,
  userId: options.userId
});
```

**Logtail Queries** (Add to `docs/logtail-queries.md`):
```sql
-- Bulk import success rate
SELECT
  DATE_TRUNC('day', dt) as day,
  COUNT(*) as total_imports,
  AVG(validIsbns) as avg_books_per_import,
  AVG(skippedLines) as avg_skipped_lines
FROM {{source:tbr-delta}}
WHERE event = 'bulk_import'
GROUP BY day
ORDER BY day DESC;

-- Goodreads import metrics
SELECT
  COUNT(*) as total_imports,
  AVG(totalBooks) as avg_books,
  AVG(imported) as avg_imported,
  AVG(failed) as avg_failed,
  AVG(durationMs) as avg_duration_ms,
  ROUND(100.0 * AVG(imported) / AVG(totalBooks), 2) as success_rate_pct
FROM {{source:tbr-delta}}
WHERE event = 'goodreads_import' AND phase = 'complete';

-- Failed imports investigation
SELECT dt, totalBooks, imported, failed, userId
FROM {{source:tbr-delta}}
WHERE event = 'goodreads_import'
  AND phase = 'complete'
  AND failed > 0
ORDER BY dt DESC
LIMIT 50;
```

### Issue 8: Missing Backlog Items
**Problem**: Phase 2/3 tasks might get lost
**Solution**: Update TODO.md now

**Add to TODO.md**:
```markdown
## Phase 2: Enhanced Goodreads Import
- [ ] Create Goodreads parser utility with unit tests
- [ ] Add CSV line parser with quote handling
- [ ] Create /api/books/import-goodreads endpoint
- [ ] Implement batch Supabase inserts
- [ ] Add shelf conflict resolution UI
- [ ] Add Goodreads detection in frontend
- [ ] Add import options UI (preserve shelves, read status)
- [ ] Test with real Goodreads export (>100 books)
- [ ] Add structured logging for metrics
- [ ] Update Logtail queries documentation

## Phase 3: Production Hardening
- [ ] Background job processing for 50+ books
- [ ] Progress indicator showing "X of Y books imported"
- [ ] Email notification on completion
- [ ] Incremental import (detect duplicates)
- [ ] Import history log (track past imports)
- [ ] Export to CSV (reverse operation)
- [ ] Support LibraryThing/StoryGraph formats
- [ ] Preserve import dates (date added, date read)
- [ ] Import ratings and reviews
- [ ] Automatic retry for failed books
```

---

## Revised Phase 1 Implementation (With Fixes)

### Updated Limits & Performance Targets
- **Max books**: 50 (down from 100) - safe for Vercel timeout
- **Concurrent metadata fetches**: 5 parallel requests
- **Total time target**: <10 seconds for 50 books
- **Performance**: O(n) parsing with Set deduplication

### Required Changes Summary
1. ✅ Use Set for deduplication (O(1) vs O(n))
2. ✅ Return skippedLines metadata
3. ✅ Add skipped lines warning in UI
4. ✅ Batch metadata fetching (5 concurrent)
5. ✅ Lower limit to 50 books
6. ✅ Add structured logging
7. ✅ Add unit tests for CSV parsing
8. ✅ Update TODO.md with backlog items

---

## Phase 2: Enhanced Goodreads Import
**Goal**: Preserve Goodreads shelves and read status during import
**Time**: ~3 hours
**Complexity**: Medium

### Features
- ✅ Detect Goodreads CSV format automatically
- ✅ Parse shelf names from `Bookshelves` column
- ✅ Parse read status from `Exclusive Shelf` column
- ✅ Option to create matching shelves
- ✅ Auto-assign books to shelves after import
- ✅ Preserve read/unread status
- ✅ Show shelf mapping preview before import

### Implementation Steps

#### **2.1 Backend: Add Goodreads-Specific Parsing** (1 hour)
**New File**: `src/lib/server/goodreads-parser.ts`

```typescript
import { toISBN13 } from './metadata';

export interface GoodreadsBook {
	isbn13: string;
	title: string;
	author: string;
	shelves: string[];
	exclusiveShelf: 'read' | 'to-read' | 'currently-reading' | null;
	isRead: boolean;
	dateRead?: string;
	rating?: number;
}

export function isGoodreadsCSV(csvContent: string): boolean {
	const firstLine = csvContent.split('\n')[0].toLowerCase();
	// Check for Goodreads-specific headers
	return firstLine.includes('book id') &&
	       firstLine.includes('exclusive shelf') &&
	       firstLine.includes('bookshelves');
}

export function parseGoodreadsCSV(csvContent: string): GoodreadsBook[] {
	const lines = csvContent.split('\n');
	if (lines.length < 2) return [];

	// Parse header
	const headers = parseCSVLine(lines[0]).map(h => h.trim());
	const getIndex = (name: string) => headers.findIndex(h =>
		h.toLowerCase().includes(name.toLowerCase())
	);

	const titleIdx = getIndex('title');
	const authorIdx = getIndex('author');
	const isbn13Idx = getIndex('isbn13');
	const isbnIdx = getIndex('isbn');
	const shelvesIdx = getIndex('bookshelves');
	const exclusiveIdx = getIndex('exclusive shelf');
	const dateReadIdx = getIndex('date read');
	const ratingIdx = getIndex('my rating');

	const books: GoodreadsBook[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = parseCSVLine(lines[i]);
		if (values.length < headers.length / 2) continue; // Skip incomplete rows

		// Get ISBN (prefer ISBN13, fallback to ISBN10)
		let isbn = values[isbn13Idx] || values[isbnIdx];
		if (!isbn) continue;

		// Clean ISBN (Goodreads uses ="123456789" format)
		isbn = isbn.replace(/^="?/, '').replace(/"?$/, '').replace(/[^0-9Xx]/g, '');

		try {
			const isbn13 = toISBN13(isbn);
			const exclusiveShelf = values[exclusiveIdx]?.trim() as any;

			books.push({
				isbn13,
				title: values[titleIdx]?.trim() || 'Unknown',
				author: values[authorIdx]?.trim() || 'Unknown',
				shelves: values[shelvesIdx]
					?.split(',')
					.map(s => s.trim())
					.filter(s => s && s !== exclusiveShelf) || [],
				exclusiveShelf: ['read', 'to-read', 'currently-reading'].includes(exclusiveShelf)
					? exclusiveShelf
					: null,
				isRead: exclusiveShelf === 'read',
				dateRead: values[dateReadIdx]?.trim() || undefined,
				rating: parseInt(values[ratingIdx]) || undefined
			});
		} catch {
			// Skip invalid ISBN
		}
	}

	return books;
}

function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	result.push(current.trim());
	return result;
}
```

---

#### **2.2 Backend: New Goodreads Import Endpoint** (1 hour)
**New File**: `src/routes/api/books/import-goodreads/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import { supabase } from '$lib/server/supabase';
import { parseGoodreadsCSV, isGoodreadsCSV } from '$lib/server/goodreads-parser';
import { fetchBookMetadata } from '$lib/server/metadata';

interface ImportOptions {
	userId: string;
	csvContent: string;
	createShelves: boolean;
	preserveReadStatus: boolean;
	targetShelfId?: string; // Optional: put all books in specific shelf
}

export const POST = async ({ request }: any) => {
	try {
		const options: ImportOptions = await request.json();

		// Validate Goodreads format
		if (!isGoodreadsCSV(options.csvContent)) {
			return json({ error: 'Not a valid Goodreads export CSV' }, { status: 400 });
		}

		// Parse CSV
		const goodreadsBooks = parseGoodreadsCSV(options.csvContent);

		if (goodreadsBooks.length === 0) {
			return json({ error: 'No valid books found in CSV' }, { status: 400 });
		}

		// Track results
		const results = {
			total: goodreadsBooks.length,
			imported: 0,
			skipped: 0,
			failed: 0,
			shelvesCreated: [] as string[]
		};

		// Create shelves if requested
		const shelfMap = new Map<string, string>();
		if (options.createShelves) {
			const uniqueShelves = new Set<string>();
			goodreadsBooks.forEach(b => {
				b.shelves.forEach(s => uniqueShelves.add(s));
				if (b.exclusiveShelf) uniqueShelves.add(b.exclusiveShelf);
			});

			for (const shelfName of uniqueShelves) {
				if (!shelfName) continue;

				// Upsert shelf (create if doesn't exist)
				const { data: shelf, error } = await supabase
					.from('shelves')
					.upsert(
						{ user_id: options.userId, name: shelfName },
						{ onConflict: 'user_id,name', ignoreDuplicates: false }
					)
					.select()
					.single();

				if (!error && shelf) {
					shelfMap.set(shelfName, shelf.id);
					results.shelvesCreated.push(shelfName);
				}
			}
		}

		// Import books with rate limiting (to prevent Google Books API issues)
		for (let i = 0; i < goodreadsBooks.length; i++) {
			const book = goodreadsBooks[i];

			try {
				// Fetch metadata from Google Books
				const metadata = await fetchBookMetadata(book.isbn13);

				if (!metadata) {
					results.skipped++;
					continue;
				}

				// Insert book (using upsert to handle duplicates)
				const { data: bookData, error: bookError } = await supabase
					.from('books')
					.upsert(
						{
							user_id: options.userId,
							isbn13: book.isbn13,
							title: metadata.title,
							author: metadata.author,
							publisher: metadata.publisher,
							publication_date: metadata.publicationDate,
							description: metadata.description,
							cover_url: metadata.coverUrl,
							is_read: options.preserveReadStatus ? book.isRead : false,
							is_owned: false
						},
						{ onConflict: 'user_id,isbn13' }
					)
					.select()
					.single();

				if (bookError) {
					console.error('Failed to insert book:', bookError);
					results.failed++;
					continue;
				}

				// Assign to shelves
				if (options.createShelves && bookData) {
					const allShelves = [...book.shelves];
					if (book.exclusiveShelf) allShelves.push(book.exclusiveShelf);

					for (const shelfName of allShelves) {
						const shelfId = shelfMap.get(shelfName);
						if (shelfId) {
							await supabase
								.from('book_shelves')
								.upsert(
									{ book_id: bookData.id, shelf_id: shelfId },
									{ onConflict: 'book_id,shelf_id', ignoreDuplicates: true }
								);
						}
					}
				} else if (options.targetShelfId && bookData) {
					// Add to single target shelf
					await supabase
						.from('book_shelves')
						.upsert(
							{ book_id: bookData.id, shelf_id: options.targetShelfId },
							{ onConflict: 'book_id,shelf_id', ignoreDuplicates: true }
						);
				}

				results.imported++;

				// Rate limit: 1 request per second to be safe with Google Books API
				if (i < goodreadsBooks.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			} catch (error) {
				console.error('Error importing book:', error);
				results.failed++;
			}
		}

		return json({ success: true, results });
	} catch (error) {
		console.error('Goodreads import error:', error);
		return json({ error: 'Import failed' }, { status: 500 });
	}
};
```

---

#### **2.3 Frontend: Add Goodreads Import UI** (1 hour)
**File**: `src/routes/[username]/+page.svelte`

**Changes**:

1. Add state for Goodreads detection:
```typescript
let isGoodreadsFile = $state(false);
let goodreadsShelvesPreview = $state<string[]>([]);
let importOptions = $state({
	createShelves: true,
	preserveReadStatus: true
});
```

2. Update file selection to detect Goodreads:
```typescript
function handleFileSelect(e: Event) {
	const target = e.target as HTMLInputElement;
	if (target.files && target.files[0]) {
		selectedFile = target.files[0];
		inputText = '';

		// Check if it's a Goodreads file
		if (selectedFile.name.includes('goodreads')) {
			isGoodreadsFile = true;
		}

		detectBooks();
	}
}
```

3. Add Goodreads-specific UI in modal:
```svelte
{#if isGoodreadsFile && detectedBooks.length > 0}
	<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
		<h4 class="font-semibold text-blue-900 mb-2 flex items-center gap-2">
			📚 Goodreads Import Detected
		</h4>
		<p class="text-sm text-blue-800 mb-3">
			Found {detectedBooks.length} books in your Goodreads export.
		</p>

		<div class="space-y-2">
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={importOptions.createShelves}
					class="rounded"
				/>
				<span>Create shelves from Goodreads (preserves organization)</span>
			</label>

			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={importOptions.preserveReadStatus}
					class="rounded"
				/>
				<span>Mark books as read/unread based on Goodreads status</span>
			</label>
		</div>

		{#if goodreadsShelvesPreview.length > 0}
			<div class="mt-3 pt-3 border-t border-blue-200">
				<p class="text-xs text-blue-700 font-medium mb-1">
					Shelves to create:
				</p>
				<div class="flex flex-wrap gap-1">
					{#each goodreadsShelvesPreview as shelf}
						<span class="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
							{shelf}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}
```

---

### Phase 2 Complete Checklist
- [ ] Goodreads parser utility created
- [ ] CSV line parser handles quoted fields
- [ ] Goodreads import endpoint created
- [ ] Shelf creation logic implemented
- [ ] Read status preservation implemented
- [ ] Rate limiting added (1 req/sec)
- [ ] Frontend detects Goodreads files
- [ ] Import options UI added
- [ ] Shelf preview shown
- [ ] Progress indicator added
- [ ] Tested with real Goodreads export
- [ ] Updated DEVLOG.md

---

## Deployment Checklist

### Before Shipping
- [ ] Test Phase 1 with various CSV formats
- [ ] Test Phase 1 with 100-book file
- [ ] Test error handling (invalid file, network error)
- [ ] Test Phase 2 with real Goodreads export
- [ ] Verify shelf creation works
- [ ] Verify read status preservation works
- [ ] Check rate limiting doesn't timeout
- [ ] Update user documentation
- [ ] Add changelog entry

### Post-Deployment Monitoring
- [ ] Monitor Google Books API usage
- [ ] Check for timeout errors
- [ ] Monitor import success rates
- [ ] Gather user feedback on Goodreads import

---

## Future Enhancements (Phase 3+)

### Nice-to-Haves
- [ ] Progress bar showing "Importing book X of Y..."
- [ ] Background job processing for large imports (500+ books)
- [ ] Export to CSV (reverse operation)
- [ ] Support for other formats (LibraryThing, StoryGraph)
- [ ] Dry-run mode (preview before importing)
- [ ] Import history log
- [ ] Automatic retry for failed books
- [ ] Email notification when import completes

### Advanced Features
- [ ] Incremental imports (detect duplicates)
- [ ] Merge with existing books
- [ ] Preserve dates (date added, date read)
- [ ] Import ratings
- [ ] Import reviews/notes
- [ ] Map Goodreads shelves to existing TBR shelves

---

## Testing Data

### Sample Goodreads CSV (Minimal)
```csv
Book Id,Title,Author,ISBN,ISBN13,Bookshelves,Exclusive Shelf
13278990,The Housing Monster,prole.info,160486530X,9781604865301,favorites,read
7805,Pale Fire,Vladimir Nabokov,0141185260,9780141185262,to-read,to-read
18144590,The Hobbit,J.R.R. Tolkien,054792822X,9780547928227,"fantasy,classics",read
```

### Sample Generic CSV
```csv
ISBN
9780547928227
9780140449136
9780061120084
```

### Sample TXT
```
9780547928227
9780140449136
9780061120084
```

---

## Success Metrics

### Phase 1
- ✅ User can upload CSV/TXT with ISBNs
- ✅ System correctly parses 95%+ of ISBNs
- ✅ Import completes in <5 minutes for 100 books
- ✅ Clear error messages for invalid files

### Phase 2
- ✅ Goodreads exports detected automatically
- ✅ Shelves created with correct names
- ✅ Books assigned to correct shelves
- ✅ Read status preserved accurately
- ✅ User satisfaction with migration experience

---

## Risk Mitigation

### Google Books API Rate Limits
- **Risk**: API throttling or quota exhaustion
- **Mitigation**: 1-second delay between requests, 100-book limit
- **Fallback**: Show error message, allow retry

### Large File Timeouts
- **Risk**: Import times out for 100+ books
- **Mitigation**: Phase 1 limits to 100 books
- **Future**: Background job processing (Phase 3)

### Goodreads Format Changes
- **Risk**: Goodreads changes CSV format
- **Mitigation**: Graceful degradation to simple ISBN parsing
- **Monitoring**: Log parsing failures for investigation

---

## Documentation Updates

### Add to User-Facing Docs
```markdown
## Importing from Goodreads

1. Export your Goodreads library:
   - Go to My Books → Import/Export
   - Click "Export Library"
   - Save the CSV file

2. Import to TBR:
   - Click the "+" button on your shelf
   - Upload the CSV file
   - Choose whether to preserve shelves
   - Wait for import to complete (~1 minute per 50 books)

**What Gets Imported:**
- ✅ All books with ISBNs
- ✅ Shelf organization (optional)
- ✅ Read/unread status (optional)
- ❌ Ratings (coming soon)
- ❌ Reviews (coming soon)
```
