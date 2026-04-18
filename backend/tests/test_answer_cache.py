"""Tests for the semantic answer cache via services/cache.py (CacheService)
and the ask-query cache key helper (services/ask_cache.py)."""
from __future__ import annotations

import hashlib
import json
import math
from unittest.mock import MagicMock

import pytest

from services.cache import cache_svc, CacheService
from services.ask_cache import _ask_cache_key as _ackey


# ── helpers ────────────────────────────────────────────────────────────────────

def _vec(val: float, dims: int = 8) -> list[float]:
    """Return a simple unit-ish vector for testing."""
    raw = [val] * dims
    norm = math.sqrt(sum(x * x for x in raw))
    return [x / norm for x in raw] if norm else raw


def _payload(answer: str = "Test answer") -> dict:
    return {"success": True, "mode": "study", "answer": answer}


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _reset_module():
    """Reset cache_svc state before every test."""
    cache_svc._redis = None
    cache_svc._sem_mem.clear()
    yield
    cache_svc._redis = None
    cache_svc._sem_mem.clear()


# ── Tests: context_hash ───────────────────────────────────────────────────────

class TestContextHash:
    def test_deterministic(self):
        h1 = cache_svc.context_hash("study", 3, "some context")
        h2 = cache_svc.context_hash("study", 3, "some context")
        assert h1 == h2

    def test_different_mode(self):
        h1 = cache_svc.context_hash("study", 3, "ctx")
        h2 = cache_svc.context_hash("summary", 3, "ctx")
        assert h1 != h2

    def test_different_complexity(self):
        h1 = cache_svc.context_hash("study", 3, "ctx")
        h2 = cache_svc.context_hash("study", 5, "ctx")
        assert h1 != h2

    def test_different_context(self):
        h1 = cache_svc.context_hash("study", 3, "context A")
        h2 = cache_svc.context_hash("study", 3, "context B")
        assert h1 != h2

    def test_returns_32_hex_chars(self):
        h = cache_svc.context_hash("study", 3, "ctx")
        assert len(h) == 32
        assert all(c in "0123456789abcdef" for c in h)


# ── Tests: _cosine_similarity ─────────────────────────────────────────────────

