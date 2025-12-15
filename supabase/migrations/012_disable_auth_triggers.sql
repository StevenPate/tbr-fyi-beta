-- Disable Supabase Auth triggers and clear auth_id references
-- This migration removes the failed Supabase Auth integration

-- Drop auth triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Clear auth_id to prevent confusion
UPDATE users SET auth_id = NULL WHERE auth_id IS NOT NULL;

-- Note: We're keeping phone_number as the primary key for backward compatibility
-- Email users will get synthetic phone numbers like 'email_user_{uuid}'
