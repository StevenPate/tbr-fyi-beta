# To-Do List

## Validation Phases

**Checkpoint 1: Core Product Validation**
- Can users easily capture and manage their TBR?
- Do users return and engage with their shelf?
- Can users trust their data (export/portability)?

**Checkpoint 2: Growth & Ecosystem**
- Platform API for third-party integrations
- Bookstore/retail partnerships
- Cross-platform sync (Hardcover, StoryGraph)

---

## Checkpoint 1: Build Now

### Data Portability (Critical for Trust)
- [ ] CSV Export (Goodreads format): `docs/plans/csv-export-specification.md`

### Core UX Improvements
- [ ] Add user-facing error messages when metadata fetching fails or ISBNs are invalid
- [ ] Amazon short link support (`a.co` redirects)
- [ ] Paginate or infinite scroll for long lists

### Book Discovery & Metadata
- [ ] Add ISBNdb to metadata pipeline (image enrichment)
- [ ] Let users replace low quality cover images
- [ ] Different edition finder (same book, better cover)

### Bulk Operations
- [ ] Web UI Bulk Operations (Phase 1): `docs/designs/BULK_OPERATIONS_PLAN.md`
- [ ] Enhanced Goodreads Import (Phase 2): `docs/designs/BULK_IMPORT_PLAN.md`

### Polish & Retention
- [ ] Improve usage tracking/analytics
- [ ] Add screenshots or demo GIF to README
- [ ] Share shelf publicly (read-only URL)

---

## Checkpoint 2: Defer

### Platform API & Integrations
- [ ] TBR.fyi Public API
- [ ] Hardcover sync (GraphQL API)
- [ ] Zapier/IFTTT integration
- [ ] Siri Shortcuts support

### Advanced Features
- [ ] OCR for book cover images (text extraction)
- [ ] Parse Goodreads links for ISBN extraction
- [ ] SMS: `LAST n` command (show n titles from TBR)
- [ ] Drag to reorder books/shelves

### Infrastructure
- [ ] Store/cache images (CDN)
- [ ] Handle rate limiting systematically
- [ ] Production hardening for bulk import (Phase 3): `docs/designs/BULK_IMPORT_PLAN.md`
- [ ] SMS multi-photo processing (Phase 2): `docs/designs/BULK_OPERATIONS_PLAN.md`

### Design System
- [ ] Refactor with semantic CSS and design tokens
- [ ] Standardize form element sizes
- [ ] Bigger note area, improved styling
- [ ] Add vertical space in grids
- [ ] Remove non-component markup

### Minor Items
- [ ] Add more help text to HELP SMS command
- [ ] Minor items from architecture audit

---

## Completed

### December 2025
- [x] Search books by title, author, or notes (Cmd+K toggle, dropdown + live filter)
- [x] Book sharing feature (individual book share links)
- [x] Custom authentication system (email magic links, SMS codes)
- [x] URL cleanup (removed @ prefix from usernames)
- [x] Integration research documentation

### November 2025
- [x] Add basic auth implementation
- [x] Simple JSON export
- [x] Use and save Logtail queries
- [x] Add Ko-fi link
- [x] Better UX for shelf links
- [x] Better design for books
- [x] Umami tracking for traffic
- [x] Important items from architecture audit
- [x] Clean repo and migrate
- [x] Update about page (GitHub links)
- [x] Choose shelf when adding from multimodal
- [x] High items on architecture audit
- [x] Book Card Entry Animations
- [x] Responsive Grid
- [x] Update README.md
- [x] Fix Book Selection UX Anti-pattern
- [x] Bulk CSV/TXT Import (Phase 1): `docs/designs/BULK_IMPORT_PLAN.md`

### Earlier
- [x] Test SMS end-to-end
- [x] Add minimal design
- [x] Implement Amazon link parsing
- [x] Deploy to Vercel
- [x] Google Vision for photo barcodes
- [x] Multiple shelves
- [x] Follow-up with Twilio about A2P
- [x] Basic component structure
- [x] Remove a book
- [x] Improve image quality
- [x] Manual ISBN entry (web UI)
- [x] SMS command parsing
- [x] Multimodal input
- [x] Homepage: basic instructions
- [x] Homepage: link to # in localStorage
- [x] Basic title/author -> ISBN search
- [x] Default to TBR shelf
- [x] Delete shelf
- [x] Add publication date and publisher description
- [x] Help page
- [x] About page
- [x] Barcode option
- [x] Feedback form
- [x] Copy ISBN button
- [x] Add observability for logging
