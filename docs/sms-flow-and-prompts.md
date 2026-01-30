# TBR.fyi SMS Flow & Prompt System Documentation

> Last updated: 2026-01-30

## Part 1: SMS Message Flow

### Entry Point

All SMS messages come through `/api/sms` as a POST request from Twilio with form data:
- `From` - Sender's phone number (becomes user_id)
- `Body` - Message text
- `NumMedia` - Count of attached media (MMS photos)
- `MediaUrl0`, etc. - URLs to attached media

### High-Level Flow

```
Twilio SMS → /api/sms
    ↓
Parse (From, Body, NumMedia)
    ↓
Get/create user
    ↓
Command detection (START/STOP/HELP/FEEDBACK)
    ↓
Check awaiting_note context → Note capture flow
    ↓
Check opted_out → Reject if true
    ↓
Check has_started → Reject if false
    ↓
Book detection (priority order):
  1. MMS photo → barcode scan
  2. Amazon link
  3. Retailer link (Bookshop.org, B&N)
  4. Indiecommerce link (/book/{ISBN})
  5. Unsupported bookstore → error
  6. Plain ISBN
  7. Title/author search → stateless, user must reply ADD
    ↓
Fetch metadata → upsert book
    ↓
Set awaiting_note context + show prompt
    ↓
TwiML response
```

---

## Commands

### START (Opt-in)

**Trigger:** User sends "START" (case-insensitive)

**Actions:**
1. Set `users.has_started = true`
2. Set `users.opted_out = false`
3. For new users: Create "TBR" shelf, set as default

**Response:**
```
Great! Text me an ISBN, Amazon link, or photo of a barcode to add your first book.

View your shelf: https://tbr.fyi/+15551234567
```

### STOP (Opt-out)

**Trigger:** User sends "STOP"

**Actions:**
1. Set `users.opted_out = true`
2. Clear `users.feedback_opt_in = false`

**Response:**
```
You're unsubscribed from TBR. Reply START anytime to resubscribe.
```

**Consequence:** All future messages rejected until START

### HELP

**Trigger:** User sends "HELP" or "?"

**Response:**
```
Send me an ISBN (10 or 13 digits), Title by Author, photo of a barcode, or Amazon link!
```

### FEEDBACK

**Trigger:** User sends "FEEDBACK"

**Actions:**
1. Set `users.feedback_opt_in = true`

**Response:**
```
Thanks! We may text occasionally to ask how TBR is working for you. Reply STOP anytime to opt out.
```

### ADD (Delayed Book Addition)

**Trigger:** User sends "ADD" or "ADD 978..."

**Flow:**
1. Extract ISBN from message or use `sms_context.last_isbn13`
2. Fetch metadata and upsert book
3. Set awaiting_note context
4. Show note prompt

**Response (if no context):**
```
I don't have a recent book to add. Reply with an ISBN or send a title like 'Title by Author' first.
```

---

## Book Detection Methods (Priority Order)

### 1. MMS Photo (Barcode Scanning)

**Condition:** `NumMedia > 0`

**Flow:**
1. Download image from Twilio with auth
2. Call `detectBarcodes()` (Google Vision)
3. For each ISBN: fetch metadata, upsert
4. Return summary

**Note:** MMS does NOT trigger note prompts currently

### 2. Amazon Link

**Condition:** Body contains "amazon.com" or "a.co"

**Flow:**
1. Extract ISBN via `extractISBNFromAmazon()`
2. Handles short `a.co` links (follows redirects)

### 3. Retailer Links (Bookshop.org, Barnes & Noble)

**Condition:** Body contains supported retailer URL

**Flow:**
1. Extract ISBN from `?ean=` query parameter

### 4. Indiecommerce Links

**Condition:** Body contains `/book/{ISBN}` pattern

**Flow:**
1. Extract ISBN from URL path

### 5. Unsupported Bookstore

**Condition:** Bookstore URL but not parseable

**Response:**
```
I can't read ISBNs from that bookstore's links. Try texting the title and author or copy the ISBN from the page.
```

### 6. Plain ISBN

**Condition:** Body contains only 10 or 13 digits

