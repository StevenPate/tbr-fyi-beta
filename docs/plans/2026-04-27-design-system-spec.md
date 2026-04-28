# Design System Spec — TBR.fyi

**Date:** 2026-04-27
**Status:** Approved

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Type scale | Major Third (1.250), 18px base | Gentle, refined steps; literary feel. 18px base matches editorial reading sites (Nature, NYT, Substack) |
| Container strategy | Cream base, white card on expand | Paper metaphor for idle state, white lift for focus |
| Text color | Warm charcoal `#2d2926` | Already correct; fix is consistent application, not a new value |
| Spacing grid | 4, 8, 12, 16, 24, 32, 48, 64 | Keep 12px for internal component padding; eliminate magic numbers |
| Border radius | Two-tier: 4px, 8px | Simplify from three tiers; 2px was indistinguishable from sharp |
| Content width | 740px (`--content-width`) | Derived: 610px text measure (60–70ch at 18px) + 64px cover + 12px gap + 40px padding |

## Type Scale (Major Third, 1.250×, 18px base)

| Token | Size | Role | Font | Weight | Line height |
|-------|------|------|------|--------|-------------|
| `--text-xs` | 11.52px (0.64rem) | Caps labels, time groups | Inter | 400 | 1.5 |
| `--text-sm` | 14.4px (0.8rem) | Metadata, authors, publishers | Inter | 400 | 1.5 |
| `--text-base` | 18px (1rem) | Body, notes, descriptions | Inter | 400 | 1.5–1.6 for notes |
| `--text-lg` | 22.5px (1.25rem) | Book titles | Lora italic | 600 | 1.3 |
| `--text-xl` | 28.13px (1.5625rem) | Page headings | Inter | 600 | 1.2 |
| `--text-2xl` | 35.16px (1.953rem) | NLP filter line (anchor) | Lora italic | 400 (triggers bold) | 1.15 |
| `--text-3xl` | 43.95px (2.441rem) | Hero / marketing (if needed) | Lora italic | 400 | 1.1 |

**Note:** The rem values assume `html { font-size: 18px }` so 1rem = 18px. Alternatively, keep browser default 16px and use absolute values or adjusted rem calculations.

### Typography rules

- **Book titles**: Always `font-serif italic font-semibold` (Lora) at `--text-lg`
- **Authors**: `--text-sm` in `--text-tertiary` — no opacity hacks
- **Notes**: `--text-base` italic, `line-height: 1.55` for literary readability
- **Time group labels**: `--text-xs` uppercase, `letter-spacing: 0.12em`, in `--warm-gray`
- **NLP filter**: `--text-2xl` is the dominant visual anchor on the page

## Color Palette

No changes to values. The fix is **eliminating off-system colors**.

### Tokens (unchanged)

| Token | Value | Usage |
|-------|-------|-------|
| `--charcoal` | `#2d2926` | Primary text (`--text-primary`) |
| `--warm-gray` | `#6b6560` | Secondary text (`--text-secondary`) |
| `--text-tertiary` | `#756b62` | Metadata, authors, descriptions |
| `--paper-light` | `#f6f1e9` | Hover states, alt backgrounds |
| `--paper-mid` | `#ece5d9` | Primary background |
| `--paper-dark` | `#ddd5c7` | Borders, dividers |
| `--terracotta` | `#b8784a` | Accent |
| `--terracotta-dark` | `#9a6238` | Accent hover |

### What to eliminate

Every instance of raw Tailwind colors must be replaced with design tokens:

- `text-gray-*` / `bg-gray-*` → appropriate `--text-*` or `--paper-*` token
- `text-stone-*` / `bg-stone-*` / `border-stone-*` → appropriate token
- `text-[var(--warm-gray)]/70` → `text-[var(--text-tertiary)]` (proper token, no opacity)
- `bg-white` → `bg-[var(--surface)]`

## Spacing Grid

