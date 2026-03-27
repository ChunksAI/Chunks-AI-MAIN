"""
backend/services/share_store.py — Shareable-link storage.

Stores and retrieves share records for flashcard decks, exams, and
study plans.  Each record is keyed by a random UUID and serialised
as JSON.

Storage back-end
----------------
* Redis   — when ``init(redis=...)`` receives a non-None client.
* In-memory dict — fallback for local dev / missing Redis.

TTL: 90 days (records expire automatically; no active cleanup needed).

Public API
----------
create_share(share_type, data, user_id='')  → share_id (str)
get_share(share_id)                         → dict | None
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# ── Module-level state ─────────────────────────────────────────────────────────
_redis = None
_mem_store: dict[str, str] = {}   # share_id → JSON string

_PREFIX = "share:"
_TTL = 90 * 24 * 3600   # 90 days in seconds

VALID_TYPES = frozenset({"deck", "exam", "plan"})


def init(redis=None) -> None:
    """Inject the shared Redis connection.  Call once at startup."""
    global _redis
    _redis = redis


# ── Helpers ────────────────────────────────────────────────────────────────────

def _redis_key(share_id: str) -> str:
    return _PREFIX + share_id


def _load(share_id: str) -> dict | None:
    if _redis is not None:
        try:
            raw = _redis.get(_redis_key(share_id))
            if raw:
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8")
                return json.loads(raw)
        except Exception as exc:
            logger.warning("share_store Redis GET error: %s", exc)
    raw = _mem_store.get(share_id)
    if raw:
        return json.loads(raw)
    return None


def _save(share_id: str, record: dict) -> None:
    payload = json.dumps(record, separators=(",", ":"), default=str)
    if _redis is not None:
        try:
            _redis.setex(_redis_key(share_id), _TTL, payload)
            return
        except Exception as exc:
            logger.warning("share_store Redis SET error: %s", exc)
    _mem_store[share_id] = payload


# ── Public API ─────────────────────────────────────────────────────────────────

def create_share(share_type: str, data: Any, user_id: str = "") -> str:
    """Persist a share record and return its unique ID.

    Parameters
    ----------
    share_type : str
        One of ``'deck'``, ``'exam'``, ``'plan'``.
    data : Any
        JSON-serialisable payload (the full data needed to render the page).
    user_id : str
        Optional — the authenticated user who created the share.

    Returns
    -------
    str
        A 32-character hex share ID (UUID4 without dashes).
    """
    if share_type not in VALID_TYPES:
        raise ValueError(f"Invalid share_type: {share_type!r}")

    share_id = uuid.uuid4().hex          # 32 hex chars
    record = {
        "share_id":   share_id,
        "type":       share_type,
        "data":       data,
        "user_id":    user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save(share_id, record)
    logger.info("share_store CREATE type=%s id=%s", share_type, share_id)
    return share_id


def get_share(share_id: str) -> dict | None:
    """Retrieve a share record by ID.

    Returns the full record dict, or ``None`` if not found / expired.
    """
    if not share_id or len(share_id) > 64:
        return None
    record = _load(share_id)
    if record:
        logger.debug("share_store GET hit id=%s", share_id)
    else:
        logger.debug("share_store GET miss id=%s", share_id)
    return record
