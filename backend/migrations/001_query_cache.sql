-- ============================================================
-- Migration: 001_query_cache.sql
-- Purpose:   Persistent AI query cache for /ask responses.
--            Acts as the long-term (7-day) backing store behind
--            the Redis (1h) and in-memory (TTLCache) tiers.
--
-- To run:
--   Supabase Dashboard → SQL Editor → paste & run
--   OR: supabase db push  (if using CLI)
-- ============================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS query_cache (
    -- Stable SHA-256 key matching the format used in server.py:
    -- "ask:v1:<16-hex-chars>"
    cache_key   TEXT        PRIMARY KEY,

    -- Full JSON payload returned to the frontend (success:true responses only)
    answer      JSONB       NOT NULL,

    -- Metadata for analytics and cache management
    model_used  TEXT,
    task_type   TEXT,
    mode        TEXT,
    book_id     TEXT,
    hit_count   INTEGER     NOT NULL DEFAULT 1,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Bump expires_at on each cache hit so hot entries stay alive longer
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    last_hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Used by the cleanup job to find expired rows efficiently
CREATE INDEX IF NOT EXISTS query_cache_expires_at_idx
    ON query_cache (expires_at);

-- Used by analytics queries (e.g. "which tasks hit cache most?")
CREATE INDEX IF NOT EXISTS query_cache_task_type_idx
    ON query_cache (task_type);

-- ── Row-level security ────────────────────────────────────────────────────────
-- The backend always uses the service_role key, which bypasses RLS.
-- We still enable RLS and deny all public access as defence-in-depth.

ALTER TABLE query_cache ENABLE ROW LEVEL SECURITY;

-- No anon or authenticated reads/writes — service_role only
CREATE POLICY "deny_all_public" ON query_cache
    FOR ALL USING (false);

-- ── Cleanup function (called by pg_cron or manually) ──────────────────────────

CREATE OR REPLACE FUNCTION delete_expired_query_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM query_cache WHERE expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- ── Optional: pg_cron schedule (requires pg_cron extension) ──────────────────
-- Run cleanup daily at 03:00 UTC.
-- Uncomment if pg_cron is enabled in your Supabase project:
--
-- SELECT cron.schedule(
--     'cleanup-query-cache',
--     '0 3 * * *',
--     $$ SELECT delete_expired_query_cache(); $$
-- );

-- ── Hit-count increment RPC (called by backend on cache hit) ─────────────────

CREATE OR REPLACE FUNCTION increment_cache_hit(p_cache_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE query_cache
       SET hit_count   = hit_count + 1,
           last_hit_at = now(),
           -- Extend expiry on hit so popular entries stay alive longer (max +7d)
           expires_at  = GREATEST(expires_at, now() + INTERVAL '7 days')
     WHERE cache_key = p_cache_key;
END;
$$;

-- ── Admin view: top cached queries ───────────────────────────────────────────

CREATE OR REPLACE VIEW query_cache_stats AS
SELECT
    task_type,
    mode,
    book_id,
    COUNT(*)                        AS entry_count,
    SUM(hit_count)                  AS total_hits,
    ROUND(AVG(hit_count), 1)        AS avg_hits_per_entry,
    MAX(last_hit_at)                AS last_hit,
    MIN(created_at)                 AS oldest_entry
FROM query_cache
WHERE expires_at > now()
GROUP BY task_type, mode, book_id
ORDER BY total_hits DESC;
