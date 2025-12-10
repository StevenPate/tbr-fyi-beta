-- Core Session System Tables and Functions
-- Implements secure session management without Supabase Auth

-- Sessions table with hashed tokens
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,  -- Store SHA256 hash, not plaintext
    user_id TEXT REFERENCES users(phone_number) ON DELETE CASCADE,  -- References phone_number!
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',  -- 7 day TTL
    last_activity TIMESTAMP DEFAULT NOW()  -- For activity-based refresh
);

-- Verification codes with enhanced security
CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,  -- phone or email
    code TEXT NOT NULL,
    code_type TEXT NOT NULL CHECK (code_type IN ('sms_6digit', 'email_token')),
    attempts INTEGER DEFAULT 0,  -- Track failed attempts
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes',
    used_at TIMESTAMP,
    ip_address TEXT  -- Track origin for security
);

-- Partial unique index - only one active code per identifier+type
CREATE UNIQUE INDEX idx_one_active_code_per_identifier
ON verification_codes(identifier, code_type)
WHERE used_at IS NULL;

-- Per-identifier rate limiting (persisted in database)
CREATE TABLE IF NOT EXISTS verification_rate_limits (
    identifier TEXT PRIMARY KEY,
    attempts_today INTEGER DEFAULT 1,
    attempts_this_hour INTEGER DEFAULT 1,
    last_attempt TIMESTAMP DEFAULT NOW(),
    hour_reset_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour',
    day_reset_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 day'
);

-- IP rate limiting (persisted in database)
CREATE TABLE IF NOT EXISTS ip_rate_limits (
    ip_address TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT NOW(),
    window_end TIMESTAMP DEFAULT NOW() + INTERVAL '1 hour'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_identifier ON verification_codes(identifier);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_ip_rate_limits_window ON ip_rate_limits(window_end);

-- SQL function for atomic IP attempt increment
CREATE OR REPLACE FUNCTION increment_ip_attempts(ip_addr TEXT)
RETURNS void AS $$
BEGIN
    UPDATE ip_rate_limits
    SET attempts = attempts + 1
    WHERE ip_address = ip_addr
    AND window_end > NOW();
END;
$$ LANGUAGE plpgsql;

-- SQL function for atomic identifier attempt increment
CREATE OR REPLACE FUNCTION increment_identifier_attempts(ident TEXT)
RETURNS void AS $$
BEGIN
    UPDATE verification_rate_limits
    SET
        attempts_today = CASE
            WHEN day_reset_at > NOW() THEN attempts_today + 1
            ELSE 1
        END,
        attempts_this_hour = CASE
            WHEN hour_reset_at > NOW() THEN attempts_this_hour + 1
            ELSE 1
        END,
        hour_reset_at = CASE
            WHEN hour_reset_at <= NOW() THEN NOW() + INTERVAL '1 hour'
            ELSE hour_reset_at
        END,
        day_reset_at = CASE
            WHEN day_reset_at <= NOW() THEN NOW() + INTERVAL '1 day'
            ELSE day_reset_at
        END,
        last_attempt = NOW()
    WHERE identifier = ident;

    -- Insert if doesn't exist
    IF NOT FOUND THEN
        INSERT INTO verification_rate_limits (identifier)
        VALUES (ident);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- SQL function for atomic verification attempt increment (by ID)
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

-- Alternative: Increment by identifier + code (for invalid code tracking)
CREATE OR REPLACE FUNCTION increment_failed_attempts(
    p_identifier TEXT,
    p_code_type TEXT
) RETURNS INTEGER AS $$
DECLARE
    current_attempts INTEGER;
BEGIN
    -- Find active code for this identifier and increment
    UPDATE verification_codes
    SET attempts = attempts + 1
    WHERE identifier = p_identifier
    AND code_type = p_code_type
    AND used_at IS NULL
    AND expires_at > NOW()
    RETURNING attempts INTO current_attempts;

    -- Return current attempts or 0 if no active code
    RETURN COALESCE(current_attempts, 0);
END;
$$ LANGUAGE plpgsql;
