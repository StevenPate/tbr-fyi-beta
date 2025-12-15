# Authentication System Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 11 security and code quality issues in the authentication implementation to make it merge-ready.

**Architecture:** The auth system uses custom session management with SHA256-hashed tokens stored in Supabase, HTTP-only cookies, and database-backed rate limiting. This plan fixes critical security gaps (session deletion, CSRF), addresses race conditions, standardizes logging, and consolidates migrations.

**Tech Stack:** SvelteKit 5, Supabase (PostgreSQL), TypeScript, Twilio

---

## Issue Summary

### Critical (Must Fix)
| # | Issue | Impact |
|---|-------|--------|
| 1 | Session not deleted from DB on logout | Tokens valid after logout |
| 2 | CSRF protection globally disabled | All endpoints vulnerable |
| 3 | Missing `verified_at` column migration | User creation fails |

### Moderate (Should Fix)
| # | Issue | Impact |
|---|-------|--------|
| 4 | Race condition in IP rate limiting | Rate limits bypassable |
| 5 | Verification attempts reset on new code | Can bypass 3-attempt limit |
| 6 | No expired session cleanup | Database bloat |
| 7 | Inconsistent logging | Debugging difficulty |
| 8 | Missing index on `users.phone_number` | Slow session joins |
| 9 | Session activity updates on every request | Unnecessary DB writes |

### Minor (Nice to Fix)
| # | Issue | Impact |
|---|-------|--------|
| 10 | Email regex too permissive | Edge case invalid emails |
| 11 | Phone number format not validated | Unclear errors |

---

## Task 1: Fix Session Deletion on Logout

**Files:**
- Modify: `src/routes/api/auth/session/+server.ts:20-33`

**Step 1: Add crypto import and fix DELETE handler**

Replace the entire file content:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { COOKIE_OPTIONS } from '$lib/server/auth';
import { supabase } from '$lib/server/supabase';
import { createHash } from 'crypto';

// GET - Check current session
export const GET: RequestHandler = async ({ locals }) => {
	if (locals.user) {
		return json({
			authenticated: true,
			user: locals.user
		});
	}

	return json({
		authenticated: false,
		user: null
	});
};

// DELETE - Logout (destroy session)
export const DELETE: RequestHandler = async ({ cookies, locals }) => {
	// Get token before clearing
	const sessionToken = cookies.get('tbr_session');

	if (sessionToken) {
		// Delete session from database
		const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
		await supabase.from('sessions').delete().eq('token_hash', tokenHash);
	}

	// Clear cookie regardless
	cookies.delete('tbr_session', { path: '/' });

	// Clear user from locals
	locals.user = null;

	return json({ success: true });
};
```

**Step 2: Commit**

```bash
git add src/routes/api/auth/session/+server.ts
git commit -m "fix(auth): delete session from database on logout"
```

---

## Task 2: Re-enable CSRF Protection with Route-Specific Exemption

**Files:**
- Modify: `svelte.config.js:10-15`
- Modify: `src/routes/api/sms/+server.ts` (add config export)

**Step 1: Remove global CSRF disable from svelte.config.js**

Replace entire file:

```javascript
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter()
		// CSRF protection enabled by default
	}
};

export default config;
```

**Step 2: Add route-specific CSRF exemption to SMS endpoint**

Add at the end of `src/routes/api/sms/+server.ts` (after line 702):

```typescript

// Disable CSRF for Twilio webhook only
export const config = {
	csrf: false
};
```

**Step 3: Commit**

```bash
git add svelte.config.js src/routes/api/sms/+server.ts
git commit -m "fix(security): re-enable CSRF, exempt only Twilio webhook"
```

---

## Task 3: Consolidate Auth Migrations

**Files:**
- Create: `supabase/migrations/014_consolidated_auth.sql`
- Update: `CLAUDE.md` migration documentation

**Step 1: Create consolidated migration**

This migration is idempotent and adds all auth-related schema for fresh installs or existing installs that already ran 007-013.

```sql
-- Consolidated Auth Migration
-- This migration adds all auth-related columns and tables.
-- Safe to run on existing databases (uses IF NOT EXISTS, IF NOT NULL checks).

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
    is_allowed BOOLEAN;
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
```

**Step 2: Update CLAUDE.md migration instructions**

Find and replace the Database Setup section in CLAUDE.md:

```markdown
## Database Setup