### 7. Title/Author Search

**Condition:** No ISBN found by previous methods

**Flow:**
1. Parse "Title by Author" format
2. Search via `searchBooks()`
3. Show best match, ask user to reply "ADD"
4. Store in `sms_context`: last_isbn13, last_title

**Response:**
```
Found: "The Hobbit" by J.R.R. Tolkien (ISBN: 9780345809483). Reply ADD to add, or click here to add via web: [url]
```

**Note:** Does NOT add book automatically - user must reply ADD

---

## Note Capture Flow

### Trigger

After book successfully added, system sets:
- `sms_context.awaiting_note = true`
- `sms_context.last_book_id = [uuid]`
- `sms_context.last_book_title = [title]`

### Next Message Handling

When `awaiting_note=true`, next message is intercepted:

| Input | Action | `responded` | `note_length` |
|-------|--------|-------------|---------------|
| 👍 / "skip" / "no" | Clear context, acknowledge | `false` | `0` |
| "why" | Explain value of notes (keep context) | — | — |
| Chip shortcut | Save preset note | `true` | length |
| Free text (looks like note) | Save note (max 500 chars) | `true` | length |
| ISBN/URL/command | Clear context, process normally | — | — |

### Chip Shortcuts

| Emoji | Keyword | Saved Note |
|-------|---------|------------|
| 👥 | "friend" | "Friend rec" |
| 🎙️ | "pod", "podcast" | "Podcast" |
| 📚 | "store", "bookstore" | "Saw at bookstore" |

### WHY Command

Doesn't clear context - user can still reply with note after seeing explanation:

```
Books slip away fast. A quick note now — who told you, what mood it's for — helps future you remember why this one mattered.

Just reply with a note, or ignore this and move on!
```

---

## User Lifecycle

### New User (First Message)

1. Auto-created in `users` table with `has_started=false`
2. Responds with welcome message asking them to send START
3. Cannot add books until START

### Opted-In User

1. `has_started=true`, `opted_out=false`
2. Full access to book addition

### Opted-Out User

1. `opted_out=true`
2. All messages rejected with "unsubscribed" message
3. Can re-opt-in with START

---

## Auxiliary Prompts

### Account Creation Prompt

**Conditions:**
- User not verified (`verified_at` is null)
- Shown fewer than 5 times
- Not shown in last 7 days
- Has 5+ books

**Appended to book addition response:**
```
📚 You've been adding books! Secure your shelf with a free account:
https://tbr.fyi/auth/verify-phone?p=%2B15551234567
```

### Feedback Opt-in Prompt

**Conditions:**
- User hasn't opted in to feedback
- Never been shown this prompt
- Just added their first book

**Appended to first book addition:**
```
Reply FEEDBACK if you'd be open to sharing your experience sometime. This is a beta that can use input!
```

---

## Part 2: Prompt System

### Available Prompts

Defined in `/src/lib/server/note-prompts.ts`:

| ID | Text | Subtext | When Used |
|----|------|---------|-----------|
| `default` | "Who recommended it? What caught your attention?" | "(Your note helps you remember later)" | First book, rotation |
| `casual` | "Jot down who mentioned this—future you will thank you." | — | MMS photo |
| `mood` | "What were you in the mood for when you saved this?" | "(Fiction escape? Learn something? Comfort read?)" | Rotation |
| `direct` | "Why this book? Future you will want to know." | — | Rotation |
| `skip` | "Add a note for later—or reply 'skip' to move on." | — | Power users |

### Selection Logic

```javascript
function selectNotePrompt(context: PromptContext): NotePrompt {
  // First book always gets DEFAULT (teach the pattern)
  if (context.totalBooks === 1) return NOTE_PROMPTS.DEFAULT;

  // Photo adds get CASUAL (conversational, in-store vibe)
  if (context.sourceType === 'sms_photo') return NOTE_PROMPTS.CASUAL;

  // Power users get SKIP (respect their time)
  if (context.totalBooks > 20 || context.booksAddedToday >= 5) {
    return NOTE_PROMPTS.SKIP;
  }

  // Otherwise rotate, avoiding repetition
  const defaults = [DEFAULT, MOOD, DIRECT];
  const available = defaults.filter(p => p.id !== context.lastPromptId);
  return random(available);
}
```

