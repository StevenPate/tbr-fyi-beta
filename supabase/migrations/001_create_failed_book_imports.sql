-- Ensure pgcrypto extension is enabled (usually default in Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE failed_book_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  asin TEXT,
  error_type TEXT NOT NULL,
  error_message TEXT,
  -- Optional enhanced tracking columns
  status_code INT,           -- HTTP status code if applicable
  final_url TEXT,            -- Final URL after redirects
  source TEXT DEFAULT 'sms', -- Source of the request (sms, web, etc.)
  notes JSONB,               -- Flexible field for additional context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by error type
CREATE INDEX idx_failed_imports_error_type ON failed_book_imports(error_type);

-- Index for querying by date
CREATE INDEX idx_failed_imports_created_at ON failed_book_imports(created_at DESC);

-- Index for querying by source
CREATE INDEX idx_failed_imports_source ON failed_book_imports(source);
