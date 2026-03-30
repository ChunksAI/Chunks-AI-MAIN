-- ════════════════════════════════════════════════════════════════
-- 012_increment_cache_hit.sql
-- Backfill: create the increment_cache_hit RPC that was defined
-- in 001_query_cache.sql but not applied to the live project.
-- Safe to run even if the function already exists.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION increment_cache_hit(p_cache_key TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE query_cache
       SET hit_count   = hit_count + 1,
           last_hit_at = now(),
           expires_at  = GREATEST(expires_at, now() + INTERVAL '7 days')
     WHERE cache_key = p_cache_key;
END;
$$;
