# Reaction Chips Design

**Date:** 2026-01-26
**Status:** Ready for implementation
**Phase:** Intent Capture Phase 2

---

## Overview

Tappable reaction chips let users capture intent with a single tap instead of typing. Chips append text to the existing `note` field - no schema change needed.

**Goal:** Reduce friction for capturing "why I saved this book" across all touchpoints.

---

## Chip Set

| Chip | Emoji | Appends to Note | Category |
|------|-------|-----------------|----------|
| Friend | 👥 | "Friend rec" | Source |
| Podcast | 🎙️ | "Podcast" | Source |
| Newsletter | 📰 | "Newsletter" | Source |
| Social | 📱 | "Social media" | Source |
| Bookstore | 📚 | "Saw at bookstore" | Source |
| Cozy | 🛋️ | "Cozy read" | Mood |
| Learn | 🧠 | "Want to learn" | Mood |
| Must read | ⭐ | "Must read" | Urgency |
| Gift | 🎁 | "Gift idea" | Urgency |
| Other... | ✏️ | *focuses text field* | Escape hatch |

---

## Behavior

**Multi-select:** Chips toggle on/off. Multiple can be selected.

**Note composition:** Selected chips joined with " · " and prepended to typed text:

```
Selected: [Friend] [Must read]
Typed: "Sarah said it changed her life"
Result: "Friend rec · Must read · Sarah said it changed her life"
```

**No forced input:** If no chips and no text, note stays empty.

**Chip state is ephemeral:** We store only the final note string, not which chips were selected. Users can edit notes freely later.

---

## UI Locations

### Location 1: Card Note Editing

When user taps "Add a note for future you" on expanded card:
- Chips appear in horizontal scrollable row above textarea
- Selected chips show filled/highlighted background
- Textarea below for custom text
- Save/Cancel buttons at bottom

Layout: `[chips row] → [textarea] → [buttons]`

### Location 2: Multimodal Add Flow

After user adds book via multimodal modal:
- New "note step" screen appears (instead of closing immediately)
- Book cover + title at top for context
- Same chip row + textarea layout
- "Save" commits note, "Skip" closes without note
- **Multi-book adds:** Skip note step entirely (avoid friction)

### Location 3: SMS Confirmation

After book saved via SMS:

```
✓ Added "Project Hail Mary" to your shelf!

Quick note for future you? Reply:
👥 friend | 🎙️ pod | 📚 in store | ✏️ something else

Or reply WHY to learn more
```

**WHY response:**
```
Books slip away fast. A quick note now — who told you, what mood it's for — helps future you remember why this one mattered.

Just reply with a note, or ignore this and move on!
```

---

## Implementation

### New Component: `ReactionChips.svelte`

```svelte
<ReactionChips
  selected={selectedChips}
  onToggle={(chip) => ...}
  onOtherClick={() => focusTextarea()}
/>
```

Props:
- `selected: Set<string>` - currently selected chip IDs
- `onToggle: (chipId: string) => void` - called when chip tapped
- `onOtherClick: () => void` - called when "Other..." tapped

### Chip Constants

```typescript
// src/lib/components/ui/reaction-chips.ts

export const REACTION_CHIPS = [
  { id: 'friend', emoji: '👥', label: 'Friend', noteText: 'Friend rec' },
  { id: 'podcast', emoji: '🎙️', label: 'Podcast', noteText: 'Podcast' },
  { id: 'newsletter', emoji: '📰', label: 'Newsletter', noteText: 'Newsletter' },
  { id: 'social', emoji: '📱', label: 'Social', noteText: 'Social media' },
  { id: 'bookstore', emoji: '📚', label: 'Bookstore', noteText: 'Saw at bookstore' },
  { id: 'cozy', emoji: '🛋️', label: 'Cozy', noteText: 'Cozy read' },
  { id: 'learn', emoji: '🧠', label: 'Learn', noteText: 'Want to learn' },
  { id: 'must', emoji: '⭐', label: 'Must read', noteText: 'Must read' },
  { id: 'gift', emoji: '🎁', label: 'Gift', noteText: 'Gift idea' },
] as const;

export function composeNote(selectedIds: Set<string>, customText: string): string {
  const chipTexts = REACTION_CHIPS
    .filter(c => selectedIds.has(c.id))
    .map(c => c.noteText);

  const parts = [...chipTexts];
  if (customText.trim()) {
    parts.push(customText.trim());
  }

  return parts.join(' · ');
}
```

