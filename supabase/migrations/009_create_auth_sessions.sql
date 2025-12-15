-- Migration: Create auth sessions tracking table
-- Description: Track active user sessions for security and device management

-- Create auth_sessions table
CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(phone_number) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_auth_sessions_auth_id ON auth_sessions(auth_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active ON auth_sessions(is_active, expires_at);

-- Comment on table and columns
COMMENT ON TABLE auth_sessions IS 'Track active user sessions for security and session management';
COMMENT ON COLUMN auth_sessions.auth_id IS 'Reference to Supabase Auth user';
COMMENT ON COLUMN auth_sessions.user_id IS 'Reference to our users table (phone_number)';
COMMENT ON COLUMN auth_sessions.session_token IS 'Unique session token for this session';
COMMENT ON COLUMN auth_sessions.user_agent IS 'Browser/device user agent string';
COMMENT ON COLUMN auth_sessions.ip_address IS 'IP address of the session';
COMMENT ON COLUMN auth_sessions.last_seen_at IS 'Last activity timestamp for this session';
COMMENT ON COLUMN auth_sessions.expires_at IS 'When this session expires (30 days by default)';
COMMENT ON COLUMN auth_sessions.is_active IS 'Whether session is still active';