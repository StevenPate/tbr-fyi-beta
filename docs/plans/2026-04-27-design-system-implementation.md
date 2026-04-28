# Design System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply a cohesive, token-driven design system across the entire TBR.fyi UI — replacing eyeballed values with a Major Third type scale (18px base), strict spacing grid, consistent color tokens, and derived layout widths.

**Architecture:** All design decisions flow from CSS custom properties in `src/app.css`, wired through `tailwind.config.js`. Changing token values in app.css cascades to every component using Tailwind's `text-*` classes. Components using hardcoded `font-size` values or raw Tailwind colors (stone-*, gray-*) must be manually updated. No structural/behavioral changes — this is a visual consistency pass.

**Tech Stack:** SvelteKit 5, Tailwind CSS v4, CSS custom properties

**Reference:** See `docs/plans/2026-04-27-design-system-spec.md` for all design decisions and rationale.

---

### Task 1: Update design tokens in app.css

**Files:**
- Modify: `src/app.css`

**Step 1: Update type scale values**

Change lines 43–49 from:
```css
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.25rem;
--text-xl: 1.625rem;
--text-2xl: 2.5rem;
```

To:
```css
--text-xs: 11.52px;
--text-sm: 14.4px;
--text-base: 18px;
--text-lg: 22.5px;
--text-xl: 28.13px;
--text-2xl: 35.16px;
--text-3xl: 43.95px;
```

**Step 2: Add line-height token for notes**

After the existing line-height tokens (lines 52–54), add:
```css
--leading-relaxed: 1.55;
```

**Step 3: Remove `--radius-sm`, add layout token**

Change the border radius section (lines 67–69) from:
```css
--radius-sm: 2px;
--radius: 4px;
--radius-lg: 8px;
```

To:
```css
--radius: 4px;
--radius-lg: 8px;
```

Add after the spacing tokens (after line 64):
```css
/* Layout */
--content-width: 740px;
```

**Step 4: Verify dev server renders**

Run: `npm run dev`
Expected: Site loads. NLPFilter (the only component using CSS vars for font-size directly) should show the updated scale. All Tailwind `text-*` classes will also pick up the new sizes since they reference these vars.

**Step 5: Commit**

```
feat: update design tokens to Major Third scale (18px base)
```

---

### Task 2: Update Tailwind config

**Files:**
- Modify: `tailwind.config.js`

**Step 1: Add `--text-3xl` to fontSize, update line-heights, remove `sm` border-radius**

Replace the full `theme.extend` object:

```js
theme: {
  extend: {
    colors: {
      // ... unchanged
    },
    fontFamily: {
      // ... unchanged
    },
    fontSize: {
      xs: ['var(--text-xs)', { lineHeight: 'var(--leading-normal)' }],
      sm: ['var(--text-sm)', { lineHeight: 'var(--leading-normal)' }],
      base: ['var(--text-base)', { lineHeight: 'var(--leading-normal)' }],
      lg: ['var(--text-lg)', { lineHeight: 'var(--leading-snug)' }],
      xl: ['var(--text-xl)', { lineHeight: 'var(--leading-snug)' }],
      '2xl': ['var(--text-2xl)', { lineHeight: 'var(--leading-tight)' }],
      '3xl': ['var(--text-3xl)', { lineHeight: 'var(--leading-tight)' }],
    },
    borderRadius: {
      DEFAULT: 'var(--radius)',
      lg: 'var(--radius-lg)',
    },
    spacing: {
      // ... unchanged
    },
  },
},
```

The key changes:
- Added `3xl` font size mapping
- Removed `sm` from borderRadius (was `var(--radius-sm)`)
- fontSize values are unchanged (they already reference CSS vars, which we updated in Task 1)

**Step 2: Verify no build errors**

Run: `npm run check`
Expected: No type errors from the config change.

**Step 3: Commit**

```
chore: update Tailwind config for new type scale and border radius
```

---

### Task 3: Fix Card.svelte — magic numbers, opacity hacks, control panel

**Files:**
- Modify: `src/lib/components/ui/Card.svelte`

This is the biggest file. Work through these changes in order.

**Step 1: Replace author opacity hack**