Run the SQL migrations in `supabase/migrations/` folder in order:
1. `001_create_failed_book_imports.sql` - Creates failed_book_imports table for error tracking
2. `002_create_shelves.sql` - Creates shelves and book_shelves tables, adds TBR shelf for existing users
3. `003_create_sms_context.sql` - Creates sms_context table for ADD command support
4. `004_add_default_shelf.sql` - Adds default_shelf_id to users table
5. `005_add_description_and_date.sql` - Adds description and publication_date to books table
6. `006_backfill_default_shelf.sql` - Backfills default_shelf_id for existing users with TBR shelves
7. `014_consolidated_auth.sql` - **Consolidated auth migration** (adds sessions, verification, rate limiting)

**Note:** Migrations 007-013 are legacy auth migrations that have been consolidated into 014. Skip them for fresh installs. If you've already run them, 014 is safe to run (idempotent).
```

**Step 3: Commit**

```bash
git add supabase/migrations/014_consolidated_auth.sql CLAUDE.md
git commit -m "feat(db): consolidate auth migrations into single idempotent migration"
```

---

## Task 4: Fix Race Condition in IP Rate Limiting

**Files:**
- Modify: `src/lib/server/rate-limit.ts:12-42`

**Step 1: Replace checkIPRateLimit with atomic version**

Replace the entire `checkIPRateLimit` function:

```typescript
/**
 * Check IP rate limit (3 attempts per hour)
 * Returns true if allowed, false if rate limited
 * Uses atomic database function to prevent race conditions
 */
export async function checkIPRateLimit(ip: string): Promise<boolean> {
	const { data, error } = await supabase.rpc('check_and_increment_ip_limit', {
		ip_addr: ip,
		max_attempts: 3
	});

	if (error) {
		// Log error but allow request (fail open for availability)
		console.error('Rate limit check failed:', error);
		return true;
	}

	return data === true;
}
```

**Step 2: Commit**

```bash
git add src/lib/server/rate-limit.ts
git commit -m "fix(security): use atomic rate limit check to prevent race condition"
```

---

## Task 5: Track Failed Verification Attempts at Identifier Level

**Problem:** The original design tracked failed attempts per-code. When a user requests a new code, they get 3 fresh guesses. An attacker could request 5 codes/hour × 3 attempts = 15 guesses/hour.

**Solution:** Track failed verification attempts in `verification_rate_limits` table at the identifier level. This counter persists across code regenerations and resets only on successful verification or after 1 hour.

**Files:**
- Modify: `src/routes/api/auth/send-code/+server.ts`
- Modify: `src/routes/api/auth/verify-phone/+server.ts`
- Modify: `src/lib/server/rate-limit.ts`

**Step 1: Add helper function to rate-limit.ts**

Add at the end of `src/lib/server/rate-limit.ts`:

```typescript

/**
 * Check if identifier is rate limited for failed verification attempts
 * Returns true if allowed, false if rate limited (10+ failed attempts in last hour)
 */
export async function checkVerificationAttemptLimit(identifier: string): Promise<boolean> {
	const { data, error } = await supabase.rpc('check_verification_rate_limit', {
		ident: identifier,
		max_attempts: 10
	});

	if (error) {
		// Fail open for availability
		console.error('Verification rate limit check failed:', error);
		return true;
	}

	return data === true;
}

/**
 * Increment failed verification attempts for identifier
 * Returns current count, or -1 if over limit
 */
export async function incrementFailedVerification(identifier: string): Promise<number> {
	const { data, error } = await supabase.rpc('increment_failed_verification', {
		ident: identifier,
		max_attempts: 10
	});

	if (error) {
		console.error('Failed to increment verification attempts:', error);
		return 0;
	}

	return data;
}

/**
 * Reset failed verification attempts on successful verification
 */
