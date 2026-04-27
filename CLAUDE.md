# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TBR.fyi is a book inbox that accepts ISBNs via SMS, fetches metadata from Google Books API, and displays books on personal shelf pages. Built with SvelteKit 5, Supabase, and Twilio. Supports multiple users with phone-number-based identification and START/STOP consent flow.

## Git & Commit Policy

**Critical rules for all git operations:**

- **Never commit without explicit approval** - Always ask for permission before creating any commits
- **No Claude references in commit messages** - Claude Code is already documented in README.md, so do not add redundant mentions of Claude, Claude Code, or claude.md in commit messages

## Development Commands

```bash
# Start dev server (localhost:5173)
npm run dev

# Start dev server with ngrok tunnel (for SMS testing)
npm run dev:tunnel

# Type check
npm run check

# Type check in watch mode
npm run check:watch

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture & Key Patterns

### ISBN Normalization Pipeline
The codebase uses a strict ISBN-13 branded type system (`src/lib/server/metadata/types.ts`). All ISBNs are normalized to ISBN-13 format before database storage or API calls:

1. Raw input (ISBN-10 or ISBN-13) → `toISBN13()` function
2. Validates checksum, converts ISBN-10 to ISBN-13 if needed
3. Returns branded `ISBN13` type (prevents accidental mixing of raw strings)

**When working with ISBNs:** Always use `toISBN13()` before passing to metadata fetchers or database operations.

### Request Flow: SMS to Shelf

```
Twilio SMS → /api/sms (POST)
  ↓
Get/create user record (users table)
  ↓
Check for commands (START, STOP, HELP)
  ↓
Check user consent (has_started, opted_out)
  ↓
Extract ISBN (from text, Amazon URL, or MMS photo)
  ↓
toISBN13() normalization
  ↓
fetchGoogleBooksMetadata(isbn13)
  ↓
supabase.upsert() to books table
  ↓
