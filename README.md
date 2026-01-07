# TBR.fyi

A simple way to never lose a book recommendation again.

Someone mentions a book on a podcast, in a group chat, or across the table from you—and you can save it instantly. No notes app, no screenshots, no forgotten tabs. Everything lands in one calm, searchable reading list.

No feeds. No algorithms. Just a place to put the books you actually want to read.

**Live at [TBR.fyi](https://tbr.fyi)**

---

## Using TBR.fyi

### Add books by text message

Send any of these to `+1 (360) 504-4327`:

- An ISBN (10 or 13 digits)
- An Amazon link
- A photo of a barcode
- A title and author ("The Hobbit by Tolkien")

The book appears on your shelf automatically.

### Add books on the web

You can also add books directly at [TBR.fyi](https://tbr.fyi)—same result, same list, no SMS required.

### Organize your shelf

Once added, you can mark books read or unread, note whether you own them, organize into custom shelves, and add context like "Recommended on Fresh Air" so you remember why you saved it.

---

## Status

This is early. I'm testing it with a small group to see if it's useful. If something breaks, [open an issue](https://github.com/stevenpate/tbr-fyi-beta/issues)—that's genuinely helpful.

---

## What's under the hood

TBR.fyi handles multiple input types (ISBN, Amazon URLs, barcode photos, free-text search) through a unified SMS endpoint, with Google Vision for OCR and a metadata pipeline that falls back from Google Books to Open Library. Authentication supports both magic links and SMS verification with rate limiting. The web app includes bulk CSV import with deduplication and validation, keyboard-driven search, book sharing via unique links, and structured logging with Pino throughout.

---

## Development

Everything below is for contributors and anyone who wants to run their own instance.

### Stack

| Layer | Technology |
| --- | --- |
| Frontend | SvelteKit 5 |
| Database | Supabase (PostgreSQL) |
| SMS | Twilio |
| Book metadata | Google Books API, Open Library fallback |
| Barcode detection | Google Cloud Vision |
| Email | Resend |
| Hosting | Vercel |

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- npm 10+
- Supabase project
- Twilio number (MMS-enabled for barcode photos)
- Optional: Google Cloud project (Vision API), Trello board for feedback routing

### Setup

```bash
npm install
cp .env.example .env
```

Required environment variables:

- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `PUBLIC_BASE_URL` (`http://localhost:5173` locally)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

Optional:

- `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT_ID` (barcode detection)
- `GOOGLE_BOOKS_API_KEY` (higher quota)
- `RESEND_API_KEY` (magic link emails)
- `TRELLO_API_KEY`, `TRELLO_TOKEN`, `TRELLO_LIST_ID` (feedback routing)

### Database

Run migrations in `supabase/migrations/` in order via the Supabase SQL editor or CLI.

### Running locally

```bash
npm run dev
```

To expose the server for Twilio webhooks:

```bash
npm run dev:tunnel
```

Then update your Twilio webhook to `https://<ngrok-url>/api/sms`.

### Deployment

```bash
npm run build
vercel
```

Mirror environment variables in Vercel and update the Twilio webhook to the production domain.

---

## Project structure

```
src/
├── lib/
│   ├── components/ui/      # Shared components
│   └── server/
│       ├── auth.ts         # Session management
│       ├── metadata/       # Book lookup orchestration
│       ├── sms-messages.ts # Twilio response handling
│       └── vision.ts       # Barcode detection
├── routes/
│   ├── api/
│   │   ├── books/          # Book CRUD
│   │   ├── shelves/        # Shelf management
│   │   └── sms/            # Twilio webhook
│   ├── auth/               # Verification flows
│   └── [identifier]/       # User shelf pages
└── app.css
```

Supporting documentation:

- `PROJECT_CONTEXT.md` — goals and current status
- `SMS_FLOW.md` — conversational flow diagrams
- `TESTING.md` — manual test plan
- `TODO.md` — roadmap by phase
- `docs/` — feature plans and specs

---

## License

MIT. Built to scratch a personal itch.

---

This project was developed with assistance from [Claude Code](https://claude.ai/code) and [Codex](https://chatgpt.com/codex).