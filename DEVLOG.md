# Development Log

## 2026-01-11 - Per-Shelf Export

### Added ability to export individual shelves as CSV or JSON
- **Goal**: Allow users to export subsets of their library filtered by shelf for workflows like FBA listings, wholesale pricing lookups, or consignment packing lists
- **Implementation**:
  - Added `?shelf={shelfId}` query parameter to both `/api/export` (JSON) and `/api/export/csv` endpoints
  - Two-step filtering approach: resolve shelf ID → book IDs via `book_shelves` table → filter books array (avoids brittle nested Supabase filter syntax)
  - Shelf validation ensures shelf exists and belongs to requesting user
  - JSON output includes `shelfFilter` field with shelf name when filtered
  - Filename includes shelf name: `tbr-export-{shelf-name}-{date}.{csv|json}`
- **UI changes**:
  - Download button (arrow + tray icon) appears only on the active/selected shelf pill
  - Clicking triggers CSV export of that shelf
  - Loading spinner shows during export
  - Error banner with dismiss button (not alert())
  - Success feedback via existing toast system
- **Bug fixes**:
  - Fixed shelf name filter to exclude both `null` and `undefined` (was only checking `!== null`)
- **Files modified**:
  - `src/routes/api/export/+server.ts` - Added shelf filtering, shelfFilter field, filename generation
  - `src/routes/api/export/csv/+server.ts` - Added shelf filtering, added `id` to BookRow interface
  - `src/routes/[identifier]/+page.svelte` - Added export button, handler, error display
- **Spec**: `docs/plans/2026-01-11-json-per-shelf-export-spec.md`

## 2026-01-10 - Retailer Link Parsing (Bookshop.org, Barnes & Noble, Indiecommerce)

### Added ISBN extraction from retailer URLs for SMS and web
- **Goal**: Allow users to add books via links from popular book retailers, not just Amazon
- **Implementation**:
  - Created `src/lib/server/bookshop-parser.ts` with multiple extraction functions
  - `extractISBNFromRetailer()` - Extracts ISBN from `?ean=` query parameter (Bookshop.org, Barnes & Noble)
  - `extractISBNFromIndiecommerce()` - Extracts ISBN from `/book/{ISBN}` URL path pattern
  - `isUnsupportedBookstoreUrl()` - Detects bookstores that can't be parsed (e.g., `/item/` pattern)
  - Helper functions: `containsRetailerUrl()`, `isIndiecommerceUrl()`
- **Supported URL patterns**:
  - `https://bookshop.org/p/books/{slug}?ean={ISBN13}` → extracts from query param
  - `https://www.barnesandnoble.com/w/{slug}?ean={ISBN13}` → extracts from query param
  - `https://{indie-store}/book/{ISBN13}` → extracts from URL path (Indiecommerce pattern)
- **Error handling**:
  - Missing `?ean=` parameter → friendly message suggesting alternative input methods
  - Unsupported bookstores (JS-rendered sites) → helpful message without mentioning technical details
  - Invalid ISBN in URL → returns null, falls through to title search
- **SMS messages** (`src/lib/server/sms-messages.ts`):
  - `retailerNoIsbn(retailer)` - Dynamic message for missing EAN
  - `UNSUPPORTED_BOOKSTORE` - Guidance for unsupported bookstore links
- **Integration**:
  - SMS endpoint: Added detection steps after Amazon, before plain ISBN check
  - Web endpoint: Added else-if blocks for retailer and Indiecommerce URLs
- **Detection order in SMS flow**:
  1. MMS photos (barcode scanning)
  2. Amazon links
  3. Retailer links (Bookshop.org, Barnes & Noble)
  4. Indiecommerce links (`/book/{ISBN}` pattern)
  5. Unsupported bookstore detection
  6. Plain ISBN
  7. Title/author search
- **Files created**: `src/lib/server/bookshop-parser.ts`
- **Files modified**: `src/lib/server/sms-messages.ts`, `src/routes/api/sms/+server.ts`, `src/routes/api/books/detect/+server.ts`
- **Future**: Added TODO item for structured logging of URL parsing with success/failure metrics

## 2026-01-10 - Design System & Homepage Refresh

### Implemented paper-inspired design system with CSS custom properties
- **Goal**: Create consistent visual language across all pages with warm, book-friendly aesthetic
- **Core palette**: Paper tones (light/mid/dark), terracotta accent, charcoal text, warm gray secondary
- **Implementation**:
  - Defined CSS custom properties in `src/app.css` as source of truth
  - Extended Tailwind config to reference CSS variables for utility class usage
  - Created semantic tokens (`--background`, `--surface`, `--accent`, etc.) for consistent theming
  - Typography: Inter for UI, Lora italic for book titles only
- **Documentation**: Created `docs/design-system.md` with comprehensive reference (colors, typography, components, spacing, shadows)
- **Files created**: `docs/design-system.md`
- **Files modified**: `src/app.css`, `tailwind.config.js`

### Homepage redesign with carousel and returning user experience
- **Carousel feature**: Swipeable phone mockup showing SMS conversation and shelf screenshot
  - Touch swipe support with `touchstart`, `touchmove`, `touchend` events
  - Click/tap to toggle between slides
  - Dot indicators for navigation
  - CSS transform-based sliding animation
- **Returning user detection**: Checks localStorage for `tbr-userId`
  - Returning users see login form at top (below hero, above "How it works")
  - Beta notice appears right after login for returning users
  - New users see login and beta notice at bottom (original flow)
- **Copy updates**:
  - Step 2: "Text the title. Snap the barcode. Or send a link."
  - Added "This is a beta" heading with feedback encouragement
- **Files modified**: `src/routes/+page.svelte`
- **Assets added**: `static/barcode.png`, `static/shelf-mockup.png`, `static/tbr-lockup-transparent.png`

### Applied design system across all pages
- Updated all auth pages (signin, signup, verify-phone, verify-email, confirm, signout, username)
- Updated static pages (about, help)
- Updated settings and book detail pages
- Fixed Input component focus ring from blue to terracotta accent
- Updated FeedbackModal with design system tokens

### On-demand sign-in prompt for expired sessions
- Created `SignInPromptModal` component triggered by 401 API responses
- Added `auth-prompt` store for cross-component state management
- Created `api.ts` utility with `fetchWithAuth()` wrapper for automatic 401 handling
- Modal offers sign-in options when session expires mid-use

## 2025-12-30 - Search, Performance & UI Polish

### Instant client-side shelf filtering
- **Performance win**: Shelf switching is now instant with no server round-trip
- Books are filtered locally using pre-loaded `allBooks` and `bookShelves` data
- Uses `history.pushState()` for shallow URL updates without page reload
- Added `popstate` listener for browser back/forward navigation

### Search dropdown fixes
- **Portal pattern**: Dropdown now renders at `document.body` level to escape header's transform stacking context
- Fixed z-index issues where dropdown appeared behind sticky shelf filter pills
- Position calculated dynamically using `getBoundingClientRect()` for accurate placement
- **Debounce fix**: Pending timer now cleared on all close paths (Escape, select, toggle, click outside)

### Search result navigation
- Clicking a search result scrolls to the book and expands/flips the card
- **List view**: Scrolls to book, highlights with pulse animation, expands the card
- **Grid view**: Scrolls to book, highlights with pulse animation, flips the card
- Only one card can be expanded/flipped at a time

