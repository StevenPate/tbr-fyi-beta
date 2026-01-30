# Phase 1: Intent Capture Implementation Plan

**Date:** 2026-01-26
**Goal:** Collect intent context at the moment of save so users can recover *why* they wanted a book later.

---

## Overview

This plan implements P0 and P1 items from the Intent Strategy Synthesis:

| Priority | Item | Status |
|----------|------|--------|
| P0 | SMS note prompt after save | Not started |
| P0 | Handle note replies | Not started |
| P0 | Update web UI copy | Not started |
| P0 | Rotating prompts (4 variants) | Not started |
| P1 | Auto-detect source_type | Not started |
| P1 | Store source_type on books | Not started |

---

## Implementation Tasks

### 1. Add source_type column (P1)

**File:** `supabase/migrations/016_add_source_type.sql`

```sql
-- Add source_type to track how books were added
ALTER TABLE books ADD COLUMN IF NOT EXISTS source_type TEXT;

COMMENT ON COLUMN books.source_type IS
  'How the book was added: sms_isbn, sms_photo, sms_link, sms_title, web_manual, web_link';
```

**Run locally:**
```bash
npx supabase db push
```

---

### 2. Add note prompts to SMS messages (P0)

**File:** `src/lib/server/sms-messages.ts`

Add after the existing exports:

```typescript
// Intent capture prompts - rotated randomly
export const NOTE_PROMPTS = [
  "Reply with a note for future you, or just ignore",
  "What caught your attention? (or ignore)",
  "Who recommended this? (or ignore)",
  "What mood is this for? (or ignore)",
] as const;

export function getRandomNotePrompt(): string {
  return NOTE_PROMPTS[Math.floor(Math.random() * NOTE_PROMPTS.length)];
}
```

Update `bookAdded()`:

```typescript
bookAdded: (title: string, phoneNumber: string, author?: string, notePrompt?: string) => {
  let msg = `✓ Added "${title}"${author ? ` by ${author}` : ''} to your shelf!\n\nView: ${getShelfUrl(phoneNumber)}`;
  if (notePrompt) {
    msg += `\n\n${notePrompt}`;
  }
  return msg;
},
```

Add note confirmation message:

```typescript
noteSaved: (title: string) =>
  `Note saved for "${title}"`,

noteSkipped: () =>
  `Got it!`,
```

---

### 3. Update sms_context table schema

**File:** `supabase/migrations/016_add_source_type.sql` (append)

```sql
-- Relax last_isbn13 constraint: note flow uses book_id, not ISBN
ALTER TABLE sms_context ALTER COLUMN last_isbn13 DROP NOT NULL;

-- Extend sms_context for note flow
ALTER TABLE sms_context
  ADD COLUMN IF NOT EXISTS awaiting_note BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_book_id UUID,
  ADD COLUMN IF NOT EXISTS last_book_title TEXT;
```

> **Note:** `last_isbn13` was originally required for the ADD command flow. The note flow uses `last_book_id` instead (the actual record UUID). Making `last_isbn13` nullable allows both flows to coexist without forcing dummy values.

---

### 4. Handle note flow in SMS handler (P0)

**File:** `src/routes/api/sms/+server.ts`

**4a. Add helper functions at top of file:**

```typescript
// Check if message looks like a note (not ISBN, URL, or command)
function looksLikeNote(text: string): boolean {
  const cleaned = text.trim();

  // Skip indicators
  if (cleaned === '👍' || cleaned.toLowerCase() === 'skip' || cleaned.toLowerCase() === 'no') {
    return false;
  }

  // Commands
  if (detectCommand(cleaned)) return false;

  // ISBN (10 or 13 digits)
  const digits = cleaned.replace(/[^0-9Xx]/g, '');
  if (digits.length === 10 || digits.length === 13) return false;

  // URLs
  if (cleaned.includes('amazon.com') || cleaned.includes('a.co') ||
      cleaned.includes('bookshop.org') || cleaned.includes('barnesandnoble.com')) {
    return false;
  }

  // ADD command
  if (/^ADD(\b|\s|!|\.)/i.test(cleaned)) return false;

  return true;
}

async function clearNoteContext(phoneNumber: string): Promise<void> {
  await supabase
    .from('sms_context')
    .update({
      awaiting_note: false,
      last_book_id: null,
      last_book_title: null
    })
    .eq('phone_number', phoneNumber);
}

async function setNoteContext(
  phoneNumber: string,
  bookId: string,
  bookTitle: string
): Promise<void> {
  await supabase
    .from('sms_context')
    .upsert({
      phone_number: phoneNumber,
      awaiting_note: true,
      last_book_id: bookId,
      last_book_title: bookTitle,
      updated_at: new Date().toISOString()
    });
}
```

**4b. Add note reply handling early in POST handler (after user status check):**

