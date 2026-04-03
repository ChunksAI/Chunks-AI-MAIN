"""
backend/services/redis_client.py — Redis connection factory with Sentinel support.

Priority order:
  1. REDIS_SENTINEL_HOSTS is set → Redis Sentinel (HA, recommended for production)
  2. REDIS_URL is set            → single Redis instance (local dev / docker-compose)
  3. Neither is set              → returns None (all services fall back to in-memory)
Environment variables
─────────────────────
  REDIS_SENTINEL_HOSTS   Comma-separated list of sentinel host:port pairs.
                         Example: "redis-sentinel:26379"
                         or       "sentinel-0:26379,sentinel-1:26379,sentinel-2:26379"

  REDIS_MASTER_NAME      Name of the master monitored by the sentinels.
                         Default: "mymaster"

  REDIS_URL              Standard redis:// URL used when Sentinel is NOT configured.
                         Example: "redis://localhost:6379"

The returned object is a standard redis.Redis client — every existing service that
calls .get(), .set(), .setex(), .incr(), .ping(), etc. works without any changes.
When Sentinel is active the client uses a SentinelConnectionPool and automatically
reconnects to the promoted master after a failover.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import redis as redis_lib

logger = logging.getLogger(__name__)

# Connection timeout shared by both code paths.
_TIMEOUT = 3

# ── Env vars ──────────────────────────────────────────────────────────────────
_SENTINEL_HOSTS_RAW = os.environ.get("REDIS_SENTINEL_HOSTS", "").strip()
_MASTER_NAME        = os.environ.get("REDIS_MASTER_NAME", "mymaster").strip()
_REDIS_URL          = os.environ.get("REDIS_URL", "").strip()


def _parse_sentinel_hosts(raw: str) -> list[tuple[str, int]]:
    """Parse "host1:port1,host2:port2" → [(host1, port1), (host2, port2)]."""
    hosts: list[tuple[str, int]] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if ":" in part:
            host, port_str = part.rsplit(":", 1)
            hosts.append((host.strip(), int(port_str)))
        else:
            hosts.append((part, 26379))
    return hosts


def build_redis_client() -> Optional[redis_lib.Redis]:
    """Build and return a connected Redis client, or *None* on failure.

    Call once at application startup.  The returned client is thread-safe and
    can be shared across all service modules.

    Returns *None* when Redis is unavailable or unconfigured; callers should
    fall back to in-memory behaviour in that case.
    """
    # ── 1. Redis Sentinel (preferred for production HA) ───────────────────────
    if _SENTINEL_HOSTS_RAW:
        sentinels = _parse_sentinel_hosts(_SENTINEL_HOSTS_RAW)
        if not sentinels:
            logger.warning(
                "⚠️  REDIS_SENTINEL_HOSTS is set but empty/invalid — "
                "falling back to REDIS_URL."
            )
        else:
            try:
                from redis.sentinel import Sentinel

                sentinel = Sentinel(
                    sentinels,
                    # Timeout for sentinel control-plane connections.
                    sentinel_kwargs={
                        "socket_connect_timeout": _TIMEOUT,
                        "socket_timeout": _TIMEOUT,
                    },
                    # Data-plane connection settings inherited by master_for().
                    socket_connect_timeout=_TIMEOUT,
                    socket_timeout=_TIMEOUT,
                    decode_responses=True,
                )
                # master_for() returns a Redis client backed by a
                # SentinelConnectionPool.  On failover it automatically
                # discovers and connects to the newly promoted master.
                client: redis_lib.Redis = sentinel.master_for(_MASTER_NAME)
                client.ping()
                logger.info(
                    "Redis Sentinel connected: master=%r sentinels=%s",
                    _MASTER_NAME,
                    sentinels,
                )
                return client
            except Exception as err:  # noqa: BLE001
                logger.warning(
                    "⚠️  Redis Sentinel connection failed (%s) — "
                    "falling back to REDIS_URL.",
                    err,
                )
                # Fall through to plain Redis URL below.

    # ── 2. Single Redis instance (local dev / docker-compose) ─────────────────
    if _REDIS_URL:
        try:
            client = redis_lib.from_url(
                _REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=_TIMEOUT,
                socket_timeout=_TIMEOUT,
            )
            client.ping()
            logger.info("Redis connected: %s", _REDIS_URL.split("@")[-1])
            return client
        except Exception as err:  # noqa: BLE001
            logger.warning(
                "⚠️  Redis connection failed (%s) — falling back to in-memory.",
                err,
            )
            return None

    # ── 3. No Redis configured ────────────────────────────────────────────────
    logger.warning(
        "⚠️  Neither REDIS_SENTINEL_HOSTS nor REDIS_URL is set. "
        "Rate limiting, caching, and background jobs require Redis. "
        "Set REDIS_SENTINEL_HOSTS for production or REDIS_URL for local dev."
    )
    return None


def build_limiter_storage_uri() -> str:
    """Return the slowapi/limits-compatible storage URI for the rate limiter.

    The ``limits`` library (used by slowapi) supports:
      - ``redis://host:port``                                   — single Redis
      - ``redis+sentinel://host1:port1,host2:port2/name``       — Sentinel HA
      - ``memory://``                                           — in-process
    """
    if _SENTINEL_HOSTS_RAW:
        sentinels = _parse_sentinel_hosts(_SENTINEL_HOSTS_RAW)
        if sentinels:
            hosts_part = ",".join(f"{h}:{p}" for h, p in sentinels)
            uri = f"redis+sentinel://{hosts_part}/{_MASTER_NAME}"
            logger.debug("Rate-limiter storage: %s", uri)
            return uri

    if _REDIS_URL:
        return _REDIS_URL

    return "memory://"
