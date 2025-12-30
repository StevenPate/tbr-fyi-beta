# TBR Delta - Project Context

## What This Is
Personal book tracking via SMS. Text ISBN, Amazon URL, or book photo → auto-add to shelf → track read/owned status.

## Current State
- ✅ **Production:** Deployed and running with multi-user support
- ✅ **SMS Commands:** START/STOP/HELP/ADD with context tracking
- ✅ **Input Methods:** SMS (ISBN/Amazon URL/photo), web UI (multimodal detection with shelf selection), title/author search
- ✅ **Shelves:** Custom shelves with default TBR auto-assignment, scalable navigation
- ✅ **Export:** JSON export with complete library data
- ✅ **Feedback:** Trello integration with global feedback form
- ✅ **Database:** Supabase (filxjcmdpawrrdbuvdvc) - 6 tables + migrations
- ✅ **Monitoring:** Better Stack infrastructure monitoring and alerts
- ✅ **Analytics:** Umami Cloud privacy-focused tracking
- ✅ **Twilio number:** +13605044327

## Tech Stack
- SvelteKit 5 + TypeScript (with Svelte 5 runes)
- Supabase (PostgreSQL)
- Vercel (deployment)
- Twilio (SMS)
- Google Books API + Open Library (metadata with fallback)
- Google Vision API (barcode detection from photos)
- Trello API (feedback collection)
- Tailwind CSS v4
- Umami Cloud (analytics)
- Better Stack (infrastructure monitoring)

## Key Files

### SMS & Backend
- `src/routes/api/sms/+server.ts` - SMS webhook handler (ISBN, Amazon URLs, photos, commands)
- `src/lib/server/sms-messages.ts` - Centralized SMS messaging and command detection
- `src/lib/server/book-operations.ts` - Centralized book upsert logic with default shelf assignment
- `src/lib/server/auth.ts` - User authentication and authorization helpers
- `src/lib/server/validation.ts` - Server-side ISBN format validation
- `src/lib/server/amazon-parser.ts` - Amazon ISBN extraction (ASIN-as-ISBN + scraping fallback)
- `src/lib/server/metadata/google-books.ts` - Google Books API metadata fetcher
- `src/lib/server/metadata/open-library.ts` - Open Library fallback metadata source
- `src/lib/server/metadata/index.ts` - Multi-source metadata orchestrator
- `src/lib/server/metadata/types.ts` - ISBN conversion utilities and branded types
- `src/lib/server/vision.ts` - Google Vision API client with error recovery

### API Endpoints
- `src/routes/api/books/add/+server.ts` - Web UI book addition endpoint (with ownership checks)
- `src/routes/api/books/update/+server.ts` - Toggle read/owned status (with ownership checks)
- `src/routes/api/books/delete/+server.ts` - Delete book from library (with ownership checks)
- `src/routes/api/books/detect/+server.ts` - Multimodal book detection (ISBN/Amazon/photo/title)
- `src/routes/api/shelves/add/+server.ts` - Create new shelf
- `src/routes/api/shelves/delete/+server.ts` - Delete shelf
- `src/routes/api/shelves/update/+server.ts` - Add/remove books from shelves (with ownership checks)
- `src/routes/api/export/+server.ts` - JSON export of complete library
- `src/routes/api/feedback/+server.ts` - Trello feedback integration

### Frontend
- `src/routes/+page.svelte` - Homepage with Inter font and improved visual hierarchy
- `src/routes/+layout.svelte` - Global layout with footer, feedback FAB, and Ko-fi link
- `src/routes/[identifier]/+page.svelte` - Main shelf page (grid/list views, search/filter, shelf selection)
- `src/routes/[identifier]/settings/+page.svelte` - Settings page with JSON export
- `src/routes/[identifier]/book/[isbn13]/+page.svelte` - Shared book page
- `src/routes/auth/` - Authentication routes (signin, signup, verify-phone, verify-email, username)
- `src/routes/about/+page.svelte` - About page
- `src/routes/help/+page.svelte` - Help documentation with interactive FAQ
- `src/lib/components/ui/FeedbackModal.svelte` - Feedback form modal with focus trap
- `src/lib/components/ui/Button.svelte` - Reusable button component
- `src/lib/components/ui/Input.svelte` - Reusable input component
- `src/lib/components/ui/Badge.svelte` - Status badge component
- `src/lib/components/ui/Card.svelte` - Card wrapper component (list view, modal mode)
- `src/lib/components/ui/FlipCard.svelte` - Flip card component (grid view)
- `src/lib/components/ui/SearchBar.svelte` - Client-side search with read/owned filters
- `src/app.html` - HTML shell with Umami analytics script

### Database
- `src/lib/server/supabase.ts` - Database client
- `supabase/migrations/` - 6 sequential migrations (see Database Schema section)

### Configuration
- `package.json` - Includes `dev:tunnel` script (runs dev server + ngrok)
- `.env` - Supabase, Twilio, Google Cloud, Trello, Umami credentials
- `.env.example` - Complete credential documentation with templates
- `service-account.example.json` - Google service account template
- `DEVLOG.md` - Chronological development log
- `ARCHITECTURE_AUDIT.md` - Architecture review and improvement tracking

