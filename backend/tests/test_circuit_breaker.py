"""Tests for services/circuit_breaker.py and its integration with call_ai_async."""
from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch, AsyncMock

import pytest

# Capture the REAL call_ai_async before the conftest autouse shim replaces it.
# The conftest fixture patches it at test-run time; module-level code here runs
# at collection time, before any fixture.
import services.ai as _ai_module_ref
_real_call_ai_async = _ai_module_ref.call_ai_async


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_redis(store: dict | None = None) -> MagicMock:
    """Return a minimal synchronous Redis mock backed by an in-memory dict."""
    if store is None:
        store = {}

    r = MagicMock()

    def _get(key):
        v = store.get(key)
        if v is None:
            return None
        return v.encode() if isinstance(v, str) else v

    def _set(key, value, ex=None, nx=False):
        if nx and key in store:
            return None   # NX = set only if not exists
        store[key] = value
        return True

    def _incr(key):
        store[key] = int(store.get(key, 0)) + 1
        return store[key]

    def _expire(key, secs):
        pass  # TTL not simulated in unit tests

    def _delete(*keys):
        for k in keys:
            store.pop(k, None)

    r.get.side_effect    = _get
    r.set.side_effect    = _set
    r.incr.side_effect   = _incr
    r.expire.side_effect = _expire
    r.delete.side_effect = _delete
    return r, store


# ─────────────────────────────────────────────────────────────────────────────
# CircuitBreaker unit tests
# ─────────────────────────────────────────────────────────────────────────────

class TestCircuitBreakerNoRedis:
    """Graceful degradation when Redis is unavailable."""

    def test_can_call_returns_true_without_redis(self):
        from services.circuit_breaker import CircuitBreaker
        cb = CircuitBreaker(redis_client=None)
        assert cb.can_call('openai/gpt-4o') is True

    def test_record_result_is_noop_without_redis(self):
        from services.circuit_breaker import CircuitBreaker
        cb = CircuitBreaker(redis_client=None)
        # Should not raise
        cb.record_result('openai/gpt-4o', success=False)
        cb.record_result('openai/gpt-4o', success=True)

    def test_get_state_returns_closed_without_redis(self):
        from services.circuit_breaker import CircuitBreaker
        cb = CircuitBreaker(redis_client=None)
        assert cb.get_state('openai/gpt-4o') == 'closed'

    def test_get_failure_count_returns_zero_without_redis(self):
        from services.circuit_breaker import CircuitBreaker
        cb = CircuitBreaker(redis_client=None)
        assert cb.get_failure_count('openai/gpt-4o') == 0


class TestCircuitBreakerClosed:
    """CLOSED state (no failures yet)."""

    def test_can_call_when_no_state_key(self):
        from services.circuit_breaker import CircuitBreaker
        r, _ = _make_redis()
        cb = CircuitBreaker(redis_client=r)
        assert cb.can_call('openai/gpt-4o') is True

    def test_success_resets_counters(self):
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis({'cb:m:failures': '2'})
        cb = CircuitBreaker(redis_client=r)
        cb.record_result('m', success=True)
        assert store.get('cb:m:failures') is None

    def test_failure_increments_counter(self):
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis()
        cb = CircuitBreaker(redis_client=r, failure_threshold=3)
        cb.record_result('m', success=False)
        assert int(store.get('cb:m:failures', 0)) == 1

    def test_circuit_opens_at_threshold(self):
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis()
        cb = CircuitBreaker(redis_client=r, failure_threshold=3, open_window_secs=30)
        for _ in range(3):
            cb.record_result('m', success=False)
        assert store.get('cb:m:state') == 'open'

    def test_circuit_not_open_before_threshold(self):
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis()
        cb = CircuitBreaker(redis_client=r, failure_threshold=3)
        for _ in range(2):
            cb.record_result('m', success=False)
        assert store.get('cb:m:state') is None