Find (appears twice, ~lines 290 and 382):
```
text-[var(--warm-gray)]/70
```

Replace both with:
```
text-[var(--text-tertiary)]
```

**Step 2: Replace `bg-[var(--paper-light)]/30`**

Find (~line 235):
```
bg-[var(--paper-light)]/30
```

Replace with:
```
bg-[var(--paper-light)]
```

The 30% opacity was making the lifted-book tint nearly invisible. Use the full token.

**Step 3: Fix left-indent alignment with CSS variables**

The magic numbers `pl-[108px]`, `pl-[96px]`, `pl-[68px]` all derive from cover width + gap + padding. Add a comment at the top of the `<script>` section and define derived values as inline styles or use consistent values.

The expanded card cover is `w-20` (80px) + `gap-3` (12px) + `px-4` (16px) = 108px. This is correct.
The collapsed cover is `w-10` (40px) + `gap-3` (12px) + `px-4` (16px) = 68px. Also correct.

The problem is `pl-[96px]` — this should be `pl-[108px]` to align with the text column above. Find all instances of `pl-[96px]` and replace with `pl-[108px]`.

**Step 4: Simplify control panel**

Find the control panel wrapper (~line 543):
```svelte
<div class="mt-5 mx-3 mb-1 rounded-lg border-t border-[var(--border)]/40 bg-[var(--background)]/50 pt-2.5 pb-2.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]">
```

Replace with:
```svelte
<div class="mt-4 border-t border-[var(--border)] pt-3 pb-1 pl-[108px] pr-4">
```

This removes the nested semi-transparent card-within-card, replaces with a simple border-top separator at the same indent as the text content, and uses grid-aligned spacing (16px top margin, 12px top padding).

**Step 5: Fix remaining opacity hacks**

Find in the note input area (~line 503):
```
placeholder-[var(--text-tertiary)]/50
```
Replace with:
```
placeholder-[var(--text-tertiary)]
```

Find (~line 503):
```
border-[var(--border)]/30
```
Replace with:
```
border-[var(--border)]
```

Find (~line 503):
```
focus:border-[var(--border)]/60
```
Replace with:
```
focus:border-[var(--accent)]
```

Find (~line 503):
```
focus:bg-[var(--surface)]/50
```
Replace with:
```
focus:bg-[var(--surface)]
```

**Step 6: Fix off-grid spacing**

Find all `mt-5` (20px) and `mb-5` (20px) in Card.svelte. Replace with `mt-4` (16px) or `mt-6` (24px) as appropriate:
- `mt-5` on control panel → already fixed in Step 4 to `mt-4`
- `mb-5` after description → change to `mb-4`

**Step 7: Visual verification**

Run dev server, navigate to a shelf with books. Expand a card. Verify:
- Author text is `--text-tertiary` color (no opacity shimmer)
- Control panel is a flat border-top, not a floating sub-card
- Left alignment of description, notes, and controls all share the same indent
- Spacing feels consistent

**Step 8: Commit**

```
fix: Card.svelte — eliminate magic numbers, opacity hacks, simplify control panel
```

---

### Task 4: Fix shelf page — off-system colors and layout

**Files:**
- Modify: `src/routes/[identifier]/+page.svelte`

This file has the highest concentration of off-system colors. Work section by section.

**Step 1: Replace `max-w-4xl` with content-width token**

Find (~line 1224):
```
max-w-4xl
```

Replace with:
```
max-w-[var(--content-width)]
```

**Step 2: Replace stone-* colors in Note prompt modal (~lines 1564–1580)**

Replace:
- `text-stone-500` → `text-[var(--text-secondary)]`
- `text-stone-600` → `text-[var(--text-secondary)]`
- `border-stone-200` → `border-[var(--border)]`
- `focus:border-stone-300` → `focus:border-[var(--accent)]`
- `focus:ring-1 focus:ring-stone-200` → `focus:ring-1 focus:ring-[var(--accent)]`
- `text-stone-400` → `text-[var(--text-tertiary)]`

**Step 3: Replace stone-* colors in Manage Shelves modal (~lines 1839–1944)**