### SMS Handler Changes

```typescript
// Emoji/keyword mapping
const CHIP_SHORTCUTS: Record<string, string> = {
  // Emoji
  '👥': 'Friend rec',
  '🎙️': 'Podcast',
  '🎙': 'Podcast',
  '📚': 'Saw at bookstore',
  // Keywords (case-insensitive matching)
  'friend': 'Friend rec',
  'pod': 'Podcast',
  'podcast': 'Podcast',
  'store': 'Saw at bookstore',
  'bookstore': 'Saw at bookstore',
};

// In note reply handling:
const normalized = message.trim().toLowerCase();
const chipNote = CHIP_SHORTCUTS[message.trim()] || CHIP_SHORTCUTS[normalized];

if (chipNote) {
  await saveNote(bookId, chipNote);
} else if (normalized === 'why') {
  return twimlResponse(SMS_MESSAGES.whyNotes());
} else {
  await saveNote(bookId, message);
}
```

### New SMS Messages

```typescript
// src/lib/server/sms-messages.ts

bookAddedWithNotePrompt: (title: string, author?: string) => `
✓ Added "${title}"${author ? ` by ${author}` : ''} to your shelf!

Quick note for future you? Reply:
👥 friend | 🎙️ pod | 📚 in store | ✏️ something else

Or reply WHY to learn more`.trim(),

whyNotes: () => `
Books slip away fast. A quick note now — who told you, what mood it's for — helps future you remember why this one mattered.

Just reply with a note, or ignore this and move on!`.trim(),
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/components/ui/ReactionChips.svelte` | New component |
| `src/lib/components/ui/reaction-chips.ts` | Chip constants + helper |
| `src/lib/components/ui/Card.svelte` | Add chips to note editing |
| `src/routes/[identifier]/+page.svelte` | Add note step to multimodal flow |
| `src/lib/server/sms-messages.ts` | New message templates |
| `src/routes/api/sms/+server.ts` | Handle emoji/keyword replies, WHY command |

---

## Testing Checklist

### Card Note Editing
- [ ] Chips appear above textarea when editing note
- [ ] Tapping chip toggles highlight on/off
- [ ] Multiple chips can be selected
- [ ] "Other..." focuses textarea without adding text
- [ ] Save combines chips + typed text with " · " separator
- [ ] Existing notes can still be edited normally

### Multimodal Add Flow
- [ ] Note step appears after single book added
- [ ] Note step skipped for multi-book adds
- [ ] Skip button closes without saving note
- [ ] Save button commits note to book

### SMS Flow
- [ ] Confirmation includes chip shortcuts
- [ ] Reply with emoji (👥) saves correct note text
- [ ] Reply with keyword ("pod") saves correct note text
- [ ] Reply with "WHY" returns explanation
- [ ] Reply with freeform text saves as-is
- [ ] New ISBN clears context, starts new flow

---

## Success Criteria

Phase 2 (Reaction Chips) is complete when:

1. Users can tap chips to quickly add intent context on web
2. SMS users can reply with emoji/keyword shortcuts
3. "WHY" command educates users on note value
4. All three touchpoints use consistent chip set

---

## Future Extensibility

Current design preserves room for:

| Future Feature | Why It's Still Possible |
|----------------|------------------------|
| User-defined chips | Note is freeform text, any chip text works |
| Frequency-based reordering | Chips in array, easy to personalize order |
| More chips | Just add to array, no migration needed |
| Per-user defaults | Add preferences table later |
| Analytics on chip usage | Can parse note text or add tracking later |
| SMS chip customization | User texts "CHIPS" to set favorites |

**Key constraint preserved:** Notes stay as plain text. Any future chip system remains backward-compatible.

---

## Out of Scope

- User-customizable chips (Phase 3+)
- Chip usage analytics (Phase 3+)
- Source-aware chip suggestions (Phase 3+)

---

*Reference: tbr-strategy-source/research/TBR_INTENT_STRATEGY_SYNTHESIS.md*
