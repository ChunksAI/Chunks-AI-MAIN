"""Tests for the device_abuse service (per-user, per-device rate limiting)."""
from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import pytest

import services.device_abuse as da


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_request_ctx(app, headers=None):
    """Return a Flask request context with custom headers."""
    _headers = {
        'User-Agent': 'TestBrowser/1.0',
        'X-Device-Id': 'test-device-abc',
    }
    if headers:
        _headers.update(headers)
    return app.test_request_context(
        '/ask',
        method='POST',
        headers=_headers,
        environ_base={'REMOTE_ADDR': '10.0.0.1'},
    )


# ── Unit tests for _build_device_key ──────────────────────────────────────────

class TestBuildDeviceKey:
    """Tests for device key construction."""

    def test_same_inputs_produce_same_key(self, app):
        with _make_request_ctx(app):
            key1 = da._build_device_key('user-123')
            key2 = da._build_device_key('user-123')
            assert key1 == key2

    def test_different_user_produces_different_key(self, app):
        with _make_request_ctx(app):
            key1 = da._build_device_key('user-123')
            key2 = da._build_device_key('user-456')
            assert key1 != key2

    def test_different_device_header_produces_different_key(self, app):
        with _make_request_ctx(app, headers={'X-Device-Id': 'device-A'}):
            key_a = da._build_device_key('user-123')
        with _make_request_ctx(app, headers={'X-Device-Id': 'device-B'}):
            key_b = da._build_device_key('user-123')
        assert key_a != key_b

    def test_different_user_agent_produces_different_key(self, app):
        with _make_request_ctx(app, headers={'User-Agent': 'Chrome/1'}):
            key_a = da._build_device_key('user-123')
        with _make_request_ctx(app, headers={'User-Agent': 'Firefox/2'}):
            key_b = da._build_device_key('user-123')
        assert key_a != key_b

    def test_key_contains_user_id(self, app):
        with _make_request_ctx(app):
            key = da._build_device_key('user-123')
            assert key.startswith('user-123:')

    def test_missing_device_header_still_works(self, app):
        with _make_request_ctx(app, headers={'X-Device-Id': ''}):
            key = da._build_device_key('user-123')
            assert key.startswith('user-123:')


# ── Unit tests for in-memory sliding window ───────────────────────────────────

class TestMemCheckWindow:
    """Tests for the in-memory sliding-window counter."""

    def setup_method(self):
        da._mem_counters.clear()

    def test_allows_under_limit(self):
        now = time.time()
        for i in range(5):
            assert da._mem_check_window('test', 60, 10, now + i) is True

    def test_blocks_at_limit(self):
        now = time.time()
        for i in range(10):
            da._mem_check_window('test', 60, 10, now + i * 0.1)
        assert da._mem_check_window('test', 60, 10, now + 2) is False

    def test_allows_after_window_expires(self):
        now = time.time()
        # Fill up the window
        for i in range(10):
            da._mem_check_window('test', 60, 10, now + i * 0.1)
        # Should be blocked
        assert da._mem_check_window('test', 60, 10, now + 30) is False
        # After the window expires, should be allowed again
        assert da._mem_check_window('test', 60, 10, now + 61) is True

    def test_different_keys_are_independent(self):
        now = time.time()
        for i in range(10):
            da._mem_check_window('key_a', 60, 10, now + i)
        # key_a is full
        assert da._mem_check_window('key_a', 60, 10, now + 11) is False
        # key_b should still be allowed
        assert da._mem_check_window('key_b', 60, 10, now + 11) is True


# ── Unit tests for Redis sliding window ───────────────────────────────────────

class TestRedisCheckWindow:
    """Tests for the Redis sliding-window counter."""

    def setup_method(self):
        da._redis = None

    def test_no_redis_allows_through(self):
        """When Redis is None, fail open."""
        assert da._redis_check_window('test', 60, 10, 120, time.time()) is True

    def test_redis_error_allows_through(self):
        """When Redis raises, fail open."""
        mock_redis = MagicMock()
        mock_redis.pipeline.side_effect = Exception("connection lost")
        da._redis = mock_redis
        try:
            assert da._redis_check_window('test', 60, 10, 120, time.time()) is True
        finally:
            da._redis = None

    def test_redis_allows_under_limit(self):
        """When count is under limit, request is allowed."""
        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_redis.pipeline.return_value = mock_pipe
        mock_pipe.execute.return_value = [0, 5]  # zremrangebyscore result, zcard=5
        mock_pipe2 = MagicMock()
        mock_redis.pipeline.side_effect = [mock_pipe, mock_pipe2]

        da._redis = mock_redis
        try:
            assert da._redis_check_window('test', 60, 10, 120, time.time()) is True
        finally:
            da._redis = None

    def test_redis_blocks_at_limit(self):
        """When count >= limit, request is blocked."""
        mock_redis = MagicMock()
        mock_pipe = MagicMock()
        mock_redis.pipeline.return_value = mock_pipe
        mock_pipe.execute.return_value = [0, 30]  # zcard=30 (at limit)

        da._redis = mock_redis
        try:
            assert da._redis_check_window('test', 60, 30, 120, time.time()) is False
        finally:
            da._redis = None