Replace all instances:
- `bg-white` → `bg-[var(--surface)]`
- `border-stone-200` → `border-[var(--border)]`
- `text-stone-900` → `text-[var(--text-primary)]`
- `text-stone-500` → `text-[var(--text-secondary)]`
- `text-stone-600` → `text-[var(--text-secondary)]`
- `text-stone-400` → `text-[var(--text-tertiary)]`
- `hover:text-stone-600` → `hover:text-[var(--text-primary)]`
- `hover:bg-stone-100` → `hover:bg-[var(--paper-light)]`
- `hover:bg-stone-50` → `hover:bg-[var(--paper-light)]`
- `bg-stone-800` → `bg-[var(--surface-dark)]`
- `hover:bg-stone-700` → `hover:bg-[var(--surface-dark-secondary)]`
- `border-stone-800` → `border-[var(--surface-dark)]`
- `border-stone-300` → `border-[var(--border)]`
- `group-hover:border-stone-400` → `group-hover:border-[var(--warm-gray)]`
- `hover:border-stone-400` → `hover:border-[var(--warm-gray)]`
- `focus:border-stone-400` → `focus:border-[var(--accent)]`

**Step 4: Replace gray-* and blue-* colors in Add Book modal (~lines 1614–1761)**

Replace all instances:
- `border-gray-300` → `border-[var(--border)]`
- `text-gray-500` → `text-[var(--text-secondary)]`
- `text-gray-600` → `text-[var(--text-secondary)]`
- `text-gray-700` → `text-[var(--text-primary)]`
- `text-gray-400` → `text-[var(--text-tertiary)]`
- `hover:bg-gray-50` → `hover:bg-[var(--paper-light)]`
- `bg-gray-200` → `bg-[var(--paper-dark)]`
- `border-gray-200` → `border-[var(--border)]`
- `text-blue-700 bg-blue-50 border border-blue-200` → `text-[var(--accent)] bg-[var(--paper-light)] border border-[var(--border)]`

**Step 5: Fix `pl-[60px]` on time group label**

Find (~line 1372):
```
pl-[60px]
```

This should align with the collapsed card's text column. Collapsed cover is `w-10` (40px) + `gap-3` (12px) + `px-4` (16px padding on card) = 68px. But the time group label sits outside the card padding context. Use `pl-16` (64px) as the nearest grid value.

Replace with:
```
pl-16
```

**Step 6: Visual verification**

Run dev server. Check:
- Page is narrower (740px vs 896px)
- All modals use design system colors (no cool grays)
- Time group labels align reasonably with collapsed card content

**Step 7: Commit**

```
fix: shelf page — replace off-system colors, apply content-width token
```

---

### Task 5: Fix ShareModal

**Files:**
- Modify: `src/lib/components/ui/ShareModal.svelte`

**Step 1: Replace all off-system colors**

- `bg-white` → `bg-[var(--surface)]`
- `border-stone-100` → `border-[var(--border)]`
- `text-stone-900` → `text-[var(--text-primary)]`
- `text-stone-400` → `text-[var(--text-tertiary)]`
- `hover:text-stone-600` → `hover:text-[var(--text-primary)]`
- `hover:bg-stone-100` → `hover:bg-[var(--paper-light)]`
- `text-stone-600` → `text-[var(--text-secondary)]`
- `bg-stone-50` → `bg-[var(--paper-light)]`
- `border-stone-200` → `border-[var(--border)]`
- `text-stone-700` → `text-[var(--text-primary)]`
- `focus:ring-blue-500` → `focus:ring-[var(--accent)]`
- `bg-blue-600` → `bg-[var(--accent)]`
- `hover:bg-blue-700` → `hover:bg-[var(--accent-hover)]`
- `text-stone-500` → `text-[var(--text-secondary)]`

**Step 2: Commit**

```
fix: ShareModal — replace off-system colors with design tokens
```

---

### Task 6: Fix SignInPromptModal

**Files:**
- Modify: `src/lib/components/SignInPromptModal.svelte`

**Step 1: Replace all off-system colors**

