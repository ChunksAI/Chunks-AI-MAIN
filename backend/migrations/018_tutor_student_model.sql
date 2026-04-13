-- ════════════════════════════════════════════════════════════════
-- 018_tutor_student_model.sql
-- Add student_knowledge_model column to user_settings for AI tutor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS student_knowledge_model TEXT;
