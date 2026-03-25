"""
backend/services/answer_cache.py — Semantic answer cache.

Caches full AI answers keyed by (query_embedding, context_hash).
A cache hit requires cosine similarity >= threshold AND an exact
context-hash match.

Uses Redis when available; falls back to an in-memory dict otherwise.
Call ``init(redis)`` once from server.py to inject the Redis connection.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
from typing import Optional

logger = logging.getLogger(__name__)

# ── Module-level state ─────────────────────────────────────────────────────────
_redis = None
_mem_store: dict[str, list[dict]] = {}   # context_hash → [{emb, ans}]

_PREFIX = "semcache:"
_TTL = 3600              # 1 hour  (matches _ASK_CACHE_TTL)
_SIMILARITY_THRESHOLD = 0.97   # high — only near-duplicate queries
_MAX_ENTRIES = 20        # max entries per context hash


def init(redis=None) -> None:
    """Inject the shared Redis connection.  Call once at startup."""
    global _redis
    _redis = redis


# ── Helpers ────────────────────────────────────────────────────────────────────

def context_hash(mode: str, complexity: int, context_text: str) -> str:
    """Compute a stable hash over mode + complexity + retrieved context."""
    canonical = f"{mode}|{complexity}|{context_text}"
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:32]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors (pure Python)."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


def _redis_key(ctx_hash: str) -> str:
    return _PREFIX + ctx_hash


def _load_entries(ctx_hash: str) -> list[dict]:
    """Load cached entries for a given context hash."""
    if _redis is not None:
        try:
            raw = _redis.get(_redis_key(ctx_hash))
            if raw:
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8")
                return json.loads(raw)
        except Exception as exc:
            logger.warning("answer_cache load Redis error: %s", exc)
    return list(_mem_store.get(ctx_hash, []))


def _save_entries(ctx_hash: str, entries: list[dict]) -> None:
    """Persist entries for a given context hash."""
    if _redis is not None:
        try:
            payload = json.dumps(entries, separators=(",", ":"), default=str)
            _redis.setex(_redis_key(ctx_hash), _TTL, payload)
        except Exception as exc:
            logger.warning("answer_cache save Redis error: %s", exc)
    else:
        _mem_store[ctx_hash] = entries


# ── Public API ─────────────────────────────────────────────────────────────────

def lookup(
    query_embedding: list[float],
    ctx_hash: str,
    threshold: float = _SIMILARITY_THRESHOLD,
) -> Optional[dict]:
    """
    Find a cached answer for a semantically similar query with the same context.

    Returns the cached answer payload dict, or ``None`` on cache miss.
    """
    entries = _load_entries(ctx_hash)
    if not entries:
        return None

    best_score = 0.0
    best_answer: Optional[dict] = None
    for entry in entries:
        emb = entry.get("emb")
        if emb is None:
            continue
        score = _cosine_similarity(query_embedding, emb)
        if score >= threshold and score > best_score:
            best_score = score
            best_answer = entry.get("ans")

    if best_answer is not None:
        logger.info(
            "semantic cache HIT (score=%.4f, ctx=%s…)", best_score, ctx_hash[:12]
        )
    return best_answer


def store(
    query_embedding: list[float],
    ctx_hash: str,
    answer_payload: dict,
) -> None:
    """
    Store a query embedding and its answer for future semantic look-ups.
    """
    # Round embedding floats for compact storage
    compact_emb = [round(x, 6) for x in query_embedding]

    entries = _load_entries(ctx_hash)

    # Avoid duplicates: if a near-identical embedding already exists, update it
    for entry in entries:
        emb = entry.get("emb")
        if emb and _cosine_similarity(compact_emb, emb) >= 0.99:
            entry["ans"] = answer_payload
            _save_entries(ctx_hash, entries)
            return

    # Append new entry; trim to cap
    entries.append({"emb": compact_emb, "ans": answer_payload})
    if len(entries) > _MAX_ENTRIES:
        entries = entries[-_MAX_ENTRIES:]

    _save_entries(ctx_hash, entries)
    logger.debug(
        "semantic cache STORE (ctx=%s…, entries=%d)", ctx_hash[:12], len(entries)
    )
