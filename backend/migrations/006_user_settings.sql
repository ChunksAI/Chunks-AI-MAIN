-- ════════════════════════════════════════════════════════════════
-- 006_user_settings.sql
-- Per-user preferences synced across devices
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_settings (
    user_id        UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    appearance     TEXT,
    chat_font_size TEXT,
    accent         TEXT,
    language       TEXT,
    spoken_language TEXT,
    voice          TEXT,
    separate_voice BOOLEAN     DEFAULT false,
    safe_content   BOOLEAN     DEFAULT false,
    notifications  JSONB       NOT NULL DEFAULT '{}'::jsonb,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_settings' AND policyname = 'user_settings_owner'
  ) THEN
    CREATE POLICY user_settings_owner ON user_settings
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- RPC: upsert individual columns via a JSONB patch object
CREATE OR REPLACE FUNCTION patch_user_settings(
    p_user_id UUID,
    p_patch   JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_settings (user_id, updated_at)
    VALUES (p_user_id, now())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE user_settings
    SET
        appearance      = COALESCE((p_patch->>'appearance'),      appearance),
        chat_font_size  = COALESCE((p_patch->>'chat_font_size'),  chat_font_size),
        accent          = COALESCE((p_patch->>'accent'),          accent),
        language        = COALESCE((p_patch->>'language'),        language),
        spoken_language = COALESCE((p_patch->>'spoken_language'), spoken_language),
        voice           = COALESCE((p_patch->>'voice'),           voice),
        separate_voice  = COALESCE((p_patch->'separate_voice')::boolean, separate_voice),
        safe_content    = COALESCE((p_patch->'safe_content')::boolean,   safe_content),
        notifications   = CASE
                            WHEN p_patch ? 'notifications'
                            THEN notifications || (p_patch->'notifications')
                            ELSE notifications
                          END,
        updated_at      = now()
    WHERE user_id = p_user_id;
END;
$$;
