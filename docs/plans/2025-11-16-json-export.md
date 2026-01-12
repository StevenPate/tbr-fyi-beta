# JSON Export Implementation Plan

**Status:** IMPLEMENTED (with enhancements)

**Goal:** Allow users to download their complete book collection as a JSON file containing ISBNs, notes, statuses, dates, shelf names, and metadata.

**What was built:** The original JSON export was implemented, plus a CSV export in Goodreads format for compatibility with other book tracking platforms. The settings page provides format selection (CSV or JSON).

---

## Implementation Summary

### Files Created

| File | Purpose |
|------|---------|
| `src/routes/api/export/+server.ts` | JSON export endpoint |
| `src/routes/api/export/csv/+server.ts` | CSV export endpoint (Goodreads format) |
| `src/routes/[identifier]/settings/+page.svelte` | Settings page with export UI |

### Files Modified

| File | Change |
|------|--------|
| `src/routes/+layout.svelte` | Added Settings link to footer |
| `src/lib/server/auth.ts` | Added `resolveIdentifierToUserId()` helper |

---

## Implemented Features

### JSON Export (`GET /api/export`)

Returns user's complete book collection as JSON:

```json
{
  "exportedAt": "2024-01-15T10:30:00.000Z",
  "userId": "+15551234567",
  "totalBooks": 42,
  "books": [
    {
      "isbn13": "9780140449136",
      "title": "The Brothers Karamazov",
      "author": ["Fyodor Dostoevsky"],
      "publisher": "Penguin Classics",
      "publicationDate": "2003-02-25",
      "description": "...",
      "coverUrl": "https://...",
      "note": "Recommended by John",
      "isRead": false,
      "isOwned": true,
      "shelves": ["TBR", "Classics"],
      "addedAt": "2024-01-10T08:15:00.000Z"
    }
  ]
}
```

- Filename: `tbr-export-YYYY-MM-DD.json`
- Auth: Derives userId from Referer header, resolves identifier to user_id
- Single query with joins (no N+1 problem)

### CSV Export (`GET /api/export/csv`)

Returns Goodreads-compatible CSV with all 31 standard columns:

- Compatible with: StoryGraph, Hardcover, BookWyrm, Literal
- Includes ISBN-10 conversion (for 978-prefix ISBNs)
- Properly escapes special characters
- Maps `is_read` to `read`/`to-read` exclusive shelf
- Filename: `tbr-export-YYYY-MM-DD.csv`

Key mappings:
- `is_read: true` → `Exclusive Shelf: read`, `Read Count: 1`
- `is_read: false` → `Exclusive Shelf: to-read`, `Read Count: 0`
- `is_owned: true` → `Owned Copies: 1`
- `note` → `Private Notes`
- Shelves formatted as lowercase-hyphenated names

### Settings Page (`/[identifier]/settings`)

Features:
- Format selection (CSV or JSON radio buttons)
- CSV shows import hints for StoryGraph, Hardcover, BookWyrm
- Loading spinner during export
- Error display on failure
- Uses design system CSS variables

### Footer Navigation

Settings link added to footer:
- Uses `currentUserId()` to build path
- Falls back to `/settings` if no user context

---

## Differences from Original Plan

| Planned | Implemented |
|---------|-------------|
| JSON export only | JSON + CSV export |
| `[username]` route | `[identifier]` route (supports phone, email, username) |
| Simple export button | Format selection radio buttons |
| Used `requireUserId()` only | Added `resolveIdentifierToUserId()` for identifier resolution |
| No import hints | CSV format shows import instructions |

---

## Testing

Manual testing only (per project philosophy):

1. Navigate to `/{identifier}/settings`
2. Select format (CSV or JSON)
3. Click "Download Export"
4. Verify file downloads with correct filename
5. Validate file contents

### Edge Cases Tested

- Empty library → exports with `totalBooks: 0` / empty CSV body
- Books with no notes → `note: null` / empty Private Notes
- Books with no shelves → `shelves: []` / empty Bookshelves
- Special characters in notes → properly escaped
- Multiple authors → first author in Author, rest in Additional Authors (CSV)

---

## Related Plans

- `csv-export-specification.md` - Detailed CSV format specification
- `2026-01-11-json-per-shelf-export-spec.md` - Future: per-shelf JSON export
