-- ════════════════════════════════════════════════════════════════
-- 011_recent_items.sql
-- Cross-device sync for exam_recent and sp_recent_plans
-- Stores lightweight sidebar list data that completes the sync story.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS recent_items (
    user_id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_recent      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    sp_recent_plans  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recent_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'recent_items' AND policyname = 'recent_items_owner'
  ) THEN
    CREATE POLICY recent_items_owner ON recent_items
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- RPC: patch exam_recent and/or sp_recent_plans in one call
CREATE OR REPLACE FUNCTION patch_recent_items(
    p_user_id         UUID,
    p_exam_recent     JSONB  DEFAULT NULL,
    p_sp_recent_plans JSONB  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO recent_items (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE recent_items
    SET exam_recent     = COALESCE(p_exam_recent,     exam_recent),
        sp_recent_plans = COALESCE(p_sp_recent_plans, sp_recent_plans),
        updated_at      = now()
    WHERE user_id = p_user_id;
END;
$$;
