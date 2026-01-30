-- Track note prompt responses for analytics and optimization
-- Helps understand which prompts lead to better note-taking engagement

CREATE TABLE IF NOT EXISTS prompt_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL REFERENCES users(phone_number) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    prompt_id text NOT NULL,
    responded boolean NOT NULL DEFAULT false,
    note_length int DEFAULT 0,
    source text NOT NULL DEFAULT 'web', -- 'web' or 'sms'
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying user's prompt history
CREATE INDEX IF NOT EXISTS idx_prompt_responses_user_id ON prompt_responses(user_id);

-- Index for analyzing prompt effectiveness
CREATE INDEX IF NOT EXISTS idx_prompt_responses_prompt_id ON prompt_responses(prompt_id);

-- Index for recent prompts (to avoid repetition)
CREATE INDEX IF NOT EXISTS idx_prompt_responses_user_created ON prompt_responses(user_id, created_at DESC);

COMMENT ON TABLE prompt_responses IS 'Tracks which note prompts were shown and whether users responded';
COMMENT ON COLUMN prompt_responses.prompt_id IS 'ID from NOTE_PROMPTS: default, casual, mood, direct, skip';
COMMENT ON COLUMN prompt_responses.responded IS 'True if user entered a note, false if skipped';
COMMENT ON COLUMN prompt_responses.note_length IS 'Character count of note if responded';
COMMENT ON COLUMN prompt_responses.source IS 'Channel: web or sms';
