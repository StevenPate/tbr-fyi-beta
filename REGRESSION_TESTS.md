# Manual Regression Testing Procedures

> **Purpose**: Step-by-step testing procedures to verify TBR.fyi functionality after implementing fixes or changes. Use these scripts to gain confidence that nothing has been broken.

---

## Quick Reference: Which Tests to Run

| Change Type | Required Tests |
|-------------|----------------|
| Bug fix in specific feature | Smoke Test + Related Feature Section |
| UI/Component changes | Smoke Test + Web UI Full Suite |
| API endpoint changes | Smoke Test + API Tests + Related UI |
| SMS flow changes | Smoke Test + SMS Full Suite |
| Database schema changes | Full Regression Suite |
| Dependency updates | Full Regression Suite |
| Pre-deployment | Full Regression Suite |

---

## Pre-Test Setup Checklist

Before running any tests, ensure:

- [ ] Dev server running: `npm run dev`
- [ ] `.env` file has all required variables
- [ ] Browser DevTools console open (to catch JS errors)
- [ ] Network tab open (to monitor API calls)
- [ ] Test phone number exists in database (for SMS tests, use ngrok: `npm run dev:tunnel`)

---

## 1. Smoke Test (Run After Every Change)

**Time: ~2 minutes**

This quick test catches critical regressions:

```bash
# Terminal 1: Type checks
npm run check

# Terminal 2: Build verification
npm run build
```

**Browser Quick Check:**

1. [ ] Open `http://localhost:5173` - Homepage loads without errors
2. [ ] Click "View your bookshelf" or navigate to a known user route
3. [ ] Verify shelf page loads with books visible
4. [ ] Open browser console - no red errors

**Pass Criteria**: All checks pass, no console errors, pages render.

---

## 2. Web UI Regression Suite

### 2.1 Homepage Tests

**Route**: `http://localhost:5173/`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Load homepage | Page renders with carousel, QR code visible | [ ] |
| 2 | Check localStorage hint | If returning user, "Continue to your library" link appears | [ ] |
| 3 | Scan QR code (phone) | Resolves to Twilio number (+1 360-504-4327) | [ ] |
| 4 | Click "About" in nav | About page loads | [ ] |
| 5 | Click "Help" in nav | Help/FAQ page loads | [ ] |
| 6 | Open browser console | No JavaScript errors | [ ] |

---

### 2.2 Shelf Page Tests

**Route**: `http://localhost:5173/[your-identifier]`

Use your phone number (e.g., `+13123756327`) or username as identifier.

#### Navigation & View Modes

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Load shelf page | Page loads, books display | [ ] |
| 2 | Click "Grid" view toggle | Books display as flip cards | [ ] |
| 3 | Click "List" view toggle | Books display as horizontal cards with details | [ ] |
| 4 | Refresh page | View mode persists within session | [ ] |
| 5 | Click shelf tabs | Books filter to selected shelf | [ ] |
| 6 | Click "All Books" | All books display regardless of shelf | [ ] |

#### Search & Filter (Cmd+K or click search)

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Press Cmd+K (or Ctrl+K) | Search bar focuses | [ ] |
| 2 | Type book title | Results filter in real-time | [ ] |
| 3 | Type author name | Results filter to author matches | [ ] |
| 4 | Clear search | All books return | [ ] |
| 5 | Use "Read" dropdown filter | Only read (or unread) books show | [ ] |
| 6 | Use "Owned" dropdown filter | Only owned (or not owned) books show | [ ] |

---

### 2.3 Add Book Modal Tests

**Trigger**: Click `+` button or press `+`/`=` key

#### ISBN Input

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Open modal | Modal appears with input field | [ ] |
| 2 | Enter ISBN-13: `9780140449136` | Book detected (The Brothers Karamazov) | [ ] |
| 3 | Enter ISBN-10: `0140449132` | Same book detected | [ ] |
| 4 | Select shelf from dropdown | Shelf highlighted | [ ] |
| 5 | Click "Add" | Book added, toast appears, modal closes | [ ] |
| 6 | Verify in book list | New book appears on selected shelf | [ ] |

#### Amazon URL Input

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Open modal | Modal appears | [ ] |
| 2 | Paste full Amazon URL | ISBN extracted, book detected | [ ] |
| 3 | Paste short a.co URL | ISBN extracted, book detected | [ ] |
| 4 | Add book | Book added successfully | [ ] |

**Test URLs** (use current Amazon links):
- Full: `https://www.amazon.com/dp/0140449132`
- Short: `https://a.co/d/xxxxxxx` (get a real short link)