TwiML response to user
```

**SMS Commands:**
- `START` - Opt in / begin adding books (required for new users)
- `STOP` - Opt out / unsubscribe
- `HELP` - Get usage instructions

**Testing SMS locally:** Use `npm run dev:tunnel` to start both dev server and ngrok tunnel. Configure Twilio webhook to ngrok URL + `/api/sms`.

### Database Schema (Supabase)

**`users` table** - User accounts and authentication:
- `phone_number` (text, primary key): Primary identifier - phone number or synthetic `email_user_{uuid}`
- `email` (text, unique, nullable): Email address for email-based users
- `username` (text, unique, nullable): Custom username for pretty URLs (/username)
- `display_name` (text, nullable): Optional display name
- `verified_at` (timestamp, nullable): When user completed verification
- `has_started` (boolean): True after user sends START command (SMS users)
- `opted_out` (boolean): True after user sends STOP command (SMS users)
- `default_shelf_id` (uuid, nullable): References `shelves.id`, used for default view
- `created_at`, `started_at`, `opted_out_at` (timestamps)

**`sessions` table** - Secure session management:
- `token_hash` (text, primary key): SHA256 hash of session token
- `user_id` (text): References `users.phone_number`
- `created_at`, `expires_at`, `last_activity` (timestamps)

**`verification_codes` table** - Phone/email verification:
- `id` (uuid, primary key)
- `identifier` (text): Phone number or email
- `code` (text): 6-digit SMS code or email token
- `code_type` (text): 'sms_6digit' or 'email_token'
- `attempts` (integer): Failed verification attempts
- `used_at`, `expires_at` (timestamps)
- Unique constraint: one active code per identifier+type

**`verification_rate_limits` table** - Per-identifier rate limiting (persistent):
- `identifier` (text, primary key): Phone number or email
- `attempts_today`, `attempts_this_hour` (integer): Code request limits
- `failed_verification_attempts` (integer): Wrong code guesses (persists across code regenerations)
- `failed_attempts_reset_at` (timestamp): When failed attempts counter resets
- `hour_reset_at`, `day_reset_at` (timestamps): Window boundaries

**`ip_rate_limits` table** - IP-based rate limiting (persistent):
- `ip_address` (text, primary key)
- `attempts` (integer): Requests in current window
- `window_start`, `window_end` (timestamps)

**`books` table** - User's book collection:
- Uses composite unique constraint on `(user_id, isbn13)` to prevent duplicate books per user
- All upserts use `onConflict: 'user_id,isbn13'`
- `user_id`: Phone number (matches `users.phone_number`)
- `isbn13`: Always stored in ISBN-13 format (13 digits)
- `author`: PostgreSQL text array (`text[]`)
- `publisher`: Publisher name (text, nullable)
- `publication_date`: Publication date in YYYY or YYYY-MM-DD format (text, nullable)
- `description`: Book description/summary from metadata (text, nullable)
- `is_read`, `is_owned`: Toggle booleans (updated via `/api/books/update`)

**`shelves` table** - Custom user-created shelves (e.g., "Want to Read", "Favorites")

**`book_shelves` table** - Many-to-many join table for books and shelves

### Multi-User Architecture & Authentication

The app supports **dual-track authentication** for both SMS and email users:

**SMS Users (Phone-First):**
1. Text books to add them (no auth required initially)
2. Shelf accessible at `/+15551234567`
3. To claim/customize: Visit shelf → "Claim This Shelf" → SMS verification → set username
4. After claiming: Shelf available at `/{username}`

**Email Users (Email-First):**
1. Visit site → Sign in with email → magic link sent
2. Click link → server-side verification → redirected to username selection
3. Choose username → shelf created at `/{username}`
4. Add books via web UI

**URL Routing:**
- `/{username}` - Claimed usernames (canonical)
- `/+phone` - Phone numbers (backward compatible)
- `/email_user_{uuid}` - Email users before claiming username
- Reserved usernames (about, help, auth, api, settings, admin, book, books, shelf, shelves, etc.) are blocked to prevent route collisions

**Authentication Flow:**
- No Supabase Auth - custom session system
- Sessions stored with SHA256 token hashing
- HTTP-only cookies (7-day expiry)
- Rate limiting: 3 attempts/hour per IP, 5 codes/day per identifier

**SMS Commands (unchanged):**
- `START` - Opt in / begin adding books
- `STOP` - Opt out / unsubscribe
- `HELP` - Get usage instructions

### Metadata Fetching Strategy

The metadata orchestrator (`src/lib/server/metadata/index.ts`) fetches from multiple sources with fallback logic:

1. **Google Books** (primary) - Better coverage, richer descriptions
2. **Open Library** (fallback) - Used when Google returns no data or no cover

The fetchers have a 5-second timeout and return `null` on failure instead of throwing errors. If Google Books has metadata but no cover, and Open Library has a cover, the system uses Google's metadata with Open Library's cover.

**Rate limits:** Google Books allows ~1000 requests/day without API key. Set `GOOGLE_BOOKS_API_KEY` in `.env` for higher limits.

### Cover Photo Recognition

When a photo fails barcode detection, the system falls back to Gemini Flash vision to identify the book by its cover:

1. `detectBarcodes()` returns 0 ISBNs
2. `identifyBookFromCover()` sends the image to Gemini Flash with a structured prompt
3. Returns `{title, author, confidence}` — never throws
4. `searchBooks({title, author})` validates against Google Books
5. Results feed into existing candidate flow (SMS: search→ADD pattern, web: detect→modal UI)

The module is at `src/lib/server/cover-recognition.ts`. It gracefully degrades to the original "no ISBN detected" message when `GEMINI_API_KEY` is not set.

### Amazon Link Parsing

`extractISBNFromAmazon()` in `src/lib/server/amazon-parser.ts` handles Amazon product URLs including:
- Full URLs with `/dp/` and `/gp/product/` patterns
- Short `a.co` redirects (follows HTTP redirects to resolve)

### Retailer Link Parsing

`src/lib/server/bookshop-parser.ts` handles ISBN extraction from book retailer URLs:

**Supported retailers:**
- **Bookshop.org** and **Barnes & Noble**: Extracts ISBN from `?ean=` query parameter
- **Indiecommerce stores**: Extracts ISBN from `/book/{ISBN}` URL path pattern

**Key functions:**
- `extractISBNFromRetailer(textOrUrl, source)` - For `?ean=` parameter extraction
- `extractISBNFromIndiecommerce(textOrUrl, source)` - For `/book/{ISBN}` path extraction
- `containsRetailerUrl(text)` - Check if text contains Bookshop.org or B&N URL
- `isIndiecommerceUrl(text)` - Check for `/book/{ISBN}` pattern
- `isUnsupportedBookstoreUrl(text)` - Detect bookstores that can't be parsed (e.g., `/item/` pattern)

**Detection order** (in SMS endpoint):
1. MMS photos (barcode scanning)
2. Amazon links
3. Retailer links (Bookshop.org, Barnes & Noble)
4. Indiecommerce links
5. Unsupported bookstore detection
6. Plain ISBN
7. Title/author search

### Authentication Implementation

**Key Files:**
- `src/lib/server/auth.ts` - Session token generation, user creation, cookie settings
- `src/lib/server/rate-limit.ts` - IP and identifier rate limiting
- `src/lib/server/email.ts` - Resend email integration (falls back to console logging if no API key)
- `src/lib/server/twilio.ts` - Twilio SMS client
- `src/hooks.server.ts` - Session validation on every request
- `src/app.d.ts` - TypeScript types for `locals.user`

**API Endpoints:**
- `/api/auth/send-code` - Send SMS verification code (6 digits)
- `/api/auth/verify-phone` - Verify phone + code, create session
- `/api/auth/send-magic-link` - Send email magic link
- `/auth/confirm` - Server-side magic link verification
- `/api/auth/username` - Set/check username availability
- `/api/auth/session` - Check session status, logout

**Security Features:**
- SHA256 token hashing (never store plaintext)
- HTTP-only cookies (not accessible to JavaScript)
- 7-day session expiry with activity refresh (throttled to 1hr updates)
- Rate limiting: 3/hour per IP, 5 codes/day per identifier
- Failed verification tracking: 10 max per hour at identifier level (persists across code regenerations)
- Environment-aware cookies (secure flag only in production)
- CSRF protection via Origin header validation in `hooks.server.ts` (exempted for `/api/sms` and `/api/admin/cleanup`)
- Session-based authorization: API endpoints use `requireSessionUserId()` from authenticated session, not request headers

**Cleanup Functions (SQL):**
- `cleanup_expired_sessions()` - Removes expired sessions
- `cleanup_expired_verification_codes()` - Removes expired codes
- `cleanup_expired_rate_limits()` - Removes stale rate limit entries
- Called via `/api/admin/cleanup` (protected by CLEANUP_SECRET bearer token)

**Critical Pattern: Phone Number as Primary Key**
- All users have `phone_number` as PK (even email users)
- Email users get synthetic: `email_user_{uuid}`
- This avoids complex migrations and maintains backward compatibility
- Sessions reference `user_id` → `users.phone_number`

## Environment Setup

Copy `.env.example` to `.env` and fill in the values.

**Required variables:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
PUBLIC_BASE_URL=http://localhost:5173  # or https://your-app.vercel.app in production
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+15551234567
RESEND_API_KEY=re_your-api-key  # For email verification (optional in dev, logs to console)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

**Optional variables:**
```
GOOGLE_BOOKS_API_KEY=your-key  # Increases Google Books rate limits
GEMINI_API_KEY=your-key        # Cover photo recognition via Gemini Flash
CLEANUP_SECRET=your-secret     # For /api/admin/cleanup endpoint (cron jobs)
```

**Trello Feedback (optional for local dev):**
- Get API key: https://trello.com/app-key
- Generate token: Click "Token" on API key page
- Find board ID: URL when viewing board (e.g., `trello.com/b/BgUPuHtx/...`)
- Find list ID: Run `node scripts/get-trello-lists.js` with valid credentials

**Important:** `PUBLIC_BASE_URL` is included in SMS responses so users know where to view their shelf. Update this to your production URL when deploying.

## Database Setup

Run the SQL migrations in `supabase/migrations/` folder in order:
1. `001_create_failed_book_imports.sql` - Creates failed_book_imports table for error tracking
2. `002_create_shelves.sql` - Creates shelves and book_shelves tables, adds TBR shelf for existing users
3. `003_create_sms_context.sql` - Creates sms_context table for ADD command support
4. `004_add_default_shelf.sql` - Adds default_shelf_id to users table
5. `005_add_description_and_date.sql` - Adds description and publication_date to books table
6. `006_backfill_default_shelf.sql` - Backfills default_shelf_id for existing users with TBR shelves
7. `014_consolidated_auth.sql` - **Consolidated auth migration** (adds sessions, verification, rate limiting)

**Note:** Migrations 007-013 are legacy auth migrations that have been consolidated into 014. Skip them for fresh installs. If you've already run them, 014 is safe to run (idempotent).

## Testing Locally

### Quick shelf test:
1. `npm run dev`
2. Manually insert a user and book via Supabase Table Editor
3. Visit `http://localhost:5173/+15551234567` (replace with test phone number)

