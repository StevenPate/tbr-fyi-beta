-- Migration: Add authentication fields to users table
-- Description: Extends users table with auth_id, email, username, and account-related fields
-- for optional account creation while maintaining backward compatibility

-- Add auth-related columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS account_created_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_account_prompt_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS account_prompt_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS web_prompt_dismissed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS default_shelf_privacy BOOLEAN DEFAULT true;

-- Add username validation constraint
ALTER TABLE users
DROP CONSTRAINT IF EXISTS username_format,
ADD CONSTRAINT username_format
CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_-]{3,20}$');

-- Create index on auth_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Comment on new columns
COMMENT ON COLUMN users.auth_id IS 'Reference to Supabase Auth user ID';
COMMENT ON COLUMN users.email IS 'User email address for account-based access';
COMMENT ON COLUMN users.username IS 'Unique username for custom URLs (e.g., @bookworm123)';
COMMENT ON COLUMN users.display_name IS 'Display name shown on profile';
COMMENT ON COLUMN users.is_public IS 'Whether user profile is publicly visible';
COMMENT ON COLUMN users.account_created_at IS 'When user upgraded from phone-only to account';
COMMENT ON COLUMN users.last_account_prompt_at IS 'Last time we prompted user to create account';
COMMENT ON COLUMN users.account_prompt_count IS 'Number of times we have prompted for account creation';
COMMENT ON COLUMN users.web_prompt_dismissed_at IS 'When user dismissed web account creation banner';
COMMENT ON COLUMN users.default_shelf_privacy IS 'Default privacy setting for new shelves';