#### Title/Author Search

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Open modal | Modal appears | [ ] |
| 2 | Type: `1984 by George Orwell` | Book suggestions appear | [ ] |
| 3 | Select a result | Book details populate | [ ] |
| 4 | Add book | Book added successfully | [ ] |

#### Image/Barcode Upload

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Open modal | Modal appears | [ ] |
| 2 | Drag barcode image onto modal | Upload triggered, detection starts | [ ] |
| 3 | Wait for detection | Book(s) detected, shown as selectable | [ ] |
| 4 | Toggle selection on one book | Selection state changes | [ ] |
| 5 | Click "Add" | Selected books added | [ ] |

**Test Images**: Use photos of book barcodes from your library.

---

### 2.4 Book Management Tests

#### Read/Owned Toggles

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Find a book in list view | Book card visible | [ ] |
| 2 | Click "Read" badge | Badge toggles state (filled/outline) | [ ] |
| 3 | Refresh page | Read state persisted | [ ] |
| 4 | Click "Owned" badge | Badge toggles state | [ ] |
| 5 | Refresh page | Owned state persisted | [ ] |
| 6 | Check network tab | POST to `/api/books/update` returns 200 | [ ] |

#### Notes

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Find a book, expand details | Note input field visible | [ ] |
| 2 | Enter a note | Text appears in field | [ ] |
| 3 | Click outside (blur) | Note saves | [ ] |
| 4 | Refresh page | Note persisted | [ ] |
| 5 | Clear note and blur | Note removed | [ ] |

#### Book Deletion

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Find a book | Book visible | [ ] |
| 2 | Click delete/trash icon | Confirmation appears | [ ] |
| 3 | Confirm deletion | Book removed from list | [ ] |
| 4 | Check database | Book record deleted | [ ] |

---

### 2.5 Shelf Management Tests

#### Create Shelf

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click "+" next to shelves (or "New Shelf") | Input appears | [ ] |
| 2 | Enter unique name: `Test Shelf` | Name accepted | [ ] |
| 3 | Submit | Shelf created, appears in list | [ ] |
| 4 | Try duplicate name | Error message shows | [ ] |

#### Assign Book to Shelf

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Find a book | Book visible | [ ] |
| 2 | Open shelf assignment menu | Shelf list appears with checkboxes | [ ] |
| 3 | Check a shelf | Book assigned (immediate UI update) | [ ] |
| 4 | Navigate to that shelf | Book appears there | [ ] |
| 5 | Uncheck the shelf | Book removed from shelf | [ ] |

#### Delete Shelf

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to test shelf | Shelf is active | [ ] |
| 2 | Click delete shelf button | Confirmation dialog appears | [ ] |
| 3 | Confirm | Shelf deleted, redirect to "All Books" | [ ] |
| 4 | Check books | Books still exist (only shelf assignment removed) | [ ] |

---

### 2.6 Export Tests

**Route**: `http://localhost:5173/[identifier]/settings` or use export buttons

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click JSON export | `.json` file downloads | [ ] |
| 2 | Open file | Valid JSON with book data | [ ] |
| 3 | Click CSV export | `.csv` file downloads | [ ] |
| 4 | Open in spreadsheet | Proper columns, Goodreads compatible | [ ] |
| 5 | Export specific shelf | Only that shelf's books included | [ ] |

---

### 2.7 Share Book Tests

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click share icon on a book | Share modal opens | [ ] |
| 2 | Copy link | URL copied to clipboard | [ ] |
| 3 | Open link in incognito | Book displays publicly (read-only) | [ ] |
| 4 | Try to modify | No edit controls visible | [ ] |

---

### 2.8 Feedback Modal Tests

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click feedback FAB (floating button) | Modal opens | [ ] |
| 2 | Enter feedback text | Text accepted | [ ] |
| 3 | Toggle screenshot option | Screenshot captured (if enabled) | [ ] |
| 4 | Submit | Success message, modal closes | [ ] |
| 5 | Check Trello board | Card created with feedback | [ ] |

---

## 3. SMS Flow Regression Suite

**Prerequisites**:
- ngrok tunnel running: `npm run dev:tunnel`
- Twilio webhook pointing to tunnel URL + `/api/sms`
- Test phone with SMS capability

### 3.1 User Lifecycle Commands

| Step | SMS Sent | Expected Response | Database State | Pass |
|------|----------|-------------------|----------------|------|
| 1 | `STOP` | Opt-out confirmation | `opted_out=true` | [ ] |
| 2 | `START` | Welcome message with instructions | `opted_out=false`, `has_started=true`, default shelf created | [ ] |
| 3 | `HELP` | Instructions for adding books | No change | [ ] |

