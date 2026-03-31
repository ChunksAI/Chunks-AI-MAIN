-- ════════════════════════════════════════════════════════════════
-- 017_add_missing_indexes.sql
-- Add missing indexes for common query patterns to improve
-- performance on frequently-joined and filtered columns.
-- ════════════════════════════════════════════════════════════════

-- messages table: lookup by session_id (used by fetchMessages, deleteMessages)
CREATE INDEX IF NOT EXISTS idx_messages_session_id
  ON messages (session_id);

-- messages table: lookup by user_id (used by RLS and deleteAllSessions)
CREATE INDEX IF NOT EXISTS idx_messages_user_id
  ON messages (user_id);

-- messages table: compound index for book-scoped message queries
CREATE INDEX IF NOT EXISTS idx_messages_user_book
  ON messages (user_id, book_id);

-- exam_attempts table: lookup by session_id (used when loading exam results)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_session_id
  ON exam_attempts (session_id);

-- fc_cards table: lookup by deck_id (used when loading cards for a deck)
CREATE INDEX IF NOT EXISTS idx_fc_cards_deck_id
  ON fc_cards (deck_id);

-- exam_questions table: lookup by session_id (used when loading exam questions)
CREATE INDEX IF NOT EXISTS idx_exam_questions_session_id
  ON exam_questions (session_id);

-- sticky_notes table: compound index for per-user document lookup
CREATE INDEX IF NOT EXISTS idx_sticky_notes_user_document
  ON sticky_notes (user_id, document_id);