### Context Object

```typescript
interface PromptContext {
  sourceType: 'sms_isbn' | 'sms_photo' | 'sms_search' | 'sms_link' | 'web';
  booksAddedToday: number;
  totalBooks: number;
  timeOfDay: number;  // 0-23 (not currently used)
  lastPromptId?: string;  // To avoid repetition
}
```

---

## Analytics Tracking

### `prompt_responses` Table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `user_id` | text | FK to users.phone_number |
| `book_id` | uuid | FK to books.id |
| `prompt_id` | text | Which prompt was shown |
| `responded` | boolean | `true`=note added, `false`=skipped |
| `note_length` | int | Character count of note |
| `source` | text | 'sms' or 'web' |
| `created_at` | timestamptz | When prompt was shown |

### Recording Flow

1. **Prompt Shown:** Insert row with `responded=false, note_length=0`
2. **User Responds:** Update row with actual values

### SMS Recording

```javascript
// When prompt shown (in bookAdded response)
await recordPromptShown(phoneNumber, bookId, promptId, 'sms');

// When user skips
await recordPromptResponse(userId, bookId, false, 0);

// When user adds note
await recordPromptResponse(userId, bookId, true, noteLength);
```

---

## Web Prompt API

### GET Prompt: `POST /api/books/note-prompt`

**Request:**
```json
{ "bookId": "uuid" }
```

**Response:**
```json
{
  "promptId": "default",
  "text": "Who recommended it? What caught your attention?",
  "subtext": "(Your note helps you remember later)"
}
```

**Side Effect:** Inserts `prompt_responses` row with `responded=false`

### Record Response: `PUT /api/books/note-prompt`

**Request:**
```json
{
  "bookId": "uuid",
  "responded": true,
  "noteLength": 45
}
```

**Side Effect:** Updates `prompt_responses` row

---

## Database Tables Summary

| Table | Purpose |
|-------|---------|
| `users` | User record, opt-in status, default_shelf_id, feedback flags |
| `sms_context` | Stateful SMS: awaiting_note, last_book_id, last_isbn13 |
| `books` | Book records with note, source_type |
| `shelves` | User shelves (auto-created TBR) |
| `book_shelves` | Book ↔ shelf assignments |
| `prompt_responses` | Prompt analytics |

---

## Source Types

The `source_type` column on `books` tracks how books were added:

| Value | Method |
|-------|--------|
| `sms_isbn` | Plain ISBN via SMS |
| `sms_photo` | MMS barcode scan |
| `sms_link` | Amazon/retailer link |
| `sms_search` | Title/author search (before ADD) |
| `sms_title` | ADD command after search |
| `web` | Web UI |

---

## Example User Journey

1. **User:** "978-0-345-80948-3"

2. **System:**
   - Fetches metadata: "The Hobbit by J.R.R. Tolkien"
   - Upserts book
   - Context: totalBooks=1 → selects DEFAULT prompt
   - Records prompt shown
   - Sets awaiting_note context
   - Responds:
   ```
   ✓ Added "The Hobbit" by J.R.R. Tolkien to your shelf!

   View: https://tbr.fyi/+15551234567

   Who recommended it? What caught your attention?
   (Your note helps you remember later)
   ```

3. **User:** "friend"

4. **System:**
   - Detects awaiting_note=true
   - Matches chip: "friend" → "Friend rec"
   - Updates book.note
   - Records: responded=true, note_length=10
   - Clears context
   - Responds: "Note saved for \"The Hobbit\""

---

## Key Files

| File | Purpose |
|------|---------|
| `src/routes/api/sms/+server.ts` | Main SMS endpoint |
| `src/lib/server/sms-messages.ts` | Message templates |
| `src/lib/server/note-prompts.ts` | Prompt definitions and selection |
| `src/lib/server/reaction-chips.ts` | Chip shortcut matching |
| `src/routes/api/books/note-prompt/+server.ts` | Web prompt API |