---

### 3.2 Add Book via ISBN

| Step | SMS Sent | Expected Response | Verify | Pass |
|------|----------|-------------------|--------|------|
| 1 | `9780140449136` | "Added: The Brothers Karamazov by Fyodor Dostoyevsky" (or similar) | Book in database, on default shelf | [ ] |
| 2 | `0140449132` (ISBN-10) | Book added confirmation | ISBN-13 stored in database | [ ] |
| 3 | Invalid ISBN: `1234567890123` | Error message | No book added | [ ] |
| 4 | Duplicate ISBN | "Already in your library" or similar | No duplicate created | [ ] |

---

### 3.3 Add Book via Amazon Link

| Step | SMS Sent | Expected Response | Pass |
|------|----------|-------------------|------|
| 1 | Full Amazon URL | Book added with title/author | [ ] |
| 2 | Short `a.co` URL | Book added with title/author | [ ] |
| 3 | Invalid Amazon URL | Error/guidance message | [ ] |

---

### 3.4 Add Book via Photo (MMS)

| Step | MMS Sent | Expected Response | Pass |
|------|----------|-------------------|------|
| 1 | Clear barcode photo | Book(s) detected and added | [ ] |
| 2 | Photo with multiple barcodes | Multiple books detected | [ ] |
| 3 | Blurry/unreadable photo | "Couldn't detect" message | [ ] |
| 4 | Non-barcode image | Helpful error message | [ ] |

---

### 3.5 Title/Author Search

| Step | SMS Sent | Expected Response | Pass |
|------|----------|-------------------|------|
| 1 | `1984 by George Orwell` | Book match found, confirmation | [ ] |
| 2 | `The Great Gatsby` | Best match returned | [ ] |
| 3 | Vague/ambiguous title | Multiple options or best guess | [ ] |
| 4 | Nonsense text | Helpful error message | [ ] |

---

### 3.6 Note Capture Flow

| Step | SMS Sent | Expected Response | Pass |
|------|----------|-------------------|------|
| 1 | Add a book (ISBN) | Book added, note prompt offered | [ ] |
| 2 | Send note text | Note saved to book | [ ] |
| 3 | Verify in web UI | Note visible on book | [ ] |
| 4 | Send `no` or skip | Context cleared, no note | [ ] |

---

### 3.7 Multi-Book Context (ADD command)

| Step | SMS Sent | Expected Response | Pass |
|------|----------|-------------------|------|
| 1 | `ADD` | "Ready for multiple books" acknowledgment | [ ] |
| 2 | ISBN #1 | Book added, waiting for more | [ ] |
| 3 | ISBN #2 | Book added, waiting for more | [ ] |
| 4 | `DONE` or empty | Summary of books added | [ ] |

---

## 4. API Endpoint Tests

Run these with cURL or a REST client. Replace placeholders with real values.

### 4.1 Book Endpoints

```bash
# Test: Detect ISBN
curl -X POST http://localhost:5173/api/books/detect \
  -H "Content-Type: application/json" \
  -d '{"input":"9780140449136"}' | jq

# Expected: Book metadata returned

# Test: Add book (need valid referer)
curl -X POST http://localhost:5173/api/books/add \
  -H "Content-Type: application/json" \
  -H "Referer: http://localhost:5173/+13123756327" \
  -d '{"isbn":"9780547928227"}' | jq

# Expected: 200 OK, book added

# Test: Update book status
curl -X POST http://localhost:5173/api/books/update \
  -H "Content-Type: application/json" \
  -H "Referer: http://localhost:5173/+13123756327" \
  -d '{"id":"BOOK_UUID_HERE","is_read":true}' | jq

# Expected: 200 OK

# Test: Delete book
curl -X POST http://localhost:5173/api/books/delete \
  -H "Content-Type: application/json" \
  -H "Referer: http://localhost:5173/+13123756327" \
  -d '{"id":"BOOK_UUID_HERE"}' | jq

# Expected: 200 OK
```

### 4.2 Shelf Endpoints

```bash
# Test: Create shelf
curl -X POST http://localhost:5173/api/shelves \
  -H "Content-Type: application/json" \
  -d '{"user_id":"+13123756327","name":"API Test Shelf"}' | jq

# Expected: 200 OK, shelf created

# Test: Delete shelf
curl -X DELETE http://localhost:5173/api/shelves \
  -H "Content-Type: application/json" \
  -d '{"id":"SHELF_UUID_HERE"}' | jq

# Expected: 200 OK
```

### 4.3 Export Endpoints

