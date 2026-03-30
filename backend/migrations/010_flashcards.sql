-- ════════════════════════════════════════════════════════════════
-- 010_flashcards.sql
-- Flashcard decks, cards, and per-user progress
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fc_decks (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    subject     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fc_cards (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id     UUID        NOT NULL REFERENCES fc_decks(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    front       TEXT        NOT NULL,
    back        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fc_progress (
    user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id     UUID        NOT NULL REFERENCES fc_cards(id)  ON DELETE CASCADE,
    ease_factor NUMERIC     NOT NULL DEFAULT 2.5,
    interval    INTEGER     NOT NULL DEFAULT 1,
    repetitions INTEGER     NOT NULL DEFAULT 0,
    next_review TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_review TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS fc_decks_user_idx    ON fc_decks    (user_id);
CREATE INDEX IF NOT EXISTS fc_cards_deck_idx    ON fc_cards    (deck_id);
CREATE INDEX IF NOT EXISTS fc_cards_user_idx    ON fc_cards    (user_id);
CREATE INDEX IF NOT EXISTS fc_progress_user_idx ON fc_progress (user_id);

ALTER TABLE fc_decks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_cards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fc_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fc_decks'    AND policyname = 'fc_decks_owner')    THEN CREATE POLICY fc_decks_owner    ON fc_decks    FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fc_cards'    AND policyname = 'fc_cards_owner')    THEN CREATE POLICY fc_cards_owner    ON fc_cards    FOR ALL USING (auth.uid() = user_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fc_progress' AND policyname = 'fc_progress_owner') THEN CREATE POLICY fc_progress_owner ON fc_progress FOR ALL USING (auth.uid() = user_id); END IF;
END $$;
