"""
backend/routes/limiter.py — Shared slowapi Limiter instance.

Defined here (rather than in server.py) so that route modules can import
``limiter`` at module load time for ``@limiter.limit(...)`` decorators,
without triggering circular imports with server.py.

server.py attaches this limiter to ``app.state.limiter`` and registers the
RateLimitExceeded exception handler.

Storage backend
───────────────
The limiter uses the same Redis connectivity as the rest of the application:

  REDIS_SENTINEL_HOSTS set → ``redis+sentinel://host:port/master_name``
                              (counters shared across all replicas, HA failover)
  REDIS_URL set            → ``redis://host:port``
                              (counters shared across replicas, no HA)
  Neither set              → ``memory://``  (in-process, for local dev only)

The ``redis+sentinel://`` scheme is supported natively by the ``limits``
library (the storage backend used by slowapi).
"""
from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from services.redis_client import build_limiter_storage_uri

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["500/hour", "120/minute"],
    storage_uri=build_limiter_storage_uri(),
)
