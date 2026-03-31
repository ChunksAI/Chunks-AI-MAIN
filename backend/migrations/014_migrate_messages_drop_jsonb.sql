-- ════════════════════════════════════════════════════════════════
-- 014_migrate_messages_drop_jsonb.sql
-- PROBLEM 1: Migrate chat_sessions.messages JSONB → messages table
-- PROBLEM 2: Drop local_id column from chat_sessions
--
-- After this migration, chat_sessions becomes metadata-only:
--   (id, user_id, book_id, title, created_at, updated_at)
-- All message content lives in the per-row `messages` table.
-- ════════════════════════════════════════════════════════════════

-- Step 1: Migrate existing JSONB messages into the messages table.
-- ON CONFLICT DO NOTHING ensures idempotency if this migration runs twice.
INSERT INTO messages (id, user_id, role, content, session_id, book_id, created_at)
SELECT
  gen_random_uuid(),
  cs.user_id,
  (msg->>'role')::text,
  (msg->>'content')::text,
  cs.id,
  cs.book_id,
  COALESCE((msg->>'created_at')::timestamptz, cs.created_at)
FROM chat_sessions cs,
  jsonb_array_elements(cs.messages) AS msg
WHERE cs.messages IS NOT NULL
  AND jsonb_array_length(cs.messages) > 0
  AND (msg->>'role') IS NOT NULL
  AND (msg->>'content') IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 2: Drop the JSONB messages column (no longer needed).
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS messages;

-- Step 3: Drop the local_id column — all code now uses the UUID `id` directly.
ALTER TABLE chat_sessions DROP COLUMN IF EXISTS local_id;

-- Step 4: Drop the local_id index (no longer needed).
DROP INDEX IF EXISTS chat_sessions_local_id_idx;

-- Step 5: Replace the append_chat_message RPC to insert into the messages
-- table instead of appending to the JSONB column. The new version also
-- creates or updates the chat_sessions metadata row.
CREATE OR REPLACE FUNCTION append_chat_message(
    p_session_id  UUID,
    p_user_id     UUID,
    p_message     JSONB,
    p_book_id     TEXT    DEFAULT NULL,
    p_title       TEXT    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Upsert the session metadata row (no messages column anymore)
    INSERT INTO chat_sessions (id, user_id, book_id, title, updated_at)
    VALUES (
        p_session_id,
        p_user_id,
        p_book_id,
        p_title,
        now()
    )
    ON CONFLICT (id) DO UPDATE
        SET updated_at = now(),
            title      = COALESCE(NULLIF(p_title, ''),    chat_sessions.title),
            book_id    = COALESCE(NULLIF(p_book_id, ''), chat_sessions.book_id);

    -- Insert the message into the per-row messages table
    INSERT INTO messages (user_id, role, content, session_id, book_id, created_at)
    VALUES (
        p_user_id,
        (p_message->>'role')::text,
        (p_message->>'content')::text,
        p_session_id,
        p_book_id,
        COALESCE((p_message->>'created_at')::timestamptz, now())
    );
END;
$$;