```bash
# Test: JSON export
curl "http://localhost:5173/api/export?identifier=+13123756327" | jq

# Expected: JSON array of books

# Test: CSV export
curl "http://localhost:5173/api/export/csv?identifier=+13123756327"

# Expected: CSV formatted text
```

---

## 5. Database State Verification

After running tests, verify database state in Supabase:

### Books Table
```sql
-- Check recent books
SELECT id, isbn13, title, is_read, is_owned, note, source_type, added_at
FROM books
WHERE user_id = '+13123756327'
ORDER BY added_at DESC
LIMIT 10;
```

### Shelves Table
```sql
-- Check user's shelves
SELECT id, name, created_at
FROM shelves
WHERE user_id = '+13123756327';
```

### Book-Shelf Relationships
```sql
-- Check shelf assignments
SELECT b.title, s.name as shelf_name
FROM book_shelves bs
JOIN books b ON bs.book_id = b.id
JOIN shelves s ON bs.shelf_id = s.id
WHERE b.user_id = '+13123756327';
```

### SMS Context
```sql
-- Check SMS context state
SELECT * FROM sms_context WHERE user_id = '+13123756327';
```

---

## 6. Full Regression Checklist

Use this for pre-deployment or after significant changes:

### Build & Compile
- [ ] `npm run check` passes
- [ ] `npm run build` passes
- [ ] No TypeScript errors
- [ ] No Svelte warnings

### Core Web Functionality
- [ ] Homepage renders
- [ ] Shelf page loads
- [ ] Add book modal works (ISBN, Amazon, image, search)
- [ ] Read/Owned toggles persist
- [ ] Notes persist
- [ ] Book deletion works
- [ ] Shelf creation works
- [ ] Shelf deletion works (with redirect)
- [ ] Search filters books
- [ ] Grid/List toggle works
- [ ] Barcode renders in list view

### Export & Share
- [ ] JSON export downloads valid file
- [ ] CSV export downloads valid file
- [ ] Share link works in incognito

### SMS Flows
- [ ] START creates user/shelf
- [ ] STOP opts out user
- [ ] HELP returns instructions
- [ ] ISBN adds book
- [ ] Amazon URL adds book
- [ ] Photo adds book(s)
- [ ] Title search finds book
- [ ] Note capture saves note

### Integrations
- [ ] Google Books metadata fetches
- [ ] Google Vision barcode detection works
- [ ] Feedback reaches Trello

### Error Handling
- [ ] Invalid ISBN shows error
- [ ] Network timeout handled gracefully
- [ ] Duplicate book prevented
- [ ] Rate limiting works (if applicable)

---

## 7. Test Data Reference

### Sample ISBNs

| ISBN-13 | ISBN-10 | Title |
|---------|---------|-------|
| 9780140449136 | 0140449132 | The Brothers Karamazov |
| 9780547928227 | 0547928227 | The Hobbit |
| 9780061120084 | 0061120081 | To Kill a Mockingbird |
| 9780451524935 | 0451524934 | 1984 |
| 9780743273565 | 0743273567 | The Great Gatsby |

### Test User Cleanup

After testing, clean up test data:

```sql
-- Remove test books (be careful!)
DELETE FROM books
WHERE user_id = '+13123756327'
AND title LIKE '%Test%';

-- Remove test shelves
DELETE FROM shelves
WHERE user_id = '+13123756327'
AND name LIKE '%Test%';

-- Clear SMS context
DELETE FROM sms_context
WHERE user_id = '+13123756327';
```

---

## 8. Regression Test Log Template

Copy this for each test session:

```markdown
## Regression Test Session

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Change Tested**: [Brief description of fix/change]
**Branch**: [Branch name]

### Tests Run
- [ ] Smoke Test
- [ ] Web UI Suite
- [ ] SMS Suite
- [ ] API Tests
- [ ] Full Regression

### Results
| Test Area | Status | Notes |
|-----------|--------|-------|
| Build | PASS/FAIL | |
| Homepage | PASS/FAIL | |
| Shelf Page | PASS/FAIL | |
| Add Book | PASS/FAIL | |
| Toggles | PASS/FAIL | |
| Shelves | PASS/FAIL | |
| Export | PASS/FAIL | |
| SMS | PASS/FAIL | |

### Issues Found
1. [Issue description]

### Sign-off
- [ ] Ready for deployment
```

---

## Quick Commands Reference

```bash
# Start dev server
npm run dev

# Start with ngrok tunnel (for SMS testing)
npm run dev:tunnel

# Type checking
npm run check

# Production build test
npm run build

# Database access
npx supabase db remote login
```