### Full SMS test (multi-user flow):
1. `npm run dev:tunnel` (starts ngrok automatically)
2. Copy ngrok URL from terminal
3. Configure Twilio webhook: `https://abc123.ngrok.io/api/sms` (HTTP POST)
4. Text "Hello" from a new number → Should receive welcome message
5. Reply "START" → Should receive activation message
6. Text an ISBN → Should add book to shelf

See `TESTING.md` for detailed step-by-step instructions.

## Deployment (Vercel)

The project uses `@sveltejs/adapter-vercel` and is production-ready. Add all environment variables in Vercel dashboard before deploying. Update Twilio webhook URL to production URL after deployment.

## Common Gotchas

- **Phone number format:** Always include + prefix (e.g., `+15551234567`)
- **Author field:** Must be JSON array syntax when manually inserting: `["Author Name"]`
- **ISBN validation:** The `toISBN13()` function will throw `InvalidISBNError` on invalid checksums
- **Duplicate books:** Upserts use `ignoreDuplicates: true`, so re-texting same ISBN is safe but returns cached book
- **Google Books 404:** Some ISBNs legitimately don't exist in Google Books—this is expected behavior
- **Email users:** Have synthetic phone_numbers starting with `email_user_` - never assume phone_number is a real phone
- **Session cookies:** Use `locals.user` in server code, not Supabase Auth - custom session system only
- **Username validation:** Must start with letter/number, 3-20 chars, alphanumeric + underscore/hyphen only
- **URL routing:** Support `/{username}`, `/+phone`, and `/email_user_{uuid}` formats in all shelf-related code

