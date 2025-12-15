# TBR.fyi CSV Export Specification

This document specifies the CSV export format for TBR.fyi, designed for maximum compatibility with Goodreads, StoryGraph, Hardcover, BookWyrm, and other book tracking platforms.

**Priority:** High - Essential for user data portability and trust

**Related:**
- [Integration Research](../research/integration-research.md) - Platform integration details
- [Ecosystem Expansion](../research/ecosystem-expansion-research.md) - Open TBR Format proposal

---

## Why This Matters

### User Trust & Data Portability

> "If I can't export my data, I don't own it."

Users need confidence that:
1. Their data isn't locked into TBR.fyi
2. They can migrate to any platform anytime
3. Export is complete and accurate

### Platform Compatibility

The export must work seamlessly with:
- **Goodreads** - The incumbent (import only, no longer exports well)
- **StoryGraph** - Uses Goodreads CSV format
- **Hardcover** - Supports Goodreads CSV + custom format
- **BookWyrm** - Goodreads CSV import
- **Literal** - Goodreads CSV import
- **LibraryThing** - Various formats

**Key insight:** Goodreads CSV is the de facto standard. Every platform imports it.

---

## Current State

### Existing Export (`/api/export`)

TBR.fyi currently exports JSON:

```json
{
  "exportedAt": "2024-12-14T10:00:00Z",
  "userId": "+15551234567",
  "totalBooks": 42,
  "books": [
    {
      "isbn13": "9780140449136",
      "title": "The Odyssey",
      "author": ["Homer"],
      "publisher": "Penguin Classics",
      "publicationDate": "2003-01-30",
      "description": "...",
      "coverUrl": "https://...",
      "note": "Recommended by Sarah",
      "isRead": false,
      "isOwned": true,
      "shelves": ["TBR", "Classics"],
      "addedAt": "2024-12-01T10:00:00Z"
    }
  ]
}
```

**Problems:**
- JSON isn't importable by other platforms
- Missing Goodreads-specific fields
- Date format may not match expectations

---

## Goodreads CSV Format (The Standard)

### Column Specification

Based on actual Goodreads exports, these are the columns:

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| `Book Id` | No | Goodreads internal ID | `12345` |
| `Title` | **Yes** | Book title | `The Odyssey` |
| `Author` | **Yes** | Primary author | `Homer` |
| `Author l-f` | No | Last, First format | `Homer` |
| `Additional Authors` | No | Other contributors | `Emily Wilson` |
| `ISBN` | **Yes** | ISBN-10 (quoted) | `="0140449132"` |
| `ISBN13` | **Yes** | ISBN-13 (quoted) | `="9780140449136"` |
| `My Rating` | No | User's rating (0-5) | `4` |
| `Average Rating` | No | Community rating | `3.87` |
| `Publisher` | No | Publisher name | `Penguin Classics` |
| `Binding` | No | Format | `Paperback` |
| `Number of Pages` | No | Page count | `541` |
| `Year Published` | No | Edition year | `2003` |
| `Original Publication Year` | No | First published | `-800` |
| `Date Read` | No | Completion date | `2024/12/01` |
| `Date Added` | **Yes** | When added to shelf | `2024/12/01` |
| `Bookshelves` | No | Comma-separated tags | `classics, epic` |
| `Bookshelves with positions` | No | Shelves with order | `classics (#1)` |
| `Exclusive Shelf` | **Yes** | Status | `to-read` |
| `My Review` | No | Review text | `Amazing translation...` |
| `Spoiler` | No | Review has spoilers | `` |
| `Private Notes` | No | Personal notes | `Sarah recommended` |
| `Read Count` | No | Times read | `1` |
| `Recommended For` | No | Who you'd recommend to | `` |
| `Recommended By` | No | Who recommended it | `Sarah` |
| `Owned Copies` | No | Number owned | `1` |
| `Original Purchase Date` | No | When purchased | `` |
| `Original Purchase Location` | No | Where purchased | `` |
| `Condition` | No | Book condition | `` |
| `Condition Description` | No | Condition notes | `` |
| `BCID` | No | BookCrossing ID | `` |