export async function resetFailedVerification(identifier: string): Promise<void> {
	await supabase.rpc('reset_failed_verification', { ident: identifier });
}
```

**Step 2: Update send-code to check identifier-level limits**

Replace the entire `src/routes/api/auth/send-code/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { checkIPRateLimit, checkIdentifierRateLimit, checkVerificationAttemptLimit } from '$lib/server/rate-limit';
import { getTwilioClient, TWILIO_FROM_NUMBER } from '$lib/server/twilio';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	try {
		const { phone } = await request.json();
		const ip = getClientAddress();

		if (!phone) {
			return json({ error: 'Phone number is required' }, { status: 400 });
		}

		// Validate phone number format (E.164)
		const phoneRegex = /^\+[1-9]\d{1,14}$/;
		if (!phoneRegex.test(phone)) {
			return json(
				{ error: 'Phone number must be in international format (e.g., +15551234567)' },
				{ status: 400 }
			);
		}

		// Check IP rate limit (3 per hour)
		if (!(await checkIPRateLimit(ip))) {
			return json({ error: 'Too many attempts from this IP. Try again later.' }, { status: 429 });
		}

		// Check identifier rate limit (5 codes per day)
		const rateLimitError = await checkIdentifierRateLimit(phone);
		if (rateLimitError) {
			return json({ error: rateLimitError }, { status: 429 });
		}

		// Check failed verification attempts (10 per hour across all codes)
		if (!(await checkVerificationAttemptLimit(phone))) {
			return json(
				{ error: 'Too many failed verification attempts. Please wait an hour.' },
				{ status: 429 }
			);
		}

		// Mark existing unused codes as superseded (don't delete - preserve audit trail)
		await supabase
			.from('verification_codes')
			.update({ used_at: new Date().toISOString() })
			.eq('identifier', phone)
			.eq('code_type', 'sms_6digit')
			.is('used_at', null);

		// Generate 6-digit code
		const code = Math.floor(100000 + Math.random() * 900000).toString();

		// Store code with metadata
		const { error: insertError } = await supabase.from('verification_codes').insert({
			identifier: phone,
			code,
			code_type: 'sms_6digit',
			ip_address: ip
		});

		if (insertError) {
			logger.error({ error: insertError }, 'Error storing verification code');
			return json({ error: 'Failed to generate verification code' }, { status: 500 });
		}

		// Send SMS
		try {
			const client = await getTwilioClient();
			await client.messages.create({
				to: phone,
				from: TWILIO_FROM_NUMBER,
				body: `Your TBR.fyi verification code: ${code}\n\nExpires in 10 minutes.`
			});

			return json({ success: true });
		} catch (smsError) {
			logger.error({ error: smsError }, 'Error sending SMS');
			return json({ error: 'Failed to send SMS. Please verify your phone number.' }, { status: 500 });
		}
	} catch (error) {
		logger.error({ error }, 'Unexpected error in send-code');
		return json({ error: 'An unexpected error occurred' }, { status: 500 });
	}
};
```

**Step 3: Update verify-phone to use identifier-level tracking**

Replace the entire `src/routes/api/auth/verify-phone/+server.ts`:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { getOrCreateUser, generateSessionToken, COOKIE_OPTIONS } from '$lib/server/auth';
import { incrementFailedVerification, resetFailedVerification } from '$lib/server/rate-limit';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { phone, code } = await request.json();

		if (!phone || !code) {
			return json({ error: 'Phone and code are required' }, { status: 400 });
		}

		// First, check if there's an active code for this identifier
		const { data: activeCode } = await supabase
			.from('verification_codes')
			.select('*')
			.eq('identifier', phone)
			.eq('code_type', 'sms_6digit')
			.is('used_at', null)
			.gt('expires_at', new Date().toISOString())
			.single();

		// If no active code exists, fail immediately
		if (!activeCode) {
			return json({ error: 'No active verification code. Please request a new one.' }, { status: 400 });
		}

		// Check if the provided code matches
		if (activeCode.code !== code) {
			// Wrong code - increment IDENTIFIER-level failed attempts (persists across code regenerations)
			const failedCount = await incrementFailedVerification(phone);

			if (failedCount === -1) {
				// Mark code as used to prevent further attempts
				await supabase
					.from('verification_codes')
					.update({ used_at: new Date().toISOString() })
					.eq('id', activeCode.id);

				return json(
					{ error: 'Too many failed attempts. Please wait an hour before trying again.' },
					{ status: 429 }
				);
			}

			const remainingAttempts = 10 - failedCount;
			return json(
				{ error: `Invalid verification code. ${remainingAttempts} attempts remaining.` },
				{ status: 400 }
			);
		}

		// Code is valid - mark as used
		await supabase
			.from('verification_codes')
			.update({ used_at: new Date().toISOString() })
			.eq('id', activeCode.id);

		// Reset failed verification attempts on success
		await resetFailedVerification(phone);

		// Get or create user (returns record with phone_number as PK)
		const user = await getOrCreateUser({ phone });

		// Create session with hashed token
		const { token, hash } = generateSessionToken();
		await supabase.from('sessions').insert({
			token_hash: hash,
			user_id: user.phone_number // PK is phone_number, not id!
		});

		// Set cookie (raw token)
		cookies.set('tbr_session', token, COOKIE_OPTIONS);

		return json({
			success: true,
			user: {
				phone_number: user.phone_number,
				email: user.email,
				username: user.username,
				display_name: user.display_name
			}
		});
	} catch (error) {
		logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error in verify-phone');
		return json({ error: 'An unexpected error occurred' }, { status: 500 });
	}
};
```

