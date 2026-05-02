# Homepage Redesign — Editorial Layout

**Date:** 2026-05-01
**Goal:** Transform the homepage from a centered landing page into an editorial, NYRB-inspired layout that earns trust through typography and structure rather than UI patterns.

---

## Design Principles

- **Title page energy** — not a landing page "hero block"
- **F-pattern scanability** — show what it does, then why it matters
- **Ink, not UI** — terracotta as annotation color, not button color
- **Invisible grid** — baseline alignment connects disparate elements
- **Unburdened** — no input forms, no heavy CTAs, just text and a phone number

---

## Page Structure

```
┌─────────────────────────────────────────────┐
│  TBR.fyi                         Sign in    │  nav bar
├─────────────────────────────────────────────┤
│                                             │
│       Text Yourself Books.                  │  headline (charcoal, serif)
│       (360) 504-4327                        │  phone link (terracotta, oldstyle figs)
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  Send a photo, ISBN,    │  ┌────────────┐   │
│  or link.               │  │ SMS mock   │   │
│                         │  │ carousel   │   │
│  It lands on your       │  │            │   │
│  shelf in seconds.      │  │            │   │
│                         │  │            │   │
│  We ask once:           │  │            │   │
│  why this one?          │  └────────────┘   │
│                         │                   │
│  No app. No password.   │                   │
│  Just text.             │                   │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  No more scrolling past books you           │  pitch (emotional beat)
│  don't recognize. You'll remember           │
│  something more than the title:             │
│  why it mattered.                           │
│                                             │
├─────────────────────────────────────────────┤
│  Built by a bookseller in Port Angeles.     │  colophon
│  Designed for people who care more about    │
│  the reading than the tracking.             │
├─────────────────────────────────────────────┤
│  Already have a shelf? Sign in              │  footer
└─────────────────────────────────────────────┘
```

---

## Typography

### Font Change: Lora → Cormorant Garamond

- **Why:** Higher stroke contrast, stunning italics, feels expensive/editorial
- **Note:** Runs small — bump all serif sizes +2-3px from current Lora sizes
- **Source:** Google Fonts (free, no licensing friction)

### Usage

| Element | Font | Weight | Size |
|---------|------|--------|------|
| "TBR.fyi" (nav) | Cormorant Garamond | 600 | ~20px |
| Headline | Cormorant Garamond italic | 500 | ~40-44px |
| Phone number | Cormorant Garamond | 400 | ~22-24px, oldstyle figures |
| Mechanics steps | Inter | 400 | 18px (base) |
| Friction relief line | Inter | 400 | 14-15px |
| Pitch text | Inter | 400 | 18-20px |
| Colophon | Inter | 400 | 13-14px, letter-spaced |
| Book titles (carousel) | Cormorant Garamond italic | 400 | inherit |

### Weight Discipline

Three weights total:
- **Semibold (600):** Nav logo only
- **Regular (400):** Everything else
- **Italic:** Headline, book titles

### Oldstyle Figures

Phone number uses `font-variant-numeric: oldstyle-nums` — makes digits feel typeset rather than digital.

---

## Color Usage

### The "Ink" Treatment

Terracotta used exclusively as functional highlight — never for backgrounds or heavy buttons.

| Element | Color |
|---------|-------|
| Body text | Charcoal `#2d2926` |
| Secondary text | Warm gray `#6b6560` |
| Phone number | Terracotta (slightly darker variant for bite) |
| "Sign in" link | Terracotta, subtle underline on hover |
| Nav "TBR.fyi" | Charcoal |
| Colophon | Warm gray or lighter |
| Backgrounds | Paper-mid (no dark hero block) |

### Contrast Logic

- Headline: dark charcoal
- Action links: terracotta
- Nav links: charcoal (or lighter gray to push back)
- Pairing warm terracotta with soft charcoal makes accent feel like intentional annotation

---

## Section Details

### Nav Bar

- Paper background (same as page), thin bottom border (`--border`)
- Flex row: "TBR.fyi" left (serif, semibold), "Sign in" right (terracotta link)
- No background color change — dissolves into the page

### Headline Block

- Centered, generous top padding (~64px)
- "Text Yourself Books." in large Cormorant Garamond italic, charcoal
- Phone number below: terracotta, oldstyle figures, `sms:` link
- No "built by" line here (moved to colophon)

### Split Section (How It Works)

**Left column — mechanics:**
```
Send a photo, ISBN, or link.

It lands on your shelf in seconds.

We ask once: why this one?

---

No app. No password. Just text.
```

- Light thin rule (or whitespace) between steps and friction-relief line
- Left-aligned, natural reading flow

**Right column — SMS carousel:**
- Simple rounded container (no detailed phone chrome)
- Keep existing carousel content (cover photo, title search, note exchange)
- Top of carousel aligns with baseline of first mechanics step

**Alignment principle:** First step baseline = top of SMS mockup. Creates a strong horizontal "start line" for the eye.

### Pitch Section

- Narrow measure: max 60-70 characters wide (~540px max-width)
- Generous line-height: 1.5-1.6
- Can be centered to signal it's a separate "beat"
- Content: "No more scrolling past books you don't recognize. You'll remember something more than the title: why it mattered."

### Colophon

- 13-14px, slightly more letter-spacing (`0.02em`)
- Lighter weight appearance (warm-gray color, not smaller weight)
- Content: "Built by a bookseller in Port Angeles. Designed for people who care more about the reading than the tracking."
- Serves as trust bridge between pitch and footer

### Footer

- Simple centered text: "Already have a shelf? Sign in"
- "Sign in" is terracotta link to `/auth/signin`
- Quiet, respects the "unburdened" promise
- Subtle top border or generous spacing to separate from colophon

---

## Mobile Behavior

- **Nav:** Stays as-is (already works at small widths)
- **Headline:** Slightly smaller, same treatment
- **Split section stacks:** Mechanics text on top, carousel below
- **Spacer:** Clear gap between "No app. Just text." and carousel so user finishes reading before seeing the demo
- **Pitch:** Narrows naturally, stays readable
- **Colophon + Footer:** Stack, no changes needed

---

## What Gets Removed

- Dark hero section (`bg-[var(--surface-dark)]`) — eliminated entirely
- "Go" input form — replaced with simple "Sign in" link
- "Or sign in with email" secondary link — consolidated into single "Sign in"
- "Builder note" section heading ("A note from the builder") — replaced by colophon tone
- Carousel "Tap or swipe" hint — keep if needed for discoverability, but consider removing

---

## CSS Changes Summary

1. **Google Fonts import:** Replace Lora with Cormorant Garamond (keep Inter)
2. **`--font-serif`:** Update to `'Cormorant Garamond', Georgia, serif`
3. **Type scale:** Bump serif sizes +2-3px across the board
4. **Remove:** `.bg-[var(--surface-dark)]` hero section
5. **Add:** Nav bar component, split grid layout
6. **Add:** `font-variant-numeric: oldstyle-nums` on phone number
7. **Add:** Colophon styles (small, letter-spaced)
8. **Responsive:** `grid-template-columns: 1fr 1fr` → stacked on mobile
