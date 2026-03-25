"""
backend/services/embedding_cache.py — Content-hash embedding cache.

Provides batch get/set for embedding vectors keyed by SHA-256 content hashes.
Uses Redis when available; falls back to an in-memory dict otherwise.

Call init(redis) once from server.py to inject the Redis connection.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Module-level state ─────────────────────────────────────────────────────────
_redis = None
_mem_cache: dict[str, list[float]] = {}

_PREFIX = "emb:"
_TTL = 7 * 24 * 3600  # 7 days


def init(redis=None) -> None:
    """Inject the shared Redis connection. Call once at startup."""
    global _redis
    _redis = redis


# ── Helpers ────────────────────────────────────────────────────────────────────

def _content_hash(text: str) -> str:
    """Return a hex SHA-256 hash of *text*."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _redis_key(h: str) -> str:
    return _PREFIX + h


def _encode_vec(vec: list[float]) -> str:
    """Serialize a vector to a compact JSON string for Redis storage."""
    return json.dumps(vec, separators=(",", ":"))


def _decode_vec(raw: str | bytes) -> list[float]:
    """Deserialize a vector stored in Redis."""
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8")
    return json.loads(raw)


# ── Public API ─────────────────────────────────────────────────────────────────

def mget(texts: list[str]) -> list[Optional[list[float]]]:
    """
    Look up cached embeddings for a batch of texts.

    Returns a list of the same length as *texts*.
    Each element is either a cached embedding vector or ``None`` (cache miss).
    """
    hashes = [_content_hash(t) for t in texts]
    results: list[Optional[list[float]]] = [None] * len(texts)

    if _redis is not None:
        try:
            keys = [_redis_key(h) for h in hashes]
            raw_vals = _redis.mget(keys)
            for i, raw in enumerate(raw_vals):
                if raw is not None:
                    results[i] = _decode_vec(raw)
        except Exception as exc:
            logger.warning("embedding_cache mget Redis error: %s", exc)
    else:
        for i, h in enumerate(hashes):
            vec = _mem_cache.get(h)
            if vec is not None:
                results[i] = vec

    return results


def mset(texts: list[str], vectors: list[Optional[list[float]]]) -> None:
    """
    Store embedding vectors in the cache.

    *texts* and *vectors* must have the same length.  Entries where the
    vector is ``None`` are silently skipped.
    """
    if len(texts) != len(vectors):
        return

    pairs: list[tuple[str, list[float]]] = []
    for text, vec in zip(texts, vectors):
        if vec is not None:
            pairs.append((_content_hash(text), vec))

    if not pairs:
        return

    if _redis is not None:
        try:
            pipe = _redis.pipeline(transaction=False)
            for h, vec in pairs:
                pipe.setex(_redis_key(h), _TTL, _encode_vec(vec))
            pipe.execute()
        except Exception as exc:
            logger.warning("embedding_cache mset Redis error: %s", exc)
    else:
        for h, vec in pairs:
            _mem_cache[h] = vec


def get(text: str) -> Optional[list[float]]:
    """Look up a single cached embedding."""
    return mget([text])[0]


def put(text: str, vec: list[float]) -> None:
    """Store a single embedding."""
    mset([text], [vec])
