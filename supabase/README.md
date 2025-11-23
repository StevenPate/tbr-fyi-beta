# Supabase Migrations

This directory contains SQL migrations for the TBR Delta application.

## Current Migrations

### `migrations/create_failed_book_imports.sql`

Creates the `failed_book_imports` table for tracking Amazon URL parsing failures.

**Status**: ⏳ Pending application to database

**Purpose**: This table logs failed attempts to extract ISBNs from Amazon URLs, enabling:
- Debugging parsing issues
- Improving scraping patterns
- Understanding common failure modes
- Tracking resolution over time

**Schema**:
- `id` (UUID): Primary key
- `url` (TEXT): Original URL from SMS
- `asin` (TEXT): Extracted ASIN, if any
- `error_type` (TEXT): Error category (no_asin, isbn_lookup_failed, etc.)
- `error_message` (TEXT): Detailed error description
- `status_code` (INT): HTTP status code, if applicable
- `final_url` (TEXT): Final URL after redirects
- `source` (TEXT): Request source (default: 'sms')
- `notes` (JSONB): Additional structured data
- `created_at` (TIMESTAMPTZ): Timestamp of failure

**Indexes**:
- `idx_failed_imports_error_type`: Query by error type
- `idx_failed_imports_created_at`: Query by date (DESC)
- `idx_failed_imports_source`: Query by source

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to: **SQL Editor**
4. Click: **New Query**
5. Copy contents of the migration file from `migrations/create_failed_book_imports.sql`
6. Paste into SQL editor
7. Click: **Run** (or Cmd/Ctrl + Enter)
8. Verify success message: "Success. No rows returned"
9. Check **Table Editor** to confirm table exists

### Option 2: Helper Script

```bash
# From project root
bash scripts/open-supabase-sql-editor.sh
```

This will:
- Display the SQL to copy
- Open the Supabase SQL Editor in your browser
- Guide you through the steps

### Option 3: Supabase CLI (Advanced)

If you have the database password:

```bash
# Link project (one-time)
supabase link --project-ref filxjcmdpawrrdbuvdvc

# Apply migrations
supabase db push
```

## Verification

After applying the migration, verify it worked:

```bash
node scripts/verify-migration.js
```

Expected output:
```
✅ Table "failed_book_imports" exists and is accessible!
📊 Current row count: 0
```

## Troubleshooting

**Error: "relation 'failed_book_imports' already exists"**
- Table already created, no action needed
- Skip to verification step

**Error: "Could not find the table in the schema cache"**
- Table hasn't been created yet
- Follow "How to Apply Migrations" above
- Wait 10 seconds after creation, then retry verification

**Error: "permission denied"**
- Check that `SUPABASE_SERVICE_KEY` in `.env` is correct
- Ensure you're using a service role key, not an anon key

## Next Steps

After successfully applying this migration:

1. Run verification: `node scripts/verify-migration.js`
2. Commit the migration: `git add supabase/ && git commit -m "feat: add failed_book_imports table for Amazon parser tracking"`
3. Proceed to Task 2 in `docs/plans/2025-10-27-amazon-isbn-parser.md`
