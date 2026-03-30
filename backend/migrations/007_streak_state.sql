-- ════════════════════════════════════════════════════════════════
-- 007_streak_state.sql
-- Flashcard streak, XP, and freeze token persistence
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS streak_state (
    user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    streak_count    INTEGER     NOT NULL DEFAULT 0,
    longest_streak  INTEGER     NOT NULL DEFAULT 0,
    last_study_date DATE,
    total_xp        INTEGER     NOT NULL DEFAULT 0,
    freeze_tokens   INTEGER     NOT NULL DEFAULT 0,
    active_theme    TEXT        NOT NULL DEFAULT 'Default',
    milestones      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE streak_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'streak_state' AND policyname = 'streak_state_owner'
  ) THEN
    CREATE POLICY streak_state_owner ON streak_state
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- RPC: record a study session and update streak logic server-side
CREATE OR REPLACE FUNCTION upsert_streak(
    p_user_id    UUID,
    p_study_date DATE,
    p_xp_earned  INTEGER DEFAULT 0,
    p_milestones JSONB   DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_last_date  DATE;
    v_streak     INTEGER;
    v_longest    INTEGER;
    v_xp         INTEGER;
    v_freezes    INTEGER;
BEGIN
    INSERT INTO streak_state (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT last_study_date, streak_count, longest_streak, total_xp, freeze_tokens
    INTO   v_last_date, v_streak, v_longest, v_xp, v_freezes
    FROM   streak_state WHERE user_id = p_user_id;

    -- Already recorded today
    IF v_last_date = p_study_date THEN
        UPDATE streak_state
        SET total_xp   = total_xp + p_xp_earned,
            milestones = CASE WHEN p_milestones IS NOT NULL THEN p_milestones ELSE milestones END,
            updated_at = now()
        WHERE user_id = p_user_id;
        RETURN;
    END IF;

    -- Consecutive day
    IF v_last_date = p_study_date - INTERVAL '1 day' THEN
        v_streak := v_streak + 1;
    -- Gap but has a freeze token
    ELSIF v_last_date = p_study_date - INTERVAL '2 days' AND v_freezes > 0 THEN
        v_streak  := v_streak + 1;
        v_freezes := v_freezes - 1;
    -- Streak broken
    ELSE
        v_streak := 1;
    END IF;

    v_longest := GREATEST(v_longest, v_streak);
    v_xp      := v_xp + p_xp_earned;

    UPDATE streak_state
    SET streak_count    = v_streak,
        longest_streak  = v_longest,
        last_study_date = p_study_date,
        total_xp        = v_xp,
        freeze_tokens   = v_freezes,
        milestones      = CASE WHEN p_milestones IS NOT NULL THEN p_milestones ELSE milestones END,
        updated_at      = now()
    WHERE user_id = p_user_id;
END;
$$;

-- RPC: award one freeze token
CREATE OR REPLACE FUNCTION award_freeze_token(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO streak_state (user_id, freeze_tokens) VALUES (p_user_id, 1)
    ON CONFLICT (user_id) DO UPDATE
        SET freeze_tokens = streak_state.freeze_tokens + 1,
            updated_at    = now();
END;
$$;
