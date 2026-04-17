-- ════════════════════════════════════════════════════════════════
-- 019_jsonb_student_model.sql
-- Convert student_knowledge_model from TEXT → JSONB on user_settings
--
-- STRATEGY (zero-downtime, fully idempotent):
--   1. Add a new JSONB column alongside the existing TEXT column.
--   2. Backfill: parse existing TEXT values; silently discard rows
--      whose value cannot be parsed as JSON (set to NULL).
--   3. Drop the old TEXT column.
--   4. Rename the new JSONB column to the canonical name.
--   5. Add a CHECK constraint that validates the required top-level
--      keys (gaps, mastered, quizHistory) are all JSON arrays.
--   6. Create a GIN index on the gaps array for analytics queries.
--      (CONCURRENTLY — must run outside the transaction block.)
--
-- ROLLBACK NOTE:
--   There is no automatic rollback for this migration.  To reverse:
--     1. Add a TEXT column: ALTER TABLE user_settings ADD COLUMN student_knowledge_model_text TEXT;
--     2. Back-serialize: UPDATE user_settings SET student_knowledge_model_text = student_knowledge_model::text;
--     3. Drop the JSONB column: ALTER TABLE user_settings DROP COLUMN student_knowledge_model;
--     4. Rename: ALTER TABLE user_settings RENAME COLUMN student_knowledge_model_text TO student_knowledge_model;
--   The GIN index (created CONCURRENTLY) must be dropped separately:
--     DROP INDEX CONCURRENTLY IF EXISTS idx_student_model_gaps;
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- ── Step 1: Add JSONB column (idempotent) ──────────────────────
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS student_knowledge_model_v2 JSONB;

-- ── Step 2: Backfill — parse TEXT values; skip bad JSON rows ───
-- Uses a PL/pgSQL DO block so that individual rows that fail the
-- ::jsonb cast raise an EXCEPTION that is caught and suppressed,
-- rather than aborting the entire migration.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ctid, student_knowledge_model
    FROM   user_settings
    WHERE  student_knowledge_model_v2 IS NULL
      AND  student_knowledge_model IS NOT NULL
      AND  student_knowledge_model <> ''
  LOOP
    BEGIN
      UPDATE user_settings
         SET student_knowledge_model_v2 = r.student_knowledge_model::jsonb
       WHERE ctid = r.ctid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- Unparseable JSON: leave student_knowledge_model_v2 as NULL for this row
      NULL;
    END;
  END LOOP;
END;
$$;

-- ── Step 3: Drop the old TEXT column (idempotent) ──────────────
ALTER TABLE user_settings
  DROP COLUMN IF EXISTS student_knowledge_model;

-- ── Step 4: Rename JSONB column to canonical name (idempotent) ─
-- Guard ensures the rename only runs when the _v2 column still
-- exists (i.e., the migration hasn't already renamed it).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_name  = 'user_settings'
      AND  column_name = 'student_knowledge_model_v2'
  ) THEN
    ALTER TABLE user_settings
      RENAME COLUMN student_knowledge_model_v2 TO student_knowledge_model;
  END IF;
END;
$$;

-- ── Step 5: CHECK constraint — validate required top-level keys ─
-- Guard ensures the constraint is only created once, even if this
-- migration is run multiple times (PostgreSQL has no ADD CONSTRAINT
-- IF NOT EXISTS syntax).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  constraint_name = 'student_model_schema_check'
      AND  table_name      = 'user_settings'
  ) THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT student_model_schema_check
      CHECK (
        student_knowledge_model IS NULL OR (
          jsonb_typeof(student_knowledge_model -> 'gaps')        = 'array'
          AND jsonb_typeof(student_knowledge_model -> 'mastered')    = 'array'
          AND jsonb_typeof(student_knowledge_model -> 'quizHistory') = 'array'
        )
      );
  END IF;
END;
$$;

COMMIT;

-- ── Step 6: GIN index for gap concept lookups across users ──────
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block,
-- so this statement is intentionally placed after COMMIT.
-- IF NOT EXISTS makes it safe to re-run.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_model_gaps
  ON user_settings
  USING GIN ((student_knowledge_model -> 'gaps'));
