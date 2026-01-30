# TBR Intent Strategy: Phase 1 Implementation Handoff

**For:** Claude Code in tbr-fyi-beta repository  
**Date:** January 26, 2026  
**Purpose:** Implement capture-time context collection for the intent memory system

---

## Strategic Context

TBR is being reframed from "frictionless capture layer" to "personal memory system for book intent." The core insight: **TBR intervenes between intent and forgetting, not just at capture.**

The key metric shift:
- **Old:** Captures per user
- **New:** Recovered intents per user (books meaningfully revisited after ≥7 days)

Phase 1 focuses on collecting intent at the moment of save, so users can recover *why* they wanted a book later.

---

## Phase 1 Scope

### P0 (Must Have)
1. **SMS: Add optional note prompt after save confirmation**
2. **SMS: Handle note replies and attach to the saved book**
3. **Web UI: Update note prompt copy to intent-focused language**
4. **Rotating prompts: Implement 4 prompt variants**

### P1 (Should Have)
5. **Auto-detect source type** (sms_text, sms_photo, sms_link, web_manual, web_link)
6. **Store source_type on books table**

### P2 (Nice to Have)
7. **Tappable reaction chips in web UI** (defer to Phase 2)

---

## Current Codebase State

### Relevant Files

```
src/
├── routes/
│   └── api/
│       └── sms/
│           └── +server.ts          # SMS webhook handler - MODIFY
├── lib/
│   ├── server/
│   │   ├── sms-messages.ts         # SMS message templates - MODIFY
│   │   ├── book-operations.ts      # Book upsert logic - MODIFY
│   │   └── supabase.ts             # DB client
│   └── components/
│       └── ui/
│           └── Card.svelte         # Book card component - MODIFY (copy only)
└── ...

supabase/
└── migrations/                      # Add new migration for source_type
```

### Database Schema (Current)

```sql
-- books table (relevant columns)
CREATE TABLE books (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  isbn13 TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT[],
  note TEXT,                    -- Already exists! Just need to populate
  added_at TIMESTAMPTZ,
  -- ... other columns
);

-- sms_context table (for multi-step flows)
CREATE TABLE sms_context (
  user_id TEXT PRIMARY KEY,
  last_command TEXT,
  detected_books JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### SMS Flow (Current)

1. User texts ISBN/link/photo → `+server.ts` handles webhook
2. Book is detected and saved via `book-operations.ts`
3. Confirmation sent: `"✓ Saved: [Title] by [Author]"`
4. Flow ends

### SMS Flow (Target)

1. User texts ISBN/link/photo → `+server.ts` handles webhook
2. Book is detected and saved via `book-operations.ts`
3. **NEW:** Store book ID in `sms_context` with `last_command: 'AWAITING_NOTE'`
4. Confirmation sent with prompt: `"✓ Saved: [Title] by [Author]\n\nReply with a note for future you, or just 👍 to skip"`
5. **NEW:** If user replies with text (not a new ISBN/command), attach as note to last saved book
6. **NEW:** If user replies with 👍 or sends new book, clear context and proceed

---

## Implementation Details

### 1. SMS Note Prompt (P0)

**File:** `src/lib/server/sms-messages.ts`

Add/modify the save confirmation message:

```typescript
// Current
export const SAVE_CONFIRMATION = (title: string, author: string) =>
  `✓ Saved: ${title} by ${author}`;

// New
export const SAVE_CONFIRMATION_WITH_PROMPT = (title: string, author: string, prompt: string) =>
  `✓ Saved: ${title} by ${author}\n\n${prompt}`;

// Rotating prompts
export const NOTE_PROMPTS = [
  "Reply with a note for future you, or 👍 to skip",
  "What caught your attention? (Reply or 👍 to skip)",
  "Who recommended this? (Reply or 👍 to skip)", 
  "What mood is this for? (Reply or 👍 to skip)",
];

export function getRandomNotePrompt(): string {
  return NOTE_PROMPTS[Math.floor(Math.random() * NOTE_PROMPTS.length)];
}
```

### 2. SMS Context Tracking (P0)

**File:** `src/routes/api/sms/+server.ts`

After saving a book, store context for potential note reply:

```typescript
// After successful book save
await supabase.from('sms_context').upsert({
  user_id: phoneNumber,
  last_command: 'AWAITING_NOTE',
  detected_books: JSON.stringify([{ 
    book_id: savedBook.id, 
    isbn13: savedBook.isbn13,
    title: savedBook.title 
  }]),
  updated_at: new Date().toISOString()
});
```

### 3. Handle Note Replies (P0)

**File:** `src/routes/api/sms/+server.ts`

Before processing as a new book, check if this is a note reply:

```typescript
// Early in the handler, after getting user context
const context = await supabase
  .from('sms_context')
  .select('*')
  .eq('user_id', phoneNumber)
  .single();

// Check if awaiting note and message is not a command/ISBN/URL
if (context?.data?.last_command === 'AWAITING_NOTE') {
  const message = body.trim();
  
  // Skip indicators
  if (message === '👍' || message.toLowerCase() === 'skip') {
    await clearSmsContext(phoneNumber);
    return new Response(twiml('Got it! Book saved.'));
  }
  
  // Not a new ISBN, URL, or command - treat as note
  if (!looksLikeISBN(message) && !looksLikeURL(message) && !isCommand(message)) {
    const books = JSON.parse(context.data.detected_books);
    const lastBook = books[0];
    
    // Update book with note
    await supabase
      .from('books')
      .update({ note: message })
      .eq('id', lastBook.book_id);
    
    await clearSmsContext(phoneNumber);
    return new Response(twiml(`Note saved for "${lastBook.title}"`));
  }
  
  // Otherwise, it's a new book - clear context and continue normal flow
  await clearSmsContext(phoneNumber);
}
```

### 4. Update Web UI Copy (P0)

**File:** `src/lib/components/ui/Card.svelte`

Change the note prompt language:

```svelte
<!-- Current -->
<button onclick={startEditingNote} class="...">
  + Add a note