class TestCosineSimilarity:
    def test_identical_vectors(self):
        v = _vec(1.0)
        assert CacheService._cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        assert CacheService._cosine_similarity(a, b) == pytest.approx(0.0)

    def test_opposite_vectors(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert CacheService._cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_zero_vector(self):
        assert CacheService._cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0

    def test_different_length(self):
        assert CacheService._cosine_similarity([1.0], [1.0, 2.0]) == 0.0


# ── Tests: in-memory store & lookup ───────────────────────────────────────────

class TestInMemoryCache:
    def test_store_and_lookup(self):
        emb = _vec(1.0)
        payload = _payload("Water is H2O.")
        ctx = cache_svc.context_hash("study", 3, "context")

        cache_svc.semantic_store(emb, ctx, payload)
        result = cache_svc.semantic_lookup(emb, ctx)
        assert result is not None
        assert result["answer"] == "Water is H2O."

    def test_miss_on_empty_cache(self):
        emb = _vec(1.0)
        ctx = cache_svc.context_hash("study", 3, "ctx")
        assert cache_svc.semantic_lookup(emb, ctx) is None

    def test_miss_on_different_context(self):
        emb = _vec(1.0)
        ctx1 = cache_svc.context_hash("study", 3, "context A")
        ctx2 = cache_svc.context_hash("study", 3, "context B")

        cache_svc.semantic_store(emb, ctx1, _payload())
        assert cache_svc.semantic_lookup(emb, ctx2) is None

    def test_miss_on_dissimilar_embedding(self):
        emb1 = [1.0, 0.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0, 0.0]
        ctx = cache_svc.context_hash("study", 3, "ctx")

        cache_svc.semantic_store(emb1, ctx, _payload())
        assert cache_svc.semantic_lookup(emb2, ctx) is None

    def test_hit_on_similar_embedding(self):
        emb1 = _vec(1.0, dims=16)
        # Slightly perturbed version — still very similar
        emb2 = [x + 0.001 for x in emb1]
        ctx = cache_svc.context_hash("study", 3, "ctx")

        cache_svc.semantic_store(emb1, ctx, _payload("original"))
        result = cache_svc.semantic_lookup(emb2, ctx)
        assert result is not None
        assert result["answer"] == "original"

    def test_duplicate_update(self):
        """Storing a near-duplicate embedding updates the answer."""
        emb = _vec(1.0)
        ctx = cache_svc.context_hash("study", 3, "ctx")

        cache_svc.semantic_store(emb, ctx, _payload("first"))
        cache_svc.semantic_store(emb, ctx, _payload("second"))

        result = cache_svc.semantic_lookup(emb, ctx)
        assert result["answer"] == "second"
        # Should still be one entry, not two
        entries = cache_svc._sem_load(ctx)
        assert len(entries) == 1

    def test_max_entries_cap(self):
        ctx = cache_svc.context_hash("study", 3, "ctx")
        for i in range(cache_svc._MAX_ENTRIES_PER_CTX + 5):
            # Each embedding is orthogonal (different dimension hot)
            emb = [0.0] * (cache_svc._MAX_ENTRIES_PER_CTX + 5)
            emb[i] = 1.0
            cache_svc.semantic_store(emb, ctx, _payload(f"answer-{i}"))

        entries = cache_svc._sem_load(ctx)
        assert len(entries) <= cache_svc._MAX_ENTRIES_PER_CTX

    def test_custom_threshold(self):
        emb1 = _vec(1.0, dims=16)
        # Perturb a single element to change direction
        emb2 = list(emb1)
        emb2[0] += 0.3
        ctx = cache_svc.context_hash("study", 3, "ctx")

        cache_svc.semantic_store(emb1, ctx, _payload("answer"))
        # High threshold => miss (vectors differ in direction)
        assert cache_svc.semantic_lookup(emb2, ctx, threshold=0.9999) is None
        # Low threshold => hit
        result = cache_svc.semantic_lookup(emb2, ctx, threshold=0.90)
        assert result is not None


# ── Tests: Redis-backed store ─────────────────────────────────────────────────

class TestRedisCache:
    @pytest.fixture(autouse=True)
    def _setup_redis_mock(self):
        self.store: dict[str, str] = {}
        self.mock_redis = MagicMock()

        def mock_get(key):
            return self.store.get(key)

        def mock_setex(key, ttl, value):
            self.store[key] = value

        self.mock_redis.get.side_effect = mock_get
        self.mock_redis.setex.side_effect = mock_setex

        cache_svc._redis = self.mock_redis
        yield
        cache_svc._redis = None

    def test_store_and_lookup_via_redis(self):
        emb = _vec(1.0)
        ctx = cache_svc.context_hash("study", 3, "ctx")

        cache_svc.semantic_store(emb, ctx, _payload("redis answer"))
        result = cache_svc.semantic_lookup(emb, ctx)
        assert result is not None
        assert result["answer"] == "redis answer"

    def test_uses_ttl(self):
        emb = _vec(1.0)
        ctx = cache_svc.context_hash("study", 3, "ctx")

        cache_svc.semantic_store(emb, ctx, _payload())
        call_args = self.mock_redis.setex.call_args
        assert call_args[0][1] == cache_svc.DEFAULT_TTL['answer']

    def test_redis_key_prefix(self):
        emb = _vec(1.0)
        ctx = cache_svc.context_hash("study", 3, "ctx")

        cache_svc.semantic_store(emb, ctx, _payload())
        stored_key = self.mock_redis.setex.call_args[0][0]
        assert stored_key.startswith(cache_svc.KEY_PREFIX['answer'])

    def test_redis_error_falls_through(self):
        """Redis errors are logged and don't raise."""
        self.mock_redis.get.side_effect = Exception("Redis down")
        emb = _vec(1.0)
        ctx = cache_svc.context_hash("study", 3, "ctx")
        # Should return None, not raise
        assert cache_svc.semantic_lookup(emb, ctx) is None

    def test_redis_set_error_is_silent(self):
        """Redis write errors are logged and don't raise."""
        self.mock_redis.setex.side_effect = Exception("Redis down")
        emb = _vec(1.0)
        ctx = cache_svc.context_hash("study", 3, "ctx")
        # Should not raise
        cache_svc.semantic_store(emb, ctx, _payload())


# ── Tests: init ───────────────────────────────────────────────────────────────

class TestInit:
    def test_init_none(self):
        cache_svc._redis = None
        assert cache_svc._redis is None

    def test_init_sets_redis(self):
        mock = MagicMock()
        cache_svc._redis = mock
        assert cache_svc._redis is mock
        cache_svc._redis = None


# ── Tests: _ask_cache_key (services/ask_cache.py) ────────────────────────────


_KEY_DEFAULTS = dict(
    book_id="zumdahl",
    task_type=None,
    mode="study",
    complexity=5,
    question="What is entropy?",
)


class TestAskCacheKey:
    def test_same_question_same_profile_yields_same_key(self):
        k1 = _ackey(**_KEY_DEFAULTS, student_profile='{"status":"failing"}')
        k2 = _ackey(**_KEY_DEFAULTS, student_profile='{"status":"failing"}')
        assert k1 == k2

    def test_same_question_different_profile_yields_different_key(self):
        k1 = _ackey(**_KEY_DEFAULTS, student_profile='{"status":"failing"}')
        k2 = _ackey(**_KEY_DEFAULTS, student_profile='{"status":"mastered"}')
        assert k1 != k2

    def test_same_question_empty_profile_on_both_yields_same_key(self):
        k1 = _ackey(**_KEY_DEFAULTS, student_profile='')
        k2 = _ackey(**_KEY_DEFAULTS, student_profile='')
        assert k1 == k2

    def test_profile_whitespace_normalised_to_same_key(self):
        k1 = _ackey(**_KEY_DEFAULTS, student_profile='{"status":"failing"}')
        k2 = _ackey(**_KEY_DEFAULTS, student_profile='  {"status":"failing"}  ')
        assert k1 == k2

    def test_key_prefix(self):
        assert _ackey(**_KEY_DEFAULTS).startswith("ask:v1:")

    def test_key_digest_length(self):
        key = _ackey(**_KEY_DEFAULTS)
        # "ask:v1:" is 7 chars; digest must be 16 hex chars
        assert len(key) == 7 + 16

    def test_empty_profile_differs_from_nonempty_profile(self):
        k_empty = _ackey(**_KEY_DEFAULTS, student_profile='')
        k_filled = _ackey(**_KEY_DEFAULTS, student_profile='{"status":"failing"}')
        assert k_empty != k_filled

