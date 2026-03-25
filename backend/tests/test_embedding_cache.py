"""Tests for the embedding_cache service module."""
from __future__ import annotations

import hashlib
import json
import sys
import os
from unittest.mock import MagicMock, patch, call

import pytest

# Ensure backend is on the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import services.embedding_cache as cache


# ── Helpers ────────────────────────────────────────────────────────────────────

def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@pytest.fixture(autouse=True)
def _reset_cache():
    """Ensure each test starts with a clean in-memory cache and no Redis."""
    cache._redis = None
    cache._mem_cache.clear()
    yield
    cache._redis = None
    cache._mem_cache.clear()


# ── In-memory (no Redis) ──────────────────────────────────────────────────────

class TestInMemoryCache:
    def test_mget_empty_returns_nones(self):
        result = cache.mget(["hello", "world"])
        assert result == [None, None]

    def test_mset_then_mget(self):
        texts = ["alpha", "beta"]
        vecs = [[0.1, 0.2], [0.3, 0.4]]

        cache.mset(texts, vecs)
        result = cache.mget(texts)

        assert result == vecs

    def test_mset_skips_none_vectors(self):
        cache.mset(["a", "b"], [None, [1.0, 2.0]])
        assert cache.mget(["a"])[0] is None
        assert cache.mget(["b"])[0] == [1.0, 2.0]

    def test_mset_length_mismatch_is_noop(self):
        cache.mset(["a"], [[1.0], [2.0]])  # length mismatch
        assert cache.mget(["a"])[0] is None

    def test_get_and_put_single(self):
        assert cache.get("hello") is None
        cache.put("hello", [0.5, 0.6])
        assert cache.get("hello") == [0.5, 0.6]

    def test_same_content_same_hash(self):
        cache.put("test text", [1.0, 2.0, 3.0])
        assert cache.get("test text") == [1.0, 2.0, 3.0]

    def test_different_content_different_hash(self):
        cache.put("aaa", [1.0])
        cache.put("bbb", [2.0])
        assert cache.get("aaa") == [1.0]
        assert cache.get("bbb") == [2.0]

    def test_mget_preserves_order(self):
        cache.put("x", [10.0])
        cache.put("z", [30.0])
        result = cache.mget(["x", "y", "z"])
        assert result == [[10.0], None, [30.0]]

    def test_empty_batch(self):
        assert cache.mget([]) == []
        cache.mset([], [])  # should not raise


# ── Redis-backed ──────────────────────────────────────────────────────────────

class TestRedisCache:
    @pytest.fixture(autouse=True)
    def _setup_redis_mock(self):
        self.store: dict[str, str] = {}
        self.mock_redis = MagicMock()

        def mock_mget(keys):
            return [self.store.get(k) for k in keys]

        self.mock_redis.mget.side_effect = mock_mget

        # Mock pipeline for mset
        self.pipe = MagicMock()
        self.pipe.setex = MagicMock(side_effect=lambda k, ttl, v: self.store.__setitem__(k, v))
        self.pipe.execute = MagicMock()
        self.mock_redis.pipeline.return_value = self.pipe

        cache.init(redis=self.mock_redis)
        yield

    def test_mget_returns_cached_vectors(self):
        vec = [0.1, 0.2, 0.3]
        key = cache._redis_key(_hash("hello"))
        self.store[key] = json.dumps(vec)

        result = cache.mget(["hello"])
        assert result == [vec]

    def test_mset_writes_to_redis_pipeline(self):
        cache.mset(["hello"], [[0.1, 0.2]])
        self.mock_redis.pipeline.assert_called_once_with(transaction=False)
        self.pipe.execute.assert_called_once()

    def test_roundtrip_via_redis(self):
        texts = ["alpha", "beta"]
        vecs = [[1.0, 2.0], [3.0, 4.0]]

        cache.mset(texts, vecs)
        result = cache.mget(texts)
        assert result == vecs

    def test_redis_error_on_mget_returns_nones(self):
        self.mock_redis.mget.side_effect = Exception("connection lost")
        result = cache.mget(["hello"])
        assert result == [None]

    def test_redis_error_on_mset_does_not_raise(self):
        self.mock_redis.pipeline.side_effect = Exception("connection lost")
        cache.mset(["hello"], [[0.1]])  # should not raise

    def test_mset_uses_ttl(self):
        cache.mset(["hello"], [[0.1]])
        setex_call = self.pipe.setex.call_args
        assert setex_call[0][1] == cache._TTL

    def test_none_vectors_skipped_in_redis(self):
        cache.mset(["a", "b"], [None, [1.0]])
        # Only one setex call should have been made (for "b")
        assert self.pipe.setex.call_count == 1


# ── Content-hash correctness ─────────────────────────────────────────────────

class TestContentHash:
    def test_hash_is_sha256_hex(self):
        h = cache._content_hash("hello world")
        expected = hashlib.sha256(b"hello world").hexdigest()
        assert h == expected

    def test_hash_deterministic(self):
        assert cache._content_hash("test") == cache._content_hash("test")

    def test_different_text_different_hash(self):
        assert cache._content_hash("a") != cache._content_hash("b")


# ── Init ──────────────────────────────────────────────────────────────────────

class TestInit:
    def test_init_none(self):
        cache.init(redis=None)
        assert cache._redis is None

    def test_init_sets_redis(self):
        mock = MagicMock()
        cache.init(redis=mock)
        assert cache._redis is mock
