-- ════════════════════════════════════════════════════════════════
-- 008_ws_state.sql
-- Workspace reading position sync
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ws_state (
    user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    active_book_id  TEXT,
    book_positions  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    sidebar_open    BOOLEAN     DEFAULT true,
    chat_open       BOOLEAN     DEFAULT true,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ws_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ws_state' AND policyname = 'ws_state_owner'
  ) THEN
    CREATE POLICY ws_state_owner ON ws_state
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- RPC: upsert a single book reading position
CREATE OR REPLACE FUNCTION upsert_book_position(
    p_user_id    UUID,
    p_book_id    TEXT,
    p_page       INTEGER DEFAULT NULL,
    p_zoom       NUMERIC DEFAULT NULL,
    p_scroll_top INTEGER DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pos JSONB;
BEGIN
    INSERT INTO ws_state (user_id, active_book_id) VALUES (p_user_id, p_book_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT COALESCE(book_positions->p_book_id, '{}'::jsonb) INTO v_pos
    FROM ws_state WHERE user_id = p_user_id;

    IF p_page       IS NOT NULL THEN v_pos := jsonb_set(v_pos, '{page}',       to_jsonb(p_page)); END IF;
    IF p_zoom       IS NOT NULL THEN v_pos := jsonb_set(v_pos, '{zoom}',       to_jsonb(p_zoom)); END IF;
    IF p_scroll_top IS NOT NULL THEN v_pos := jsonb_set(v_pos, '{scroll_top}', to_jsonb(p_scroll_top)); END IF;
    v_pos := jsonb_set(v_pos, '{visited_at}', to_jsonb(now()::text));

    UPDATE ws_state
    SET active_book_id = p_book_id,
        book_positions = jsonb_set(book_positions, ARRAY[p_book_id], v_pos),
        updated_at     = now()
    WHERE user_id = p_user_id;
END;
$$;

-- RPC: save sidebar/chat panel open state
CREATE OR REPLACE FUNCTION upsert_ws_panels(
    p_user_id      UUID,
    p_sidebar_open BOOLEAN DEFAULT NULL,
    p_chat_open    BOOLEAN DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO ws_state (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE ws_state
    SET sidebar_open = COALESCE(p_sidebar_open, sidebar_open),
        chat_open    = COALESCE(p_chat_open,    chat_open),
        updated_at   = now()
    WHERE user_id = p_user_id;
END;
$$;
