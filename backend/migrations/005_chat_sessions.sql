-- ════════════════════════════════════════════════════════════════
-- 005_chat_sessions.sql
-- Cross-device home chat session persistence
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    local_id    TEXT,                        -- r+timestamp key used on the originating device
    book_id     TEXT,                        -- associated document/book id (nullable)
    title       TEXT,
    messages    JSONB       NOT NULL DEFAULT '[]'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx    ON chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_updated_at_idx ON chat_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_local_id_idx   ON chat_sessions (user_id, local_id) WHERE local_id IS NOT NULL;

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'chat_sessions_owner'
  ) THEN
    CREATE POLICY chat_sessions_owner ON chat_sessions
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- RPC: append a single message to an existing session (or create the session row)
CREATE OR REPLACE FUNCTION append_chat_message(
    p_session_id  UUID,
    p_user_id     UUID,
    p_message     JSONB,
    p_book_id     TEXT    DEFAULT NULL,
    p_title       TEXT    DEFAULT NULL,
    p_local_id    TEXT    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO chat_sessions (id, user_id, local_id, book_id, title, messages, updated_at)
    VALUES (
        p_session_id,
        p_user_id,
        p_local_id,
        p_book_id,
        p_title,
        jsonb_build_array(p_message),
        now()
    )
    ON CONFLICT (id) DO UPDATE
        SET messages   = chat_sessions.messages || p_message,
            updated_at = now(),
            title      = COALESCE(NULLIF(p_title, ''),    chat_sessions.title),
            book_id    = COALESCE(NULLIF(p_book_id, ''), chat_sessions.book_id),
            local_id   = COALESCE(NULLIF(p_local_id, ''), chat_sessions.local_id);
END;
$$;