```typescript
// Check if awaiting note reply
const { data: noteContext } = await supabase
  .from('sms_context')
  .select('awaiting_note, last_book_id, last_book_title')
  .eq('phone_number', userId)
  .maybeSingle();

if (noteContext?.awaiting_note && noteContext.last_book_id) {
  const message = (body || '').trim();

  // Skip indicators - clear context and acknowledge
  if (message === '👍' || message.toLowerCase() === 'skip' || message.toLowerCase() === 'no') {
    await clearNoteContext(userId);
    return twimlResponse(SMS_MESSAGES.noteSkipped());
  }

  // If it looks like a note (not ISBN/URL/command), save it
  if (looksLikeNote(message)) {
    await supabase
      .from('books')
      .update({ note: message.slice(0, 500) }) // 500 char limit
      .eq('id', noteContext.last_book_id);

    await clearNoteContext(userId);
    return twimlResponse(SMS_MESSAGES.noteSaved(noteContext.last_book_title));
  }

  // Otherwise, clear context and continue with normal flow
  await clearNoteContext(userId);
}
```

**4c. After each successful book save, set note context and add prompt:**

Find all places where `SMS_MESSAGES.bookAdded()` is called and update:

```typescript
// After successful save via upsertBookForUser
const notePrompt = getRandomNotePrompt();
await setNoteContext(userId, result.bookId!, metadata.title);

let message = SMS_MESSAGES.bookAdded(metadata.title, userId, authorText, notePrompt);
message = await maybeAddFeedbackPrompt(message, userId);
message = await maybeAddAccountPrompt(message, userId);
return twimlResponse(message);
```

---

### 5. Track source_type on save (P1)

**File:** `src/lib/server/book-operations.ts`

Update function signature:

```typescript
export async function upsertBookForUser(
  userId: string,
  metadata: BookMetadata,
  sourceType?: string  // NEW
): Promise<UpsertBookResult> {
```

Add to upsert object:

```typescript
source_type: sourceType,
```

**File:** `src/routes/api/sms/+server.ts`

Pass source type to `upsertBookForUser()`:

```typescript
// For ISBN detection
const result = await upsertBookForUser(userId, metadata, 'sms_isbn');

// For MMS/photo
const result = await upsertBookForUser(userId, metadata, 'sms_photo');

// For Amazon/retailer links
const result = await upsertBookForUser(userId, metadata, 'sms_link');

// For title/author search
const result = await upsertBookForUser(userId, metadata, 'sms_title');
```

---

### 6. Update web UI copy (P0)

**File:** `src/lib/components/ui/Card.svelte`

Line ~455, change:
```svelte
<!-- Old -->
+ Add a note

<!-- New -->
+ Add a note for future you
```

Line ~461, change placeholder:
```svelte
<!-- Old -->
placeholder="Why did you add this? Where did you hear about it?"

<!-- New -->
placeholder="What caught your attention about this one?"
```

---

## Testing Checklist

### SMS Flow
- [ ] Save book via ISBN → receive confirmation with note prompt
- [ ] Reply with note text → note attached to book, confirmation sent
- [ ] Reply with 👍 → context cleared, "Got it!" response
- [ ] Reply with "skip" or "no" → context cleared, "Got it!" response
- [ ] Reply with new ISBN → new book saved (starts fresh note flow)
- [ ] Reply with HELP/STOP → commands work normally
- [ ] Long pause (24h+) then reply → should start fresh (context expired)

### Web UI
- [ ] Note button shows "Add a note for future you"
- [ ] Placeholder text is "What caught your attention about this one?"
- [ ] Existing note editing still works
- [ ] Notes display correctly in collapsed view

### Database
- [ ] source_type column exists after migration
- [ ] New SMS books have source_type populated (sms_isbn, sms_photo, sms_link, sms_title)
- [ ] Notes are saved correctly (≤500 chars for SMS)
- [ ] sms_context table has new columns

---

## Files Modified (Summary)

| File | Changes |
|------|---------|
| `supabase/migrations/016_add_source_type.sql` | New migration |
| `src/lib/server/sms-messages.ts` | Add prompts, update bookAdded() |
| `src/lib/server/book-operations.ts` | Add sourceType parameter |
| `src/routes/api/sms/+server.ts` | Note flow handling, source tracking |
| `src/lib/components/ui/Card.svelte` | Update copy |

---

## Open Decisions

1. **Context timeout**: How long should `awaiting_note` persist?
   - Recommendation: 24 hours, then auto-clear on next message

2. **Note length**: 500 chars for SMS, unlimited for web?
   - Recommendation: Yes, enforce 500 char limit in SMS handler

3. **MMS note flow**: Should we prompt for notes after multi-book MMS?
   - Recommendation: No, skip for Phase 1 (complex UX)

---

## Execution Order

1. Run migration (source_type + sms_context columns)
2. Update `book-operations.ts` (sourceType param)
3. Update `sms-messages.ts` (prompts + bookAdded signature)
4. Update `+server.ts` (note flow + source tracking)
5. Update `Card.svelte` (copy changes)
6. Test SMS flow end-to-end
7. Test web UI
8. Deploy

---

*Reference: tbr-strategy-source/research/TBR_INTENT_STRATEGY_SYNTHESIS.md*