**Step 4: Commit**

```bash
git add src/lib/server/rate-limit.ts src/routes/api/auth/send-code/+server.ts src/routes/api/auth/verify-phone/+server.ts
git commit -m "fix(security): track failed verification attempts at identifier level"
```

---

## Task 6: Add Session Cleanup Endpoint

**Files:**
- Create: `src/routes/api/admin/cleanup/+server.ts`

**Note on CSRF:** External cron services may send requests with an `Origin` header that doesn't match the app's origin, causing SvelteKit to reject the request. Since this endpoint is protected by bearer token authentication, we disable CSRF checking for it (same pattern as the Twilio webhook).

**Step 1: Create cleanup endpoint**

Create directory and file:

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/server/supabase';
import { logger } from '$lib/server/logger';
import { CLEANUP_SECRET } from '$env/static/private';

// POST - Run cleanup (protected by secret)
export const POST: RequestHandler = async ({ request }) => {
	// Verify cleanup secret (set via environment variable)
	const authHeader = request.headers.get('Authorization');
	const providedSecret = authHeader?.replace('Bearer ', '');

	if (!CLEANUP_SECRET || providedSecret !== CLEANUP_SECRET) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		// Clean up expired sessions
		const { data: sessionsDeleted } = await supabase.rpc('cleanup_expired_sessions');

		// Clean up expired verification codes
		const { data: codesDeleted } = await supabase.rpc('cleanup_expired_verification_codes');

		// Clean up expired rate limits
		const { data: rateLimitsDeleted } = await supabase.rpc('cleanup_expired_rate_limits');

		logger.info(
			{
				sessions_deleted: sessionsDeleted,
				codes_deleted: codesDeleted,
				rate_limits_deleted: rateLimitsDeleted
			},
			'Cleanup completed'
		);

		return json({
			success: true,
			deleted: {
				sessions: sessionsDeleted,
				verification_codes: codesDeleted,
				rate_limits: rateLimitsDeleted
			}
		});
	} catch (error) {
		logger.error({ error }, 'Cleanup failed');
		return json({ error: 'Cleanup failed' }, { status: 500 });
	}
};

// Disable CSRF for external cron services (protected by CLEANUP_SECRET bearer token)
export const config = {
	csrf: false
};
```

**Step 2: Add CLEANUP_SECRET to .env.example**

Add to `.env.example`:

```
CLEANUP_SECRET=your-secret-here  # For /api/admin/cleanup endpoint
```

**Step 3: Commit**

```bash
mkdir -p src/routes/api/admin/cleanup
git add src/routes/api/admin/cleanup/+server.ts .env.example
git commit -m "feat(admin): add cleanup endpoint for expired sessions and codes"
```

---

## Task 7: Standardize Logging

**Files:**
- Modify: `src/routes/api/auth/send-magic-link/+server.ts`
- Modify: `src/routes/api/auth/username/+server.ts`

**Note:** `verify-phone` and `send-code` were already updated with proper logging in Task 5.

**Step 1: Fix send-magic-link logging**

Add import at top:
```typescript
import { logger } from '$lib/server/logger';
```

Replace line 55 `console.error('Error storing verification token:', insertError);` with:
```typescript
logger.error({ error: insertError }, 'Error storing verification token');
```

Replace line 69 `console.error('Error sending email:', emailError);` with:
```typescript
logger.error({ error: emailError }, 'Error sending email');
```

Replace line 76 `console.error('Unexpected error in send-magic-link:', error);` with:
```typescript
logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Unexpected error in send-magic-link');
```

**Step 2: Fix username logging**

Add import at top:
```typescript
import { logger } from '$lib/server/logger';
```

Replace line 103 `console.error('Error setting username:', updateError);` with:
```typescript
logger.error({ error: updateError }, 'Error setting username');
```

Replace line 119 `console.error('Unexpected error in username:', error);` with:
```typescript
logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Unexpected error in username');
```

**Step 3: Commit**

```bash
git add src/routes/api/auth/send-magic-link/+server.ts src/routes/api/auth/username/+server.ts
git commit -m "refactor(logging): standardize auth endpoints to use logger service"
```

---

## Task 8: Throttle Session Activity Updates

**Files:**
- Modify: `src/hooks.server.ts:35-42`

**Step 1: Add throttled activity update**

Replace the session activity update block (lines 35-42) with:

```typescript
		if (session && session.user) {
			event.locals.user = session.user;

			// Throttle activity updates to once per hour
			const lastActivity = new Date(session.last_activity).getTime();
			const oneHourAgo = Date.now() - 60 * 60 * 1000;

			if (lastActivity < oneHourAgo) {
				// Update in background, don't await
				supabase
					.from('sessions')
					.update({ last_activity: new Date().toISOString() })
					.eq('token_hash', tokenHash)
					.then(() => {})
					.catch((err) => logger.error({ error: err }, 'Failed to update session activity'));
			}
		}
