"""Tests for routes/shared.py — _AppContext lazy namespace."""
import pytest

from routes.shared import _AppContext


def test_app_context_uninitialized_public_attr():
    """Accessing a public attribute before _init() raises with helpful message."""
    ctx = _AppContext()
    with pytest.raises(AttributeError, match="ctx._init"):
        _ = ctx.redis


def test_app_context_uninitialized_private_attr():
    """Accessing a private (underscore) attribute before _init() raises plain AttributeError."""
    ctx = _AppContext()
    with pytest.raises(AttributeError):
        _ = ctx._nonexistent


def test_app_context_initialized():
    """After _init(), injected attributes are accessible."""
    ctx = _AppContext()
    ctx._init(redis='mock_redis', session='mock_session')
    assert ctx.redis == 'mock_redis'
    assert ctx.session == 'mock_session'
    assert ctx._ready is True