### Card component enhancements
- **Compact/expanded redesign**: Card refactored with collapsible compact view and expandable details
- Made `expanded` prop bindable for external state control
- Added `onToggleExpand` callback for parent state sync
- **Note sync fix**: Note value now syncs correctly when book data updates externally

### Card hover and background styling
- **Compact cards**: Semi-transparent white (`bg-white/50`) blends with page
- **Hover state**: Solid white with subtle shadow (`hover:shadow-sm`)
- **Expanded state**: Solid white with medium shadow (`shadow-md`)
- **Page background**: Changed from `gray-50` to `gray-100` for better card contrast
- Updated sticky headers and gradients to match new background

### FlipCard improvements
- Simplified back: Shows note preview with "View Details" button for full modal
- Corner fold hint: Visual indicator that cards are flippable
- One-time flip hint: First-time users see "Click to flip" tooltip on first card
- Note expansion: Notes fill available space on card back
- Soft success feedback: Visual confirmation when actions complete

### Mobile UI polish
- **Smart sticky header**: Slides up when scrolling down, reappears when scrolling up
- **Shelf filter pills**: Auto-scroll to selected shelf, improved overflow handling
- **More Shelves dropdown**: Fixed positioning and behavior

### SEO improvements
- Added proper `<title>` and meta description to shelf pages
- Meta description includes book count

### Bug fixes
- **API username resolution**: Username identifiers now properly resolve to `user_id` in API endpoints
- **Note editing accessibility**: Notes can be edited from both grid and list layouts

## 2025-12-14 - Integration Research & Documentation

### Comprehensive integration research for ecosystem expansion
- **Goal**: Document integration possibilities with external book tracking platforms and evaluate API/export strategies
- **Research Conducted**:
  - **Hardcover.app**: Full GraphQL API (beta, free), read/write access, Bearer token auth
  - **The StoryGraph**: No official API (4+ year roadmap item), CSV import only via Goodreads format
  - **Shepherd.com**: Discovery-focused platform, no public API, TBR app in development
  - **BookWyrm**: Federated ActivityPub platform, no authenticated API for external apps
- **TBR.fyi Public API Design**: Designed comprehensive REST API specification
  - `POST /api/v1/books` - Add book by ISBN
  - `GET /api/v1/books` - List with filters (shelf, status, pagination)
  - `PATCH /api/v1/books/:id` - Update read/owned status
  - `DELETE /api/v1/books/:id` - Remove from library
  - API key authentication with SHA256 hashing, `tbr_k_` prefix
  - Estimated ~3-5 days implementation effort
- **Integration Frontier**: Documented ROI tiers for Siri Shortcuts, Slack, Discord, Notion, Zapier, IFTTT, browser extensions
- **Ecosystem Expansion**: Web components, WordPress/Shopify plugins, Open TBR Format standard, webhooks
- **CSV Export Specification**: Complete Goodreads-compatible format (31 columns)
  - Critical ISBN format: `="9780140449136"` wrapper to preserve leading zeros
  - Field mapping from TBR.fyi data model
  - Platform-specific import notes (StoryGraph, Hardcover, BookWyrm)
  - Estimated ~2.5 days implementation effort
- **Files Created**:
  - `docs/research/integration-research.md` - Platform integration details (6 parts)
  - `docs/research/ecosystem-expansion-research.md` - Network effect strategies
  - `docs/plans/csv-export-specification.md` - Goodreads CSV export spec

## 2025-12-12 - Book Sharing Feature

### Individual book sharing with dedicated share pages
- **Goal**: Allow users to share individual books from their shelf via shareable links
- **Implementation**:
  - Created shared book page at `/{identifier}/book/{isbn13}`
  - ShareModal component for copying share links with "Copied!" feedback
  - Share button added to shelf grid (FlipCard back) and list views
  - Add-from-share API endpoint with 409 response for duplicates
  - Auto-adds shared book after email verification (checks `isbn` query param)
  - Share page includes Copy ISBN, Barcode toggle, and Share button
- **URL Format**: `/{username}/book/{isbn13}` (canonical)
  - Supports all identifier formats: username, +phone, email_user_{uuid}
  - Redirects legacy formats to canonical username URL when available
- **User Flow**:
  - Sender: Views book → clicks Share → copies link
  - Recipient: Opens link → sees book details + "Shared by @username" → clicks "Add to my shelf"
  - Non-users: Can view book, prompted to sign up to add
- **Open Graph Tags**: Added meta tags for social previews (title, author, cover image)
- **Files Created**:
  - `src/routes/[identifier]/book/[isbn13]/+page.server.ts` - Data loader
  - `src/routes/[identifier]/book/[isbn13]/+page.svelte` - Share page UI
  - `src/lib/components/ui/ShareModal.svelte` - Share link modal
  - `src/routes/api/books/add-from-share/+server.ts` - Add book API
- **Files Modified**:
  - `src/routes/[identifier]/+page.svelte` - Added Share button and modal
  - `src/lib/components/ui/Card.svelte` - Added `onShare` callback prop
  - `src/lib/server/sms-messages.ts` - Added `getBookShareUrl()` helper
  - `src/routes/auth/confirm/+server.ts` - Auto-add book after verification

### URL cleanup: Removed @ prefix from username URLs
- Changed from `/@{username}` to `/{username}` for cleaner URLs
- Added reserved username validation (about, help, auth, api, etc.)
- Updated all redirects and navigation throughout the app

## 2025-12-08 - Custom Authentication System

### Dual-track authentication for email and SMS users
- **Goal**: Replace Supabase Auth with custom session system supporting both email magic links and SMS verification
- **Design**: See `docs/plans/2025-12-08-simplified-auth-design.md`
- **Implementation**:
  - Custom session system with SHA256 token hashing
  - HTTP-only cookies (7-day expiry, activity refresh)
  - Rate limiting: 3 attempts/hour per IP, 5 codes/day per identifier
  - Failed attempt tracking (3 max per verification code)
- **Email Flow (Magic Link)**:
  - User enters email → magic link sent via Resend
  - Click link → server-side verification → username selection
  - Sender: `noreply@notifications.tbr.fyi`
- **SMS Flow (6-Digit Code)**:
  - User enters phone → 6-digit code sent via Twilio
  - Enter code on web → session created → username selection
- **Database Schema** (4 new tables):
  - `sessions` - SHA256 token hashes, user_id, expiry
  - `verification_codes` - codes/tokens with type, attempts, expiry
  - `verification_rate_limits` - per-identifier rate limiting
  - `ip_rate_limits` - IP-based rate limiting
- **API Endpoints**:
  - `POST /api/auth/send-code` - Send SMS verification code
  - `POST /api/auth/verify-phone` - Verify phone + code
  - `POST /api/auth/send-magic-link` - Send email magic link
  - `GET /auth/confirm` - Server-side magic link verification
  - `POST /api/auth/username` - Set/check username availability
  - `GET/DELETE /api/auth/session` - Session management
