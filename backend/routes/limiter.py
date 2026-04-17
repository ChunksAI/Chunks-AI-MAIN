"""
backend/routes/limiter.py — Shared slowapi Limiter instance.

Defined here (rather than in server.py) so that route modules can import
``limiter`` at module load time for ``@limiter.limit(...)`` decorators,
without triggering circular imports with server.py.

server.py attaches this limiter to ``app.state.limiter`` and registers the
RateLimitExceeded exception handler.
"""
from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request as StarletteRequest


def _is_rate_limit_disabled() -> bool:
    """Rate limiting is disabled only when pytest is actively running. Never in production."""
    return 'PYTEST_CURRENT_TEST' in os.environ


def _rate_limit_key(request: StarletteRequest) -> str:
    """OPTIONS preflight must never be rate-limited."""
    if request.method == "OPTIONS":
        return "options-preflight-exempt"
    return get_remote_address(request)


limiter = Limiter(
    key_func=_rate_limit_key,
    default_limits=["500/hour", "120/minute"],
)