## Features

### ✅ Implemented

**Book Input:**
- SMS: ISBN (10/13 digit), Amazon URLs (full + a.co short links), MMS photos
- Web UI: Multimodal detection (ISBN/Amazon URL/photo upload/title-author search)
- Shelf selection during bulk add (collapsible shelf picker in detection modal)
- Title/Author search → Google Books → returns ISBN candidates
- Keyboard shortcut: Press Enter in detection modal to submit
- Server-side ISBN format validation with clear error messages

**Multi-User System:**
- Phone-based user identification (no auth required)
- START/STOP/HELP commands with consent tracking
- ADD command with SMS context tracking for multi-book flows
- Returning user detection via localStorage

**Shelves:**
- Custom user-created shelves
- Default TBR shelf auto-created on START
- Auto-assign new books to default shelf
- Scalable two-tier navigation (first 3 visible + "More shelves" dropdown)
- Smooth transitions when switching between shelves
- Add/remove books from multiple shelves
- Delete shelves with confirmation
- "All Books" view with explicit ?view=all parameter

**Book Management:**
- Read/owned status toggles
- Delete books with confirmation
- Copy ISBN to clipboard (grid + list views)
- ISBN barcode generation (EAN-13, scannable on mobile)
- Collapsible descriptions
- Publication date display

**Metadata:**
- Google Books API (primary)
- Open Library (fallback for missing covers)
- Smart metadata orchestrator merges best data
- Cover quality optimization (extraLarge→large→medium, zoom=1, w=1280)

**UI/UX:**
- Grid view with flip cards and smooth transitions
- List view (compact) with detail modal
- Client-side search (title, author, notes) with Cmd+K shortcut
- Read/Owned status filters (session-only)
- "Find Elsewhere" links (Amazon, Bookshop, library)
- Responsive design (mobile-first)
- Inter font for professional typography
- Medium drop-shadows on all cards
- Reusable component library (Button, Input, Badge, Card, FlipCard, SearchBar)
- QR code for Twilio number on getting started page
- About page and interactive FAQ Help page
- Settings page with export functionality
- Umami analytics for view mode tracking

**Feedback System:**
- Global feedback modal with focus trap
- Floating Action Button (FAB) always visible
- Trello integration (card creation + screenshot upload)
- Auto-detect user from URL or localStorage
- Separate warning UI for non-blocking attachment failures
- Ko-fi donation link in footer

**Infrastructure:**
- 6 sequential database migrations
- Duplicate detection with composite unique constraints
- Failed import tracking
- Amazon URL parsing with 2-stage approach (ASIN→ISBN, then scraping)
- ISBN normalization pipeline with branded types
- Centralized book upsert logic (~260 LOC reduction)
- User ownership checks on all data-mutating endpoints
- Vision API client with automatic error recovery
- Better Stack infrastructure monitoring (dashboards + alerts)
- Umami Cloud privacy-focused analytics

### 💡 Ideas for Future
- CSV export / Goodreads-compatible format
- JSON import functionality
- Reading stats dashboard
- International Amazon domains (.co.uk, .de, etc.)
- Rate limiting for Amazon scraping (deferred from architecture audit)
- ASIN→ISBN caching layer
- Book recommendations based on reading history

## Local Development

### Start Dev Server
```bash
npm run dev
```

### Start with Ngrok Tunnel (for Twilio testing)
```bash
npm run dev:tunnel
```
Then configure Twilio webhook to use the ngrok URL with `--host-header=localhost:5173` flag.

### TypeScript Check
```bash
npm run check
```

## Database Schema

### Migrations (Sequential Order)
1. `001_create_failed_book_imports.sql` - Error tracking table
2. `002_create_shelves.sql` - Shelves and book_shelves tables + TBR initialization
3. `003_create_sms_context.sql` - SMS context for ADD command
4. `004_add_default_shelf.sql` - Default shelf column on users
5. `005_add_description_and_date.sql` - Book metadata columns
6. `006_backfill_default_shelf.sql` - Backfill for existing users

### `users` Table
```sql
CREATE TABLE users (
  phone_number TEXT PRIMARY KEY,
  has_started BOOLEAN DEFAULT false,
  opted_out BOOLEAN DEFAULT false,
  default_shelf_id UUID REFERENCES shelves(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ
);
```

### `books` Table
```sql
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  isbn13 TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT[],
  publisher TEXT,
  publication_date TEXT,
  description TEXT,
  cover_url TEXT,
  is_read BOOLEAN DEFAULT false,
  is_owned BOOLEAN DEFAULT false,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, isbn13)
);
```

### `shelves` Table
```sql
CREATE TABLE shelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
```

### `book_shelves` Table (Many-to-Many)
```sql
CREATE TABLE book_shelves (
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  shelf_id UUID REFERENCES shelves(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (book_id, shelf_id)
);
```