## Manual Book Entry

Users can add books via:
1. **SMS**: Text ISBN, Amazon link, or photo of barcode to Twilio number
2. **Web UI**: Click "+" button in shelf header → enter ISBN in modal

Both methods use the same metadata fetching logic (Google Books → Open Library fallback).

**Security**: Web UI endpoints require authenticated session. User ID comes from `locals.user` (session-based), not request headers.

**Keyboard shortcut**: Press `+` key to open ISBN entry form

## Default TBR Shelf

New users automatically get a "TBR" (To Be Read) shelf:
- Created when user sends START command
- Set as their default shelf (`users.default_shelf_id`)
- New books auto-assigned to TBR shelf

**Default view behavior:**
- Shelf page loads TBR view if user has default shelf
- Otherwise loads "All Books" view
- URL param `?shelf=<id>` overrides default

**Database:**
- `users.default_shelf_id` references `shelves.id`
- Unique constraint on `(user_id, name)` for idempotent creation
- Books stay on TBR when marked as read (manual removal)

**Existing users:** No automatic TBR creation (manual only)

## SMS Message Management

All SMS messages and commands are centralized in `src/lib/server/sms-messages.ts`:
- `SMS_COMMANDS` - Command constants (START, STOP, HELP)
- `SMS_MESSAGES` - All user-facing messages (success, errors, onboarding)
- `detectCommand()` - Helper to parse command from message text

**When adding new messages:** Update `sms-messages.ts` instead of hardcoding strings in the endpoint. This keeps all messaging in one maintainable location.

## Design System

The app uses a warm, paper-inspired design with CSS custom properties as the source of truth, extended into Tailwind config.

### Color Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `--paper-light` | `#f5f0e8` | Alternate backgrounds, hover states |
| `--paper-mid` | `#ebe4d8` | Primary background |
| `--paper-dark` | `#e5ddd0` | Borders, dividers |
| `--terracotta` | `#c4a67c` | Primary accent (buttons, links, focus rings) |
| `--terracotta-dark` | `#a8845c` | Accent hover states |
| `--charcoal` | `#3d3d3d` | Primary text |
| `--warm-gray` | `#635e58` | Secondary text |

### Semantic Tokens
- `--background` → `--paper-mid`
- `--background-alt` → `--paper-light`
- `--surface` → white (cards, modals)
- `--border` → `--paper-dark`
- `--text-primary` → `--charcoal`
- `--text-secondary` → `--warm-gray`
- `--accent` → `--terracotta`
- `--accent-hover` → `--terracotta-dark`

### Typography
- **UI text**: Inter (`--font-sans`)
- **Book titles**: Lora italic (`--font-serif`)

### Usage Patterns
```css
/* CSS variables (preferred for component styles) */
background: var(--background);
color: var(--text-primary);
border: 1px solid var(--border);

/* Tailwind classes (available via config) */
class="bg-paper-light text-charcoal border-border"
class="bg-terracotta hover:bg-terracotta-dark"
class="font-serif italic"  /* For book titles */
```

### Key Files
- `src/app.css` - Token definitions
- `tailwind.config.js` - Tailwind theme extension
- `src/lib/components/ui/` - Reusable components

### Component Patterns
- **Inputs**: Use `focus:ring-[var(--accent)]` for focus states
- **Buttons**: Primary uses `--accent`, secondary uses `--surface` with `--border`
- **Cards**: White background (`--surface`), 16px border-radius, subtle shadow
- **Book titles**: Always use `font-serif italic` (Lora)

## Code Philosophy

This is an MVP with no tests, minimal error handling, and bare minimum observability. The focus is on validating the core idea quickly. Multi-user support is basic (phone-based, no auth). If the app proves valuable, THEN add infrastructure (tests, monitoring, proper auth).
