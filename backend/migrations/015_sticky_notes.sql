-- ════════════════════════════════════════════════════════════════
-- 015_sticky_notes.sql
-- PROBLEM 5: Create sticky_notes table for per-page notes
-- Currently stored only in localStorage — this enables cross-device sync.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sticky_notes (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id  TEXT,                        -- associated document/book id
    page_number  INTEGER,                    -- page the sticky is attached to
    content      TEXT        NOT NULL DEFAULT '',
    color        TEXT        DEFAULT 'yellow',
    position_x   INTEGER,                    -- optional x position on page
    position_y   INTEGER,                    -- optional y position on page
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sticky_notes_user_id_idx      ON sticky_notes (user_id);
CREATE INDEX IF NOT EXISTS sticky_notes_document_idx     ON sticky_notes (user_id, document_id);

ALTER TABLE sticky_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sticky_notes' AND policyname = 'sticky_notes_owner'
  ) THEN
    CREATE POLICY sticky_notes_owner ON sticky_notes
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
