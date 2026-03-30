-- ============================================================
-- Migration: 004_exams_meta.sql
-- Purpose:   Extend the exams table to support standalone
--            (non-document) exam attempts and richer metadata.
--
-- Changes:
--   1. Make document_id nullable — standalone exams have no
--      associated document UUID.
--   2. Add topic TEXT — human-readable topic/subject label.
--   3. Add meta JSONB  — flexible extra fields (type, diff,
--      timeTaken, wrongConcepts, …) so we don't need more
--      migrations for every new field.
--
-- To run:
--   Supabase Dashboard → SQL Editor → paste & run
--   OR: supabase db push  (if using CLI)
-- ============================================================

-- ── 1. Allow document_id to be NULL ──────────────────────────────────────────

ALTER TABLE exams
    ALTER COLUMN document_id DROP NOT NULL;

-- ── 2. Add topic column ───────────────────────────────────────────────────────

ALTER TABLE exams
    ADD COLUMN IF NOT EXISTS topic TEXT;

-- ── 3. Add meta column ────────────────────────────────────────────────────────
-- Expected keys (all optional):
--   type         TEXT    — exam type: 'mcq' | 'truefalse' | 'situational' | 'cbl' | 'mixed'
--   diff         TEXT    — difficulty: 'easy' | 'medium' | 'hard'
--   timeTaken    TEXT    — formatted duration, e.g. '3:42'
--   wrongConcepts TEXT[] — concept labels for questions answered incorrectly
--   count        INT     — total number of questions
--   correct      INT     — number of questions answered correctly

ALTER TABLE exams
    ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── Index on topic for efficient per-topic history queries ────────────────────

CREATE INDEX IF NOT EXISTS exams_user_topic_idx
    ON exams (user_id, topic);
