-- Add feedback opt-in columns to users table
-- For TCPA-compliant follow-up messaging

-- Add feedback_opt_in column (boolean, default false)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'feedback_opt_in'
    ) THEN
        ALTER TABLE users ADD COLUMN feedback_opt_in BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add feedback_opt_in_at column (timestamp, nullable)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'feedback_opt_in_at'
    ) THEN
        ALTER TABLE users ADD COLUMN feedback_opt_in_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add feedback_prompted_at column to track when we showed the prompt
-- (prevents showing it multiple times)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'feedback_prompted_at'
    ) THEN
        ALTER TABLE users ADD COLUMN feedback_prompted_at TIMESTAMPTZ;
    END IF;
END $$;
