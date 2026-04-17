# DEPRECATED: use services.cache.CacheService instead
"""
backend/services/ask_cache.py — Redis + Supabase cache layer for /ask queries.

Extracted from server.py to break the circular import between server.py and
the route files that previously did ``from server import _ask_cache_key, ...``.

Call ``init(...)`` once from server.py at startup.
"""
from __future__ import annotations

import hashlib
import json
import logging

logger = logging.getLogger(__name__)

_ASK_CACHE_TTL       = 3600
_ASK_CACHEABLE_MODES = frozenset(['study', 'summary', 'general', 'concise', 'detailed', 'generate'])
_SB_CACHE_TTL_DAYS   = 7

_redis               = None
_session             = None
SUPABASE_URL: str    = ''
SUPABASE_SERVICE_KEY: str = ''


def init(redis=None, session=None, supabase_url: str = '',
         supabase_service_key: str = '') -> None:
    """Inject shared dependencies. Call once from server.py at startup."""
    global _redis, _session, SUPABASE_URL, SUPABASE_SERVICE_KEY
    _redis               = redis
    _session             = session
    SUPABASE_URL         = supabase_url
    SUPABASE_SERVICE_KEY = supabase_service_key


# ── Key helpers ───────────────────────────────────────────────────────────────

def _ask_cache_key(
    book_id: str,
    task_type: str | None,
    mode: str,
    complexity: int,
    question: str,
    doc_context: str = '',
    student_profile: str = '',   # ADD THIS PARAMETER
) -> str:
    canonical = f"{book_id}|{task_type or mode}|{complexity}|{question.strip().lower()}"
    if doc_context:
        ctx_hash  = hashlib.sha256(doc_context.encode()).hexdigest()[:12]
        canonical += f"|ctx:{ctx_hash}"
    if student_profile:
        sp_hash   = hashlib.sha256(student_profile.strip().lower().encode()).hexdigest()[:12]
        canonical += f"|sp:{sp_hash}"
    digest = hashlib.sha256(canonical.encode()).hexdigest()[:16]
    return f"ask:v1:{digest}"


def _ask_is_cacheable(mode: str, history: list, web_search: bool,
                      thinking_mode: str | None) -> bool:
    return (
        mode in _ASK_CACHEABLE_MODES
        and not history
        and not web_search
        and not thinking_mode
    )


# ── Supabase helpers ──────────────────────────────────────────────────────────

def _sb_headers() -> dict:
    return {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey":        SUPABASE_SERVICE_KEY,
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }


def _sb_cache_get(key: str) -> dict | None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY or _session is None:
        return None
    try:
        import datetime
        resp = _session.get(
            f"{SUPABASE_URL}/rest/v1/query_cache",
            params={
                "cache_key": f"eq.{key}",
                "expires_at": f"gt.{datetime.datetime.utcnow().isoformat()}",
                "select":    "answer",
                "limit":     "1",
            },
            headers=_sb_headers(),
            timeout=3,
        )
        if resp.status_code == 200:
            rows = resp.json()
            if rows:
                try:
                    _session.post(
                        f"{SUPABASE_URL}/rest/v1/rpc/increment_cache_hit",
                        json={"p_cache_key": key},
                        headers=_sb_headers(),
                        timeout=2,
                    )
                except Exception:
                    pass
                logger.debug("ask_cache HIT (supabase) key=%s", key)
                return rows[0]["answer"]
    except Exception as e:
        logger.warning("sb_cache GET error: %s", e)
    return None


def _sb_cache_set(key: str, payload: dict, task_type: str | None,
                  mode: str, book_id: str, model_used: str) -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY or _session is None:
        return
    try:
        import datetime
        expires = (datetime.datetime.utcnow() +
                   datetime.timedelta(days=_SB_CACHE_TTL_DAYS)).isoformat()
        _session.post(
            f"{SUPABASE_URL}/rest/v1/query_cache",
            json={
                "cache_key":  key,
                "answer":     payload,
                "task_type":  task_type,
                "mode":       mode,
                "book_id":    book_id,
                "model_used": model_used,
                "expires_at": expires,
            },
            headers={**_sb_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
            timeout=4,
        )
    except Exception as e:
        logger.warning("sb_cache SET error: %s", e)


# ── Public cache API ──────────────────────────────────────────────────────────

def _ask_cache_get(key: str) -> dict | None:
    if _redis:
        try:
            raw = _redis.get(key)
            if raw:
                logger.debug("ask_cache HIT (redis) key=%s", key)
                return json.loads(raw)
        except Exception as e:
            logger.warning("ask_cache redis GET error: %s", e)
    sb_hit = _sb_cache_get(key)
    if sb_hit:
        if _redis:
            try:
                _redis.setex(key, _ASK_CACHE_TTL, json.dumps(sb_hit, default=str))
            except Exception:
                pass
        return sb_hit
    return None


def _ask_cache_set(key: str, payload: dict, *,
                   task_type: str | None = None, mode: str = '',
                   book_id: str = '', model_used: str = '') -> None:
    if _redis:
        try:
            _redis.setex(key, _ASK_CACHE_TTL, json.dumps(payload, default=str))
        except Exception as e:
            logger.warning("ask_cache redis SET error: %s", e)
    _sb_cache_set(key, payload, task_type=task_type, mode=mode,
                  book_id=book_id, model_used=model_used)
