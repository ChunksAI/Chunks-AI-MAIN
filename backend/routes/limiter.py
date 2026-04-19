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
    """
    Return a rate-limit bucket key for the request.

    - OPTIONS preflights are always exempt (one shared key).
    - Authenticated requests (Bearer token present) are keyed by token so that
      each user has an independent bucket.
    - Anonymous requests fall back to the remote IP address.
    """
    if request.method == "OPTIONS":
        return "options-preflight-exempt"
    auth = request.headers.get("authorization", "") or request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        # Key on the token itself — this is opaque to the limiter and gives
        # every authenticated user their own independent quota.
        return f"bearer:{auth[7:60]}"  # cap to 60 chars (more than sufficient for a UUID JWT)
    return get_remote_address(request)


def _dynamic_ask_limit(key: str) -> str:
    """
    Return the per-minute rate limit for the /ask endpoint.

    SlowAPI calls this with the result of ``key_func`` (_rate_limit_key), so
    ``key`` is either ``"bearer:<token>"`` for authenticated users or an IP
    address for anonymous ones.

    - Authenticated users (Bearer token present): 60 requests/minute.
    - Anonymous users (no token): 15 requests/minute.
    """
    if key.startswith("bearer:"):
        return "60/minute"
    return "15/minute"


limiter = Limiter(
    key_func=_rate_limit_key,
    default_limits=["500/hour", "120/minute"],
)
