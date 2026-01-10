# TBR.fyi Design System

A warm, paper-inspired design system built with CSS custom properties and Tailwind CSS.

## Philosophy

The design evokes the feel of a well-loved reading list—warm paper tones, comfortable typography, and a calm aesthetic that puts books front and center. No harsh colors, no aggressive CTAs, just a pleasant place to track what you want to read.

## Colors

### Core Palette

| Name | Hex | CSS Variable | Tailwind Class |
|------|-----|--------------|----------------|
| Paper Light | `#f5f0e8` | `--paper-light` | `bg-paper-light` |
| Paper Mid | `#ebe4d8` | `--paper-mid` | `bg-paper` |
| Paper Dark | `#e5ddd0` | `--paper-dark` | `bg-paper-dark` |
| Terracotta | `#c4a67c` | `--terracotta` | `bg-terracotta` |
| Terracotta Dark | `#a8845c` | `--terracotta-dark` | `bg-terracotta-dark` |
| Charcoal | `#3d3d3d` | `--charcoal` | `text-charcoal` |
| Warm Gray | `#635e58` | `--warm-gray` | `text-warm-gray` |
| White | `#ffffff` | `--white` | `bg-white` |

### Semantic Tokens

These map to the core palette and should be used for consistency:

| Token | Maps To | Usage |
|-------|---------|-------|
| `--background` | `--paper-mid` | Page backgrounds |
| `--background-alt` | `--paper-light` | Alternate sections, footer |
| `--surface` | `--white` | Cards, modals, inputs |
| `--border` | `--paper-dark` | Borders, dividers |
| `--text-primary` | `--charcoal` | Headings, body text |
| `--text-secondary` | `--warm-gray` | Captions, hints, metadata |
| `--accent` | `--terracotta` | Buttons, links, focus rings |
| `--accent-hover` | `--terracotta-dark` | Hover states |

## Typography

### Font Families

- **Inter** (`--font-sans`): All UI text—headings, body, buttons, labels
- **Lora** (`--font-serif`): Book titles only, always italic

### Usage

```html
<!-- Regular UI text (default) -->
<p class="font-sans">Regular text uses Inter</p>

<!-- Book titles -->
<h2 class="font-serif italic">The Great Gatsby</h2>
```

### Hierarchy

| Element | Size | Weight |
|---------|------|--------|
| Page title | 1.875rem (30px) | 700 |
| Section heading | 1.5rem (24px) | 600 |
| Card title | 1.25rem (20px) | 600 |
| Body text | 0.875rem (14px) | 400 |
| Small/hint | 0.75rem (12px) | 400 |

## Components

### Buttons

**Primary** (main actions):
```css
background: var(--accent);
color: white;
border-radius: 8px;
```
```html
<button class="bg-terracotta hover:bg-terracotta-dark text-white rounded-lg px-4 py-2">
  Save Book
</button>
```

**Secondary** (cancel, back):
```css
background: var(--surface);
border: 1px solid var(--border);
color: var(--text-primary);
```

### Inputs

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 8px;

/* Focus state */
border-color: var(--accent);
box-shadow: 0 0 0 3px rgba(196, 166, 124, 0.2);
```

### Cards

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 16px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
padding: 24px; /* or 32px for larger cards */
```

### Links

```css
color: var(--accent);
/* Hover */
color: var(--accent-hover);
```

## Page Layouts

### Standard Page Structure

```html
<div class="page">           <!-- bg-background, min-h-screen -->
  <div class="container">    <!-- max-w-*, mx-auto, px-4 -->
    <header>...</header>
    <main>...</main>
  </div>
</div>
```

### Common Patterns

**Static pages** (About, Help):
- Max width: 48rem (768px)
- Card-based content sections
- CTA section at bottom with gradient background

**Auth pages**:
- Centered vertically
- Max width: 28rem (448px)
- Single card or form

**Shelf page**:
- Full width with constrained content
- Sticky header with tabs
- Grid layout for book cards

## Spacing

Use consistent spacing based on 4px grid:
- `4px` (1): Tight spacing
- `8px` (2): Default gap
- `16px` (4): Section padding
- `24px` (6): Card padding
- `32px` (8): Large card padding
- `48px` (12): Section margins

## Shadows

- **Subtle**: `0 1px 2px rgba(0, 0, 0, 0.05)` - inputs
- **Card**: `0 1px 3px rgba(0, 0, 0, 0.1)` - cards
- **Elevated**: `0 4px 12px rgba(0, 0, 0, 0.15)` - modals, FAB
- **Focus ring**: `0 0 0 3px rgba(196, 166, 124, 0.2)` - terracotta at 20%

## Border Radius

- **Small**: 4px - badges, tags
- **Default**: 8px - buttons, inputs
- **Large**: 16px - cards, modals
- **Full**: 9999px - pills, FAB

## Files Reference

| File | Purpose |
|------|---------|
| `src/app.css` | CSS custom property definitions |
| `tailwind.config.js` | Tailwind theme extension |
| `src/lib/components/ui/` | Reusable UI components |
| `static/tbr-lockup-transparent.png` | Logo lockup |

## Migration Notes

The design system uses a dual approach:
1. **CSS custom properties** are the source of truth (defined in `app.css`)
2. **Tailwind config** references those variables for utility class usage

This means you can use either approach:
```html
<!-- CSS variable in inline style -->
<div style="background: var(--paper-light)">

<!-- Tailwind class -->
<div class="bg-paper-light">
```

Both produce the same result. Prefer Tailwind classes for consistency with the rest of the codebase.
