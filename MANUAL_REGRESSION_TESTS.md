# Manual Regression Testing Scripts

Quick-reference testing scripts for verifying TBR.fyi functionality during user testing or after code changes. Designed for rapid verification when you need confidence that core features work.

---

## Quick Smoke Test (5 minutes)

Run this checklist when you need the fastest possible sanity check:

```
[ ] npm run check          → No TypeScript errors
[ ] npm run build          → Build succeeds
[ ] Load homepage (/)      → Carousel renders, no console errors
[ ] Load user page         → Books display in grid/list view
[ ] Add book via ISBN      → Modal detects, book appears in list
[ ] Toggle Read status     → Badge updates, survives refresh
[ ] Send SMS ISBN          → Reply with title, book appears on web
```

---

## Table of Contents

1. [Web UI Tests](#1-web-ui-tests)
2. [SMS Flow Tests](#2-sms-flow-tests)
3. [Book Operations Tests](#3-book-operations-tests)
4. [Shelf Management Tests](#4-shelf-management-tests)
5. [Search & Filter Tests](#5-search--filter-tests)
6. [Export Tests](#6-export-tests)
7. [Authentication Tests](#7-authentication-tests)
8. [Integration Tests](#8-integration-tests)
9. [Edge Cases & Error Handling](#9-edge-cases--error-handling)
10. [Test Data Reference](#10-test-data-reference)

---

## 1. Web UI Tests

### 1.1 Homepage

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 1.1.1 | Page loads | Navigate to `/` | Carousel renders with getting started slides |
| 1.1.2 | QR code works | Scan QR code with phone | Opens SMS to Twilio number |
| 1.1.3 | localStorage persistence | Visit homepage, check localStorage | `tbr_last_user` key contains last visited user ID |
| 1.1.4 | No console errors | Open DevTools Console | No red errors on load |

### 1.2 User Shelf Page

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 1.2.1 | Page loads | Navigate to `/[identifier]` | Books grid displays without errors |
| 1.2.2 | Grid view | Click grid icon | Books display in card grid layout |
| 1.2.3 | List view | Click list icon | Books display in expandable list |
| 1.2.4 | View persistence | Toggle view, refresh page | Same view mode persists |
| 1.2.5 | Empty state | Load user with no books | Shows "No books yet" message |
| 1.2.6 | Shelf pills display | User has multiple shelves | Shelf navigation shows correctly |
| 1.2.7 | "More shelves" dropdown | User has >3 shelves | Dropdown appears with overflow shelves |

### 1.3 Add Book Modal

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 1.3.1 | Open via button | Click `+` button | Modal opens with input field |
| 1.3.2 | Keyboard shortcut | Press `+` or `=` | Modal opens |
| 1.3.3 | Close modal | Click outside or press Escape | Modal closes |
| 1.3.4 | ISBN detection | Enter `9780140449136` | Book metadata appears for preview |
| 1.3.5 | ISBN-10 conversion | Enter `0140449132` | Converts to ISBN-13, shows metadata |
| 1.3.6 | Amazon URL full | Enter Amazon product URL | ISBN extracted, metadata displayed |
| 1.3.7 | Amazon short URL | Enter `a.co/d/xxxxx` | ISBN extracted, metadata displayed |
| 1.3.8 | Bookshop.org URL | Enter Bookshop.org link | ISBN extracted from `?ean=` param |
| 1.3.9 | B&N URL | Enter Barnes & Noble link | ISBN extracted from `?ean=` param |
| 1.3.10 | Title/author search | Enter "Project Hail Mary by Andy Weir" | Search results returned |
| 1.3.11 | Photo upload (drag) | Drag barcode image into modal | Barcode detected, metadata shown |
| 1.3.12 | Photo upload (picker) | Click upload, select image | Barcode detected, metadata shown |
| 1.3.13 | Multi-book selection | Upload multi-barcode image | All detected, can select/deselect |
| 1.3.14 | Add confirmation | Click "Add Book" | Toast appears, book in list |
| 1.3.15 | Duplicate detection | Add same ISBN twice | "Already in library" message |

### 1.4 Book Card Interactions

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 1.4.1 | Flip card (grid) | Click card in grid view | Card flips to show back |
| 1.4.2 | Expand card (list) | Click card in list view | Card expands with details |
| 1.4.3 | Read toggle | Click Read badge | Badge toggles, persists on refresh |
| 1.4.4 | Owned toggle | Click Owned badge | Badge toggles, persists on refresh |
| 1.4.5 | Copy ISBN | Click copy icon | ISBN copied, success indicator shown |
| 1.4.6 | View barcode | Click barcode icon | EAN-13 barcode displays |
| 1.4.7 | Share book | Click share icon | Share modal with unique URL |
| 1.4.8 | Delete book | Click delete, confirm | Book removed from list |
| 1.4.9 | Shelf assignment | Open shelf menu, toggle shelf | Book added/removed from shelf |
| 1.4.10 | Description expand | Click "Show more" on long desc | Full description visible |

### 1.5 Feedback Modal

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 1.5.1 | FAB visible | Load any page | Floating action button in corner |
| 1.5.2 | Open modal | Click FAB | Feedback form opens |
| 1.5.3 | Submit text only | Enter feedback, submit | Success message, card in Trello |
| 1.5.4 | Submit with screenshot | Attach screenshot, submit | Card with attachment in Trello |
| 1.5.5 | Focus trap | Tab through modal | Focus stays within modal |

---

## 2. SMS Flow Tests

> **Prerequisites**: Twilio webhook pointing to dev server or ngrok tunnel. Test handset with phone number matching a user record.

### 2.1 Commands

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 2.1.1 | START - new user | Send `START` from new number | Welcome message, account created, TBR shelf created |
| 2.1.2 | START - existing user | Send `START` from known number | Already registered message |
| 2.1.3 | START - opted out | Send `START` after STOP | Resubscribed, opt-out cleared |
| 2.1.4 | STOP | Send `STOP` | Opt-out confirmation, `opted_out=true` in DB |
| 2.1.5 | HELP | Send `HELP` | Instructions message with command list |
| 2.1.6 | FEEDBACK | Send `FEEDBACK` | Feedback opt-in confirmation |
| 2.1.7 | Case insensitive | Send `start`, `Stop`, `HELP` | All recognized correctly |

### 2.2 Book Addition via SMS

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 2.2.1 | Plain ISBN-13 | Text `9780140449136` | Book added, title in reply |
| 2.2.2 | Plain ISBN-10 | Text `0140449132` | Converts to ISBN-13, book added |
| 2.2.3 | Amazon full URL | Text Amazon product URL | ISBN extracted, book added |
| 2.2.4 | Amazon short URL | Text `a.co/d/xxxxx` | ISBN extracted, book added |
| 2.2.5 | Bookshop.org link | Text Bookshop URL | ISBN from `?ean=`, book added |
| 2.2.6 | B&N link | Text Barnes & Noble URL | ISBN from `?ean=`, book added |
| 2.2.7 | Indiecommerce link | Text indie bookstore URL | ISBN from path, book added |
| 2.2.8 | MMS barcode photo | Send photo of barcode | Vision API detects, book added |
| 2.2.9 | Multi-barcode photo | Send photo with multiple barcodes | All books added, count in reply |
| 2.2.10 | Title/author search | Text "Dune by Frank Herbert" | Best match suggested |
| 2.2.11 | ADD after search | Text `ADD` after suggestion | Suggested book added |
| 2.2.12 | Duplicate addition | Add same ISBN twice | "Already on shelf" message |

### 2.3 Note Capture Flow

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 2.3.1 | Note prompt | Add a book via SMS | Follow-up prompt asking for context |
| 2.3.2 | Add note | Reply with note text | Note saved, confirmation sent |
| 2.3.3 | Skip with emoji | Reply with `👍` | Note skipped, context cleared |
| 2.3.4 | Skip with text | Reply with "skip" or "no" | Note skipped, context cleared |
| 2.3.5 | Note length limit | Reply with 500+ chars | Truncated to 500, saved |
| 2.3.6 | Note visibility | Check web UI | Note appears on book card |

### 2.4 Account & Feedback Prompts

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 2.4.1 | Account prompt trigger | Add 5th book, <5 prompts sent | Account prompt included in reply |
| 2.4.2 | Prompt frequency | Check `last_account_prompt_at` | No prompt if <1 week since last |
| 2.4.3 | Prompt cap | User has 5 prompts | No more account prompts sent |
| 2.4.4 | Feedback prompt | User opted in to feedback | Occasional feedback prompt |

---

## 3. Book Operations Tests

### 3.1 Book Metadata

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 3.1.1 | Title displays | Add book | Title shown correctly |
| 3.1.2 | Author displays | Add book | Author(s) listed |
| 3.1.3 | Cover image | Add book | Cover thumbnail loads |
| 3.1.4 | Description | Add book | Description text available |
| 3.1.5 | Publication date | Add book | Pub date shown if available |
| 3.1.6 | Publisher | Add book | Publisher shown if available |
| 3.1.7 | Missing cover fallback | Add book without cover | Placeholder or Open Library fallback |
| 3.1.8 | Google Books fallback | Primary lookup fails | Open Library data used |

### 3.2 Book Status

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 3.2.1 | Read default | Add new book | `is_read = false` |
| 3.2.2 | Owned default | Add new book | `is_owned = false` |
| 3.2.3 | Toggle read (web) | Click Read badge | Status changes in DB |
| 3.2.4 | Toggle owned (web) | Click Owned badge | Status changes in DB |
| 3.2.5 | Persist read | Toggle, refresh | Status persists |
| 3.2.6 | Persist owned | Toggle, refresh | Status persists |

### 3.3 Book Notes

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 3.3.1 | Note saved (SMS) | Add note via SMS flow | Note in `books.note` column |
| 3.3.2 | Note displays | View book with note | Note text visible |
| 3.3.3 | Note searchable | Search for note content | Book appears in results |
| 3.3.4 | Note limit | 500+ char note | Truncated at 500 |

### 3.4 Book Deletion

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 3.4.1 | Delete confirmation | Click delete | Confirmation dialog appears |
| 3.4.2 | Cancel delete | Click cancel | Book not deleted |
| 3.4.3 | Confirm delete | Click confirm | Book removed from DB |
| 3.4.4 | Cascade shelf removal | Delete book on shelves | Removed from all `book_shelves` |

---

## 4. Shelf Management Tests

### 4.1 Shelf Creation

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 4.1.1 | Create shelf (web) | Click add shelf, enter name | Shelf created, appears in nav |
| 4.1.2 | Default shelf (SMS) | New user sends START | "TBR" shelf auto-created |
| 4.1.3 | Duplicate name blocked | Create shelf with existing name | Error message shown |
| 4.1.4 | Empty name blocked | Create shelf with no name | Validation error |

### 4.2 Shelf Navigation

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 4.2.1 | All Books view | Click "All Books" | Shows all user's books |
| 4.2.2 | Shelf filter | Click shelf name | Shows only books on that shelf |
| 4.2.3 | Shelf count | View shelf pills | Book count accurate |
| 4.2.4 | More dropdown | User has >3 shelves | Overflow in dropdown |

### 4.3 Shelf Assignment

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 4.3.1 | Auto-assign new book | Add book via SMS | Book on default shelf |
| 4.3.2 | Add to shelf (web) | Open shelf menu, check shelf | Book appears on shelf |
| 4.3.3 | Remove from shelf | Uncheck shelf in menu | Book removed from shelf |
| 4.3.4 | Multi-shelf | Add book to multiple shelves | Book shows in all selected |
| 4.3.5 | No shelf | Remove from all shelves | Book still in "All Books" |

### 4.4 Shelf Deletion

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 4.4.1 | Delete confirmation | Click delete on shelf | Confirmation dialog |
| 4.4.2 | Delete shelf | Confirm deletion | Shelf removed, books remain |
| 4.4.3 | Delete active shelf | Delete currently viewed shelf | Redirect to "All Books" |
| 4.4.4 | Cascade removal | Delete shelf with books | `book_shelves` entries removed |

---

## 5. Search & Filter Tests

### 5.1 Client-Side Search

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 5.1.1 | Search by title | Type partial title | Matching books shown |
| 5.1.2 | Search by author | Type author name | Matching books shown |
| 5.1.3 | Search by note | Type note content | Matching books shown |
| 5.1.4 | Case insensitive | Search with mixed case | Matches regardless of case |
| 5.1.5 | Keyboard shortcut | Press Cmd+K | Search bar focused |
| 5.1.6 | Clear search | Click X or clear input | All books shown |

### 5.2 Status Filters

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 5.2.1 | Filter read | Click Read filter | Only read books shown |
| 5.2.2 | Filter unread | Click Unread filter | Only unread books shown |
| 5.2.3 | Filter owned | Click Owned filter | Only owned books shown |
| 5.2.4 | Filter not owned | Click Not Owned filter | Only not-owned books shown |
| 5.2.5 | Combined filters | Read + Owned | Books matching both shown |
| 5.2.6 | Filter + search | Apply filter, then search | Both applied |

---

## 6. Export Tests

### 6.1 JSON Export

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 6.1.1 | Export all | Settings → Export JSON | JSON file downloads |
| 6.1.2 | Export shelf | Select shelf, export | Only shelf books in JSON |
| 6.1.3 | JSON structure | Inspect exported file | Valid JSON with book data |
| 6.1.4 | Filename format | Check downloaded file | Contains shelf name + date |

### 6.2 CSV Export

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 6.2.1 | Export all | Settings → Export CSV | CSV file downloads |
| 6.2.2 | Export shelf | Select shelf, export | Only shelf books in CSV |
| 6.2.3 | CSV headers | Inspect file | Proper column headers |
| 6.2.4 | Filename format | Check downloaded file | Contains shelf name + date |

---

## 7. Authentication Tests

### 7.1 Phone-Based Auth

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 7.1.1 | Phone identifier | Visit `/+1234567890` | User's books load |
| 7.1.2 | Username identifier | Visit `/username` | Same user's books load |
| 7.1.3 | Invalid identifier | Visit `/nonexistent` | 404 or empty state |

### 7.2 Verification Flow

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 7.2.1 | Send phone code | Enter phone, request code | SMS with code sent |
| 7.2.2 | Verify phone | Enter correct code | Verification succeeds |
| 7.2.3 | Invalid code | Enter wrong code | Error message |
| 7.2.4 | Magic link | Enter email, request link | Email sent |
| 7.2.5 | Verify email | Click magic link | Email verified |

### 7.3 Username Claim

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 7.3.1 | Claim username | Enter unique username | Username saved |
| 7.3.2 | Duplicate blocked | Claim existing username | Error message |
| 7.3.3 | Invalid format | Special chars in username | Validation error |

---

## 8. Integration Tests

### 8.1 Twilio Integration

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 8.1.1 | Webhook receives | Send SMS to Twilio number | Request logged in dev server |
| 8.1.2 | Reply sent | Command processed | SMS reply received on phone |
| 8.1.3 | MMS received | Send photo | Media URL accessible |

### 8.2 Google Books API

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 8.2.1 | Metadata fetch | Add book by ISBN | Title/author/cover populated |
| 8.2.2 | Search works | Search "Dune" | Results returned |
| 8.2.3 | Rate limit handling | Rapid requests | Graceful degradation or retry |

### 8.3 Google Vision API

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 8.3.1 | Barcode detection | Upload barcode image | ISBN extracted |
| 8.3.2 | Timeout handling | Large/slow image | 5s timeout, error message |
| 8.3.3 | No barcode | Upload non-barcode image | "No barcode found" message |

### 8.4 Trello Integration

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 8.4.1 | Card creation | Submit feedback | Card appears in Trello board |
| 8.4.2 | Screenshot upload | Attach screenshot | Attachment on Trello card |

---

## 9. Edge Cases & Error Handling

### 9.1 Input Validation

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 9.1.1 | Invalid ISBN | Enter `1234567890123` | "Invalid ISBN" message |
| 9.1.2 | Malformed URL | Enter random URL | "Could not detect book" |
| 9.1.3 | Empty input | Submit empty form | Validation error |
| 9.1.4 | XSS attempt | Enter `<script>alert(1)</script>` | Input sanitized |

### 9.2 Network Errors

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 9.2.1 | Offline web | Disconnect network, interact | Error toast, no crash |
| 9.2.2 | API timeout | Slow/failing API | Timeout message, retry option |
| 9.2.3 | Partial failure | Some books fail to add | Success count + failure message |

### 9.3 Data Integrity

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 9.3.1 | Duplicate ISBN | Add same ISBN twice | Single entry, duplicate message |
| 9.3.2 | User isolation | Query another user's data | 403 or empty result |
| 9.3.3 | Cascade delete | Delete user with books/shelves | All related data removed |

---

## 10. Test Data Reference

### Sample ISBNs

| Book | ISBN-13 | ISBN-10 |
|------|---------|---------|
| The Odyssey | 9780140449136 | 0140449132 |
| Project Hail Mary | 9780593135204 | 0593135202 |
| Dune | 9780441172719 | 0441172717 |
| 1984 | 9780451524935 | 0451524934 |
| The Hobbit | 9780547928227 | 0547928227 |

### Sample Amazon URLs

```
# Full URL
https://www.amazon.com/Project-Hail-Mary-Andy-Weir/dp/0593135202

# Short URL
https://a.co/d/abc1234
```

### Sample Retailer URLs

```
# Bookshop.org
https://bookshop.org/p/books/dune-frank-herbert/1234567?ean=9780441172719

# Barnes & Noble
https://www.barnesandnoble.com/w/dune-frank-herbert/1234567?ean=9780441172719

# Indiecommerce
https://www.indiestore.com/book/9780140449136
```

### SMS Test Messages

```
# Commands
START
STOP
HELP
FEEDBACK

# Book additions
9780140449136
0140449132
https://www.amazon.com/dp/0593135202
Dune by Frank Herbert
ADD

# Note responses
This was recommended by Sarah at book club
👍
skip
no
```

---

## Quick Reference: Pre-Deploy Checklist

Run before any production deployment:

```
[ ] npm run check                    - TypeScript/Svelte compilation
[ ] npm run build                    - Production build succeeds
[ ] Homepage loads (/)               - No console errors
[ ] User page loads (/[id])          - Books display correctly
[ ] Add book via ISBN                - Modal → Detection → Addition works
[ ] Add book via photo               - Vision API → Detection → Addition works
[ ] Read/Owned toggles               - Persist after refresh
[ ] Shelf creation                   - New shelf appears in nav
[ ] Shelf assignment                 - Book added/removed from shelf
[ ] Export (JSON + CSV)              - Files download with correct data
[ ] SMS: START                       - Welcome message, account created
[ ] SMS: ISBN                        - Book added, reply received
[ ] SMS: Photo                       - Barcode detected, book added
[ ] SMS: STOP                        - Opt-out confirmed
[ ] Feedback submission              - Card created in Trello
```

---

## Troubleshooting

### Common Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| SMS not received | Twilio webhook misconfigured | Check ngrok/webhook URL |
| Barcode not detected | Image quality/lighting | Try clearer photo |
| Book not found | ISBN not in Google Books | Try Open Library directly |
| 500 error on user page | Invalid identifier format | Check URL encoding |
| Export empty | No books match filter | Try "All Books" |

### Environment Checks

```bash
# Verify env vars are set
echo $SUPABASE_URL
echo $TWILIO_ACCOUNT_SID
echo $GOOGLE_CLOUD_PROJECT

# Test Twilio webhook locally
npm run dev:tunnel   # or ngrok http 5173
```

---

*Last updated: January 2026*
