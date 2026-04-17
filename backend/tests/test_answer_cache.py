"""Tests for the semantic answer cache (services/answer_cache.py)
and the ask-query cache key helper (services/ask_cache.py)."""
from __future__ import annotations

import hashlib
import json
import math
from unittest.mock import MagicMock

import pytest

import services.answer_cache as cache
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
    """Reset module state before every test."""
    cache._redis = None
    cache._mem_store.clear()
    yield
    cache._redis = None
    cache._mem_store.clear()


# ── Tests: context_hash ───────────────────────────────────────────────────────

class TestContextHash:
    def test_deterministic(self):
        h1 = cache.context_hash("study", 3, "some context")
        h2 = cache.context_hash("study", 3, "some context")
        assert h1 == h2

    def test_different_mode(self):
        h1 = cache.context_hash("study", 3, "ctx")
        h2 = cache.context_hash("summary", 3, "ctx")
        assert h1 != h2

    def test_different_complexity(self):
        h1 = cache.context_hash("study", 3, "ctx")
        h2 = cache.context_hash("study", 5, "ctx")
        assert h1 != h2

    def test_different_context(self):
        h1 = cache.context_hash("study", 3, "context A")
        h2 = cache.context_hash("study", 3, "context B")
        assert h1 != h2

    def test_returns_32_hex_chars(self):
        h = cache.context_hash("study", 3, "ctx")
        assert len(h) == 32
        assert all(c in "0123456789abcdef" for c in h)


# ── Tests: _cosine_similarity ─────────────────────────────────────────────────

class TestCosineSimilarity:
    def test_identical_vectors(self):
        v = _vec(1.0)
        assert cache._cosine_similarity(v, v) == pytest.approx(1.0)

    def test_orthogonal_vectors(self):
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        assert cache._cosine_similarity(a, b) == pytest.approx(0.0)

    def test_opposite_vectors(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert cache._cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_zero_vector(self):
        assert cache._cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0

    def test_different_length(self):
        assert cache._cosine_similarity([1.0], [1.0, 2.0]) == 0.0


# ── Tests: in-memory store & lookup ───────────────────────────────────────────

class TestInMemoryCache:
    def test_store_and_lookup(self):
        emb = _vec(1.0)
        payload = _payload("Water is H2O.")
        ctx = cache.context_hash("study", 3, "context")

        cache.store(emb, ctx, payload)
        result = cache.lookup(emb, ctx)
        assert result is not None
        assert result["answer"] == "Water is H2O."

    def test_miss_on_empty_cache(self):
        emb = _vec(1.0)
        ctx = cache.context_hash("study", 3, "ctx")
        assert cache.lookup(emb, ctx) is None

    def test_miss_on_different_context(self):
        emb = _vec(1.0)
        ctx1 = cache.context_hash("study", 3, "context A")
        ctx2 = cache.context_hash("study", 3, "context B")

        cache.store(emb, ctx1, _payload())
        assert cache.lookup(emb, ctx2) is None

    def test_miss_on_dissimilar_embedding(self):
        emb1 = [1.0, 0.0, 0.0, 0.0]
        emb2 = [0.0, 1.0, 0.0, 0.0]
        ctx = cache.context_hash("study", 3, "ctx")

        cache.store(emb1, ctx, _payload())
        assert cache.lookup(emb2, ctx) is None

    def test_hit_on_similar_embedding(self):
        emb1 = _vec(1.0, dims=16)
        # Slightly perturbed version — still very similar
        emb2 = [x + 0.001 for x in emb1]
        ctx = cache.context_hash("study", 3, "ctx")

        cache.store(emb1, ctx, _payload("original"))
        result = cache.lookup(emb2, ctx)
        assert result is not None
        assert result["answer"] == "original"

    def test_duplicate_update(self):
        """Storing a near-duplicate embedding updates the answer."""
        emb = _vec(1.0)
        ctx = cache.context_hash("study", 3, "ctx")

        cache.store(emb, ctx, _payload("first"))
        cache.store(emb, ctx, _payload("second"))

        result = cache.lookup(emb, ctx)
        assert result["answer"] == "second"
        # Should still be one entry, not two
        entries = cache._load_entries(ctx)
        assert len(entries) == 1

    def test_max_entries_cap(self):
        ctx = cache.context_hash("study", 3, "ctx")
        for i in range(cache._MAX_ENTRIES + 5):
            # Each embedding is orthogonal (different dimension hot)
            emb = [0.0] * (cache._MAX_ENTRIES + 5)
            emb[i] = 1.0
            cache.store(emb, ctx, _payload(f"answer-{i}"))

        entries = cache._load_entries(ctx)
        assert len(entries) <= cache._MAX_ENTRIES

    def test_custom_threshold(self):
        emb1 = _vec(1.0, dims=16)
        # Perturb a single element to change direction
        emb2 = list(emb1)
        emb2[0] += 0.3
        ctx = cache.context_hash("study", 3, "ctx")

        cache.store(emb1, ctx, _payload("answer"))
        # High threshold => miss (vectors differ in direction)
        assert cache.lookup(emb2, ctx, threshold=0.9999) is None
        # Low threshold => hit
        result = cache.lookup(emb2, ctx, threshold=0.90)
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

        cache.init(redis=self.mock_redis)
        yield

    def test_store_and_lookup_via_redis(self):
        emb = _vec(1.0)
        ctx = cache.context_hash("study", 3, "ctx")

        cache.store(emb, ctx, _payload("redis answer"))
        result = cache.lookup(emb, ctx)
        assert result is not None
        assert result["answer"] == "redis answer"

    def test_uses_ttl(self):
        emb = _vec(1.0)
        ctx = cache.context_hash("study", 3, "ctx")

        cache.store(emb, ctx, _payload())
        call_args = self.mock_redis.setex.call_args
        assert call_args[0][1] == cache._TTL

    def test_redis_key_prefix(self):
        emb = _vec(1.0)
        ctx = cache.context_hash("study", 3, "ctx")

        cache.store(emb, ctx, _payload())
        stored_key = self.mock_redis.setex.call_args[0][0]
        assert stored_key.startswith(cache._PREFIX)

    def test_redis_error_falls_through(self):
        """Redis errors are logged and don't raise."""
        self.mock_redis.get.side_effect = Exception("Redis down")
        emb = _vec(1.0)
        ctx = cache.context_hash("study", 3, "ctx")
        # Should return None, not raise
        assert cache.lookup(emb, ctx) is None

    def test_redis_set_error_is_silent(self):
        """Redis write errors are logged and don't raise."""
        self.mock_redis.setex.side_effect = Exception("Redis down")
        emb = _vec(1.0)
        ctx = cache.context_hash("study", 3, "ctx")
        # Should not raise
        cache.store(emb, ctx, _payload())


# ── Tests: init ───────────────────────────────────────────────────────────────

class TestInit:
    def test_init_none(self):
        cache.init(redis=None)
        assert cache._redis is None

    def test_init_sets_redis(self):
        mock = MagicMock()
        cache.init(redis=mock)
        assert cache._redis is mock


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