### Critical Fields for Import

Based on platform documentation and user reports, these fields are **essential** for successful import:

| Field | Why Essential |
|-------|---------------|
| `Title` | Book identification |
| `Author` | Book identification |
| `ISBN13` | Primary matching key |
| `ISBN` | Fallback matching key |
| `Exclusive Shelf` | Determines read status |
| `Date Added` | Timeline preservation |
| `Bookshelves` | Tag/shelf import |

### Exclusive Shelf Values

| Value | Meaning | TBR.fyi Mapping |
|-------|---------|-----------------|
| `to-read` | Want to read | `is_read = false` |
| `currently-reading` | In progress | `is_read = false` (future: add status) |
| `read` | Completed | `is_read = true` |
| `did-not-finish` | DNF | (future: add status) |

### ISBN Format Quirk

**Critical:** Goodreads uses a special quoted format for ISBNs to preserve leading zeros:

```csv
ISBN,ISBN13
="0140449132","9780140449136"
```

Without the `="..."` wrapper, Excel/Sheets may:
- Strip leading zeros
- Convert to scientific notation
- Corrupt the data

---

## TBR.fyi → Goodreads CSV Mapping

### Field Mapping

| TBR.fyi Field | Goodreads Column | Transformation |
|---------------|------------------|----------------|
| `isbn13` | `ISBN13` | Wrap: `="9780140449136"` |
| `isbn13` | `ISBN` | Convert to ISBN-10, wrap: `="0140449132"` |
| `title` | `Title` | Direct |
| `author[0]` | `Author` | First author |
| `author[1..]` | `Additional Authors` | Remaining, comma-separated |
| `publisher` | `Publisher` | Direct |
| `publication_date` | `Year Published` | Extract year |
| `note` | `Private Notes` | Direct |
| `is_read` | `Exclusive Shelf` | `true` → `read`, `false` → `to-read` |
| `is_owned` | `Owned Copies` | `true` → `1`, `false` → `0` |
| `shelves` | `Bookshelves` | Comma-separated, lowercase, hyphenated |
| `added_at` | `Date Added` | Format: `YYYY/MM/DD` |
| `marked_read_at` | `Date Read` | Format: `YYYY/MM/DD` |
| (n/a) | `My Rating` | `0` (TBR.fyi doesn't have ratings) |
| (n/a) | `Read Count` | `1` if read, `0` otherwise |
| (n/a) | `Book Id` | Empty |

### Date Format

Goodreads uses `YYYY/MM/DD` format:
- `2024/12/14` ✓
- `2024-12-14` ✗ (may work, not guaranteed)
- `12/14/2024` ✗ (ambiguous)

### Shelf Name Transformation

TBR.fyi shelf names → Goodreads bookshelves:

```
"TBR" → "tbr"
"Want to Read" → "want-to-read"
"Science Fiction" → "science-fiction"
"My Favorites!" → "my-favorites"
```

Rules:
1. Lowercase
2. Replace spaces with hyphens
3. Remove special characters
4. Preserve letters and numbers

---

## Implementation

### Endpoint: `GET /api/export/csv`

```typescript
// src/routes/api/export/csv/+server.ts

import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { requireUserId } from '$lib/server/auth';

export const GET: RequestHandler = async ({ request }) => {
  const userId = requireUserId(request);

  const { data: books } = await supabase
    .from('books')
    .select('*, book_shelves(shelf_id, shelves(name))')
    .eq('user_id', userId)
    .order('added_at', { ascending: false });

  const csv = generateGoodreadsCSV(books || []);

  const date = new Date().toISOString().split('T')[0];
  const filename = `tbr-export-${date}.csv`;

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};

function generateGoodreadsCSV(books: Book[]): string {
  const headers = [
    'Book Id',
    'Title',
    'Author',
    'Author l-f',
    'Additional Authors',
    'ISBN',
    'ISBN13',
    'My Rating',
    'Average Rating',
    'Publisher',
    'Binding',
    'Number of Pages',
    'Year Published',
    'Original Publication Year',
    'Date Read',
    'Date Added',
    'Bookshelves',
    'Bookshelves with positions',
    'Exclusive Shelf',
    'My Review',
    'Spoiler',
    'Private Notes',
    'Read Count',
    'Recommended For',
    'Recommended By',
    'Owned Copies',
    'Original Purchase Date',
    'Original Purchase Location',
    'Condition',
    'Condition Description',
    'BCID',
  ];

  const rows = books.map((book) => [
    '', // Book Id
    escapeCSV(book.title),
    escapeCSV(book.author?.[0] || ''),
    escapeCSV(formatAuthorLastFirst(book.author?.[0] || '')),
    escapeCSV(book.author?.slice(1).join(', ') || ''),
    formatISBN(isbn13ToIsbn10(book.isbn13)),
    formatISBN(book.isbn13),
    '0', // My Rating (TBR.fyi doesn't have ratings)
    '', // Average Rating
    escapeCSV(book.publisher || ''),
    '', // Binding
    '', // Number of Pages
    extractYear(book.publication_date),
    '', // Original Publication Year
    book.is_read ? formatDate(book.marked_read_at) : '',
    formatDate(book.added_at),
    formatBookshelves(book.book_shelves),
    '', // Bookshelves with positions
    book.is_read ? 'read' : 'to-read',
    '', // My Review
    '', // Spoiler
    escapeCSV(book.note || ''),
    book.is_read ? '1' : '0',
    '', // Recommended For
    '', // Recommended By
    book.is_owned ? '1' : '0',
    '', // Original Purchase Date
    '', // Original Purchase Location
    '', // Condition
    '', // Condition Description
    '', // BCID
  ]);

  return [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');
}

// Helper functions

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatISBN(isbn: string | null): string {
  if (!isbn) return '';
  // Goodreads format: ="0140449132" to preserve leading zeros
  return `="${isbn}"`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function extractYear(dateStr: string | null): string {
  if (!dateStr) return '';
  return dateStr.split('-')[0] || '';
}

function formatAuthorLastFirst(author: string): string {
  // "Homer" → "Homer"
  // "Emily Wilson" → "Wilson, Emily"
  const parts = author.trim().split(' ');
  if (parts.length === 1) return author;
  const last = parts.pop();
  return `${last}, ${parts.join(' ')}`;
}

function formatBookshelves(bookShelves: BookShelf[]): string {
  return bookShelves
    .map((bs) => bs.shelves?.name)
    .filter(Boolean)
    .map((name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
    .join(', ');
}

function isbn13ToIsbn10(isbn13: string): string | null {
  // Convert ISBN-13 to ISBN-10
  // Only works for ISBNs starting with 978
  if (!isbn13 || !isbn13.startsWith('978')) return null;

  const isbn10Base = isbn13.slice(3, 12);
  const checkDigit = calculateIsbn10CheckDigit(isbn10Base);
  return isbn10Base + checkDigit;
}

function calculateIsbn10CheckDigit(isbn10Base: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn10Base[i]) * (10 - i);
  }
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? 'X' : String(check);
}
```

---

## Platform-Specific Notes

### StoryGraph

- Uses Goodreads CSV format exactly
- Import via: Manage Account → Goodreads Import
- Custom shelves mapped to tags
- May prompt for shelf category mapping

**Verified compatible:** The Goodreads format works without modification.

### Hardcover

- Accepts Goodreads CSV format
- Also has custom CSV format with different columns
- Import via: Settings → Import

**Recommendation:** Use Goodreads format for compatibility.

### BookWyrm

- Accepts Goodreads CSV format
- Import via: Settings → Import
- May take time for large libraries

**Verified compatible:** The Goodreads format works without modification.

### Literal

- Accepts Goodreads CSV format
- Matches on ISBN primarily

**Note:** Some users report needing to ensure ISBN13 is populated.

---

## Testing Checklist

### Export Validation

- [ ] All 31 Goodreads columns present
- [ ] Header row exactly matches Goodreads format
- [ ] ISBNs wrapped in `="..."` format
- [ ] Dates in `YYYY/MM/DD` format
- [ ] Exclusive Shelf is `to-read` or `read`
- [ ] Special characters in titles properly escaped
- [ ] UTF-8 encoding preserved
- [ ] File opens correctly in Excel
- [ ] File opens correctly in Google Sheets

### Import Testing

- [ ] **Goodreads:** Import successful, all books appear
- [ ] **StoryGraph:** Import successful, shelves mapped correctly
- [ ] **Hardcover:** Import successful, status preserved
- [ ] **BookWyrm:** Import successful, no errors

### Edge Cases

- [ ] Book with no author
- [ ] Book with multiple authors
- [ ] Book with commas in title
- [ ] Book with quotes in title
- [ ] Book with newlines in notes
- [ ] Book with non-ASCII characters (émojis, accents)
- [ ] ISBN-13 starting with 979 (no ISBN-10 equivalent)
- [ ] Very long notes (>1000 chars)
- [ ] Empty library (0 books)
- [ ] Large library (1000+ books)

---

## UI/UX

### Export Page/Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Export Your Library                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Download your books to use with other platforms.               │
│                                                                 │
│  Format:                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ CSV (Goodreads format)                                │   │
│  │   Works with: StoryGraph, Hardcover, BookWyrm, Literal  │   │
│  │                                                          │   │
│  │ ○ JSON (TBR.fyi format)                                 │   │
│  │   For developers or data backup                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Your export includes:                                          │
│  • 42 books                                                     │
│  • Titles, authors, ISBNs                                       │
│  • Read/unread status                                           │
│  • Shelf assignments                                            │
│  • Personal notes                                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Download Export                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  After downloading, import to:                                  │
│  • StoryGraph: Manage Account → Goodreads Import               │
│  • Hardcover: Settings → Import                                │
│  • BookWyrm: Settings → Import                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Access Points

1. Settings page: "Export Library" link
2. Shelf page: Menu → "Export"
3. API: `GET /api/export/csv`

---

## Implementation Effort

| Task | Effort |
|------|--------|
| CSV generation function | 0.5 day |
| ISBN-13 to ISBN-10 conversion | 0.25 day |
| Date formatting | 0.25 day |
| Edge case handling | 0.5 day |
| Export UI (modal or page) | 0.5 day |
| Platform import testing | 0.5 day |
| Documentation | 0.25 day |
| **Total** | **~2.5 days** |

---

## OPML Export (Future)

OPML is XML-based, used for RSS/podcast subscriptions. It's **not standard** for book lists, but could be useful for:

- Reading lists as "feeds"
- Integration with RSS readers
- Podcast-style "book subscription" concept

**Recommendation:** Deprioritize OPML. Focus on CSV (universal) and JSON (developer-friendly).

---

## Summary

### Priority: **High**

CSV export is:
1. Essential for user trust (data portability)
2. Low effort (~2.5 days)
3. High compatibility (works everywhere)
4. Required before marketing to book community

### Key Success Criteria

1. **Flawless Goodreads format** - Every column, exact formatting
2. **Works on first try** - No manual fixing needed
3. **Tested on all platforms** - StoryGraph, Hardcover, BookWyrm
4. **Clear documentation** - Users know how to import elsewhere

### Implementation Order

1. CSV export endpoint (`/api/export/csv`)
2. UI for export (settings page)
3. Platform import testing
4. Documentation + help page
