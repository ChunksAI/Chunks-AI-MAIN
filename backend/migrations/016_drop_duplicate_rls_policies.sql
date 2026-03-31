-- ════════════════════════════════════════════════════════════════
-- 016_drop_duplicate_rls_policies.sql
-- PROBLEM 6: Remove overlapping RLS policies
-- Each table should have ONE "ALL" policy per user.
-- Duplicate granular (SELECT/INSERT/UPDATE/DELETE) policies cause
-- unpredictable permission behavior and must be removed.
-- ════════════════════════════════════════════════════════════════

-- ── chat_sessions: drop granular cmd policies, keep "Users own their sessions" ALL ──
DROP POLICY IF EXISTS "chat_sessions_owner_select" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_owner_insert" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_owner_update" ON chat_sessions;
DROP POLICY IF EXISTS "chat_sessions_owner_delete" ON chat_sessions;

-- ── fc_decks: drop duplicate, keep "Users own their decks" ALL ──
DROP POLICY IF EXISTS "fc_decks: own rows only" ON fc_decks;

-- ── fc_cards: drop duplicate, keep "Users own their cards" ALL ──
DROP POLICY IF EXISTS "fc_cards: own rows only" ON fc_cards;

-- ── fc_progress: drop duplicate, keep "Users own their progress" ALL ──
DROP POLICY IF EXISTS "fc_progress: own rows only" ON fc_progress;

-- ── user_settings: drop granular, keep "Users own their settings" ALL ──
DROP POLICY IF EXISTS "user_settings_owner_select" ON user_settings;
DROP POLICY IF EXISTS "user_settings_owner_insert" ON user_settings;
DROP POLICY IF EXISTS "user_settings_owner_update" ON user_settings;

-- ── streak_state: drop granular, keep "Users own their streak" ALL ──
DROP POLICY IF EXISTS "streak_state_owner_select" ON streak_state;
DROP POLICY IF EXISTS "streak_state_owner_insert" ON streak_state;
DROP POLICY IF EXISTS "streak_state_owner_update" ON streak_state;

-- ── ws_state: drop granular, keep "Users own their ws state" ALL ──
DROP POLICY IF EXISTS "ws_state_owner_select" ON ws_state;
DROP POLICY IF EXISTS "ws_state_owner_insert" ON ws_state;
DROP POLICY IF EXISTS "ws_state_owner_update" ON ws_state;
