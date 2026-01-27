# Testing Guide

This document captures the repeatable checks needed to keep TBR Delta stable after changes. Use it alongside the feature plans in `docs/plans/` and the project overview in `PROJECT_CONTEXT.md`.

---

## 1. Prerequisites

- `.env` configured with Supabase, Twilio, Google Cloud Vision, Trello credentials.
- Database seeded with at least one user record whose `phone_number` matches the test handset. (For local-only tests, the phone number can be any identifier such as `+19999999999`.)
- Twilio webhook pointing at the running dev server or ngrok tunnel when exercising SMS flows.
- Chrome or another modern browser for UI validation.
- Optional: A small library of ISBNs and sample barcode photos for regression checks (see `docs/features/title-author-sms-examples.md` for quick references).

---

## 2. Automated Checks

| Command | Purpose |
| --- | --- |
| `npm run check` | Ensures SvelteKit routes sync correctly and the TypeScript/Svelte compile steps pass. |
| `npm run build` | Verifies the production bundle compiles without errors. Run before deployment when feasible. |

> Tip: Run `npm run dev` locally **before** the other checks so missing environment variables are caught early.

---

## 3. Manual Web QA

Follow this sequence when verifying UI changes:

1. **Homepage (`/`)**
   - Confirm instructions render and the localStorage hint persists the most recent user ID.
   - Scan the QR code with a phone; it should resolve to the Twilio number.
2. **User Shelf (`/[username]`)**
   - Load an existing phone-number route (e.g., `http://localhost:5173/+15551234567`).
   - Toggle between *Grid* and *List* views; state should persist during the session.
   - Add a shelf, rename collision guard should display when creating a duplicate name.
   - Delete a shelf, confirm redirect to "All Books" when deleting the active shelf.
   - Toggle `Read`/`Owned` badges and ensure the state survives a refresh.
   - Edit a note, blur the input, and confirm changes persist.
   - Open the shelf assignment menu, add/remove a shelf, and verify immediate UI updates after `invalidateAll()`.
   - Expand/Collapse descriptions and verify the scrollbar styling.
   - Open the barcode panel, confirm barcode renders and scales responsively.
   - Use the copy ISBN action and ensure the success icon appears, clipboard contains the ISBN.
3. **Add Book Modal**
   - Launch via `+` button or keyboard shortcut (`+` or `=`).
   - Test text input detection with:
     - Raw ISBN-13.
     - Amazon URL (full and short `a.co`).
     - "Title by Author" style query.
   - Upload a barcode photo (drag/drop and file picker) and confirm detection triggers automatically.
   - Deselect one detected book to validate selection logic.
   - Add books and verify confirmation toaster plus list refresh.
4. **Feedback Modal**
   - Open the FAB, submit feedback with and without a screenshot, confirm Trello cards appear (check Trello board).

---

## 4. SMS Flow Verification

These tests require Twilio pointing at your dev server (or ngrok tunnel via `npm run dev:tunnel`). Each step should be validated with a real handset when possible.

1. **START / STOP**
   - Send `STOP`, ensure an opt-out confirmation is returned and Supabase reflects `opted_out=true`.
   - Send `START`, verify welcome message, default shelf creation, and database updates.
2. **ADD ISBN (Single)**
   - Text an ISBN and confirm the SMS reply includes title/author. Refresh web UI to verify the book appears on the default shelf.
3. **ADD via MMS Photo**
   - Send a clear barcode photo. Expect detection response with title confirmation. Confirm book metadata (cover, description) populates.
4. **ADD Amazon Link**
   - Send a product URL (regular + `a.co` short). Verify ISBN extraction and addition.
5. **Multibook Flow**
   - Send `ADD` to enter context mode, follow with multiple ISBNs. Ensure the session tracks state and completes with summary reply.
6. **HELP Command**
   - Verify help text includes latest instructions and matches `PROJECT_CONTEXT.md` guidance.

> Remember to manually clear testing books/shelves from Supabase after SMS tests so production data stays clean.

---

## 5. API Spot Checks

Use cURL or REST client extensions to hit key endpoints while the dev server is running:

```bash
# Add book (web endpoint)
curl -X POST http://localhost:5173/api/books/add \
  -H "Content-Type: application/json" \
  -d '{"isbn":"9780140449136"}'

# Toggle read status
curl -X POST http://localhost:5173/api/books/update \
  -H "Content-Type: application/json" \
  -d '{"id":"<book-uuid>","is_read":true}'

# Create shelf
curl -X POST http://localhost:5173/api/shelves \
  -H "Content-Type: application/json" \
  -d '{"user_id":"+15551234567","name":"Sci-Fi"}'
```

Confirm 200 responses and inspect Supabase for matching changes.

---

## 6. Regression Checklist

Run this quick sweep before any production deploy:

- [ ] `npm run check`
- [ ] `npm run build`
- [ ] Homepage renders without console errors
- [ ] `/[username]` route loads (no `Missing +page.svelte` or 500s)
- [ ] Add book modal detects ISBN, Amazon URL, and image
- [ ] Read/Owned toggles persist
- [ ] Shelf creation and deletion work
- [ ] Barcode renders
- [ ] Feedback submission reaches Trello
- [ ] SMS START/STOP/ADD flow verified against Twilio staging number

Document any deviations in `DEVLOG.md` under the testing date so we keep a trace of edge cases and fixes.
