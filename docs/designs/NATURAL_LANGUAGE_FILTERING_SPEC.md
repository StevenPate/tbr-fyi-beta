# Feature Spec: Natural Language Filter

**Project:** TBR.fyi
**Date:** 2026-04-27
**Status:** Design approved

---

## Core Concept

Replace the shelf tab row, filter button, and filter dropdown with a single interactive sentence:

**"I'm looking at [status] [view] in [shelf]."**

Each underlined word is a tappable popover trigger. The sentence is the sole filter UI — it replaces all existing filter controls.

---

## Variables

### Status (what to show)
- **all** (default) — no filtering
- **unread** — `is_read: false`
- **read** — `is_read: true`
- **without notes** — `note: null`

### View (how to show it)
- **books** (default) — current card layout (cover, title, author)
- **notes** — note text becomes primary element, book title/author becomes secondary citation

### Shelf (where to look)
- User's default shelf (default)
- Any other user-created shelf

---

## Sentence Grammar ("Collapse Rules")

The sentence reads naturally by combining status + view:

| Status | View | Sentence |
|--------|------|----------|
| all | books | "I'm looking at **all books** in **TBR**." |
| unread | books | "I'm looking at **unread books** in **TBR**." |
| read | notes | "I'm looking at **read notes** in **TBR**." |
| without notes | books | "I'm looking at **books without notes** in **TBR**." |
| all | notes | "I'm looking at **all notes** in **TBR**." |

---

## View Behavior

### Books View (default)
Current card layout unchanged — cover thumbnail, title (Lora italic), author, expandable detail card. Time groupings ("THIS WEEK" / "A WHILE AGO") and resurfacing logic continue as-is.

### Notes View
The collapsed card flips hierarchy:
- **Primary:** Note text (Lora italic, generous size)
- **Secondary:** Book title + author as a citation line below the note
- **Cover:** Stays but shrinks to a supporting role

Books without notes are **hidden**. A quiet line appears: "Hiding 12 books without notes" — where "books without notes" is tappable and switches the filter to that status.

**Interaction:** Tapping a note card expands to the same full book detail view as Books mode. Use a subtle scale + fade animation for the transition from note-primary to expanded detail.

**Time groupings:** Preserved for v1. Revisit whether to drop them once the view is usable.

### Dynamic Book Count
The count below the page title updates to reflect the active filter state:
- "166 books on this shelf"
- "23 unread books in TBR"
- "8 books without notes in TBR"

Mirrors the sentence language naturally.

---

## Interaction Model

### Discoverability

On first visit (or until dismissed), show a subtle inline hint below the sentence: "Tap a word to filter." Use `localStorage` to track dismissal. The interactive text with no button styling is a learnability risk — this one-time nudge solves it cheaply.

### Popover Triggers

- Sentence renders in Lora (serif) at heading size
- Variable words get a subtle underline (dotted or 0.5px solid, `--paper-dark` color)
- No link-blue, no button styling — the underline signals interactivity without shouting

### Responsive Layout

Long shelf names can break the sentence on narrow screens. Rules:
- Shelf name truncates with ellipsis at a max-width (~40% of sentence width)
- Full shelf name shown in the popover
- If the sentence wraps to two lines, that's fine — don't fight it

### Popover Behavior
- **Desktop:** Dropdown anchored to the word
- **Mobile:** Bottom sheet
- Options listed vertically, current selection highlighted
- Selecting an option: closes popover, updates sentence, filters list, updates URL

### URL Sync
State syncs to URL via `history.pushState()` (shallow navigation, same pattern as current shelf switching).

**URL shape:** `tbr.fyi/steven?status=unread&view=notes&shelf={id}`

Defaults are omitted — `tbr.fyi/steven` means "all books in default shelf."

---

## What Gets Removed

- **Shelf tab row** (sticky "All (N)" + shelf pills + "More" dropdown) — replaced by shelf variable
- **Filter button + dropdown panel** (read/owned filters) — replaced by status variable
- **Owned filter** — deferred, not in v1

### What Stays
- **Search bar** (Cmd+K / Ctrl+K) — orthogonal to filtering
- **"+" add button** — unchanged
- **"..." menu** — unchanged

---

## Edge Cases

### "without notes" + "notes" view
This combination is logically empty (Notes view hides books without notes, and this filter only shows books without notes). Show a simple empty state — "No notes yet" — rather than preventing the combination.

---

## Not in v1

- **Ownership filter** — real use cases (wish list, in-store shopping) but unclear where it belongs in the sentence yet. Defer until usage patterns emerge.
- **Sort controls** — future kebab/overflow menu alongside download, share, and bulk edit
- **Keyboard navigation for popovers** — tap/click only for now
- **Notes view time grouping changes** — keep existing groupings, revisit later

### Future: Accessibility

When adding keyboard support, the full scope includes:
- Tab focus on each variable word, Enter/Space to open popover
- Arrow keys to navigate options within popover, Escape to close
- Focus return to trigger word after popover closes
- `aria-live` region on the dynamic book count so screen readers announce filter changes
- `aria-haspopup` and `aria-expanded` on trigger words

---

## Why This Fits

- **Minimalist:** One sentence replaces filter icon, dropdown menu, and shelf tab row
- **Natural:** Speaks the user's language, not database terminology
- **Productive:** "without notes" status provides a direct path to annotation — the intentional part of the app