class TestCircuitBreakerOpen:
    """OPEN state — calls must be rejected."""

    def test_can_call_returns_false_when_open(self):
        from services.circuit_breaker import CircuitBreaker
        r, _ = _make_redis({'cb:m:state': 'open'})
        cb = CircuitBreaker(redis_client=r)
        assert cb.can_call('m') is False

    def test_get_state_returns_open(self):
        from services.circuit_breaker import CircuitBreaker
        r, _ = _make_redis({'cb:m:state': 'open'})
        cb = CircuitBreaker(redis_client=r)
        assert cb.get_state('m') == 'open'

    def test_status_all(self):
        from services.circuit_breaker import CircuitBreaker
        r, _ = _make_redis({'cb:m:state': 'open', 'cb:m:failures': '3'})
        cb = CircuitBreaker(redis_client=r)
        status = cb.status_all(['m'])
        assert status['m']['state'] == 'open'
        assert status['m']['failure_count'] == 3


class TestCircuitBreakerHalfOpen:
    """HALF_OPEN state — one trial allowed."""

    def test_first_caller_allowed(self):
        from services.circuit_breaker import CircuitBreaker
        r, _ = _make_redis({'cb:m:state': 'half_open'})
        cb = CircuitBreaker(redis_client=r)
        assert cb.can_call('m') is True   # first caller → gets trial lock

    def test_second_caller_blocked(self):
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis({'cb:m:state': 'half_open'})
        cb = CircuitBreaker(redis_client=r)
        cb.can_call('m')       # first caller acquires lock
        assert cb.can_call('m') is False   # second caller blocked

    def test_success_closes_circuit(self):
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis({'cb:m:state': 'half_open'})
        cb = CircuitBreaker(redis_client=r)
        cb.record_result('m', success=True)
        assert store.get('cb:m:state') is None   # CLOSED = no key

    def test_failure_reopens_circuit(self):
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis({'cb:m:state': 'half_open'})
        cb = CircuitBreaker(redis_client=r)
        cb.record_result('m', success=False)
        assert store.get('cb:m:state') == 'open'


class TestCircuitBreakerRedisError:
    """Redis exceptions are swallowed and degrade gracefully."""

    def test_can_call_returns_true_on_redis_error(self):
        from services.circuit_breaker import CircuitBreaker
        r = MagicMock()
        r.get.side_effect = Exception("Redis connection refused")
        cb = CircuitBreaker(redis_client=r)
        assert cb.can_call('m') is True

    def test_record_result_is_noop_on_redis_error(self):
        from services.circuit_breaker import CircuitBreaker
        r = MagicMock()
        r.get.side_effect = Exception("Redis connection refused")
        r.incr.side_effect = Exception("Redis connection refused")
        cb = CircuitBreaker(redis_client=r)
        cb.record_result('m', success=False)  # must not raise


# ─────────────────────────────────────────────────────────────────────────────
# Integration: call_ai_async skips primary when circuit is OPEN
# ─────────────────────────────────────────────────────────────────────────────