```

**Step 2: Commit**

```bash
git add src/hooks.server.ts
git commit -m "perf(sessions): throttle activity updates to once per hour"
```

---

## Task 9: Improve Email Validation

**Files:**
- Modify: `src/routes/api/auth/send-magic-link/+server.ts:18-22`

**Step 1: Replace basic regex with comprehensive validation**

Replace the email validation block:

```typescript
// Comprehensive email validation
// - Must have local part, @, domain, and TLD
// - Local part allows typical characters
// - Domain allows subdomains
// - TLD must be 2+ characters
const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
if (!emailRegex.test(email) || email.length > 254) {
	return json({ error: 'Invalid email address' }, { status: 400 });
}
```

**Step 2: Commit**

```bash
git add src/routes/api/auth/send-magic-link/+server.ts
git commit -m "fix(validation): improve email regex to reject invalid formats"
```

---

## Task 10: Handle Username Race Condition Gracefully

**Files:**
- Modify: `src/routes/api/auth/username/+server.ts:96-105`

**Step 1: Handle unique constraint violation**

Replace the update and error handling block:

```typescript
// Update user with username (rely on unique constraint for race condition)
const { error: updateError } = await supabase
	.from('users')
	.update({ username })
	.eq('phone_number', locals.user.phone_number);

if (updateError) {
	// Check for unique constraint violation (race condition)
	if (updateError.code === '23505') {
		return json({ error: 'Username was just taken. Please try another.' }, { status: 409 });
	}
	logger.error({ error: updateError }, 'Error setting username');
	return json({ error: 'Failed to set username' }, { status: 500 });
}
```

**Step 2: Commit**

```bash
git add src/routes/api/auth/username/+server.ts
git commit -m "fix(username): handle race condition with unique constraint error"
```

---

## Task 11: Final Verification

**Step 1: Run type check**

```bash
npm run check
```

Expected: No TypeScript errors

**Step 2: Run dev server to verify no runtime errors**

```bash
npm run dev
```

Verify the server starts without errors.

**Step 3: Create summary commit**

```bash
git add -A
git status  # Verify no uncommitted changes
```

If there are uncommitted changes from previous steps, commit them:

```bash
git commit -m "chore: finalize auth security fixes"
```

---

## Summary of Changes

| Task | Files Modified | Commit Message |
|------|---------------|----------------|
| 1 | `api/auth/session/+server.ts` | fix(auth): delete session from database on logout |
| 2 | `svelte.config.js`, `api/sms/+server.ts` | fix(security): re-enable CSRF, exempt only Twilio webhook |
| 3 | `014_consolidated_auth.sql`, `CLAUDE.md` | feat(db): consolidate auth migrations |
| 4 | `rate-limit.ts` | fix(security): use atomic rate limit check |
| 5 | `rate-limit.ts`, `send-code`, `verify-phone` | fix(security): track failed verification at identifier level |
| 6 | `api/admin/cleanup/+server.ts` | feat(admin): add cleanup endpoint (CSRF exempt) |
| 7 | `send-magic-link`, `username` | refactor(logging): standardize to logger service |
| 8 | `hooks.server.ts` | perf(sessions): throttle activity updates |
| 9 | `api/auth/send-magic-link/+server.ts` | fix(validation): improve email regex |
| 10 | `api/auth/username/+server.ts` | fix(username): handle race condition |

---

## Post-Implementation

After completing all tasks:

1. **Run full test suite** (when tests exist)
2. **Deploy migration 014** to Supabase
3. **Set CLEANUP_SECRET** in production environment
4. **Set up cron job** to call `/api/admin/cleanup` daily (optional)
5. **Merge to main** after verification