- **Username Rules**: 3-20 chars, alphanumeric + underscore/hyphen, must start with letter/number
- **Reserved Usernames**: about, help, auth, api, settings, etc.
- **Phone Number as Primary Key**: All users have `phone_number` as PK (email users get `email_user_{uuid}`)
- **Files Created**:
  - `src/lib/server/auth.ts` - Session management, token generation
  - `src/lib/server/rate-limit.ts` - Rate limiting utilities
  - `src/routes/auth/` - Verification UI pages
  - `src/routes/api/auth/` - Auth API endpoints
  - `supabase/migrations/012-013` - Session system migrations
- **Files Modified**:
  - `src/hooks.server.ts` - Session validation middleware
  - `src/app.d.ts` - TypeScript types for `locals.user`
  - `src/lib/server/email.ts` - Magic link email template

## 2025-11-22 - Architecture Audit Implementation (Important Items)

### Implemented code quality improvements from architecture audit
- **Source**: ARCHITECTURE_AUDIT.md - addressing "IMPORTANT" priority items
- **Goal**: Reduce code duplication, improve validation, enhance error recovery

### I1: Extracted duplicate book upsert logic to shared function
- **Problem**: Book upsert + default shelf assignment logic duplicated 4 times:
  - `/api/books/add/+server.ts` - Manual web UI addition
  - `/api/sms/+server.ts` - ISBN command (lines 247-305)
  - `/api/sms/+server.ts` - MMS photo flow (lines 445-508)
  - `/api/sms/+server.ts` - Fallback ISBN add (lines 632-697)
- **Solution**: Created `/src/lib/server/book-operations.ts` with `upsertBookForUser()` function
- **Benefits**:
  - Single source of truth for book addition logic
  - Consistent error handling across all entry points
  - Easier to maintain and test
  - Auto-assignment to default shelf centralized
