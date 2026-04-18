"""
backend/services/cache.py — Unified cache service for AI response caching.

Merges three previously separate cache modules into one:
  - ask_cache.py      → namespace 'ask'    (Redis + Supabase, key prefix 'ask:')
  - material_cache.py → namespace 'material' (Redis only,       key prefix 'mat:')
  - answer_cache.py   → semantic cache     (Redis + in-memory,  key prefix 'ans:')

The embedding_cache is kept separate — it stores float vectors rather than
JSON strings and has a fundamentally different access pattern.

Usage::

    from services.cache import cache_svc

    # Simple key-value cache
    val  = cache_svc.get('material', key)
    cache_svc.set('material', key, payload)
    cache_svc.delete('material', key)

    # Ask cache (Redis + Supabase, key construction + cacheability check)
    key  = cache_svc.ask_key(book_id, task_type, mode, complexity, question)
    if cache_svc.ask_is_cacheable(mode, history, web_search, thinking_mode):
        hit = cache_svc.ask_get(key)
    cache_svc.ask_set(key, payload, task_type=..., mode=..., book_id=..., model_used=...)

    # Semantic / answer cache
    ctx = cache_svc.context_hash(mode, complexity, context_text)
    hit = cache_svc.semantic_lookup(query_embedding, ctx)
    cache_svc.semantic_store(query_embedding, ctx, answer_payload)

Initialise once at startup (server.py)::

    from services.cache import cache_svc
    cache_svc.init(
        redis=_redis,
        session=_session,
        supabase_url=SUPABASE_URL,
        supabase_service_key=SUPABASE_SERVICE_KEY,
    )
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import re
from typing import Optional

logger = logging.getLogger(__name__)


class CacheService:
    """Single cache service covering ask, material, and semantic answer caches."""

    # Redis key prefix per namespace
    KEY_PREFIX: dict[str, str] = {
        'answer':   'ans:',
        'ask':      'ask:',
        'material': 'mat:',
    }

    # Default TTL in seconds per namespace
    DEFAULT_TTL: dict[str, int] = {
        'answer':   3600,    # 1 h  (semantic cache)
        'ask':      3600,    # 1 h  (Redis layer; Supabase layer uses 7 days)
        'material': 86400,   # 24 h (study materials and flashcards)
    }

    # Modes eligible for ask-cache hits
    _ASK_CACHEABLE_MODES = frozenset([
        # Legacy modes (kept for backward compat)
        'study', 'summary', 'general', 'concise', 'detailed', 'generate',
        # Current production modes
        'snap', 'chunk', 'master', 'research',
    ])
    _SB_CACHE_TTL_DAYS = 7

    # Semantic-cache thresholds
    _SIMILARITY_THRESHOLD = 0.97
    _DEDUP_THRESHOLD = 0.99
    _MAX_ENTRIES_PER_CTX = 20

    def __init__(self) -> None:
        self._redis = None
        self._session = None
        self._supabase_url: str = ''
        self._supabase_service_key: str = ''

        # In-memory fallback for semantic cache when Redis is unavailable
        # context_hash → list of {emb, ans} dicts
        self._sem_mem: dict[str, list[dict]] = {}

    # ── Initialisation ────────────────────────────────────────────────────────

    def init(
        self,
        redis=None,
        session=None,
        supabase_url: str = '',
        supabase_service_key: str = '',
    ) -> None:
        """Inject shared dependencies. Call once from server.py at startup."""
        self._redis = redis
        self._session = session
        self._supabase_url = supabase_url
        self._supabase_service_key = supabase_service_key

    # ── Generic key-value interface ───────────────────────────────────────────

    def get(self, namespace: str, key: str) -> dict | None:
        """Fetch a cached JSON value from Redis.

        Returns the deserialised dict, or ``None`` on miss or Redis error.
        """
        if self._redis is None:
            return None
        try:
            raw = self._redis.get(key)
            if raw is not None:
                return json.loads(raw)
        except Exception as exc:
            logger.warning("cache.get [%s] error: %s", namespace, exc)
        return None

    def set(
        self,
        namespace: str,
        key: str,
        value: dict,
        ttl: int | None = None,
    ) -> None:
        """Store a JSON-serialisable value in Redis with an optional TTL.

        If ``ttl`` is ``None`` the namespace default from ``DEFAULT_TTL`` is used.
        """
        if self._redis is None:
            return
        effective_ttl = ttl if ttl is not None else self.DEFAULT_TTL.get(namespace, 3600)
        try:
            self._redis.setex(key, effective_ttl, json.dumps(value, default=str))
        except Exception as exc:
            logger.warning("cache.set [%s] error: %s", namespace, exc)

    def delete(self, namespace: str, key: str) -> None:
        """Delete a cached entry from Redis."""
        if self._redis is None:
            return
        try:
            self._redis.delete(key)
        except Exception as exc:
            logger.warning("cache.delete [%s] error: %s", namespace, exc)

    # ── Ask-cache helpers ─────────────────────────────────────────────────────

    def ask_key(
        self,
        book_id: str | None,
        task_type: str | None,
        mode: str,
        complexity: int,
        question: str,
        doc_context: str = '',
        student_profile: str = '',
    ) -> str:
        """Build a stable Redis key for an /ask request."""
        canonical = (
            f"{book_id}|{task_type or mode}|{complexity}"
            f"|{question.strip().lower()}"
        )
        if doc_context:
            ctx_hash   = hashlib.sha256(doc_context.encode()).hexdigest()[:12]
            canonical += f"|ctx:{ctx_hash}"
        if student_profile:
            sp_hash    = hashlib.sha256(student_profile.strip().lower().encode()).hexdigest()[:12]
            canonical += f"|sp:{sp_hash}"
        digest = hashlib.sha256(canonical.encode()).hexdigest()[:16]
        return f"ask:v1:{digest}"

    def ask_is_cacheable(
        self,
        mode: str,
        history: list,
        web_search: bool,
        thinking_mode: str | None,
    ) -> bool:
        """Return True when an /ask response is eligible for caching."""
        return (
            mode in self._ASK_CACHEABLE_MODES
            and not history
            and not web_search
            and not thinking_mode
        )

    def ask_get(self, key: str) -> dict | None:
        """Retrieve an /ask response from Redis, with Supabase fallback."""
        if self._redis:
            try:
                raw = self._redis.get(key)
                if raw:
                    logger.debug("ask_cache HIT (redis) key=%s", key)
                    return json.loads(raw)
            except Exception as exc:
                logger.warning("cache.ask_get redis error: %s", exc)

        sb_hit = self._sb_cache_get(key)
        if sb_hit:
            # Warm Redis from Supabase
            if self._redis:
                try:
                    self._redis.setex(
                        key,
                        self.DEFAULT_TTL['ask'],
                        json.dumps(sb_hit, default=str),
                    )
                except Exception:
                    pass
            return sb_hit
        return None

    def ask_set(
        self,
        key: str,
        payload: dict,
        *,
        task_type: str | None = None,
        mode: str = '',
        book_id: str = '',
        model_used: str = '',
    ) -> None:
        """Persist an /ask response to Redis and Supabase."""
        if self._redis:
            try:
                self._redis.setex(
                    key,
                    self.DEFAULT_TTL['ask'],
                    json.dumps(payload, default=str),
                )
            except Exception as exc:
                logger.warning("cache.ask_set redis error: %s", exc)
        self._sb_cache_set(
            key, payload,
            task_type=task_type, mode=mode,
            book_id=book_id, model_used=model_used,
        )

    # ── Material-cache helpers ────────────────────────────────────────────────

    def material_key(
        self,
        book_id: str,
        topic: str,
        mtype: str,
        count: int,
    ) -> str:
        """Build a Redis key for study-material / flashcard cache entries."""
        norm = re.sub(r'[^a-z0-9]', '_', topic.lower().strip())[:60]
        return f"{mtype}:{book_id}:{norm}:{count}"

    # ── Semantic / answer-cache helpers ───────────────────────────────────────

    @staticmethod
    def context_hash(mode: str, complexity: int, context_text: str) -> str:
        """Compute a stable hash over mode + complexity + retrieved context.

        Returns the first 32 hex chars of the SHA-256 digest.
        """
        canonical = f"{mode}|{complexity}|{context_text}"
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()[:32]

    def semantic_lookup(
        self,
        query_embedding: list[float],
        ctx_hash: str,
        threshold: float | None = None,
    ) -> Optional[dict]:
        """Find a cached answer for a semantically similar query.

        Returns the cached answer payload dict, or ``None`` on miss.
        """
        if threshold is None:
            threshold = self._SIMILARITY_THRESHOLD
        entries = self._sem_load(ctx_hash)
        if not entries:
            return None

        best_score = 0.0
        best_answer: Optional[dict] = None
        for entry in entries:
            emb = entry.get('emb')
            if emb is None:
                continue
            score = self._cosine_similarity(query_embedding, emb)
            if score >= threshold and score > best_score:
                best_score = score
                best_answer = entry.get('ans')

        if best_answer is not None:
            logger.info(
                "semantic cache HIT (score=%.4f, ctx=%s…)", best_score, ctx_hash[:12]
            )
        return best_answer

    def semantic_store(
        self,
        query_embedding: list[float],
        ctx_hash: str,
        answer_payload: dict,
    ) -> None:
        """Store a query embedding and its answer for future semantic look-ups."""
        compact_emb = [round(x, 6) for x in query_embedding]
        entries = self._sem_load(ctx_hash)

        # Avoid duplicates: update near-identical embeddings in place
        for entry in entries:
            emb = entry.get('emb')
            if emb and self._cosine_similarity(compact_emb, emb) >= self._DEDUP_THRESHOLD:
                entry['ans'] = answer_payload
                self._sem_save(ctx_hash, entries)
                return

        entries.append({'emb': compact_emb, 'ans': answer_payload})
        if len(entries) > self._MAX_ENTRIES_PER_CTX:
            entries = entries[-self._MAX_ENTRIES_PER_CTX:]

        self._sem_save(ctx_hash, entries)
        logger.debug(
            "semantic cache STORE (ctx=%s…, entries=%d)", ctx_hash[:12], len(entries)
        )

    # ── Supabase helpers (ask-cache only) ─────────────────────────────────────

    def _sb_headers(self) -> dict:
        return {
            'Authorization': f'Bearer {self._supabase_service_key}',
            'apikey':        self._supabase_service_key,
            'Content-Type':  'application/json',
            'Prefer':        'return=minimal',
        }

    def _sb_cache_get(self, key: str) -> dict | None:
        if not self._supabase_url or not self._supabase_service_key or self._session is None:
            return None
        try:
            import datetime
            resp = self._session.get(
                f'{self._supabase_url}/rest/v1/query_cache',
                params={
                    'cache_key': f'eq.{key}',
                    'expires_at': f'gt.{datetime.datetime.now(datetime.timezone.utc).isoformat()}',
                    'select':    'answer',
                    'limit':     '1',
                },
                headers=self._sb_headers(),
                timeout=3,
            )
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    try:
                        self._session.post(
                            f'{self._supabase_url}/rest/v1/rpc/increment_cache_hit',
                            json={'p_cache_key': key},
                            headers=self._sb_headers(),
                            timeout=2,
                        )
                    except Exception:
                        pass
                    logger.debug('ask_cache HIT (supabase) key=%s', key)
                    return rows[0]['answer']
        except Exception as exc:
            logger.warning('cache._sb_cache_get error: %s', exc)
        return None

    def _sb_cache_set(
        self,
        key: str,
        payload: dict,
        *,
        task_type: str | None,
        mode: str,
        book_id: str,
        model_used: str,
    ) -> None:
        if not self._supabase_url or not self._supabase_service_key or self._session is None:
            return
        try:
            import datetime
            expires = (
                datetime.datetime.now(datetime.timezone.utc)
                + datetime.timedelta(days=self._SB_CACHE_TTL_DAYS)
            ).isoformat()
            self._session.post(
                f'{self._supabase_url}/rest/v1/query_cache',
                json={
                    'cache_key':  key,
                    'answer':     payload,
                    'task_type':  task_type,
                    'mode':       mode,
                    'book_id':    book_id,
                    'model_used': model_used,
                    'expires_at': expires,
                },
                headers={
                    **self._sb_headers(),
                    'Prefer': 'resolution=merge-duplicates,return=minimal',
                },
                timeout=4,
            )
        except Exception as exc:
            logger.warning('cache._sb_cache_set error: %s', exc)

    # ── Semantic cache storage helpers ────────────────────────────────────────

    def _sem_redis_key(self, ctx_hash: str) -> str:
        return self.KEY_PREFIX['answer'] + ctx_hash

    def _sem_load(self, ctx_hash: str) -> list[dict]:
        if self._redis is not None:
            try:
                raw = self._redis.get(self._sem_redis_key(ctx_hash))
                if raw:
                    if isinstance(raw, bytes):
                        raw = raw.decode('utf-8')
                    return json.loads(raw)
            except Exception as exc:
                logger.warning('cache._sem_load redis error: %s', exc)
        return list(self._sem_mem.get(ctx_hash, []))

    def _sem_save(self, ctx_hash: str, entries: list[dict]) -> None:
        if self._redis is not None:
            try:
                payload = json.dumps(entries, separators=(',', ':'), default=str)
                self._redis.setex(
                    self._sem_redis_key(ctx_hash),
                    self.DEFAULT_TTL['answer'],
                    payload,
                )
            except Exception as exc:
                logger.warning('cache._sem_save redis error: %s', exc)
        else:
            self._sem_mem[ctx_hash] = entries

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        if len(a) != len(b):
            return 0.0
        dot    = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return dot / (norm_a * norm_b)


# ── Module-level singleton ────────────────────────────────────────────────────

cache_svc = CacheService()


def init(
    redis=None,
    session=None,
    supabase_url: str = '',
    supabase_service_key: str = '',
) -> None:
    """Convenience wrapper around ``cache_svc.init()``.

    Call once from server.py at startup::

        from services.cache import init as init_cache
        init_cache(redis=_redis, session=_session, ...)
    """
    cache_svc.init(
        redis=redis,
        session=session,
        supabase_url=supabase_url,
        supabase_service_key=supabase_service_key,
    )