class TestCallAiAsyncCircuitBreaker:
    """call_ai_async respects can_call() and calls record_result()."""

    def _setup(self, monkeypatch, cb):
        import services.ai as ai_svc
        import services.token_budget as tb
        # Restore the real call_ai_async (overrides the conftest shim)
        monkeypatch.setattr(ai_svc, 'call_ai_async', _real_call_ai_async)
        monkeypatch.setattr(ai_svc, '_circuit_breaker', cb)
        monkeypatch.setattr(ai_svc, 'OPENROUTER_API_KEY', 'test-key')
        monkeypatch.setattr(ai_svc, 'MODEL', 'openai/gpt-4o')
        monkeypatch.setattr(ai_svc, '_record_usage_from_response', lambda *a, **kw: None)
        monkeypatch.setattr(tb, 'check_daily_budget', lambda: True)
        monkeypatch.setattr(tb, 'max_tokens_for_endpoint', lambda *a, **kw: 1000)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            'choices': [{'message': {'content': 'answer'}}],
            'usage': {},
        }
        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=mock_resp)
        monkeypatch.setattr(ai_svc, '_async_client', mock_client)
        return mock_client

    def test_open_circuit_skips_primary_uses_fallback(self, monkeypatch):
        """When primary circuit is OPEN, fallback is used directly."""
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis({'cb:openai/gpt-4o:state': 'open'})
        cb = CircuitBreaker(redis_client=r)

        import services.ai as ai_svc
        mock_client = self._setup(monkeypatch, cb)

        result = asyncio.get_event_loop().run_until_complete(
            ai_svc.call_ai_async(
                'What is entropy?',
                model='openai/gpt-4o',
                fallback_model='google/gemini-flash',
                timeout=10,
            )
        )
        assert result == 'answer'
        # Verify the call went to fallback, not primary
        call_args = mock_client.post.call_args
        payload = call_args[1]['json']
        assert payload['model'] == 'google/gemini-flash'

    def test_closed_circuit_records_success(self, monkeypatch):
        """A successful call records success=True on the circuit breaker."""
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis()
        cb = CircuitBreaker(redis_client=r)
        record_calls: list = []
        _orig = cb.record_result
        def _spy(model, *, success):
            record_calls.append((model, success))
            return _orig(model, success=success)
        cb.record_result = _spy

        import services.ai as ai_svc
        self._setup(monkeypatch, cb)

        asyncio.get_event_loop().run_until_complete(
            ai_svc.call_ai_async('test', model='openai/gpt-4o', timeout=10)
        )
        assert any(success is True for _, success in record_calls)

    def test_timeout_records_failure(self, monkeypatch):
        """A timeout records success=False and raises LLM_TIMEOUT."""
        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis()
        cb = CircuitBreaker(redis_client=r)
        record_calls: list = []
        _orig = cb.record_result
        def _spy(model, *, success):
            record_calls.append((model, success))
            return _orig(model, success=success)
        cb.record_result = _spy

        import services.ai as ai_svc
        self._setup(monkeypatch, cb)
        # Override mock to timeout
        import httpx
        ai_svc._async_client.post = AsyncMock(side_effect=asyncio.TimeoutError())

        with pytest.raises(RuntimeError, match='LLM_TIMEOUT'):
            asyncio.get_event_loop().run_until_complete(
                ai_svc.call_ai_async('test', model='openai/gpt-4o', timeout=10)
            )
        assert any(success is False for _, success in record_calls)


# ─────────────────────────────────────────────────────────────────────────────
# Admin endpoint: GET /api/admin/circuit-breaker-status
# ─────────────────────────────────────────────────────────────────────────────

def _make_admin_jwt(email: str = 'admin@example.com') -> str:
    import base64, json as _json
    header  = base64.urlsafe_b64encode(_json.dumps({'alg': 'none'}).encode()).rstrip(b'=')
    payload = base64.urlsafe_b64encode(
        _json.dumps({'email': email, 'sub': 'uid-1'}).encode()
    ).rstrip(b'=')
    return f'{header.decode()}.{payload.decode()}.sig'


class TestCircuitBreakerAdminEndpoint:

    def test_requires_auth(self, client):
        resp = client.get('/api/admin/circuit-breaker-status')
        assert resp.status_code == 401

    def test_returns_status_for_all_models(self, client, monkeypatch):
        import os, routes.admin as admin_mod
        monkeypatch.setenv('ADMIN_EMAIL_OWNER', 'owner@example.com')
        monkeypatch.setenv('ADMIN_PIN_HASH_OWNER', 'a' * 64)
        # Bypass PIN: patch _check_admin_role to succeed
        monkeypatch.setattr(
            admin_mod, '_check_admin_role',
            lambda t: ({'email': 'owner@example.com', 'id': 'u1'}, 'owner'),
        )

        from services.circuit_breaker import CircuitBreaker
        r, store = _make_redis({'cb:openai/gpt-4o-mini:state': 'open'})
        cb = CircuitBreaker(redis_client=r)
        import services.circuit_breaker as cb_mod
        monkeypatch.setattr(cb_mod, '_breaker', cb)

        resp = client.get(
            '/api/admin/circuit-breaker-status',
            headers={'Authorization': f'Bearer {_make_admin_jwt("owner@example.com")}'},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data['success'] is True
        assert 'circuit_breakers' in data
        assert 'config' in data
        assert data['config']['failure_threshold'] == 3

    def test_forbidden_for_non_admin(self, client, monkeypatch):
        import routes.admin as admin_mod
        monkeypatch.setattr(
            admin_mod, '_check_admin_role',
            lambda t: (None, None),
        )
        resp = client.get(
            '/api/admin/circuit-breaker-status',
            headers={'Authorization': 'Bearer sometoken'},
        )
        assert resp.status_code == 403
