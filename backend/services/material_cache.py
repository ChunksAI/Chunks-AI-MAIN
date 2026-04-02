"""
backend/services/material_cache.py — Redis-backed cache for study materials.

Extracted from server.py to break the circular import between server.py and
the route files that previously did ``from server import _cache_key, ...``.

Call ``init(redis)`` once from server.py before registering routers.
"""
from __future__ import annotations

import json
import logging
import re

logger = logging.getLogger(__name__)

_MATERIAL_CACHE_TTL = 86400          # 24 hours

_redis = None


def init(redis=None) -> None:
    """Inject the Redis client. Call once from server.py at startup."""
    global _redis
    _redis = redis


def _cache_key(book_id: str, topic: str, mtype: str, count: int) -> str:
    norm = re.sub(r'[^a-z0-9]', '_', topic.lower().strip())[:60]
    return f"{mtype}:{book_id}:{norm}:{count}"


def _cache_get(key: str):
    if _redis is None:
        return None
    try:
        raw = _redis.get(key)
        if raw is not None:
            return json.loads(raw)
    except Exception as exc:
        logger.warning("material_cache GET error: %s", exc)
    return None


def _cache_set(key: str, value) -> None:
    if _redis is None:
        return
    try:
        _redis.setex(key, _MATERIAL_CACHE_TTL, json.dumps(value, default=str))
    except Exception as exc:
        logger.warning("material_cache SET error: %s", exc)
