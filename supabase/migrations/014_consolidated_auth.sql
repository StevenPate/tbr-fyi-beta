-- Consolidated Auth Migration
-- This migration adds all auth-related columns and tables.
-- Safe to run on existing databases (uses IF NOT EXISTS, IF NOT NULL checks).
--
-- NOTE: The following columns are intentionally excluded as they were part of a
-- failed Supabase Auth implementation and are unused:
-- - account_created_at
-- - web_prompt_dismissed_at
-- - default_shelf_privacy

-- =============================================================================
-- PART 1: User table extensions
-- =============================================================================

-- Add auth columns to users (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email') THEN
        ALTER TABLE users ADD COLUMN email TEXT UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
        ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'display_name') THEN
        ALTER TABLE users ADD COLUMN display_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verified_at') THEN
        ALTER TABLE users ADD COLUMN verified_at TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_public') THEN
        ALTER TABLE users ADD COLUMN is_public BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'account_prompt_count') THEN
        ALTER TABLE users ADD COLUMN account_prompt_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_account_prompt_at') THEN
        ALTER TABLE users ADD COLUMN last_account_prompt_at TIMESTAMP;
    END IF;
END $$;

-- Username format constraint (idempotent)
ALTER TABLE users DROP CONSTRAINT IF EXISTS username_format;
ALTER TABLE users ADD CONSTRAINT username_format
    CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$');

-- Indexes for user lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_verified_at ON users(verified_at);

-- =============================================================================
-- PART 2: Session management
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(phone_number) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
    last_activity TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- =============================================================================
-- PART 3: Verification codes
-- =============================================================================

CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    code TEXT NOT NULL,
    code_type TEXT NOT NULL CHECK (code_type IN ('sms_6digit', 'email_token')),
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes',
    used_at TIMESTAMP,
    ip_address TEXT
);

-- Partial unique index - only one active code per identifier+type
DROP INDEX IF EXISTS idx_one_active_code_per_identifier;
CREATE UNIQUE INDEX idx_one_active_code_per_identifier
ON verification_codes(identifier, code_type)
WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_verification_codes_identifier ON verification_codes(identifier);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

-- =============================================================================
-- PART 4: Rate limiting tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS verification_rate_limits (
    identifier TEXT PRIMARY KEY,
    attempts_today INTEGER DEFAULT 1,
    attempts_this_hour INTEGER DEFAULT 1,
    failed_verification_attempts INTEGER DEFAULT 0,  -- Tracks wrong code guesses
    failed_attempts_reset_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
    last_attempt TIMESTAMP DEFAULT NOW(),
    hour_reset_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
    day_reset_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 day'
);