</button>

<!-- New -->
<button onclick={startEditingNote} class="...">
  + Add a note for future you
</button>

<!-- Current placeholder -->
<textarea
  placeholder="Why did you add this? Where did you hear about it?"
  ...
></textarea>

<!-- New placeholder (rotate these) -->
<textarea
  placeholder="What caught your attention about this one?"
  ...
></textarea>
```

### 5. Add source_type Column (P1)

**New migration file:** `supabase/migrations/007_add_source_type.sql`

```sql
-- Add source_type to track how books were added
ALTER TABLE books ADD COLUMN source_type TEXT;

-- Possible values: 'sms_isbn', 'sms_photo', 'sms_link', 'sms_title', 'web_manual', 'web_link'
COMMENT ON COLUMN books.source_type IS 'How the book was added: sms_isbn, sms_photo, sms_link, sms_title, web_manual, web_link';

-- Backfill existing books (all are currently from SMS or unknown)
UPDATE books SET source_type = 'unknown' WHERE source_type IS NULL;
```

### 6. Track source_type on Save (P1)

**File:** `src/lib/server/book-operations.ts`

Add source_type parameter:

```typescript
export async function upsertBook(
  supabase: SupabaseClient,
  userId: string,
  bookData: BookData,
  sourceType?: string  // NEW
): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .upsert({
      user_id: userId,
      isbn13: bookData.isbn13,
      title: bookData.title,
      author: bookData.author,
      // ... other fields
      source_type: sourceType,  // NEW
    })
    .select()
    .single();
  // ...
}
```

**File:** `src/routes/api/sms/+server.ts`

Pass source type based on input detection:

```typescript
// After detecting input type
let sourceType = 'sms_text';
if (isISBN) sourceType = 'sms_isbn';
else if (isAmazonLink || isBookshopLink) sourceType = 'sms_link';
else if (hasPhoto) sourceType = 'sms_photo';

// Pass to upsertBook
const savedBook = await upsertBook(supabase, userId, bookData, sourceType);
```

---

## Prompt Rotation Strategy

For Phase 1, use simple random rotation. In Phase 2, consider:
- Source-aware prompts (if link detected, ask "Where did you find this?")
- Time-aware prompts (evening: "For winding down?")
- Frequency-aware (first save of day vs. batch saving)

**Initial 4 prompts:**

| ID | Prompt | When to Use |
|----|--------|-------------|
| 1 | "Reply with a note for future you, or 👍 to skip" | Default |
| 2 | "What caught your attention? (Reply or 👍)" | Default |
| 3 | "Who recommended this? (Reply or 👍)" | Good for links |
| 4 | "What mood is this for? (Reply or 👍)" | Default |

---

## Testing Checklist

### SMS Flow
- [ ] Save book via ISBN → receive confirmation with note prompt
- [ ] Reply with note text → note attached to book
- [ ] Reply with 👍 → context cleared, no note saved
- [ ] Reply with new ISBN → new book saved (note prompt for new book)
- [ ] Reply with HELP/STOP → commands work normally
- [ ] Timeout: if user doesn't reply, next message starts fresh

### Web UI
- [ ] Note button shows "Add a note for future you"
- [ ] Placeholder text is intent-focused
- [ ] Existing note editing still works

### Database
- [ ] source_type column exists
- [ ] New books have source_type populated
- [ ] Notes are saved correctly

---

## Files to Modify (Summary)

| File | Changes |
|------|---------|
| `src/lib/server/sms-messages.ts` | Add note prompts, rotation function |
| `src/routes/api/sms/+server.ts` | Add note reply handling, context tracking |
| `src/lib/server/book-operations.ts` | Add source_type parameter |
| `src/lib/components/ui/Card.svelte` | Update copy (note button, placeholder) |
| `supabase/migrations/007_add_source_type.sql` | New migration |

---

## Success Criteria

Phase 1 is complete when:
1. Users receive a note prompt after saving via SMS
2. Users can reply with a note that gets attached to the book
3. Users can skip with 👍 without friction
4. Web UI copy is updated to intent-focused language
5. source_type is tracked for new books

---

## Out of Scope for Phase 1

- Resurfacing mechanisms (Phase 3)
- Card display reordering (Phase 2)
- Recovered intent metrics (Phase 4)
- Weekly digest emails (Phase 3)
- Tappable reaction chips (Phase 2)

---

## Related Documents

- `tbr-strategy-source/decisions/2026-01-26-intent-strategy-synthesis.md` - Full strategic context
- `tbr-strategy-source/TBR_COMPLETE_PICTURE.md` - Overall product vision
- `tbr-fyi-beta/PROJECT_CONTEXT.md` - Technical context
- `tbr-fyi-beta/SMS_FLOW.md` - Current SMS implementation details

---

## Questions to Resolve

1. **Timeout behavior:** How long should `AWAITING_NOTE` context persist? Suggest 24 hours.
2. **Multiple books:** If user saves multiple books quickly, which one gets the note? Suggest: most recent.
3. **Note length limit:** Should we cap note length? Suggest: 500 chars for SMS, unlimited for web.

---

*This handoff document provides implementation context for Phase 1 of the TBR intent strategy. The goal is to start collecting user intent at capture time so it can be surfaced during retrieval in later phases.*