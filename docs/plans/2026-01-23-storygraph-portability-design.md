# StoryGraph Portability Messaging & Documentation

**Date:** 2026-01-23
**Status:** Ready for implementation

---

## Problem

Users testing TBR.fyi may hesitate to invest time adding books if they're unsure their data is portable. The "Goodreads Import" label on StoryGraph makes it unclear that TBR.fyi exports work there.

## Solution

Two-pronged approach:

1. **Messaging** - Proactive reassurance that data is portable (homepage + shelf banner)
2. **Documentation** - Detailed guide with video placeholder showing the export→import flow

## Success Criteria

- New users see portability messaging before they need to ask
- Users can self-serve the entire StoryGraph import process
- No support questions about "can I export to StoryGraph?"

---

## Implementation

### 1. Homepage Messaging

**File:** `src/routes/+page.svelte`

**Copy:**

> **Your data, your choice.** Export to StoryGraph or Goodreads anytime.

**Design:**
- Single line below main value proposition
- Subtle styling using `--text-secondary`
- Not a card/callout - integrated text
- Links to settings page or help#exporting

---

### 2. Shelf Page Banner

**File:** `src/routes/[identifier]/+page.svelte`

**Copy:**

> **Testing TBR.fyi?** Your books are portable — export to StoryGraph or Goodreads anytime from Settings. [Dismiss ×]

**Behavior:**
- Shows by default for all users
- Clicking × sets `localStorage.setItem('portability-banner-dismissed', 'true')`
- Never shows again once dismissed
- Check happens client-side on mount (avoids SSR hydration mismatch)

**Design:**
- Light background (`--paper-light`) with subtle border (`--border`)
- Single line on desktop, may wrap on mobile
- "Settings" links to `/{identifier}/settings`
- Dismiss button (×) on right
- Compact height

---

### 3. Settings Page Import Guide

**File:** `src/routes/[identifier]/settings/+page.svelte`

**Structure:** New card below existing export card

#### Card Content

**Title:** Importing to StoryGraph

**Video Placeholder:**
- 16:9 aspect ratio container
- Background: `--paper-light`
- Border: `1px solid var(--border)`, 12px border-radius
- Centered play icon (circle with triangle) in `--text-secondary`
- Text: "Video coming soon"
- Caption: "See the full export → import flow"

**Step-by-step instructions:**

1. Download your CSV export above (Goodreads format)
2. Go to [StoryGraph](https://thestorygraph.com) → Manage Account → Goodreads Import
3. Click "Import from file" and select your downloaded CSV
4. StoryGraph will process your books (may take up to 24 hours for large libraries)
5. You may be prompted to map your shelves to StoryGraph categories

---

### Video Placeholder Design

```
┌─────────────────────────────────────────────────┐
│                                                 │
│        ┌───────────────────────────┐            │
│        │                           │            │
│        │      ▶  (play icon)       │            │
│        │                           │            │
│        │   Video coming soon       │            │
│        │                           │            │
│        └───────────────────────────┘            │
│                                                 │
│   See the full export → import flow            │
│                                                 │
└─────────────────────────────────────────────────┘
```

**When video is ready:**
- Replace placeholder with embedded video/GIF
- Video should show:
  1. Click "Download Export" on TBR.fyi settings
  2. Navigate to StoryGraph → Manage Account → Goodreads Import
  3. Upload the file
  4. Success confirmation

---

## Files to Modify

| File | Change |
|------|--------|
| `src/routes/+page.svelte` | Add portability line to hero section |
| `src/routes/[identifier]/+page.svelte` | Add dismissible banner |
| `src/routes/[identifier]/settings/+page.svelte` | Add import guide card |

## Implementation Order

1. **Settings page import guide** - Most value, where users export
2. **Shelf page banner** - Reminds users the option exists
3. **Homepage messaging** - Trust signal for new visitors

---

## Out of Scope

- Goodreads-specific documentation (they don't import well anymore)
- Hardcover/BookWyrm guides (can add later using same pattern)
- SMS onboarding changes

---

## Technical Notes

- No backend changes needed - all frontend
- localStorage key: `portability-banner-dismissed`
- Could extract banner to `src/lib/components/PortabilityBanner.svelte` for reuse
