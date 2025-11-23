# SMS Flow Documentation

This document maps out all SMS workflows, states, and responses for the TBR system.

## User States

| State | has_started | opted_out | Description |
|-------|-------------|-----------|-------------|
| **New User** | false | false | First contact, user record just created |
| **Active User** | true | false | Can add books, normal operations |
| **Opted Out** | any | true | Cannot add books, must START to resubscribe |

## Command Flow

### START Command
```
Input: "START" (exact, case-insensitive)

New User (has_started=false):
  → Set has_started=true, started_at=now
  → "Great! Text me an ISBN, Amazon link, or photo of a barcode to add your first book.

     View your shelf: https://tbr-delta.vercel.app/%2B15551234567"

Opted Out User (opted_out=true):
  → Set has_started=true, opted_out=false
  → "Great! Text me an ISBN, Amazon link, or photo of a barcode to add your first book.

     View your shelf: https://tbr-delta.vercel.app/%2B15551234567"

Already Active:
  → "Great! Text me an ISBN, Amazon link, or photo of a barcode to add your first book.

     View your shelf: https://tbr-delta.vercel.app/%2B15551234567"

Note: URL includes the user's phone number (URL-encoded, + becomes %2B)
```

### STOP Command
```
Input: "STOP" (exact, case-insensitive)

Active User:
  → Set opted_out=true, opted_out_at=now
  → "You're unsubscribed from TBR. Reply START anytime to resubscribe."

Already Opted Out:
  → "You're already unsubscribed. Reply START to resubscribe."
```

### HELP Command
```
Input: "HELP" or "?" (exact, case-insensitive)

Any State:
  → "Send me an ISBN (10 or 13 digits), Title by Author, photo of a barcode, or Amazon link!"
```

## Message Processing Flow

### 1. New User (has_started=false, any message)
```
User: "9780140328721"
System: "Welcome to TBR! Reply START to begin adding books to your shelf."

User: "START"
System: "Great! Text me an ISBN, Amazon link, or photo of a barcode to add your first book."

User: "9780140328721"
System: "✓ Added "Animal Farm" by George Orwell to your shelf!"
```

### 2. Opted Out User (opted_out=true, any message)
```
User: "9780140328721"
System: "You're currently unsubscribed. Reply START to resubscribe and add books."

User: "START"
System: "Great! Text me an ISBN, Amazon link, or photo of a barcode to add your first book."

User: "9780140328721"
System: "✓ Added "Animal Farm" by George Orwell to your shelf!"
```

### 3. Active User - ISBN Text
```
User: "978-0-14-032872-1"
System: "✓ Added "Animal Farm" by George Orwell to your shelf!

        View: https://tbr-delta.vercel.app/%2B15551234567"

User: "9780140328721" (duplicate)
System: ""Animal Farm" is already on your shelf!"

User: "1234567890123" (invalid checksum)
System: "Invalid ISBN: [checksum error message]"

User: "9781234567890" (valid but not found)
System: "Couldn't find book info for ISBN 9781234567890. Try a different ISBN?"

### 3a. Active User - Title/Author Text (stateless MVP)
```
User: "Project Hail Mary by Andy Weir"
System: "Found: \"Project Hail Mary\" by Andy Weir (ISBN: 9780593135204).\nReply with that ISBN or reply ADD to add, or open to pick another: https://tbr-delta.vercel.app/%2B15551234567?q=Project%20Hail%20Mary%20by%20Andy%20Weir"

User: "The Hobbit Tolkien"
System: "Best match: \"The Hobbit\" by J.R.R. Tolkien (ISBN: 9780547928227).\nReply with that ISBN or reply ADD to add, or open to pick another: https://tbr-delta.vercel.app/%2B15551234567?q=The%20Hobbit%20Tolkien"

User: "Some obscure title"
System: "Couldn't find a match. Try 'Title by Author' or open: https://tbr-delta.vercel.app/%2B15551234567?q=Some%20obscure%20title"
```

### 3b. Active User - ADD command
```
User: "ADD"
System: "✓ Added \"Project Hail Mary\" by Andy Weir to your shelf!\n\nView: https://tbr-delta.vercel.app/%2B15551234567"

User: "ADD 9780547928227"
System: "✓ Added \"The Hobbit\" by J.R.R. Tolkien to your shelf!\n\nView: https://tbr-delta.vercel.app/%2B15551234567"

User: "ADD" (no prior suggestion)
System: "I don't have a recent book to add. Reply with an ISBN (10 or 13 digits) or send a title like 'Title by Author' first."
```
```

### 4. Active User - Amazon Link
```
User: "https://www.amazon.com/dp/0140328726"
System: "✓ Added "Animal Farm" by George Orwell to your shelf!"

User: "https://amazon.com/some-invalid-url"
System: "Couldn't find ISBN from that Amazon link. Try texting the ISBN directly!"
```

### 5. Active User - Photo (MMS)
```
User: [Photo with clear barcode]
System: "Found 1 ISBN, added 1 to your shelf:\n- Animal Farm"

User: [Photo with multiple barcodes]
System: "Found 3 ISBNs, added 2 to your shelf:\n- Animal Farm\n- 1984\n\nAlready on shelf: Brave New World"

User: [Photo with no readable ISBN]
System: "Photo received, no valid ISBN detected."

User: [Non-image file]
System: "That doesn't look like an image. Please send a photo of a barcode."
```

## Error Handling

### Network/API Errors
- **Google Books timeout**: "Couldn't find book info for ISBN [isbn]. Try a different ISBN?"
- **Supabase error**: "Oops, had trouble saving. Try again?"
- **MMS download fail**: "Could not download the photo. Please try again."
- **MMS timeout**: "Photo processing timed out. Please try again."
- **Generic error**: "Sorry, something went wrong. Try again?"

### Validation Errors
- **No ISBN detected**: "Send me an ISBN (10 or 13 digits), Title by Author, photo of a barcode, or Amazon link!"
- **Invalid ISBN checksum**: "Invalid ISBN: [reason]"
- **Amazon parse error**: "Had trouble reading that Amazon link. Try the ISBN directly?"

## Message Customization

All messages are defined in `src/lib/server/sms-messages.ts`. To update any message:
1. Edit the appropriate constant in `SMS_MESSAGES`
2. TypeScript will ensure all references are updated
3. Run `npm run check` to verify

## Future Enhancements

Consider adding:
- **Fuzzy command matching**: "start please" → START
- **Mixed content**: "START 9780140328721" → Process both
- **Help context**: Different HELP messages based on user state
- **Undo/Remove**: "REMOVE [title]" to delete books
- **List**: "LIST" to get summary of shelf via SMS