- `bg-white` → `bg-[var(--surface)]`
- `border-gray-200` → `border-[var(--border)]`
- `text-gray-900` → `text-[var(--text-primary)]`
- `text-gray-600` → `text-[var(--text-secondary)]`
- `text-gray-400` → `text-[var(--text-tertiary)]`
- `hover:text-gray-600` → `hover:text-[var(--text-primary)]`
- `border-gray-300` → `border-[var(--border)]`
- `text-gray-700` → `text-[var(--text-primary)]`
- `hover:bg-gray-50` → `hover:bg-[var(--paper-light)]`
- `focus:ring-2 focus:ring-blue-500 focus:border-blue-500` → `focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)]`
- `disabled:bg-gray-50` → `disabled:bg-[var(--paper-light)]`
- `bg-blue-600` → `bg-[var(--accent)]`
- `hover:bg-blue-700` → `hover:bg-[var(--accent-hover)]`

Also replace `bg-red-50 border border-red-200` error container (~line 114) with `bg-red-50 border border-red-200` — keep as-is. Status colors (red for error, green for success) are intentionally outside the design system; they're semantic UI signals, not brand colors.

**Step 2: Commit**

```
fix: SignInPromptModal — replace off-system colors with design tokens
```

---

### Task 7: Fix ClaimShelfBanner

**Files:**
- Modify: `src/lib/components/ClaimShelfBanner.svelte`

**Step 1: Replace all off-system colors**

Replace the blue/green gradient backgrounds with flat design-system surfaces:
- `bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200` → `bg-[var(--paper-light)] border-b border-[var(--border)]`
- `bg-gradient-to-r from-green-50 to-teal-50 border-b border-green-200` → `bg-[var(--paper-light)] border-b border-[var(--border)]`
- `text-blue-600` → `text-[var(--accent)]`
- `text-green-600` → `text-[var(--accent)]`
- `text-gray-900` → `text-[var(--text-primary)]`
- `text-gray-600` → `text-[var(--text-secondary)]`
- `text-gray-500` → `text-[var(--text-secondary)]`
- `text-gray-400` → `text-[var(--text-tertiary)]`
- `hover:text-gray-700` → `hover:text-[var(--text-primary)]`
- `hover:text-gray-500` → `hover:text-[var(--text-secondary)]`
- `bg-blue-600 hover:bg-blue-700` → `bg-[var(--accent)] hover:bg-[var(--accent-hover)]`
- `focus:ring-blue-500` → `focus:ring-[var(--accent)]`
- `hover:text-green-500` → `hover:text-[var(--accent-hover)]`

**Step 2: Commit**

```
fix: ClaimShelfBanner — replace off-system colors with design tokens
```

---

### Task 8: Fix ReactionChips

**Files:**
- Modify: `src/lib/components/ui/ReactionChips.svelte`

**Step 1: Replace all stone-* colors**

Active chip state:
- `bg-stone-700 text-white border-stone-700` → `bg-[var(--surface-dark)] text-[var(--text-on-dark)] border-[var(--surface-dark)]`

Inactive chip state (appears twice — selectable and add-reaction):
- `bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:border-stone-300` → `bg-[var(--paper-light)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--paper-mid)] hover:border-[var(--warm-gray)]`

**Step 2: Commit**

```
fix: ReactionChips — replace off-system colors with design tokens
```

---

### Task 9: Fix remaining pages — auth, about, help, home, book detail, settings, layout

**Files:**
- Modify: `src/routes/auth/signin/+page.svelte`
- Modify: `src/routes/auth/signup/+page.svelte`
- Modify: `src/routes/auth/verify-phone/+page.svelte`
- Modify: `src/routes/auth/verify-email/+page.svelte`
- Modify: `src/routes/auth/username/+page.svelte`
- Modify: `src/routes/+page.svelte` (home)
- Modify: `src/routes/[identifier]/book/[isbn13]/+page.svelte`
- Modify: `src/routes/[identifier]/settings/+page.svelte`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/lib/components/ui/Popover.svelte`
- Modify: `src/lib/components/ui/FeedbackModal.svelte`

**Step 1: Fix hardcoded `font-size: 1.875rem` in auth pages**

All five auth pages (signin, signup, verify-phone, verify-email, username) have a `font-size: 1.875rem` (30px) heading in their `<style>` block. The closest scale value is `--text-xl` (28.13px). Replace in each:

```css
/* Before */
font-size: 1.875rem;

