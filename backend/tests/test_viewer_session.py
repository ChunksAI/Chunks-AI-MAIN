"""
backend/tests/test_viewer_session.py — Tests for POST/GET /api/viewer/set-state and
/api/viewer/get-state.

Redis is mocked via the shared conftest fixture.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock, patch


# ── Fixtures / helpers ────────────────────────────────────────────────────────

def _auth_patch(monkeypatch, user_id='user-123'):
    """Bypass Supabase JWT verification."""
    monkeypatch.setattr(
        'services.auth._extract_verified_user',
        lambda req: (user_id, 'pro', False),
    )


_SAMPLE_STATE = {
    'type': 'youtube',
    'video_id': 'abc123',
    'current_timestamp_seconds': 42.5,
}


# ── Route registration ────────────────────────────────────────────────────────

def test_viewer_set_state_route_registered(app):
    paths = [r.path for r in app.routes]
    assert '/api/viewer/set-state' in paths


def test_viewer_get_state_route_registered(app):
    paths = [r.path for r in app.routes]
    assert '/api/viewer/get-state' in paths


# ── set-state: unauthenticated ────────────────────────────────────────────────

def test_set_state_unauthenticated_returns_200_noop(client):
    with patch('services.auth._extract_verified_user', return_value=('ip:1.2.3.4', 'guest', False)):
        resp = client.post('/api/viewer/set-state', json={'viewer_state': _SAMPLE_STATE})
    assert resp.status_code == 200
    assert resp.json()['success'] is True


# ── set-state: input validation ───────────────────────────────────────────────

def test_set_state_missing_viewer_state_returns_422(client, monkeypatch):
    _auth_patch(monkeypatch)
    resp = client.post('/api/viewer/set-state', json={})
    assert resp.status_code == 422
    assert resp.json()['success'] is False


def test_set_state_invalid_viewer_state_type_returns_422(client, monkeypatch):
    _auth_patch(monkeypatch)
    resp = client.post('/api/viewer/set-state', json={'viewer_state': 'not-a-dict'})
    assert resp.status_code == 422
    assert resp.json()['success'] is False


# ── set-state: success ────────────────────────────────────────────────────────

def test_set_state_writes_to_redis(client, monkeypatch, app):
    _auth_patch(monkeypatch)

    mock_redis = MagicMock()
    mock_redis.setex = MagicMock()

    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    resp = client.post('/api/viewer/set-state', json={'viewer_state': _SAMPLE_STATE})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True

    # Verify Redis was called with the correct key, TTL, and serialised value
    mock_redis.setex.assert_called_once()
    call_args = mock_redis.setex.call_args
    key, ttl, value = call_args[0]
    assert key == 'viewer_state:user-123'
    assert ttl == 3600
    assert json.loads(value) == _SAMPLE_STATE


# ── set-state: Redis failure ──────────────────────────────────────────────────

def test_set_state_redis_failure_returns_503(client, monkeypatch):
    _auth_patch(monkeypatch)

    mock_redis = MagicMock()
    mock_redis.setex.side_effect = Exception('Redis down')

    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    resp = client.post('/api/viewer/set-state', json={'viewer_state': _SAMPLE_STATE})
    assert resp.status_code == 503
    assert resp.json()['success'] is False


# ── get-state: unauthenticated ────────────────────────────────────────────────

def test_get_state_unauthenticated_returns_200_null(client):
    with patch('services.auth._extract_verified_user', return_value=('ip:1.2.3.4', 'guest', False)):
        resp = client.get('/api/viewer/get-state')
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['viewer_state'] is None


# ── get-state: cache miss ─────────────────────────────────────────────────────

def test_get_state_returns_null_when_not_cached(client, monkeypatch):
    _auth_patch(monkeypatch)

    mock_redis = MagicMock()
    mock_redis.get.return_value = None

    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    resp = client.get('/api/viewer/get-state')
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['viewer_state'] is None


# ── get-state: cache hit ──────────────────────────────────────────────────────

def test_get_state_returns_stored_state(client, monkeypatch):
    _auth_patch(monkeypatch)

    mock_redis = MagicMock()
    mock_redis.get.return_value = json.dumps(_SAMPLE_STATE).encode()

    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    resp = client.get('/api/viewer/get-state')
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['viewer_state'] == _SAMPLE_STATE

    mock_redis.get.assert_called_once_with('viewer_state:user-123')


# ── get-state: Redis failure ──────────────────────────────────────────────────

def test_get_state_redis_failure_returns_503(client, monkeypatch):
    _auth_patch(monkeypatch)

    mock_redis = MagicMock()
    mock_redis.get.side_effect = Exception('Redis down')

    from routes.shared import ctx
    monkeypatch.setattr(ctx, 'redis', mock_redis)

    resp = client.get('/api/viewer/get-state')
    assert resp.status_code == 503
    assert resp.json()['success'] is False
