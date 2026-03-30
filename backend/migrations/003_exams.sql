-- ============================================================
-- Migration: 003_exams.sql
-- Purpose:   Persist exam attempts per user per document.
--            Each INSERT is a new attempt — no overwriting.
--
-- To run:
--   Supabase Dashboard → SQL Editor → paste & run
--   OR: supabase db push  (if using CLI)
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exams (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- FK to auth.users (RLS enforces ownership)
    user_id     UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,

    -- Identifies the study-plan / document the exam was taken for.
    -- Stored as TEXT so it can hold either a Supabase UUID or a
    -- client-generated plan id (e.g. "plan_1710000000000_abc12").
    document_id TEXT        NOT NULL,

    -- Full question array with chosen answers embedded, stored as JSONB
    -- for efficient indexing and filtering.
    -- Shape: [{ q, options, answer, explanation, chosen }, …]
    questions   JSONB       NOT NULL DEFAULT '[]'::jsonb,

    -- Percentage score 0-100
    score       INTEGER     NOT NULL CHECK (score >= 0 AND score <= 100),

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Fast lookup: "all attempts for a given user + document"
CREATE INDEX IF NOT EXISTS exams_user_document_idx
    ON exams (user_id, document_id);

-- Chronological ordering within a user's history
CREATE INDEX IF NOT EXISTS exams_user_created_idx
    ON exams (user_id, created_at DESC);

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- Users may only read their own exam attempts
CREATE POLICY "exams_select_own" ON exams
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users may only insert rows for themselves
CREATE POLICY "exams_insert_own" ON exams
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- No UPDATE — each attempt is immutable once saved
-- No DELETE via client — service_role only for admin cleanup