### `sms_context` Table
```sql
CREATE TABLE sms_context (
  user_id TEXT PRIMARY KEY,
  last_command TEXT,
  detected_books JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `failed_book_imports` Table
```sql
CREATE TABLE failed_book_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  asin TEXT,
  error_type TEXT NOT NULL,
  error_message TEXT,
  status_code INT,
  final_url TEXT,
  source TEXT DEFAULT 'sms',
  notes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Known Issues
None currently blocking.

## Security & Code Quality
- ✅ All credentials migrated to environment variables
- ✅ Hardcoded Trello credentials rotated (2025-11-22)
- ✅ Security templates for sensitive files (.env.example, service-account.example.json)
- ✅ User ownership checks on all data-mutating endpoints (H1 audit fix)
- ✅ Type safety aligned with latest schema (H3 audit fix)
- ✅ Centralized book upsert logic (I1 audit fix)
- ✅ Server-side ISBN format validation (I2 audit fix)
- ✅ Vision API error recovery with exponential backoff (I4 audit fix)

## Recent Completions
- **2025-12-30:** Read/Owned status filters in SearchBar dropdown
- **2025-12-30:** About page content refresh
- **2025-12-30:** Technical stack added to README
- **2025-12-29:** Client-side search for shelf books (Cmd+K)
- **2025-12-29:** "Find Elsewhere" links on book cards (Amazon, Bookshop, library)
- **2025-12-29:** View mode analytics tracking (Umami)
- **2025-12-29:** Card modal close button (replaces collapse in modal context)
- **2025-11-22:** Architecture audit implementation (I1, I2, I4 - ~260 LOC reduction)
- **2025-11-22:** Security audit and credential hardening (rotated Trello credentials)
- **2025-11-22:** Shelf selection in multimodal "Add Book" flow (collapsible picker)
- **2025-11-22:** Smooth shelf transition animations (150ms crossfade)
- **2025-11-22:** Umami Cloud analytics tracking installation
- **2025-11-22:** Enhanced barcode display and fixed Copy ISBN button
- **2025-11-19:** Scalable two-tier shelf navigation (visible + dropdown)
- **2025-11-19:** Ko-fi donation link and feedback encouragement
- **2025-11-18:** Better Stack infrastructure monitoring setup (dashboards + alerts)
- **2025-11-16:** JSON export feature with complete library data
- **2025-11-16:** Settings page with export functionality
- **2025-11-14:** Homepage redesign with Inter font and improved hierarchy
- **2025-11-14:** Help page redesign with interactive FAQ accordion
- **2025-11-10:** User ownership checks on data-mutating endpoints (H1)
- **2025-11-10:** Type safety alignment with latest schema (H3)
- **2025-10-31:** Copy ISBN button on book cards (grid + list views, SVG icons, transparent bg)
- **2025-10-31:** Feedback form with Trello integration (FAB, focus trap, screenshot upload)
- **2025-10-31:** Fixed "All Books" button navigation with ?view=all parameter
- **2025-10-31:** Renumbered database migrations for Supabase CLI compatibility
- **2025-10-31:** Backfilled default_shelf_id for existing users
- **2025-10-31:** Enter key submit in Add Book modal
- **2025-10-31:** Publication date in multimodal detection
- **2025-10-31:** ISBN barcode generation (EAN-13, responsive)
- **2025-10-31:** About page, Help page, Global footer
- **2025-10-31:** Publication date and collapsible descriptions
- **2025-10-31:** Delete shelf feature with confirmation
- **2025-10-31:** Default TBR shelf auto-creation
- **2025-10-30:** Title/Author search → ISBN (MVP)
- **2025-10-30:** Returning user experience with localStorage
- **2025-10-29:** Multimodal ISBN input with detect endpoint
- **2025-10-29:** Fixed shelf tab active state bug (Svelte 5 reactivity)
- **2025-10-28:** Multi-user SMS flow with START/STOP commands
- **2025-10-28:** UI component library and grid/list view refactor
- **2025-10-27:** Amazon ISBN parser implementation

## Documentation

### Core Documentation
- `DEVLOG.md` - Chronological development log with implementation details
- `TESTING.md` - Testing procedures and examples
- `TODO.md` - Current task list

### Implementation Plans
- `docs/plans/2025-11-16-json-export.md` - JSON export feature implementation
- `docs/plans/2025-10-30-title-author-search.md` - Title/Author search feature
- `docs/plans/2025-10-29-delete-shelf.md` - Delete shelf feature
- `docs/plans/2025-10-28-default-tbr-shelf.md` - Default TBR shelf implementation

### Design References
- `docs/plans/reference/2025-10-27-amazon-isbn-parser-design.md` - Amazon parser design
- `docs/plans/reference/2025-10-28-default-tbr-shelf-design.md` - Default shelf design
- `docs/plans/reference/2025-10-29-multimodal-isbn-input-design.md` - Multimodal input design
- `docs/plans/reference/2025-10-29-pagination-recommendations.md` - Pagination strategy

### Operations & Monitoring
- `docs/betterstack-working-queries.md` - Infrastructure monitoring queries (600+ lines)
- `docs/betterstack-dashboard-setup.md` - Dashboard and alert configuration
- `docs/vercel-betterstack-log-setup.md` - Metrics source setup guide