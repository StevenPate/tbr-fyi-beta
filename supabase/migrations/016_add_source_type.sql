-- Add source_type to track how books were added
ALTER TABLE books ADD COLUMN IF NOT EXISTS source_type TEXT;

COMMENT ON COLUMN books.source_type IS
  'How the book was added: sms_isbn, sms_photo, sms_link, sms_title, web_manual, web_link';

-- Relax last_isbn13 constraint: note flow uses book_id, not ISBN
ALTER TABLE sms_context ALTER COLUMN last_isbn13 DROP NOT NULL;

-- Extend sms_context for note flow
ALTER TABLE sms_context
  ADD COLUMN IF NOT EXISTS awaiting_note BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_book_id UUID,
  ADD COLUMN IF NOT EXISTS last_book_title TEXT;
