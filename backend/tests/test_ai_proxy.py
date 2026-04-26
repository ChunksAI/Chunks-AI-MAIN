"""Tests for routes/ai_proxy.py — AI task proxy (FBD, research-summary)."""
from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Capture the real rate-limit function before any fixture patches it.
import routes.ai_proxy as _proxy_mod
_REAL_CHECK_AI_RATE_LIMIT = _proxy_mod._check_ai_rate_limit


# ---------------------------------------------------------------------------
# Autouse fixture: bypass the custom rate limiter for all route-level tests
# and clear in-memory state between tests.
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _bypass_ai_rate_limit(monkeypatch):
    """Patch _check_ai_rate_limit to return None (no limit) for every test.

    Tests that specifically exercise rate-limiting logic call the helper
    functions directly rather than relying on the full HTTP stack.
    """
    import routes.ai_proxy as proxy_mod
    monkeypatch.setattr(proxy_mod, '_check_ai_rate_limit', lambda req: None)
    proxy_mod._rl_fallback.clear()
    yield
    proxy_mod._rl_fallback.clear()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_httpx_resp(status: int = 200, json_data: dict | None = None):
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = json_data or {
        'choices': [{'message': {'content': 'OK'}}],
    }
    return resp


def _make_async_client(resp):
    """Return a mock ctx.async_client whose post() returns resp via AsyncMock."""
    async_client = MagicMock()
    async_client.post = AsyncMock(return_value=resp)
    return async_client


# ---------------------------------------------------------------------------
# Route registration
# ---------------------------------------------------------------------------

def test_ai_proxy_route_registered(app):
    paths = [r.path for r in app.routes]
    assert '/api/ai' in paths


# ---------------------------------------------------------------------------
# API key guard
# ---------------------------------------------------------------------------