/* After */
font-size: var(--text-xl);
```

**Step 2: Fix hardcoded font-sizes in auth style blocks**

Replace `font-size: 0.875rem` with `font-size: var(--text-sm)` in all auth page style blocks. These appear multiple times in each file.

**Step 3: Fix home page hardcoded sizes**

In `src/routes/+page.svelte` style block:
- `font-size: 13px` (~line 289) → `font-size: var(--text-xs)`
- `font-size: 15px` (~line 306) → `font-size: var(--text-sm)`

**Step 4: Fix settings page hardcoded sizes**

In `src/routes/[identifier]/settings/+page.svelte` style block:
- `font-size: 0.875rem` → `font-size: var(--text-sm)` (multiple occurrences)
- `font-size: 1.875rem` → `font-size: var(--text-xl)`
- `font-size: 1.25rem` → `font-size: var(--text-lg)`

**Step 5: Fix layout hardcoded sizes**

In `src/routes/+layout.svelte` style block:
- `font-size: 0.875rem` → `font-size: var(--text-sm)` (multiple occurrences)
- `font-size: 0.75rem` → `font-size: var(--text-xs)`

**Step 6: Fix Popover hardcoded sizes**

In `src/lib/components/ui/Popover.svelte` style block:
- `font-size: 1rem` → `font-size: var(--text-base)`
- `font-size: 0.875rem` → `font-size: var(--text-sm)`
- `line-height: 1.5` → `line-height: var(--leading-normal)`

**Step 7: Fix FeedbackModal hardcoded sizes**

In `src/lib/components/ui/FeedbackModal.svelte` style block:
- `font-size: 1.5rem` (24px heading) → `font-size: var(--text-xl)` (closest scale step)
- `font-size: 0.875rem` → `font-size: var(--text-sm)` (multiple occurrences)
- `font-size: 0.75rem` → `font-size: var(--text-xs)` (multiple occurrences)

**Step 8: Fix book detail page off-system colors**

In `src/routes/[identifier]/book/[isbn13]/+page.svelte`:
- `text-stone-400` → `text-[var(--text-tertiary)]`
- `text-2xl sm:text-3xl` → keep (now properly mapped via Tailwind config with Task 2's `3xl` addition)

**Step 9: Visual verification**

Run dev server. Spot-check:
- Auth pages (signin, username) — headings should be slightly smaller (28px vs 30px) but proportional
- Home page — no visible regressions
- Settings page — text sizing consistent
- Book detail page — colors match system

**Step 10: Commit**

```
fix: replace hardcoded font sizes and off-system colors across all pages
```

---

### Task 10: Final cleanup — remove preview HTML files

**Files:**
- Delete: `type-scale-preview.html`
- Delete: `container-preview.html`
- Delete: `base-size-preview.html`

**Step 1: Remove design exploration files**

```bash
rm type-scale-preview.html container-preview.html base-size-preview.html
```

**Step 2: Commit**

```
chore: remove design exploration preview files
```

---

### Task 11: Full visual regression check

**No file changes.** This is a verification-only task.

**Step 1: Run type check**

Run: `npm run check`
Expected: No errors.

**Step 2: Visual walkthrough**

Start dev server and check each page:

1. **Shelf page** (`/username`) — NLP filter is dominant anchor at 35px. Book titles at 22.5px. Authors at 14.4px in tertiary color. Notes at 18px italic with generous line-height. Collapsed rows on cream, expanded card lifts to white. Control panel is a simple border-top. Page width is 740px. All left margins aligned.

2. **Expand a book** — white card with 8px radius and subtle shadow. Description, notes, controls all share same left indent. No nested semi-transparent panels.

3. **Add Book modal** — all colors from design system (no gray-* or stone-*).

4. **Manage Shelves modal** — same.

5. **Home page** — type scale consistent.

6. **Auth pages** — headings use `--text-xl`, body uses `--text-sm`.

7. **Help/About pages** — type scale consistent.

8. **Book detail page** — colors match system.

**Step 3: Note any issues for follow-up**

If anything looks off, fix it before closing. The goal is zero off-system colors and zero hardcoded font sizes when this task completes.
