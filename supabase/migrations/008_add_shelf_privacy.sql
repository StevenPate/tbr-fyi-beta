-- Migration: Add privacy controls to shelves
-- Description: Adds privacy settings to shelves table for public/private/unlisted access control

-- Add privacy column to shelves table
ALTER TABLE shelves
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'public';

-- Add constraint for privacy level values
ALTER TABLE shelves
DROP CONSTRAINT IF EXISTS privacy_level_check,
ADD CONSTRAINT privacy_level_check
CHECK (privacy_level IN ('public', 'unlisted', 'private'));

-- Create index for privacy queries
CREATE INDEX IF NOT EXISTS idx_shelves_privacy ON shelves(user_id, is_public);
CREATE INDEX IF NOT EXISTS idx_shelves_privacy_level ON shelves(privacy_level);

-- Update existing shelves to be public by default
UPDATE shelves
SET is_public = true,
    privacy_level = 'public'
WHERE is_public IS NULL;

-- Comment on new columns
COMMENT ON COLUMN shelves.is_public IS 'Quick flag for public visibility (deprecated, use privacy_level)';
COMMENT ON COLUMN shelves.privacy_level IS 'Privacy setting: public (anyone), unlisted (link only), private (owner only)';