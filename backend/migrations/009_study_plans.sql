-- ════════════════════════════════════════════════════════════════
-- 009_study_plans.sql
-- Cross-device study plan and mastery persistence
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS study_plans (
    id          TEXT        NOT NULL,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    mastery     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    topic       TEXT,
    exam_date   TEXT,
    saved_at    BIGINT,
    is_deleted  BOOLEAN     NOT NULL DEFAULT false,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS study_plans_user_updated_idx ON study_plans (user_id, updated_at DESC);

ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_plans' AND policyname = 'study_plans_owner'
  ) THEN
    CREATE POLICY study_plans_owner ON study_plans
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
