-- Ensure pgcrypto extension is enabled (for UUID generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create shelves table
CREATE TABLE shelves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique shelf names per user
  CONSTRAINT unique_user_shelf UNIQUE (user_id, name)
);

-- Create junction table for many-to-many relationship between books and shelves
CREATE TABLE book_shelves (
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  shelf_id UUID NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (book_id, shelf_id)
);

-- Indexes for efficient querying
CREATE INDEX idx_shelves_user_id ON shelves(user_id);
CREATE INDEX idx_book_shelves_shelf_id ON book_shelves(shelf_id);
CREATE INDEX idx_book_shelves_book_id ON book_shelves(book_id);

-- Create a default "TBR" shelf for each existing user and add all their books to it
DO $$
DECLARE
  user_record RECORD;
  shelf_id UUID;
BEGIN
  -- Loop through distinct users who have books
  FOR user_record IN SELECT DISTINCT user_id FROM books
  LOOP
    -- Create default TBR shelf for this user
    INSERT INTO shelves (user_id, name)
    VALUES (user_record.user_id, 'TBR')
    ON CONFLICT (user_id, name) DO NOTHING
    RETURNING id INTO shelf_id;

    -- If we just created the shelf, get its ID
    IF shelf_id IS NULL THEN
      SELECT id INTO shelf_id
      FROM shelves
      WHERE user_id = user_record.user_id AND name = 'TBR';
    END IF;

    -- Add all of this user's books to their TBR shelf
    INSERT INTO book_shelves (book_id, shelf_id)
    SELECT id, shelf_id
    FROM books
    WHERE user_id = user_record.user_id
    ON CONFLICT (book_id, shelf_id) DO NOTHING;
  END LOOP;
END $$;