-- Add columns if table already exists (for existing installs)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'verification_rate_limits'
                   AND column_name = 'failed_verification_attempts') THEN
        ALTER TABLE verification_rate_limits
        ADD COLUMN failed_verification_attempts INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'verification_rate_limits'
                   AND column_name = 'failed_attempts_reset_at') THEN
        ALTER TABLE verification_rate_limits
        ADD COLUMN failed_attempts_reset_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS ip_rate_limits (
    ip_address TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT NOW(),
    window_end TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_window ON ip_rate_limits(window_end);

-- =============================================================================
-- PART 5: Atomic SQL functions for rate limiting (with race condition fix)
-- =============================================================================

-- Atomic check-and-increment for IP rate limiting
-- Returns TRUE if allowed, FALSE if rate limited
CREATE OR REPLACE FUNCTION check_and_increment_ip_limit(
    ip_addr TEXT,
    max_attempts INTEGER DEFAULT 3
) RETURNS BOOLEAN AS $$
DECLARE
    current_attempts INTEGER;
BEGIN
    -- Try to insert or update atomically
    INSERT INTO ip_rate_limits (ip_address, attempts, window_start, window_end)
    VALUES (ip_addr, 1, NOW(), NOW() + INTERVAL '1 hour')
    ON CONFLICT (ip_address) DO UPDATE SET
        attempts = CASE
            WHEN ip_rate_limits.window_end <= NOW() THEN 1
            ELSE ip_rate_limits.attempts + 1
        END,
        window_start = CASE
            WHEN ip_rate_limits.window_end <= NOW() THEN NOW()
            ELSE ip_rate_limits.window_start
        END,
        window_end = CASE
            WHEN ip_rate_limits.window_end <= NOW() THEN NOW() + INTERVAL '1 hour'
            ELSE ip_rate_limits.window_end
        END
    RETURNING attempts INTO current_attempts;

    RETURN current_attempts <= max_attempts;
END;
$$ LANGUAGE plpgsql;

-- Keep old function for backward compatibility (deprecated)
CREATE OR REPLACE FUNCTION increment_ip_attempts(ip_addr TEXT)
RETURNS void AS $$
BEGIN
    UPDATE ip_rate_limits
    SET attempts = attempts + 1
    WHERE ip_address = ip_addr
    AND window_end > NOW();
END;
$$ LANGUAGE plpgsql;

-- Atomic identifier rate limit check
CREATE OR REPLACE FUNCTION increment_identifier_attempts(ident TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO verification_rate_limits (identifier)
    VALUES (ident)
    ON CONFLICT (identifier) DO UPDATE SET
        attempts_today = CASE
            WHEN verification_rate_limits.day_reset_at > NOW() THEN verification_rate_limits.attempts_today + 1
            ELSE 1
        END,
        attempts_this_hour = CASE
            WHEN verification_rate_limits.hour_reset_at > NOW() THEN verification_rate_limits.attempts_this_hour + 1
            ELSE 1
        END,
        hour_reset_at = CASE
            WHEN verification_rate_limits.hour_reset_at <= NOW() THEN NOW() + INTERVAL '1 hour'
            ELSE verification_rate_limits.hour_reset_at
        END,
        day_reset_at = CASE
            WHEN verification_rate_limits.day_reset_at <= NOW() THEN NOW() + INTERVAL '1 day'
            ELSE verification_rate_limits.day_reset_at
        END,
        last_attempt = NOW();
END;
$$ LANGUAGE plpgsql;

-- Increment verification attempts (by code ID) - DEPRECATED, use increment_failed_verification
CREATE OR REPLACE FUNCTION increment_verification_attempts(code_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_attempts INTEGER;
BEGIN
    UPDATE verification_codes
    SET attempts = attempts + 1
    WHERE id = code_id
    RETURNING attempts INTO current_attempts;

    RETURN current_attempts;
END;
$$ LANGUAGE plpgsql;

-- Increment failed verification attempts at IDENTIFIER level (persists across code regenerations)
-- Returns current failed attempts count, or -1 if rate limited
CREATE OR REPLACE FUNCTION increment_failed_verification(ident TEXT, max_attempts INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
    current_failed INTEGER;
BEGIN
    -- Insert or update the rate limit record
    INSERT INTO verification_rate_limits (identifier, failed_verification_attempts, failed_attempts_reset_at)
    VALUES (ident, 1, NOW() + INTERVAL '1 hour')
    ON CONFLICT (identifier) DO UPDATE SET
        failed_verification_attempts = CASE
            WHEN verification_rate_limits.failed_attempts_reset_at <= NOW() THEN 1
            ELSE verification_rate_limits.failed_verification_attempts + 1
        END,
        failed_attempts_reset_at = CASE
            WHEN verification_rate_limits.failed_attempts_reset_at <= NOW() THEN NOW() + INTERVAL '1 hour'
            ELSE verification_rate_limits.failed_attempts_reset_at
        END
    RETURNING failed_verification_attempts INTO current_failed;

    -- Return -1 if over limit (caller should reject)
    IF current_failed > max_attempts THEN
        RETURN -1;
    END IF;

    RETURN current_failed;
END;
$$ LANGUAGE plpgsql;

-- Check if identifier is rate limited for verification attempts
CREATE OR REPLACE FUNCTION check_verification_rate_limit(ident TEXT, max_attempts INTEGER DEFAULT 10)
RETURNS BOOLEAN AS $$
DECLARE
    current_failed INTEGER;
BEGIN
    SELECT failed_verification_attempts INTO current_failed
    FROM verification_rate_limits
    WHERE identifier = ident
    AND failed_attempts_reset_at > NOW();

    RETURN COALESCE(current_failed, 0) < max_attempts;
END;
$$ LANGUAGE plpgsql;

-- Reset failed verification attempts on successful verification
CREATE OR REPLACE FUNCTION reset_failed_verification(ident TEXT)
RETURNS void AS $$
BEGIN
    UPDATE verification_rate_limits
    SET failed_verification_attempts = 0
    WHERE identifier = ident;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 6: Cleanup old/expired data (scheduled cleanup support)
-- =============================================================================

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM verification_codes WHERE expires_at < NOW() AND used_at IS NULL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired rate limits
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    ip_deleted INTEGER;
    ident_deleted INTEGER;
BEGIN
    DELETE FROM ip_rate_limits WHERE window_end < NOW();
    GET DIAGNOSTICS ip_deleted = ROW_COUNT;

    DELETE FROM verification_rate_limits WHERE day_reset_at < NOW() - INTERVAL '1 day';
    GET DIAGNOSTICS ident_deleted = ROW_COUNT;

    RETURN ip_deleted + ident_deleted;
END;
$$ LANGUAGE plpgsql;
