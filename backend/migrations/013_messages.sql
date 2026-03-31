-- ════════════════════════════════════════════════════════════════
-- 013_messages.sql
-- Per-row AI chat messages table
-- Prepared for Phase 2+ real-time sync (ChatGPT-style architecture)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT        NOT NULL,
    session_id  UUID,                        -- optional: group messages into a conversation
    book_id     TEXT,                        -- optional: associate with a document
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_user_id_idx         ON messages (user_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx      ON messages (user_id, created_at ASC);
CREATE INDEX IF NOT EXISTS messages_session_id_idx      ON messages (session_id) WHERE session_id IS NOT NULL;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'messages_owner'
  ) THEN
    CREATE POLICY messages_owner ON messages
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
