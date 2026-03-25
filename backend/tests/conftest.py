"""
backend/tests/conftest.py — Shared pytest fixtures.

All tests use the Flask test client created here.
External dependencies (OpenRouter, Supabase, Redis) are mocked so tests
never make real network calls.
"""
from __future__ import annotations

import sys
import os
from unittest.mock import MagicMock, patch

import pytest

# Ensure the backend directory is on the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture(scope='session')
def app():
    """Create a Flask test application with all external calls mocked."""
    # Mock out requests.Session before server.py is imported so _build_session
    # returns a mock session that never touches the network.
    mock_session = MagicMock()
    # ping() response for Redis mock
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_redis.get.return_value = None   # cache miss by default

    with patch('requests.Session', return_value=mock_session), \
         patch('redis.from_url', return_value=mock_redis):
        import server as srv
        srv.app.config.update({
            'TESTING': True,
            'WTF_CSRF_ENABLED': False,
            'RATELIMIT_ENABLED': False,   # disable rate limits in tests
        })
        yield srv.app


@pytest.fixture
def client(app):
    """Return a Flask test client."""
    return app.test_client()


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
    mock = MagicMock(return_value=('ip:127.0.0.1', Tier.FREE))
    monkeypatch.setattr(auth_svc, '_extract_verified_user', mock)
    return mock


@pytest.fixture
def mock_guest_gate(monkeypatch):
    """Patch guest_gate to be a no-op (never blocks) in all route modules."""
    import guest_limits
    import routes.library
    import routes.flashcards
    import routes.study
    noop = lambda *a, **kw: None
    monkeypatch.setattr(guest_limits,      'guest_gate', noop)
    monkeypatch.setattr(routes.library,    'guest_gate', noop)
    monkeypatch.setattr(routes.flashcards, 'guest_gate', noop)
    monkeypatch.setattr(routes.study,      'guest_gate', noop)
