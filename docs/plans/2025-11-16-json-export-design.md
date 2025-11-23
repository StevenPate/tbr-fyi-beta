# JSON Export Feature Design

**Date:** 2025-11-16
**Status:** Approved for implementation

## Overview

Simple JSON export feature that allows users to download their complete book collection as a JSON file containing ISBNs, user-generated notes, statuses, dates, shelf assignments, and metadata.

## Requirements

- Export all books in user's library (regardless of current shelf/filter view)
- Include user-generated data: notes, read/owned status, shelf assignments, dates
- Include metadata: title, author, publisher, publication date, description, cover URL
- Accessible from dedicated settings page
- Immediate JSON download on button click
- No preview or email options (keep it simple)

## Architecture

### Components

**1. Settings Page**
- Route: `src/routes/[username]/settings/+page.svelte`
- Simple single-column layout with "Export Library" button
- Derives userId from URL param (existing auth pattern)
- Minimal UI matching current design system
- Accessible via footer navigation link

**2. Export API Endpoint**
- Route: `src/routes/api/export/+server.ts`
- GET endpoint (stateless, no request body needed)
- Derives userId from referer header using `requireUserId()` helper
- Returns JSON with download headers

**3. Navigation**
- Add "Settings" link to global footer (`src/routes/+layout.svelte`)
- Position: between existing links (About, Help)
- Optional breadcrumb on settings page: "My Reading List > Settings"

### JSON Structure

```json
{
  "exportedAt": "2025-11-16T10:30:00Z",
  "userId": "+15551234567",
  "totalBooks": 27,
  "books": [
    {
      "isbn13": "9781442442031",
      "title": "Hatchet",
      "author": ["Gary Paulsen"],
      "publisher": "Simon and Schuster",
      "publicationDate": "2009",
      "description": "Thirteen-year-old Brian Robeson...",
      "coverUrl": "https://books.google.com/books/content?id=...",
      "note": "Classic. Really ought to read it. Think ahead for Jo.",
      "isRead": false,
      "isOwned": true,
      "shelves": ["TBR", "2025"],
      "addedAt": "2025-11-16T09:00:00Z"
    }
  ]
}
```

**Field Mapping:**
- `exportedAt`: Current timestamp (ISO 8601)
- `userId`: User's phone number from auth
- `totalBooks`: Count of books array
- `isbn13`: books.isbn13 (string)
- `title`: books.title (string)
- `author`: books.author (text array)
- `publisher`: books.publisher (string | null)
- `publicationDate`: books.publication_date (string | null)
- `description`: books.description (string | null)
- `coverUrl`: books.cover_url (string | null)
- `note`: books.note (string | null)
- `isRead`: books.is_read (boolean)
- `isOwned`: books.is_owned (boolean)
- `shelves`: Array of shelf names from join (string[])
- `addedAt`: books.added_at (ISO 8601 string)

## Data Flow

1. User navigates to `/[username]/settings`
2. Clicks "Export Library" button
3. Browser makes GET request to `/api/export`
4. API derives userId from referer: `https://tbr.fyi/+15551234567/settings` → `+15551234567`
5. Single Supabase query fetches all books with joined shelf data
6. Server transforms rows into JSON structure
7. Response headers trigger download:
   - `Content-Type: application/json`
   - `Content-Disposition: attachment; filename="tbr-export-2025-11-16.json"`
8. Browser downloads file automatically

### Database Query

```typescript
const { data: books, error } = await supabase
  .from('books')
  .select('*, book_shelves(shelf_id, shelves(name))')
  .eq('user_id', userId)
  .order('added_at', { ascending: false });
```

**Query Strategy:**
- Single query with joins (no N+1 problem)
- Fetches books + book_shelves + shelves in one round-trip
- Transform shelf join data: `book_shelves: [{shelves: {name: "TBR"}}, ...]` → `shelves: ["TBR", ...]`
- Sort by `added_at DESC` for chronological export

## Error Handling

### Authentication Errors
- Missing/invalid referer → 401 JSON error
- Reuse `requireUserId()` helper from existing endpoints
- No custom UI needed (browser handles HTTP errors)

### Database Errors
- Query failure → 500 JSON error with generic message
- Log full error server-side for debugging
- Don't expose database internals in response

### Edge Cases
- Empty library (0 books) → Valid JSON: `{totalBooks: 0, books: []}`
- Books with no shelves → `shelves: []`
- Missing metadata → Include as `null` (preserve structure)
- Very large libraries (100+ books) → No pagination, JSON handles it

### Settings Page Errors
- Export button click fails → Show alert: "Export failed. Please try again."
- No retry logic (user clicks again if needed)

### Security
- userId from referer prevents cross-user exports
- Same auth pattern used throughout app
- No additional authentication needed

## File Naming

Format: `tbr-export-YYYY-MM-DD.json`

Example: `tbr-export-2025-11-16.json`

- Uses current date (not user's timezone, server timezone is fine)
- Allows multiple exports per day without collision (browser appends number)
- Descriptive prefix `tbr-export-` for easy identification

## Testing Plan

### Manual Testing
1. Create test user with ~5 books across multiple shelves
2. Add notes to some books, leave others blank
3. Navigate to `/+15551234567/settings`
4. Click "Export Library"
5. Verify file downloads with correct filename
6. Validate JSON structure:
   - All books present
   - Shelf arrays correct
   - Notes preserved
   - Metadata populated
   - Valid ISO 8601 dates

### Edge Case Testing
- User with 0 books → Empty export
- Books without notes → `note: null`
- Books on no shelves → `shelves: []`
- Long notes (500+ chars) → Fully preserved
- Special characters in notes → Properly escaped JSON

### Browser Compatibility
- Chrome, Safari, Firefox
- Verify auto-download (not in-browser view)
- Mobile: iOS Safari, Android Chrome

**No automated tests** (matches MVP philosophy)

## Implementation Notes

### Reusable Code
- `requireUserId()` helper from `/api/books/update`
- Button, Input components from `$lib/components/ui`
- Footer navigation pattern from `+layout.svelte`

### New Files
1. `src/routes/[username]/settings/+page.svelte` - Settings page
2. `src/routes/api/export/+server.ts` - Export API endpoint

### Modified Files
1. `src/routes/+layout.svelte` - Add "Settings" link to footer

### Database Changes
None required (note field already exists in production)

## Future Enhancements

Out of scope for MVP, potential future additions:
- CSV export format option
- Goodreads-compatible CSV format
- Import feature (restore from JSON)
- Scheduled auto-exports via email
- Export history/versioning
- Configurable field selection

## Success Criteria

- User can download complete library as JSON in <2 seconds
- JSON is valid and parseable
- All user data preserved accurately
- Works on desktop and mobile browsers
- No errors for libraries of any size (0-1000+ books)
