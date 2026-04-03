"""
backend/tests/conftest.py — Shared pytest fixtures.

All tests use the Starlette TestClient (compatible with FastAPI) created here.
External dependencies (OpenRouter, Supabase, Redis) are mocked so tests
never make real network calls.
"""
from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock, patch

import pytest

# Ensure the backend directory is on the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Disable CSRF checks in tests by default
os.environ.setdefault('TESTING', 'true')


@pytest.fixture(scope='session')
def app():
    """Create a FastAPI test application with all external calls mocked."""
    mock_session = MagicMock()
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = None   # cache miss by default

    with patch('requests.Session', return_value=mock_session), \
         patch('redis.from_url', return_value=mock_redis):
        import server as srv
        yield srv.app


@pytest.fixture
def client(app):
    """Return a Starlette/FastAPI test client.

    Includes a default Origin header so that CORS preflight (OPTIONS) requests
    are handled correctly by the CORSMiddleware.
    """
    from starlette.testclient import TestClient
    return TestClient(
        app,
        raise_server_exceptions=False,
        headers={'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'POST'},
    )


@pytest.fixture
def csrf_client(app):
    """Test client with CSRF enforcement turned ON.

    Uses a fresh client WITHOUT a default Origin header so CSRF tests can
    precisely control which headers are sent.
    """
    import server
    from starlette.testclient import TestClient
    server._csrf_disabled = False
    with TestClient(app, raise_server_exceptions=False) as tc:
        yield tc
    server._csrf_disabled = True   # restore — CSRF off for other tests


@pytest.fixture
def mock_call_ai(monkeypatch):
    """Patch services.ai.call_ai to return a canned string response."""
    import services.ai as ai_svc
    mock = MagicMock(return_value="Mocked AI response for testing.")
    monkeypatch.setattr(ai_svc, 'call_ai', mock)
    return mock


@pytest.fixture
def mock_extract_user(monkeypatch):
    """Patch _extract_verified_user to return a fixed guest user."""
    import services.auth as auth_svc
    from services.auth import Tier
    mock = MagicMock(return_value=('ip:127.0.0.1', Tier.FREE, False))
    monkeypatch.setattr(auth_svc, '_extract_verified_user', mock)
    return mock


@pytest.fixture
def mock_guest_gate(monkeypatch):
    """Patch guest_gate to be a no-op (never blocks) in all route modules."""
    import guest_limits
    import routes.chat
    import routes.library
    import routes.flashcards
    import routes.study
    noop = lambda *a, **kw: None
    monkeypatch.setattr(guest_limits,      'guest_gate', noop)
    monkeypatch.setattr(routes.chat,       'guest_gate', noop)
    monkeypatch.setattr(routes.library,    'guest_gate', noop)
    monkeypatch.setattr(routes.flashcards, 'guest_gate', noop)
    monkeypatch.setattr(routes.study,      'guest_gate', noop)