# ── Integration tests for check_device_rate_limit ─────────────────────────────

class TestCheckDeviceRateLimit:
    """Tests for the public check_device_rate_limit function."""

    def setup_method(self):
        da._redis = None
        da._mem_counters.clear()

    def test_empty_user_id_returns_none(self, app):
        """No user → fail open (guest_gate handles those)."""
        with _make_request_ctx(app):
            assert da.check_device_rate_limit('') is None
            assert da.check_device_rate_limit(None) is None

    def test_allows_normal_usage(self, app):
        """A few requests should not be blocked."""
        with _make_request_ctx(app):
            for _ in range(5):
                assert da.check_device_rate_limit('user-123') is None

    def test_blocks_after_burst_limit(self, app):
        """Exceeding the per-minute burst limit returns 429."""
        # Override rate limits to make testing feasible
        original = da.RATE_LIMITS
        da.RATE_LIMITS = [(60, 3, 120)]  # 3 per minute
        try:
            with _make_request_ctx(app):
                for _ in range(3):
                    assert da.check_device_rate_limit('user-burst') is None
                # 4th request should be blocked
                result = da.check_device_rate_limit('user-burst')
                assert result is not None
                resp, status = result
                assert status == 429
        finally:
            da.RATE_LIMITS = original

    def test_different_users_have_separate_limits(self, app):
        """User A hitting limit does not affect User B."""
        original = da.RATE_LIMITS
        da.RATE_LIMITS = [(60, 2, 120)]
        try:
            with _make_request_ctx(app):
                # Fill user-a's quota
                for _ in range(2):
                    da.check_device_rate_limit('user-a')
                assert da.check_device_rate_limit('user-a') is not None
                # user-b should still be fine
                assert da.check_device_rate_limit('user-b') is None
        finally:
            da.RATE_LIMITS = original

    def test_different_devices_have_separate_limits(self, app):
        """Same user on different devices has separate counters."""
        original = da.RATE_LIMITS
        da.RATE_LIMITS = [(60, 2, 120)]
        try:
            with _make_request_ctx(app, headers={'X-Device-Id': 'device-1'}):
                for _ in range(2):
                    da.check_device_rate_limit('user-x')
                assert da.check_device_rate_limit('user-x') is not None

            with _make_request_ctx(app, headers={'X-Device-Id': 'device-2'}):
                assert da.check_device_rate_limit('user-x') is None
        finally:
            da.RATE_LIMITS = original


# ── Tests for DeviceRateLimited exception ─────────────────────────────────────

class TestDeviceRateLimited:
    """Tests for the DeviceRateLimited exception class."""

    def test_message_contains_details(self):
        exc = da.DeviceRateLimited('user-123', 'minute', 30)
        assert 'user-123' in str(exc)
        assert '30' in str(exc)
        assert 'minute' in str(exc)

    def test_response_returns_429(self, app):
        exc = da.DeviceRateLimited('user-123', 'minute', 30)
        with app.app_context():
            resp, status = exc.response()
            assert status == 429

    def test_response_json_has_required_fields(self, app):
        exc = da.DeviceRateLimited('user-123', 'hour', 200)
        with app.app_context():
            resp, status = exc.response()
            data = resp.get_json()
            assert data['success'] is False
            assert data['rate_limited'] is True
            assert data['window'] == 'hour'
            assert data['limit'] == 200
            assert 'error' in data


# ── Tests for init() ──────────────────────────────────────────────────────────

class TestInit:
    """Tests for the init() function."""

    def test_init_sets_redis(self):
        mock_redis = MagicMock()
        da.init(redis=mock_redis)
        assert da._redis is mock_redis
        # Clean up
        da._redis = None

    def test_init_with_none(self):
        da.init(redis=None)
        assert da._redis is None
