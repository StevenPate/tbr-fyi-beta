src/
# TBR.fyi – Your Book Inbox

Capture books from anywhere (SMS, Amazon links, barcode photos, CSV exports) and review them on a multi-shelf web dashboard. Toggle read/owned status, jot inline notes, share books with friends, and manage your backlog without installing an app.

---

## Highlights

- **Dual-track authentication**: Sign up via email (magic link) or SMS verification. Claim a custom username for clean URLs like `tbr.fyi/yourname`.
- **SMS capture**: START/STOP/HELP/ADD commands, ISBN parsing, Amazon link scraping, barcode OCR via Google Vision, and title/author search fallback.
- **Web companion**: Grid/list views, inline note editing, shelf assignment, responsive barcode display, clipboard copy for ISBNs, and feedback modal tied to Trello.
- **Book sharing**: Share individual books via link. Recipients see book details and can add to their own shelf with one click.
- **Bulk import**: Upload CSV/TXT files (Goodreads exports, plain ISBN lists) through the multimodal modal; dedupes, validates, and surfaces skipped rows.
- **Multi-shelf organization**: Custom shelves, default TBR auto-assignment, shelf deletion safeguards, and ownership checks on every mutating endpoint.
- **Observability**: Structured logging with Pino (pretty output in dev, JSON in prod) covering book additions, API latency, and import metrics.

---

## Getting Started

### Prerequisites
- Node.js 22 (see `.nvmrc`)
- npm 10+
- Supabase project (PostgreSQL)
- Twilio SMS number (MMS enabled for barcode photos)
- Optional: Google Cloud project (Vision API), Trello board for feedback routing

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy the example file and adjust values:
```bash
cp .env.example .env
```

Required settings:
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `PUBLIC_BASE_URL` (`http://localhost:5173` in development)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT_ID` (enable barcode photo detection)

Optional integrations:
- `GOOGLE_BOOKS_API_KEY` for higher Google Books quota
- `RESEND_API_KEY` for email verification (magic links)
- `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_LIST_ID` (feedback modal uploads cards/screenshots)

### 3. Initialize the database
Run the SQL scripts in `supabase/migrations/` **in order** using the Supabase SQL editor or CLI. The migrations create:
- `users`, `books`, `shelves`, `book_shelves`, `sms_context`, `failed_book_imports`
- `sessions`, `verification_codes`, `verification_rate_limits`, `ip_rate_limits` (authentication)
- default shelf support (`default_shelf_id`) and extended book metadata (`publication_date`, `description`)

### 4. Start the dev server
```bash
npm run dev
```

Visit `http://localhost:5173` to sign up via email or SMS. After claiming a username, your shelf is at `http://localhost:5173/yourusername`.

### 5. Expose the server to Twilio (optional but recommended)
```bash
npm run dev:tunnel
# => runs Vite dev server and ngrok simultaneously
```

Update the Twilio webhook (Messaging → “When a message comes in”) to the ngrok URL: `https://<random>.ngrok.io/api/sms`.

### 6. Optional integrations
- **Google Vision**: Upload the service-account JSON referenced in `.env`. Barcode MMS handling will automatically use it.
- **Feedback (Trello)**: Create a board/list, set the `TRELLO_*` env vars, and the floating action button in the web UI will file cards with optional screenshots.

### 7. Tooling & tests
- Static analysis: `npm run check`
- Manual regression plan: see `TESTING.md`
- Structured logs: view pretty output in the dev console (Pino transport), JSON logs in Vercel.

---

## Using the App

### Authentication
- **Email**: Enter your email on the homepage, click the magic link sent to your inbox
- **SMS**: Text START to (360) 504-4327, then verify via the web UI
- After verifying, choose a username for your permanent shelf URL

### Adding Books
1. **SMS** one of the following to (360) 504-4327:
   - ISBN (10/13 digits)
   - Amazon URL (`amazon.com` or `a.co` short links)
   - Photo of a barcode (MMS)
   - `ADD`, `START`, `STOP`, `HELP`, or free-form title/author text
2. **Web UI** (`/{username}`):
   - Toggle grid/list views, read/owned flags, and barcode overlays
   - Edit notes inline; blur to persist
   - Manage shelf membership via the "Add to shelf" popover
   - Trigger multimodal modal (`+` button or keyboard `+`)
3. **Bulk import**: In the modal, upload a `.csv` or `.txt` file (Goodreads exports supported). The UI surfaces processed counts, skipped lines, and duplicate removals before you commit the adds.

### Sharing Books
- Click the Share button on any book to get a shareable link
- Recipients see full book details and can add to their own shelf
- Share links work for non-users too (they'll be prompted to sign up)

### Other Features
- **Feedback**: Hit the FAB to file a Trello card; screenshots are optional, failure states are non-blocking.

---

## Deployment

```bash
npm run build
npm install -g vercel
vercel
```

Remember to mirror all environment variables into Vercel and update the Twilio webhook to point at the production domain.

---

## Project Structure

```

├── lib/
│   ├── components/ui/          # Button, Badge, FlipCard, ShareModal, Feedback modal, etc.
│   └── server/
│       ├── auth.ts             # Session management, token generation, cookie handling
│       ├── email.ts            # Resend email integration for magic links
│       ├── rate-limit.ts       # IP and identifier rate limiting
│       ├── amazon-parser.ts    # Amazon ISBN extraction
│       ├── metadata/           # Google Books + Open Library orchestrator
│       ├── sms-messages.ts     # Twilio response templates & command handling
│       └── vision.ts           # Google Vision client helper
├── routes/
│   ├── +layout.svelte          # Layout + global feedback FAB
│   ├── +page.svelte            # Landing page with email sign-in
│   ├── about/+page.svelte      # About copy
│   ├── help/+page.svelte       # SMS command reference
│   ├── auth/                   # Email/SMS verification, username selection
│   ├── [identifier]/+page.*    # Reading list dashboard (grid/list, modal, bulk import)
│   ├── [identifier]/book/      # Shared book pages
│   └── api/
│       ├── auth/               # send-code, verify-phone, send-magic-link, username, session
│       ├── books/              # add, update, delete, shelves, detect, add-from-share
│       ├── shelves/+server.ts  # Shelf CRUD with ownership checks
│       └── sms/+server.ts      # Twilio webhook
└── app.css                     # Tailwind entry point
```

Key supporting docs:
- `PROJECT_CONTEXT.md` – high-level goals and status
- `SMS_FLOW.md` – conversational flow diagrams
- `docs/` – feature plans, reference designs, and logging/import specs
- `TESTING.md` – manual test plan

---

## Roadmap Snapshot

Planned items live in `TODO.md`, grouped by Phase (bulk import hardening, pagination, edition matching, etc.). Contributions should link updates to the corresponding doc in `docs/plans/`.

---

## License & Attribution

MIT License. Built to scratch a personal itch—feel free to customize, but mind your Supabase/Twilio quotas.

### Development

This project was developed with assistance from [Claude Code](https://claude.com/claude-code), Anthropic's AI coding agent as well as Chat GPT-5-Codex from [Open AI](https://github.com/OPENAI). 
