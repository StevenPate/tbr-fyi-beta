-- Migration: Create phone verification codes table
-- Description: Store temporary verification codes for phone number ownership verification

-- Create phone_verification_codes table
CREATE TABLE IF NOT EXISTS phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  purpose TEXT DEFAULT 'account_claim',
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '10 minutes'),
  used_at TIMESTAMP,
  is_used BOOLEAN DEFAULT false
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_phone_verification_phone ON phone_verification_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_verification_code ON phone_verification_codes(phone_number, code);
CREATE INDEX IF NOT EXISTS idx_phone_verification_expires ON phone_verification_codes(is_used, expires_at);

-- Add constraint for purpose values
ALTER TABLE phone_verification_codes
ADD CONSTRAINT purpose_check
CHECK (purpose IN ('account_claim', 'phone_link', 'password_reset'));

-- Add constraint for max attempts
ALTER TABLE phone_verification_codes
ADD CONSTRAINT max_attempts_check
CHECK (attempts <= 5);

-- Comment on table and columns
COMMENT ON TABLE phone_verification_codes IS 'Temporary verification codes for phone ownership verification';
COMMENT ON COLUMN phone_verification_codes.phone_number IS 'Phone number being verified';
COMMENT ON COLUMN phone_verification_codes.code IS 'Verification code (6 digits)';
COMMENT ON COLUMN phone_verification_codes.auth_id IS 'Auth user trying to claim this phone number';
COMMENT ON COLUMN phone_verification_codes.email IS 'Email associated with verification request';
COMMENT ON COLUMN phone_verification_codes.purpose IS 'Why verification is needed: account_claim, phone_link, password_reset';
COMMENT ON COLUMN phone_verification_codes.attempts IS 'Number of verification attempts';
COMMENT ON COLUMN phone_verification_codes.expires_at IS 'When this code expires (10 minutes by default)';
COMMENT ON COLUMN phone_verification_codes.used_at IS 'When code was successfully used';
COMMENT ON COLUMN phone_verification_codes.is_used IS 'Whether code has been used';