- **Implementation**:
  - Handles book upsert with conflict resolution
  - Auto-assigns to user's default shelf if configured
  - Returns structured result with success/error/isDuplicate flags
  - Non-blocking shelf assignment (doesn't fail entire operation)
- **Files created**: `src/lib/server/book-operations.ts`
- **Files updated**:
  - `src/routes/api/books/add/+server.ts` (replaced ~80 lines with function call)
  - `src/routes/api/sms/+server.ts` (replaced 3 duplicate blocks, saved ~180 lines)
  - Removed unnecessary `defaultShelfId` pre-fetching from MMS flow
- **Code reduction**: ~260 lines of duplicate logic eliminated

### I2: Added server-side ISBN format validation
- **Problem**: Server only validated ISBN existence, not format - relied on `toISBN13()` throwing errors
- **Solution**: Created `/src/lib/server/validation.ts` with `validateISBNFormat()` function
- **Validation rules**:
  - Checks for 10 or 13 character length (after removing hyphens/spaces)
  - Validates only digits, X, hyphens, and spaces allowed
  - ISBN-10: X can only appear as last character
  - ISBN-13: Cannot contain X at all
  - Returns clear error messages for each violation
- **Benefits**:
  - Better user error messages ("ISBN must be 10 or 13 characters" vs generic checksum error)
  - Catches format errors before expensive toISBN13() processing
  - Reusable validation function for other endpoints
- **Files created**: `src/lib/server/validation.ts`
- **Files updated**: `src/routes/api/books/add/+server.ts` (validates before normalization)

### I4: Added error recovery to Vision API client singleton
- **Problem**: Module-level singleton client with no retry - if initialization failed once, error state persisted forever
- **Solution**: Added automatic retry logic with exponential backoff
- **Implementation**:
  - Tracks last initialization attempt timestamp
  - Caches last error and retries after 60-second delay
  - Provides clear error messages with retry countdown
  - Resets error state on successful initialization
  - Prevents rapid retry loops while allowing recovery
- **Benefits**:
  - Transient failures (network issues, credential refresh) can self-heal
  - No permanent failure states
  - Clear feedback to users about when retry will occur
  - Prevents retry storms
- **Files updated**: `src/lib/server/vision.ts` (lines 16-81)

### Status of other audit items
- **I3 (User ID extraction)**: ✅ Already resolved - `auth.ts` with `requireUserId()` exists and is used
- **I6 (Shelf deletion)**: ✅ Already resolved - `/api/shelves` DELETE clears `default_shelf_id` (lines 110-121)
- **I5 (Rate limiting)**: ⏸️ Deferred - larger infrastructure change, not blocking for MVP

### Technical debt reduced
- **Before**: 4 duplicate book upsert implementations (~260 LOC), weak validation, fragile singleton
- **After**: Centralized operations, robust validation, self-healing error recovery
- **LOC saved**: ~260 lines of duplicate code eliminated
- **Type safety**: All new code passes TypeScript strict checks
- **SMS handler**: Reduced from 4 duplicate blocks to 3 calls to shared `upsertBookForUser()` function

## 2025-11-22 - Security Audit and Credential Hardening

### Conducted comprehensive security audit of secrets and credentials
- **Audit scope**: Identified all secrets, API keys, and credentials used in the application
- **Git history scan**: Verified that .env and service-account.json were never committed to repository
- **Findings**:
  - ✅ Supabase service role key: Never in git history (safe)
  - ✅ Google Cloud service account: Never in git history (safe)
  - ✅ Twilio credentials: Never in git history (safe)
  - 🚨 **Trello credentials**: Found hardcoded in `scripts/get-trello-lists.js` (CRITICAL)
  - ✅ Umami website ID: Public client-side (safe by design)
- **Repository status**: Confirmed GitHub repo is private (404 response)

### Fixed hardcoded Trello credentials vulnerability
- **Problem**: `scripts/get-trello-lists.js` contained hardcoded API key, token, and board ID (lines 2-4)
- **Security risk**: Credentials visible in git commit history (commit `d652e2f` and earlier)
- **Resolution**:
  - Rotated Trello API token and regenerated credentials
  - Rewrote script to read from environment variables using `dotenv/config`
  - Added validation to show helpful error if env vars missing
  - Updated credentials in .env and Vercel environment variables
- **Files modified**: `scripts/get-trello-lists.js`

### Created security templates for sensitive files
- **service-account.example.json**: Template showing Google service account JSON structure with placeholders
- **Purpose**: Helps developers set up credentials without exposing real values
- **Pattern**: Uses placeholder values like "your-project-id", "your-private-key"
- **Files created**: `service-account.example.json`

### Enhanced .env.example with complete credential documentation
- **Added Trello section**: TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID, TRELLO_LIST_ID
- **Improved documentation**: Clear comments explaining what each credential is for
- **Developer experience**: New developers can copy .env.example → .env and fill in values
- **Files modified**: `.env.example` (lines 22-26)

### Strengthened .gitignore to prevent future credential leaks
- **Added**: `supabase/.branches/` to exclude local Supabase branch data
- **Already covered**: .env, .env.*, service-account.json, *.log files
- **Verification**: Confirmed all secret files properly excluded from version control
- **Files modified**: `.gitignore` (line 25)

### Security posture summary
- **Before**: 1 script with hardcoded credentials visible in git history
- **After**: All credentials in environment variables, old credentials rotated, templates in place
- **Protection layers**: .gitignore exclusions + example templates + env var validation in scripts
- **Risk status**: Mitigated (old Trello credentials invalidated, new ones secure)

## 2025-11-22 - Shelf Transitions and Analytics Tracking

### Added smooth transitions when switching between shelves
- **Shelf switching animations**: Wrapped both grid and list views in `{#key data.selectedShelfId}` block
- **Crossfade effect**: 150ms fade out → 150ms delay → 300ms fade in
- **Consistent with view toggle**: Uses same transition parameters as grid/list mode switching
- **Files modified**: `src/routes/[username]/+page.svelte` (lines 938-1294)

### Installed Umami Cloud analytics tracking
- **Privacy-focused analytics**: Added Umami script to track page views and user behavior
- **Global tracking**: Script added to `src/app.html` head section for all pages
- **Deferred loading**: Uses `defer` attribute to avoid blocking page render
- **Account**: Connected to Umami Cloud (ID: 1604e054-a0aa-4abd-bc1e-7654f6e8bd14)
- **Website ID**: f02a51c2-ddb8-42cf-9ab6-9d194c15c633
- **Files modified**: `src/app.html` (line 6)

### Added shelf selection to multimodal "Add Book" flow
- **Collapsible shelf picker**: Users can now assign books to shelves during bulk import/detection
- **Workflow**: After detecting books → click "Add to shelves (optional)" → select shelves → add books
- **Implementation**:
  - Added `selectedShelfIds` state to track shelf selections
  - Added `showShelfSelection` state for collapse/expand (defaults to collapsed)
  - Disclosure button with rotating chevron icon for clean, minimal UI
  - Checkboxes for each shelf (scrollable list, max-height: 8rem)
  - Enhanced `addSelectedBooks()` to assign books to selected shelves after adding to library
- **API flow**: First adds books → refreshes data → then assigns to shelves → refreshes again
- **State cleanup**: Resets `selectedShelfIds` and `showShelfSelection` when modal closes
- **Use case**: Bulk CSV import can now assign all books to "Want to Read" in one action
- **Files modified**: `src/routes/[username]/+page.svelte` (lines 47-48, 560-649, 1550-1581)

## 2025-11-22 - Cover Card Barcode and Copy Button Improvements

### Enhanced barcode display for better scannability
- **Increased barcode size**: Bar width increased from 0.8-1.2px to 1.5-2.5px for better visibility
- **Taller barcode**: Height increased from 30-45px to 50-65px minimum/maximum
- **Better width utilization**: Changed from `containerWidth - 24px` (with 280px cap) to `containerWidth - 12px` (no cap)
- **Proper centering**: Removed all JsBarcode margins and added `flat: true` to eliminate quiet zone whitespace
- **Responsive scaling**: Uses ResizeObserver to regenerate barcode on viewport changes
- **Professional appearance**: Barcode now uses nearly full card width while remaining scannable

### Fixed Copy ISBN button functionality
- **Made function async**: Updated `copyISBN()` to properly await `navigator.clipboard.writeText()`
- **Added error handling**: Wrapped clipboard API call in try/catch with console error logging
- **Updated onclick handler**: Changed button handler to `async (e) =>` to properly await the async function
- **Visual feedback**: "Copied!" message now displays correctly after successful copy

### Technical details
- Reduced barcode container padding from `p-3` to `p-2` for better space utilization
- Added `node.style.display = 'block'` for proper canvas centering
- Synchronized both initial generation and regenerate functions with same parameters
- JsBarcode config: `margin: 0, flat: true, textMargin: 0` to minimize whitespace
- Barcode container allows content to push down "Remove from shelf" button as needed

## 2025-11-19 - Shelf Navigation UX Improvements

### Implemented two-tier shelf navigation ux to reduce clutter
  - Always visible: "All Books" + first 3 shelves + "+ New Shelf" button
  - Hidden in dropdown: All remaining shelves behind "More shelves (N)" button
  - Smart visibility logic: Always includes currently selected shelf in visible pills (even if not in top 3)
  - Click-outside handler to close dropdown automatically
  - Changed shelf ordering from oldest-first to newest-first (`ascending: false`)

### Added Ko-fi donation link and feedback encouragement
- Added "Leave me a tip" link to global footer pointing to https://ko-fi.com/stevenpate
- Added prominent feedback note at bottom of homepage encouraging users to click Feedback button
- Yellow banner with clear call-to-action emphasizing importance of user feedback during MVP phase

## 2025-11-18 - Better Stack Infrastructure Monitoring Setup

### Implemented production infrastructure monitoring with Better Stack metrics
- **Goal**: Set up observability dashboards to monitor application health, traffic patterns, and errors
- **Implementation**:
  - Configured Vercel → Better Stack integration (Logtail)
  - Discovered Better Stack source is a **Metrics source** (not raw logs) via `DESCRIBE TABLE {{source:tbr_delta}}`
  - Source stores pre-aggregated infrastructure metrics, not application stdout logs
  - Key field mappings: `response_status`, `request_method`, `request_path`, `dt`, `user_agent_platform`, `events_count`
  - Used ClickHouse aggregate functions: `countMerge()`, `countMergeIf()` for querying metrics
  - **Dashboard 1: Application Health Overview** ✅ (6 widgets):
    - Request Success Rate (24h) - percentage of 2xx/3xx responses
    - Error Count (24h) - count of 4xx/5xx responses
    - Total Requests (24h) - overall traffic volume
    - Requests Over Time - hourly time series chart
    - Status Code Breakdown - table of HTTP status distribution
    - Top Request Paths - table of most-accessed endpoints
  - **Dashboard 2: Traffic Analysis** ✅ (3 widgets):
    - Requests by Method - GET/POST pie chart
    - Traffic by Platform - PC/iOS/Mac breakdown
    - Bot Traffic - bot request counter
  - **Critical Alerts Dashboard** ✅ (3 alerts):
    - High Error Rate (5xx) - triggers on >10 errors in 10 min
    - Low Success Rate - triggers on <95% success rate
    - No Traffic (Downtime) - triggers on 0 requests in 5 min
- **What Works** ✅:
  - Infrastructure monitoring: uptime, errors, traffic patterns, status codes
  - All critical operational metrics for production reliability
  - Real-time dashboards and alerting on infrastructure issues
- **What Doesn't Work** ❌:
  - Application logs (Pino stdout) not accessible via queries (no `message` field in metrics source)
  - Business metrics (book additions, user signups, API calls) require separate logs source
  - Better Stack Vercel integration creates Metrics/APM source, not raw Logs source
- **Documentation**:
  - Created `docs/betterstack-working-queries.md` (600+ lines) with working infrastructure queries
  - Clearly marked which queries work (infrastructure) vs don't work (application logs)
  - Created `docs/vercel-betterstack-log-setup.md` documenting metrics source limitations
  - Updated `docs/betterstack-dashboard-setup.md` with field name warnings
- **Technical Learnings**:
  - Better Stack Vercel integration provides metrics, not raw logs
  - Metrics source: pre-aggregated, structured columns, optimized for infrastructure monitoring
  - Logs source (different type): raw messages, full-text search, application stdout
  - `events_count` is `AggregateFunction(count, UInt64)`, requires `countMerge()` to extract
  - Cannot use `CASE WHEN ... ELSE NULL` with aggregate functions - use `countMergeIf()` instead
  - When using "Percent" unit in widgets, don't multiply by 100 (Better Stack does it automatically)
  - ClickHouse time functions: `toStartOfHour()`, `toStartOfDay()` faster than `DATE_TRUNC()`
- **Files Created**:
  - `docs/betterstack-working-queries.md` (600+ lines - infrastructure queries + reference for future logs)
  - `docs/vercel-betterstack-log-setup.md` (setup guide with metrics source explanation)
- **Dashboards Created**: 3 dashboards, 12 widgets, 3 critical alerts - all operational
- **Recommendation**: Infrastructure monitoring is complete and excellent for production. For business metrics (books added, signups), query Supabase directly rather than complex log aggregation setup.

## 2025-11-16 - JSON Export Feature

### Complete book collection export as downloadable JSON
- **Goal**: Allow users to export their entire library as a portable JSON file containing ISBNs, notes, statuses, dates, shelf names, and metadata
- **Implementation**:
  - Created `/api/export` GET endpoint with authentication via referer header
  - Single database query with joins to fetch books + shelves efficiently (no N+1 problem)
  - Transforms database rows to clean camelCase JSON structure
  - Returns JSON with `Content-Disposition: attachment` header for auto-download
  - Filename format: `tbr-export-YYYY-MM-DD.json`
- **Settings Page** (`src/routes/[username]/settings/+page.svelte`):
  - New settings page accessible from global footer
  - Export Library button with loading states and error handling
  - Blob download with filename extraction from Content-Disposition header
  - Clean UI matching existing design system
- **Navigation**:
  - Added Settings link to global footer (next to About, Help)
  - Uses `currentUserId()` for dynamic routing to user-specific settings
- **JSON Structure** (15 fields per book):
  - User data: `note`, `isRead`, `isOwned`, `shelves[]`, `addedAt`
  - Metadata: `isbn13`, `title`, `author[]`, `publisher`, `publicationDate`, `description`, `coverUrl`
  - Top-level: `exportedAt`, `userId`, `totalBooks`
- **Type Safety Improvements**:
  - Added `BookShelfJoin` interface for nested join structure
  - Replaced `any` types with proper interfaces
  - Added type predicates to filters: `(name): name is string => name !== null`
  - Fixed pre-existing type errors in `/api/books/detect` and `/routes/help`
- **Files Created**:
  - `src/routes/api/export/+server.ts` (79 lines)
  - `src/routes/[username]/settings/+page.svelte` (89 lines)
  - `docs/plans/2025-11-16-json-export.md` (454 lines - implementation plan)
- **Files Modified**:
  - `src/routes/+layout.svelte` (4 lines - Settings link in footer)
  - `src/routes/api/books/detect/+server.ts` (1 line - type fix)
  - `src/routes/help/+page.svelte` (2 lines - type fix)
- **Testing**: Manual end-to-end testing with users having 0, 1, and 117 books
  - Validated JSON structure, edge cases (null notes, empty shelves), special characters
  - Verified download functionality, filename format, Content-Disposition headers
  - Type checking: 0 errors (9 pre-existing warnings)
- **Authentication**: Reuses existing `requireUserId()` pattern from other endpoints
- **Performance**: Single query response time ~500-700ms for 117 books
- **Future Enhancements**: CSV export, Goodreads-compatible format, import functionality

## 2025-11-14 - Homepage and Help Page Redesign

### Homepage refresh with Inter font and improved visual hierarchy
- **Goal**: Cleaner, more focused landing page with professional typography
- **Implementation**:
  - Replaced component-based layout with simpler centered design
  - Added Inter font from Google Fonts (400, 500, 600, 700 weights)
  - Applied medium drop-shadows to all cards: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`
  - Added QR code for SMS texting (desktop only, hidden < 768px)
  - Removed dependency on UI components (Button, Input) for faster load
  - Fixed horizontal centering with `margin: 0 auto` on content container
  - Simplified phone number normalization logic
- **Visual Changes**:
  - Hero section with larger, cleaner typography
  - Welcome back card for returning users (blue gradient)
  - Demo section with phone number and QR code side-by-side on desktop
  - "Already using it?" card with phone input (light blue background)
  - Enhanced footer with help page link
- **UX**: QR code appears next to phone number on desktop for easy mobile access

### Help page complete redesign with interactive FAQ
- **Goal**: Comprehensive, searchable documentation with better visual organization
- **Implementation**:
  - Converted from Tailwind utility classes to scoped component CSS
  - Added Inter font to match homepage styling
  - Implemented accordion FAQ system with Svelte 5 `$state` runes
  - Added quick jump links with smooth scroll behavior
  - Created visual SMS examples with barcode illustrations
  - Added numbered step indicators for onboarding flows
  - Applied medium drop-shadows to all cards for consistency
- **New Sections**:
  - Quick Links navigation grid at top
  - Getting Started with numbered steps and info box
  - Adding Books with visual SMS bubble examples (ISBN, title/author, photo, Amazon link)
  - Managing Library with feature grids for actions
  - FAQ accordion (8 questions total)
  - Troubleshooting accordion
  - Contact section with gradient background
- **New FAQ Added**: "Why can't I send a photo of the book cover?"
  - Explains complexity of cover text extraction
  - Sets expectations about feature prioritization
  - Friendly tone about future possibilities
- **Accessibility**: Accordion uses proper button semantics with arrow icons that rotate on open

### Technical cleanup
- Fixed unused CSS selector warning (`.help-link` → `.footer-help a`)
- Updated both pages to use consistent shadow values
- Maintained existing localStorage behavior for returning users

## 2025-11-10 - Architecture Audit Fixes (H1, H3)

### H1: User Ownership Checks on Data-Mutating Endpoints
- Created `src/lib/server/auth.ts` with `requireUserId()` to extract user ID from referer header
- Added `.eq('user_id', userId)` checks to `/api/books/update`, `/api/books/delete`
- Added book+shelf ownership verification to `/api/books/shelves` (POST & DELETE)
- Updated `/api/shelves` to derive userId server-side and clear `default_shelf_id` on deletion
- Changed all endpoints to use `.maybeSingle()` for proper 404 responses (not 500 errors)
- Removed client-provided `user_id` from frontend requests (now server-derived)
- **Impact**: Prevents attackers with knowledge of UUIDs from modifying other users' data

### H3: Type Safety Alignment with Latest Schema
- Added `publication_date?: string` and `description?: string` to Book interface in `supabase.ts`
- TypeScript now correctly reflects database schema for better editor tooling and type checking

## 2025-11-10 - Book Card Entry Animations and Responsive Grid

### Added subtle entry animations to hint at card interactivity
- First card auto-flips on load (back→front, 1.2s) to demonstrate flip interaction
- All cards fly in from bottom with 80ms stagger (0.6s each) for polished entrance
- Added 2-column grid breakpoint at 640px (mobile: 1 col, tablet: 2 col, desktop: 3 col)
- Both animations respect `prefers-reduced-motion` accessibility preference
- Files: `FlipCard.svelte` (added `autoFlipOnMount` & `animationIndex` props), `[username]/+page.svelte` (grid classes)

## 2025-11-07 - Fix Book Selection UX Anti-pattern

### Fixed default checkbox behavior in multimodal book detection
- **Issue**: When searching by title/author returned multiple book candidates, all checkboxes were checked by default
- **Anti-pattern**: Users had to *uncheck* books they didn't want instead of *selecting* books they did want
- **Root cause**: Line 421 in `src/routes/[username]/+page.svelte` auto-selected all detected books: `selectedBookIds = new Set(detectedBooks.map((b) => b.isbn13))`
- **Solution**: Changed selection logic to only auto-select when exactly one book is detected:
  ```javascript
  selectedBookIds = detectedBooks.length === 1
    ? new Set(detectedBooks.map((b) => b.isbn13))
    : new Set();
  ```
- **Behavior**:
  - **1 book found**: Auto-checked (likely what user wants)
  - **Multiple books found**: All unchecked (user actively selects what to add)
- **Files modified**:
  - `src/routes/[username]/+page.svelte` - Updated `detectBooks()` function
- **Impact**: Better UX aligned with common selection patterns - users opt-in to selections rather than opt-out

## 2025-11-04 - Bulk CSV/TXT Import (Phase 1)
### Implemented simple bulk ISBN import from CSV and TXT files
- **Goal**: Allow users to import multiple books (up to 50) from CSV or TXT files containing ISBNs
- **Backend Changes** (`src/routes/api/books/detect/+server.ts`):
  - Added `'file'` type support to detection endpoint (alongside 'text' and 'image')
  - Implemented CSV/TXT parsing with Set-based deduplication (O(n) performance)
  - Added batch metadata fetching with 5 concurrent requests to avoid rate limiting
  - Integrated structured logging with Pino for observability
  - Returns `DetectionMetadata` with file processing stats (totalLines, validIsbns, skippedLines, duplicatesRemoved)
  - Created `fetchMetadataInBatches()` helper function for efficient Google Books API calls
  - Added 50-book limit per import to stay within Vercel function timeout (10s)
- **Frontend Changes** (`src/routes/[username]/+page.svelte`):
  - Updated `detectInputType()` to detect CSV/TXT files based on mime type and file extension
  - Added `fileToText()` utility function to read text files
  - Updated `detectBooks()` to handle file type and capture metadata from API response
  - Added `DetectionMetadata` interface and state variable
  - Updated file input accept attribute to include `.csv`, `.txt`, `text/plain`, `text/csv`
  - Added blue info banner with bulk import hints ("Upload a CSV or TXT file with ISBNs...")
  - Added metadata display showing processing stats (lines processed, valid ISBNs found)
  - Added warning UI for skipped lines (amber background)
  - Added info UI for duplicate removal (blue background)
- **Features**:
  - Supports CSV files with ISBN columns (auto-detects headers like "ISBN", "Title", "Author")
  - Supports TXT files with one ISBN per line
  - Handles common CSV delimiters: comma, semicolon, tab, pipe
  - Handles Goodreads CSV format with `="ISBN"` escaping
  - Skips invalid ISBNs gracefully (validates checksum)
  - Removes duplicate ISBNs automatically using Set
  - Shows clear feedback for skipped lines and duplicates
  - Batch fetches metadata (5 concurrent) to respect rate limits and avoid timeouts
  - Logs import metrics for observability in Logtail
- **Testing**: Created sample `test-import.csv` and `test-import.txt` files for manual testing
- **Performance**: 50 books ÷ 5 concurrent = ~10 batches × 1 sec + 200ms delays = <12 seconds (safe for 10s Vercel timeout)
- **Documentation**: See `docs/designs/BULK_IMPORT_PLAN.md` for full implementation plan
- **Status**: Phase 1 complete and ready for user testing

## 2025-11-01 - Book Card Visual Refinement 
### Implemented visual improvements from prototype design evaluation
- **Goal**: Improve visual hierarchy and polish of book cards without sacrificing usability
  - Increased title size from `text-xl` to `text-2xl` for better prominence
  - Added `amber` variant to Badge component for "Unread" state (amber background vs gray)
  - Added subtle borders to all badge variants for visual refinement
  - Changed delete button from prominent danger Button to softer text-only link
  - Delete action now uses `text-sm text-red-600 hover:text-red-700` styling]
  - Created unified metadata footer with `bg-gray-50` background
  - Grouped ISBN, shelf count, and added date in footer with icons
  - Moved "Show barcode" toggle to footer (next to ISBN for context)
  - Improved Copy ISBN button with "Copy/Copied!" text labels
  - Barcode now expands below footer when toggled
  - Moved delete action outside footer with subtle border separation
  - Made shelf count clickable to open shelf management dropdown (replaces standalone button)
  - Removed standalone "Manage shelves" button for cleaner UI
  - Shelf management dropdown and barcode display now position absolutely above their triggers
  - Fixed z-index layering to prevent dropdowns from being cut off in grid view
  - Dropdowns now appear above the metadata footer with white background, border, and shadow
  - Used `bottom-full` positioning to anchor dropdowns above their buttons
  - Added `relative` positioning to card back container and metadata footer for proper absolute positioning context
- **Design Approach**: Hybrid approach based on `/docs/designs/EVALUATION.md`
  - Adopted visual improvements from prototype (better typography, refined badges, softer delete, metadata footer)
  - Kept current UX patterns (direct badge toggles, visible actions, cover images)
  - Skipped complexity additions (kebab menu, hidden actions)
  - Used inline SVG icons instead of lucide-react (no new dependencies)
- **Impact**: ~100% of planned visual benefit with zero UX regressions
- **Result**: Professional, polished book cards with better information hierarchy and no UI clipping issues

## 2025-11-01 - Logtail Integration Setup

### Configured Better Stack Logtail for log analysis
- **Goal**: Enable better querying of structured logs beyond Vercel's UI limitations
- **Implementation**:
  - Connected Vercel project to Logtail via Better Stack integration
  - Pino JSON logs now streaming to Logtail for SQL-like querying
  - Created comprehensive query reference document (`docs/logtail-queries.md`)
- **Query Capabilities**:
  - Book addition success rates by method/source
  - API performance metrics (Google Books, Vision API)
  - User event tracking (signups, opt-outs)
  - Error analysis with stack traces
  - Request timing and slow endpoint detection
- **Files Created**:
  - `docs/logtail-queries.md` - SQL query reference for common metrics
- **Benefit**: Can now query logs by JSON fields, calculate aggregates, and analyze trends

## 2025-11-01 - Structured Logging & Observability

### Implemented comprehensive logging system with Pino
- **Goal**: Track book additions, user events, API performance, and errors before scaling to more users
- **Implementation**:
  - Installed Pino (fast, low-overhead structured logging) with pino-pretty for dev
  - Created typed logger utility (`src/lib/server/logger.ts`) with event interfaces
  - Added logging to SMS endpoint (`/api/sms`) for all book addition flows
  - Added logging to web book addition endpoint (`/api/books/add`)
  - Added performance timing middleware to `hooks.server.ts` for all HTTP requests
  - Created request ID system for distributed tracing
- **Event Types Tracked**:
  - `book_addition`: Tracks source (SMS/web), method (ISBN/search/image/Amazon), success/failure, duration
  - `user_event`: Signup (START), opt-out (STOP), help commands
  - `api_call`: Google Books and Vision API calls with timing
  - `error`: All errors with stack traces and user context
  - `request`: All HTTP requests with method, path, status, duration, user-agent
- **Log Output**:
  - **Dev**: Pretty-printed colorized logs with timestamps (human-readable)
  - **Production**: JSON structured logs (machine-readable for Vercel/external services)
- **Metrics Available**:
  - Book addition success rate by method (ISBN vs search vs photo vs Amazon)
  - SMS vs Web usage patterns
  - API performance (latency, timeout rates)
  - Failed book lookups by user
  - User signup/opt-out trends
  - Error rates and types
  - Request volumes and patterns
- **Viewing Logs**:
  - Local: Terminal with color-coded output
  - Production: Vercel dashboard → Logs tab (filter by endpoint, search JSON fields)
  - Future: Ready to pipe to Logtail, Datadog, or Axiom (no code changes needed)
- **Privacy**: Phone numbers logged for debugging but can be purged on request (GDPR compliance)

## 2025-10-31 - Update footer, fix button, clean up documentation

## 2025-10-31 - Copy ISBN Button on Book Cards

### Added ISBN copy functionality to all book cards
- **Feature**: Users can quickly copy ISBNs from book cards with a single click
- **Implementation**:
  - Added clipboard copy button next to ISBN on both grid and list views
  - SVG icons for professional appearance (copy icon → checkmark)
  - Transparent background that blends with card surface
  - Uses `stopPropagation()` to prevent triggering card flip in grid view
  - 2-second visual feedback with green icon color on successful copy
  - Tracks which ISBN was copied using state management
- **UX**:
  - Minimal, icon-only button with tooltip: "Copy ISBN"
  - Gray icon normally (`text-gray-500`), darkens on hover (`text-gray-700`)
  - Changes to green (`text-green-600`) with checkmark for 2 seconds after copying
  - Non-blocking - doesn't interfere with card flip or other interactions
- **Use Cases**:
  - Quickly copy ISBN to text to Twilio number from another device
  - Share ISBN with friends or reading groups
  - Look up book on other sites (Goodreads, library catalog, etc.)

## 2025-10-31 - Feedback Form with Trello Integration

### Added global feedback modal accessible from all pages
- **Feature**: Users can submit feedback from any page via floating button or footer link
- **Implementation**:
  - Created `FeedbackModal.svelte` component with focus trap and keyboard accessibility
  - Added floating action button (FAB) in bottom-right corner - always visible while scrolling
  - Also added footer button for desktop users
  - FAB shows icon-only on mobile, icon + "Feedback" text on larger screens
  - Integrated Trello REST API for card creation and screenshot attachment upload
  - Separate warning UI for non-blocking attachment failures (yellow banner vs red error)
  - Auto-detects userId from current page URL or localStorage and includes in Trello cards
- **User Flow**:
  - Click floating feedback button (always visible) or footer link → Modal opens with focus trapped
  - Answer two questions: "What were you trying to do?" and "What happened?"
  - Optionally attach screenshot (PNG/JPG/GIF, max 10MB)
  - Submit → Creates Trello card in MVP Feedback list with user's phone number (if available)
  - Success message shows; warning displayed if screenshot upload failed but feedback saved
- **User Identification**:
  - If on shelf page (`/{phoneNumber}`), extracts userId from URL
  - Otherwise checks localStorage for `tbr-userId` (saved from previous shelf visits)
  - Trello card includes "User: {phoneNumber}" at top when available
  - Anonymous feedback still works (no userId required)
- **Accessibility**:
  - Focus trap prevents keyboard users from tabbing outside modal
  - Restores focus to trigger button on close
  - Guards against empty NodeList with `HTMLElement | null` types
  - ESC key closes modal (with confirmation if form has content)
- **Files**:
  - `src/lib/components/ui/FeedbackModal.svelte` - Modal component
  - `src/routes/+layout.svelte` - Global footer button, modal, and userId detection
  - `src/routes/api/feedback/+server.ts` - Trello API endpoint
  - Environment: Requires `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_LIST_ID`

## 2025-10-31 - Fix "All Books" Button Navigation

### Fixed All Books button falling back to default shelf
- **Issue**: Clicking "All Books" would clear the shelf param but still show the default shelf (TBR) instead of all books
- **Root cause**: Server load logic was treating "no shelf param" as "use default shelf" in all cases, not distinguishing between initial visit vs. explicit "All Books" click
- **Solution**: Added `?view=all` query parameter to explicitly indicate "show all books, don't use default"
- **Changes**:
  - `selectShelf()` now sets `?view=all` when clicking "All Books"
  - Server load checks `viewParam === 'all'` to skip default shelf fallback
  - `deleteShelf()` updated to use `?view=all` when redirecting after deletion
- **Impact**: "All Books" now correctly displays all books, while initial visits still default to TBR shelf

## 2025-10-31 - Renumber Database Migrations

### Organized migrations for Supabase CLI compatibility
- **Issue**: Migration files had inconsistent naming (some with numbers, some without)
- **Root cause**: Initial migrations were created without number prefixes, making CLI execution order unpredictable
- **Solution**: Renamed all migrations with sequential numbering based on dependencies and chronology
- **New order**:
  1. `001_create_failed_book_imports.sql` - Error tracking table (standalone)
  2. `002_create_shelves.sql` - Shelves tables and TBR initialization (depends on books table)
  3. `003_create_sms_context.sql` - SMS context for ADD command (standalone)
  4. `004_add_default_shelf.sql` - Default shelf column (depends on shelves)
  5. `005_add_description_and_date.sql` - Book metadata columns
  6. `006_backfill_default_shelf.sql` - Backfill for existing users (depends on 004)
- Migrations now run correctly in sequence via Supabase CLI

## 2025-10-31 - Fix Default Shelf for Existing Users

### Backfill default_shelf_id for users created before migration
- **Issue**: Users created before the `default_shelf_id` column was added couldn't auto-assign books to TBR
- **Root cause**: START command only sets default_shelf_id for NEW users (`if (!userStatus.exists)`)
- **Solution**: Created migration `005_backfill_default_shelf.sql` to find existing TBR shelves and set them as default
- **Impact**: All book addition methods (SMS, web UI, MMS photos) now auto-assign to TBR for all users
- Migration finds users with `default_shelf_id IS NULL` and a shelf named 'TBR', then sets that shelf as their default

## 2025-10-31 - Enter Key Submit in Add Book Modal

### Added keyboard shortcut for faster book detection
- Pressing Enter in the textarea submits the detection (calls `detectBooks()`)
- Shift+Enter still allows multiline input if needed
- Only works when textarea has content and detection is not already in progress
- Updated help text to inform users: "Press Enter to detect"
- Improves workflow for quick single-book additions

## 2025-10-31 - Publication Date in Multimodal Detection

### Added publication date to book detection results
- Updated `GoogleBooksSearchResult` interface to include `publicationDate` field
- Modified `searchGoogleBooks` to include `publishedDate` from Google Books API
- Updated `DetectedBook` interface in detect API and UI to include `publicationDate`
- Multimodal "Add Book" modal now displays publisher and publication year for detected books
- Same format as main shelf display: "Publisher (Year)"
- Helps users distinguish between different editions when multiple results are found

## 2025-10-31 - ISBN Barcode Generation

### Show EAN-13 barcodes to bookstore staff
- Added jsbarcode library (v3.12.1) for canvas-based barcode generation
- Created fully responsive barcode generation Svelte action with dynamic sizing
- Calculates bar width, height, and font size based on container width
- Scales from 150px (minimum for scannability) to 350px (maximum for desktop)
- Proportional scaling of all barcode elements on narrow viewports
- Barcode toggle button (icon only) appears on same line as "Add to shelf" button, aligned right
- Hover tooltip shows "Show barcode" / "Hide barcode" for mouse users
- Grid view: Barcode appears on flipcard back, below shelves dropdown
- List view: Barcode appears below shelves dropdown
- Helper text: "📱 Show this to booksellers to scan"
- Barcodes remain scannable on mobile devices while fitting viewport

## 2025-10-31 - About Page, Help Page, Global Footer
- Created `/about` route with project overview and details
- Created footer in root layout (`+layout.svelte`) to appear on all pages
- Created `/help` route with full documentation

## 2025-10-31 - Publication Date and Description Display

### Added publication date and collapsible descriptions to book cards
- Database: Added `description` (text) and `publication_date` (text) columns to books table
- Backend: Updated all 4 book upsert locations to save these fields from BookMetadata
  - SMS endpoint: 3 locations (ADD command, MMS photo, plain ISBN)
  - Web UI endpoint: manual book addition
- UI: Collapsible description with "Show/Hide description" toggle button
- Toggle buttons only appear when description exists

## 2025-10-31 - Delete Shelf Feature

### Shelf deletion with confirmation and security
- Added delete button to each shelf tab (subtle × on right side)
- Confirmation dialog warns about books remaining in library
- Special message when deleting default shelf or currently viewed shelf
- API endpoint validates ownership before deletion
- Returns 404 when shelf not found or access denied
- Cascading delete removes book-shelf associations automatically
- Redirects to "All Books" when deleting currently viewed shelf
- UI shows "Deleting..." state during deletion
- Delete button integrated into shelf button with subtle hover effect

## 2025-10-31 - Default TBR Shelf

### Auto-create TBR for new users
- Added `default_shelf_id` to users table
- TBR shelf created automatically on START command (new users only)
- New books auto-assigned to default shelf if exists
- Shelf page defaults to TBR view (if user has one)
- Books stay on TBR when marked as read (manual removal)

## 2025-10-30 - Title/Author search → ISBN (MVP)
- Extended detect API to treat non-ISBN/non-Amazon text as a query and return candidates with ISBN-13
- Added Google Books search helper (`searchGoogleBooks`) and exported via metadata index as `searchBooks`
- Updated shelf modal: any non-empty text is valid input; added `?q=` deep-link support and clarified placeholder/help text
- Documented SMS stateless flow for title/author queries, plus created plan doc (`docs/plans/2025-10-30-title-author-search.md`)

## 2025-10-30 - Returning User Experience with localStorage
- Added localStorage detection to remember returning users
- Homepage now shows "Welcome back! Go to My Reading List →" button for users who've visited their shelf
- User's phone number is saved to localStorage when they visit their shelf page

## 2025-10-29 - Getting Started Page with QR Code and Enhanced Copy UX
- Prominent Twilio number display (+13605044327) with copy button and QR code
- "What happens next" flow and quick tips sections

## 2025-10-29 - Multimodal ISBN input, detect endpoint, a11y fixes, Node 22 setup
- Replaced manual ISBN modal with a multimodal "Add Book" modal:
    - Accepts ISBN, Amazon URL, or photo (upload/camera, drag-and-drop)
    - Detects multiple books; lets the user select and add via existing `/api/books/add`
	- Added Node version files for adapter-vercel compatibility: `.nvmrc` (22) and `.node-version`
- Followups
	- Migrate UI components away from `<slot>` to `{@render ...}`
	- Implement shelf ownership checks and `users.default_shelf_id` migration + auto-assignment
	- Optional: rate-limit detect endpoint and validate image size/format

## 2025-10-29 - Fixed Shelf Tab Active State Bug
- In Svelte 5, any value derived from `$props()` must use `$derived` to maintain reactivity
- Using `const` breaks reactivity for computed values that depend on props

## 2025-10-28 - Add Book via "+" Button
- Added modal overlay with ISBN entry form (opens from "+" button in shelf header)\
- Full validation and error handling (invalid ISBN, not found, duplicate, network errors)
- Server-side userId derivation from referer for security (prevents client spoofing)

## 2025-10-28 - Cover Image Quality Fix

### Fixed Google Books zoom parameter bug
- Changed from `zoom=5` (lower quality) to `zoom=1` (highest quality)
- Added `&w=1280` parameter to request larger image width
- Removed `&edge=curl` effect that can reduce quality

### Added image size logging
- Console logs now show which size Google Books provides (extraLarge, large, medium, etc.)
- Shows enhanced URL after optimization
- Makes it easy to debug image quality issues

## 2025-10-28 - Delete Book endpoint, button and confirmation

## 2025-10-28 - Multi-User SMS Flow with START/STOP Commands
- Users Table and Consent Tracking
- Complete START/STOP/HELP Command Flow
- Centralized SMS Messaging (`src/lib/server/sms-messages.ts`)
- Shelf URLs in SMS Responses

## 2025-10-28 - UI Component Library and Grid/List View Refactor

### Reusable UI component library with Svelte 5 runes and proper TypeScript typing:
- **Button.svelte**: Variant-based button component with variants and sizes
- **Input.svelte**: Standardized input component with size variants (sm, md, lg)
- **Badge.svelte**: Status badge component with variants and interactivity (toggles)
- **Card.svelte**: Card wrapper with padding options and hover effects
- **index.ts**: Barrel export for clean imports
### Shelf Page Grid view (with flipcard) and list view, with toggle
- Replaced `window.location.reload()` with `invalidateAll()` for smoother updates (no full page refresh)
- Added duplicate shelf name validation
- Better event handling with `stopPropagation()` on nested interactive elements
- Improved accessibility with proper aria-labels and event types
- Better fallback state for missing covers (centered emoji + truncated title)
- More compact information display on card backs
- Responsive gap spacing and layout improvements

## 2025-10-28 - Google Vision API and Cover Image Quality Improvements
- Improved Google Books cover fetching (larger sizes: extraLarge→large→medium, zoom=5)
- Added Open Library as fallback metadata source with direct Covers API integration
- Created smart metadata orchestrator that merges best data from multiple sources
- Fixed environment variable handling to support both SvelteKit and standalone scripts
- Created backfill script (scripts/backfill-covers.ts) to update existing books with missing covers
- Successfully backfilled 1 book (Nineteen Eighty-four) with Open Library cover

## 2025-10-28 - Initial Commit and Configure Prod
- Added proper Amazon URL parsing and scraping
- Added a minimum card and grid layout for shelf page
- Fixed Tailwind v4 syntax in app.css (@import "tailwindcss")
- Disabled CSRF origin checking in svelte.config.js
- Cleaned up hooks.server.ts
- Added service-account.json to .gitignore
- **Next**: Add Google Vision for photo barcodes

## 2025-10-27 - Initial Setup
- Created MVP with repurposed codebase from a larger project
- SMS webhook works (takes ISBN text)
- Shelf page displays books
- Read/owned toggles functional
