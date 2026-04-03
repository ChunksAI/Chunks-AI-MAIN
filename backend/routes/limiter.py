"""
backend/routes/limiter.py — Shared slowapi Limiter instance.

Defined here (rather than in server.py) so that route modules can import
``limiter`` at module load time for ``@limiter.limit(...)`` decorators,
without triggering circular imports with server.py.

server.py attaches this limiter to ``app.state.limiter`` and registers the
RateLimitExceeded exception handler.

Storage backend
───────────────
When REDIS_URL is set the limiter stores counters in Redis so that rate-limit
state is shared across all replicas (required for horizontal scaling).
Without REDIS_URL it falls back to an in-process memory store, which is fine
for single-instance local development but will give each pod its own
independent counter in a multi-replica deployment.
"""
from __future__ import annotations

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

_redis_url = os.environ.get('REDIS_URL')

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["500/hour", "120/minute"],
    storage_uri=_redis_url if _redis_url else "memory://",
)