**Allowed values:** 4, 8, 12, 16, 24, 32, 48, 64

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Title→author gap, tight internal |
| `--space-2` | 8px | Author→note gap, small margins |
| `--space-3` | 12px | Cover→text gap, component internal padding |
| `--space-4` | 16px | Card padding, entry vertical padding |
| `--space-6` | 24px | Between entries (visible gap) |
| `--space-8` | 32px | Between time groups, page top/bottom |
| `--space-12` | 48px | Between major page sections |
| `--space-16` | 64px | Page-level separation |

### Layout

| Token | Value | Derivation |
|-------|-------|------------|
| `--content-width` | 740px | 610px text measure + 64px cover + 12px gap + 2×20px card padding |

Replaces `max-w-4xl` (896px) on the shelf page container.

### What to eliminate

- `max-w-4xl` → `max-w-[var(--content-width)]`
- `pl-[108px]` / `pl-[96px]` → calculate from grid values or use a CSS variable
- `mt-5` (20px) / `mb-5` (20px) → use `--space-4` (16px) or `--space-6` (24px)
- Any arbitrary Tailwind spacing not on the grid

## Container Strategy

### Collapsed book entry (on cream)
- Background: transparent (inherits `--paper-mid`)
- Hover: `--paper-light`
- Separator: `border-bottom` in `--border`
- Padding: 16px vertical, 16px horizontal
- No border-radius, no shadow

### Expanded book entry (white card)
- Background: `--surface` (white)
- Border-radius: 8px (`--radius-lg`)
- Shadow: `0 2px 8px rgba(0,0,0,0.06)`
- Padding: 16–24px
- Margin: 8px vertical (lifts off the row rhythm slightly)

### Modals
- Background: `--surface` (white)
- Border-radius: 8px (`--radius-lg`)
- Shadow: larger elevation
- No change to current pattern (already consistent)

### Control panel (inside expanded card)
- Remove the nested semi-transparent layer
- Use a simple `border-top` in `--border` for separation
- Same white background as parent card

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | 4px | Buttons, inputs, pills, small elements |
| `--radius-lg` | 8px | Cards, modals, panels, expanded entries |

**Eliminated:** `--radius-sm` (2px) — not visually distinct enough to justify.

## Implementation Scope

### Files to modify

1. **`src/app.css`** — Update type scale values, remove `--radius-sm`
2. **`tailwind.config.js`** — Update fontSize mappings, remove `sm` border-radius
3. **`src/lib/components/ui/Card.svelte`** — Apply new scale, fix left-indent alignment, simplify control panel, eliminate opacity hacks
4. **`src/routes/[identifier]/+page.svelte`** — Replace off-system colors (stone-*, gray-*), fix spacing to grid, update h1 to use proper token size
5. **`src/lib/components/ui/NLPFilter.svelte`** — Update to new `--text-2xl` value (31.25px)
6. **All modals** (ShareModal, FeedbackModal, SignInPromptModal, shelf selection) — Replace stone-*/gray-* with design tokens
7. **`src/lib/components/ui/ReactionChips.svelte`** — Replace stone-* colors
8. **Other pages** (about, help, auth) — Audit and replace off-system colors

### What NOT to change

- Font families (Inter + Lora pairing is solid)
- Color values (palette is correct)
- Overall layout structure (centering, responsive patterns)
- Animation/transition tokens (until follow-up below)

## Follow-up: Card Expand/Collapse Animation

**Not in initial scope** — implement after the static design system is consistent so animations have correct start/end states.

### Spec

- **Height reveal**: `ease-out`, ~200ms. Smooth reveal, no spring/bounce.
- **Background + shadow**: crossfade cream→white and shadow appearance, same 200ms duration.
- **Cover resize**: animate 40px→64px thumbnail growth in sync.
- **No page-load animations**: no staggered fade-ins for the list. Repeat visitors will find them annoying.
- **Respect `prefers-reduced-motion`**: disable all of the above when set.