def test_missing_api_key_returns_503(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', '')

    resp = client.post('/api/ai', json={'task': 'fbd', 'question': 'What forces act?'})
    assert resp.status_code == 503
    assert 'AI service not configured' in resp.json()['error']


# ---------------------------------------------------------------------------
# Body parsing
# ---------------------------------------------------------------------------

def test_invalid_json_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')

    resp = client.post(
        '/api/ai',
        content=b'not json',
        headers={'Content-Type': 'application/json'},
    )
    assert resp.status_code == 400
    assert 'Invalid JSON' in resp.json()['error']


def test_non_object_body_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')

    resp = client.post('/api/ai', json=[1, 2, 3])
    assert resp.status_code == 400
    assert 'JSON object' in resp.json()['error']


def test_missing_task_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')

    resp = client.post('/api/ai', json={'question': 'hello'})
    assert resp.status_code == 400
    assert 'task' in resp.json()['error']


def test_unknown_task_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')

    resp = client.post('/api/ai', json={'task': 'unknown_task'})
    assert resp.status_code == 400
    assert 'Unknown task' in resp.json()['error']


# ---------------------------------------------------------------------------
# FBD task
# ---------------------------------------------------------------------------

def test_fbd_missing_model_returns_503(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.delenv('FBD_MODEL', raising=False)

    resp = client.post('/api/ai', json={'task': 'fbd', 'question': 'What forces?'})
    assert resp.status_code == 503
    assert 'FBD model not configured' in resp.json()['error']


def test_fbd_missing_question_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('FBD_MODEL', 'test-model')

    resp = client.post('/api/ai', json={'task': 'fbd', 'question': ''})
    assert resp.status_code == 400
    assert 'question is required' in resp.json()['error']


def test_fbd_question_too_long_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('FBD_MODEL', 'test-model')

    resp = client.post('/api/ai', json={'task': 'fbd', 'question': 'x' * 1001})
    assert resp.status_code == 400
    assert '1000 character limit' in resp.json()['error']


def test_fbd_ai_text_too_long_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('FBD_MODEL', 'test-model')

    resp = client.post('/api/ai', json={
        'task': 'fbd',
        'question': 'What forces?',
        'aiText': 'a' * 2501,
    })
    assert resp.status_code == 400
    assert '2500 character limit' in resp.json()['error']


def test_fbd_success(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('FBD_MODEL', 'test-model')

    mock_resp = _mock_httpx_resp(200, {
        'choices': [{'message': {'content': '{"object":"box","forces":[]}'}}],
    })
    monkeypatch.setattr(ctx, 'async_client', _make_async_client(mock_resp))

    resp = client.post('/api/ai', json={
        'task': 'fbd',
        'question': 'A block sits on a table. What forces act on it?',
        'aiText': 'Gravity pulls down.',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert 'content' in data
    assert data['content'][0]['text'] == '{"object":"box","forces":[]}'


def test_fbd_success_no_ai_text(client, monkeypatch):
    """FBD works when aiText is absent (optional field)."""
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('FBD_MODEL', 'test-model')

    mock_resp = _mock_httpx_resp(200, {
        'choices': [{'message': {'content': '{"object":"ball","forces":[]}'}}],
    })
    monkeypatch.setattr(ctx, 'async_client', _make_async_client(mock_resp))

    resp = client.post('/api/ai', json={'task': 'fbd', 'question': 'Ball in free fall?'})
    assert resp.status_code == 200
    assert resp.json()['content'][0]['text'] == '{"object":"ball","forces":[]}'


# ---------------------------------------------------------------------------
# Research-summary task
# ---------------------------------------------------------------------------

def test_research_summary_missing_model_returns_503(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.delenv('RESEARCH_SUMMARY_MODEL', raising=False)
    monkeypatch.delenv('FBD_MODEL', raising=False)

    resp = client.post('/api/ai', json={
        'task': 'research-summary',
        'title': 'A Paper',
        'abstract': 'Some abstract.',
    })
    assert resp.status_code == 503
    assert 'not configured' in resp.json()['error']


def test_research_summary_missing_title_and_abstract_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('RESEARCH_SUMMARY_MODEL', 'test-model')

    resp = client.post('/api/ai', json={
        'task': 'research-summary',
        'title': '',
        'abstract': '',
    })
    assert resp.status_code == 400
    assert 'title or abstract is required' in resp.json()['error']


def test_research_summary_title_too_long_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('RESEARCH_SUMMARY_MODEL', 'test-model')

    resp = client.post('/api/ai', json={
        'task': 'research-summary',
        'title': 't' * 501,
        'abstract': 'fine',
    })
    assert resp.status_code == 400
    assert '500 character limit' in resp.json()['error']


def test_research_summary_abstract_too_long_returns_400(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('RESEARCH_SUMMARY_MODEL', 'test-model')

    resp = client.post('/api/ai', json={
        'task': 'research-summary',
        'title': 'My Paper',
        'abstract': 'a' * 4001,
    })
    assert resp.status_code == 400
    assert '4000 character limit' in resp.json()['error']


def test_research_summary_success(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('RESEARCH_SUMMARY_MODEL', 'test-model')

    mock_resp = _mock_httpx_resp(200, {
        'choices': [{'message': {'content': 'Great findings.'}}],
    })
    monkeypatch.setattr(ctx, 'async_client', _make_async_client(mock_resp))

    resp = client.post('/api/ai', json={
        'task': 'research-summary',
        'title': 'Attention Is All You Need',
        'abstract': 'We propose the Transformer...',
    })
    assert resp.status_code == 200
    assert resp.json()['content'][0]['text'] == 'Great findings.'


def test_research_summary_uses_fbd_model_fallback(client, monkeypatch):
    """When RESEARCH_SUMMARY_MODEL is absent, falls back to FBD_MODEL."""
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.delenv('RESEARCH_SUMMARY_MODEL', raising=False)
    monkeypatch.setenv('FBD_MODEL', 'fallback-model')

    mock_resp = _mock_httpx_resp(200, {
        'choices': [{'message': {'content': 'Summary via fallback.'}}],
    })
    monkeypatch.setattr(ctx, 'async_client', _make_async_client(mock_resp))

    resp = client.post('/api/ai', json={
        'task': 'research-summary',
        'title': 'My Paper',
        'abstract': 'Some text.',
    })
    assert resp.status_code == 200


def test_research_summary_title_only(client, monkeypatch):
    """research-summary with only a title (no abstract) is accepted."""
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('RESEARCH_SUMMARY_MODEL', 'test-model')

    mock_resp = _mock_httpx_resp(200, {
        'choices': [{'message': {'content': 'Summary text.'}}],
    })
    monkeypatch.setattr(ctx, 'async_client', _make_async_client(mock_resp))

    resp = client.post('/api/ai', json={
        'task': 'research-summary',
        'title': 'Just a Title',
    })
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# OpenRouter error paths
# ---------------------------------------------------------------------------

def test_openrouter_timeout_returns_504(client, monkeypatch):
    from routes.shared import ctx
    import routes.ai_proxy as proxy_mod
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('FBD_MODEL', 'test-model')

    async def _raise_timeout(coro, timeout):
        coro.close()
        raise asyncio.TimeoutError()

    monkeypatch.setattr(proxy_mod.asyncio, 'wait_for', _raise_timeout)

    resp = client.post('/api/ai', json={'task': 'fbd', 'question': 'Forces on a block?'})
    assert resp.status_code == 504
    assert 'timed out' in resp.json()['error']


def test_openrouter_network_error_returns_502(client, monkeypatch):
    from routes.shared import ctx
    import routes.ai_proxy as proxy_mod
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('FBD_MODEL', 'test-model')

    async def _fail(coro, timeout):
        coro.close()
        raise ConnectionError('unreachable')

    monkeypatch.setattr(proxy_mod.asyncio, 'wait_for', _fail)

    resp = client.post('/api/ai', json={'task': 'fbd', 'question': 'Forces on a block?'})
    assert resp.status_code == 502
    assert 'Failed to reach AI service' in resp.json()['error']


def test_openrouter_non_200_returns_error_status(client, monkeypatch):
    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')
    monkeypatch.setenv('FBD_MODEL', 'test-model')

    mock_resp = _mock_httpx_resp(429, {'error': 'rate limit'})
    monkeypatch.setattr(ctx, 'async_client', _make_async_client(mock_resp))

    resp = client.post('/api/ai', json={'task': 'fbd', 'question': 'Forces on a block?'})
    assert resp.status_code == 429
    assert 'AI service error' in resp.json()['error']


# ---------------------------------------------------------------------------
# Rate limiting — unit tests for _check_ai_rate_limit directly
# (These bypass the autouse fixture by testing the function, not the route.)
# ---------------------------------------------------------------------------

def _make_request(ip: str = 'testclient', auth: str = ''):
    """Build a minimal mock Request for _check_ai_rate_limit."""
    req = MagicMock()
    req.headers = {'authorization': auth} if auth else {}
    req.client = MagicMock()
    req.client.host = ip
    return req


def test_rate_limit_redis_guest_allows_under_limit(monkeypatch):
    from routes.shared import ctx

    mock_pipe = MagicMock()
    mock_pipe.execute.return_value = [3, True]   # count=3 < limit=5
    mock_redis = MagicMock()
    mock_redis.pipeline.return_value = mock_pipe
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    result = _REAL_CHECK_AI_RATE_LIMIT(_make_request())
    assert result is None


def test_rate_limit_redis_guest_blocks_over_limit(monkeypatch):
    from routes.shared import ctx

    mock_pipe = MagicMock()
    mock_pipe.execute.return_value = [6, True]   # count=6 > limit=5
    mock_redis = MagicMock()
    mock_redis.pipeline.return_value = mock_pipe
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    result = _REAL_CHECK_AI_RATE_LIMIT(_make_request())
    assert result is not None
    assert result.status_code == 429


def test_rate_limit_redis_authenticated_allows_under_limit(monkeypatch):
    from routes.shared import ctx

    mock_pipe = MagicMock()
    mock_pipe.execute.return_value = [10, True]  # count=10 < limit=20
    mock_redis = MagicMock()
    mock_redis.pipeline.return_value = mock_pipe
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    with patch('services.auth._verify_supabase_jwt', return_value={'id': 'user-123'}):
        result = _REAL_CHECK_AI_RATE_LIMIT(
            _make_request(auth='Bearer fake.jwt.token')
        )
    assert result is None


def test_rate_limit_redis_authenticated_blocks_over_limit(monkeypatch):
    from routes.shared import ctx

    mock_pipe = MagicMock()
    mock_pipe.execute.return_value = [21, True]  # count=21 > limit=20
    mock_redis = MagicMock()
    mock_redis.pipeline.return_value = mock_pipe
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    with patch('services.auth._verify_supabase_jwt', return_value={'id': 'user-123'}):
        result = _REAL_CHECK_AI_RATE_LIMIT(
            _make_request(auth='Bearer fake.jwt.token')
        )
    assert result is not None
    assert result.status_code == 429


def test_rate_limit_redis_exception_falls_back_to_memory(monkeypatch):
    """When Redis raises, the in-memory fallback is used (and allows)."""
    from routes.shared import ctx

    mock_pipe = MagicMock()
    mock_pipe.execute.side_effect = RuntimeError('Redis error')
    mock_redis = MagicMock()
    mock_redis.pipeline.return_value = mock_pipe
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    _proxy_mod._rl_fallback.clear()
    result = _REAL_CHECK_AI_RATE_LIMIT(_make_request())
    assert result is None
    _proxy_mod._rl_fallback.clear()


def test_rate_limit_in_memory_guest_allows_under_limit(monkeypatch):
    from routes.shared import ctx

    monkeypatch.setattr(ctx, 'redis', None)
    _proxy_mod._rl_fallback.clear()

    result = _REAL_CHECK_AI_RATE_LIMIT(_make_request())
    assert result is None
    _proxy_mod._rl_fallback.clear()


def test_rate_limit_in_memory_guest_blocks_over_limit(monkeypatch):
    import time
    from routes.shared import ctx

    monkeypatch.setattr(ctx, 'redis', None)
    _proxy_mod._rl_fallback.clear()

    now = time.monotonic()
    _proxy_mod._rl_fallback['ai_rl:ip:testclient'] = [now - 1] * 5

    result = _REAL_CHECK_AI_RATE_LIMIT(_make_request())
    assert result is not None
    assert result.status_code == 429
    _proxy_mod._rl_fallback.clear()


def test_rate_limit_invalid_jwt_treated_as_guest(monkeypatch):
    """An invalid JWT token falls back to guest rate limiting."""
    from routes.shared import ctx

    monkeypatch.setattr(ctx, 'redis', None)
    _proxy_mod._rl_fallback.clear()

    with patch('services.auth._verify_supabase_jwt', side_effect=Exception('bad token')):
        result = _REAL_CHECK_AI_RATE_LIMIT(
            _make_request(auth='Bearer bad.token')
        )
    assert result is None   # under guest limit
    _proxy_mod._rl_fallback.clear()


def test_rate_limit_jwt_uses_sub_when_no_id(monkeypatch):
    """JWT payload with 'sub' but no 'id' still uses the authenticated tier."""
    from routes.shared import ctx

    mock_pipe = MagicMock()
    mock_pipe.execute.return_value = [1, True]   # well under authenticated limit
    mock_redis = MagicMock()
    mock_redis.pipeline.return_value = mock_pipe
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    with patch('services.auth._verify_supabase_jwt', return_value={'sub': 'user-456'}):
        result = _REAL_CHECK_AI_RATE_LIMIT(
            _make_request(auth='Bearer sub.only.token')
        )
    assert result is None
