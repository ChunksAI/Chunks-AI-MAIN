"""
backend/services/device_abuse.py — Per-user, per-device rate limiting.

Why this exists:
  Client-side fingerprint checks can be bypassed by clearing localStorage,
  using incognito mode, or disabling JavaScript.  This module enforces
  server-side rate limits keyed by (user_id, device_id) in Redis so that
  abuse is caught regardless of client behaviour.

  Device identification uses a composite key that combines:
    - X-Device-Id header (opaque client-generated ID)
    - User-Agent string
    - Client IP address
  This avoids relying on fingerprinting alone.

Rate-limit windows (all per user+device combination):
  - Short burst  :  30 requests / minute
  - Sustained    : 200 requests / hour
  - Daily cap    : 500 requests / day

All state is Redis-backed with in-memory fallback — identical resilience
pattern to answer_cache / embedding_cache / token_budget.

Usage in any endpoint::

    from services.device_abuse import check_device_rate_limit, DeviceRateLimited

    @app.route('/ask', methods=['POST'])
    def ask():
        result = check_device_rate_limit(user_id)
        if result is not None:
            return result  # 429 response
        ...

IMPORTANT — Redis is required for production enforcement.
  When Redis is unavailable, check_device_rate_limit fails open.
  Set REDIS_URL in your Railway environment for production-grade enforcement.
"""
from __future__ import annotations

import hashlib
import logging
import time
from typing import Optional

from flask import jsonify, request

logger = logging.getLogger(__name__)

# ── Module-level state (injected by init()) ───────────────────────────────────
_redis = None

# In-memory fallback: dict of key → list of timestamps
_mem_counters: dict[str, list[float]] = {}

# ── Configurable rate limits ──────────────────────────────────────────────────
# Each tuple: (window_seconds, max_requests, redis_ttl_seconds)
RATE_LIMITS: list[tuple[int, int, int]] = [
    (60,    30,   120),     # 30 req / minute  (TTL 2 min)
    (3600,  200,  7_200),   # 200 req / hour   (TTL 2 h)
    (86400, 500,  90_000),  # 500 req / day    (TTL 25 h)
]

_REDIS_KEY_PREFIX = 'device_rl:'


def init(redis=None) -> None:
    """Inject Redis handle.  Call once from server.py at startup."""
    global _redis
    _redis = redis


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_client_ip() -> str:
    """Return the real client IP (ProxyFix-corrected)."""
    return request.remote_addr or '0.0.0.0'


def _build_device_key(user_id: str) -> str:
    """
    Build a composite device identifier from multiple signals.

    Combines:
      - X-Device-Id header (client-generated, optional)
      - User-Agent string
      - Client IP address

    This avoids relying on any single signal (especially fingerprints)
    and makes it expensive for abusers to rotate all three simultaneously.
    """
    device_header = request.headers.get('X-Device-Id', '').strip()[:128]
    user_agent = request.headers.get('User-Agent', '').strip()[:256]
    ip = _get_client_ip()

    # Hash the composite to get a fixed-length key
    raw = f'{device_header}|{user_agent}|{ip}'
    device_hash = hashlib.sha256(raw.encode()).hexdigest()[:16]

    return f'{user_id}:{device_hash}'


# ── Redis sliding-window counters ─────────────────────────────────────────────

def _redis_check_window(
    base_key: str,
    window_secs: int,
    max_requests: int,
    ttl: int,
    now: float,
) -> bool:
    """
    Check a single sliding-window counter in Redis using a sorted set.

    Returns True if the request is ALLOWED, False if rate-limited.
    Adds the current timestamp to the sorted set if allowed.
    """
    if _redis is None:
        return True  # fail open

    key = f'{_REDIS_KEY_PREFIX}{base_key}:{window_secs}'
    window_start = now - window_secs

    try:
        pipe = _redis.pipeline(True)
        # Remove expired entries
        pipe.zremrangebyscore(key, '-inf', window_start)
        # Count remaining entries in the window
        pipe.zcard(key)
        results = pipe.execute()
        count = results[1]

        if count >= max_requests:
            return False

        # Add the new request timestamp
        pipe2 = _redis.pipeline(False)
        pipe2.zadd(key, {str(now): now})
        pipe2.expire(key, ttl)
        pipe2.execute()

        return True

    except Exception as exc:
        logger.warning("device_abuse: Redis error (%s) — allowing request (fail-open)", exc)
        return True


# ── In-memory sliding-window fallback ─────────────────────────────────────────

def _mem_check_window(
    base_key: str,
    window_secs: int,
    max_requests: int,
    now: float,
) -> bool:
    """
    Check a single sliding-window counter using in-memory storage.

    Returns True if the request is ALLOWED, False if rate-limited.
    """
    key = f'{base_key}:{window_secs}'
    window_start = now - window_secs

    timestamps = _mem_counters.get(key, [])
    # Prune expired entries
    timestamps = [t for t in timestamps if t > window_start]
    _mem_counters[key] = timestamps

    if len(timestamps) >= max_requests:
        return False

    timestamps.append(now)
    return True


# ── Public API ────────────────────────────────────────────────────────────────

class DeviceRateLimited(Exception):
    """Raised when a user+device combination has exceeded its rate limit."""

    def __init__(self, user_id: str, window: str, limit: int):
        self.user_id = user_id
        self.window = window
        self.limit = limit
        super().__init__(
            f"Device rate limit exceeded for user {user_id}: "
            f"{limit} requests per {window}"
        )

    def response(self):
        """Return a Flask (response, status_code) tuple."""
        return jsonify({
            'success': False,
            'error': (
                f'Too many requests. Limit: {self.limit} per {self.window}. '
                'Please slow down and try again later.'
            ),
            'rate_limited': True,
            'window': self.window,
            'limit': self.limit,
        }), 429


_WINDOW_LABELS = {
    60: 'minute',
    3600: 'hour',
    86400: 'day',
}


def check_device_rate_limit(user_id: str) -> Optional[tuple]:
    """
    Check whether the current request from (user_id, device) is within
    all rate-limit windows.

    Returns None if the request is allowed.
    Returns a (response, 429) tuple if any window is exceeded.

    Call this at the TOP of an endpoint, after user authentication.
    """
    if not user_id:
        return None  # fail open for unauthenticated — guest_gate handles those

    device_key = _build_device_key(user_id)
    now = time.time()

    for window_secs, max_reqs, ttl in RATE_LIMITS:
        if _redis is not None:
            allowed = _redis_check_window(device_key, window_secs, max_reqs, ttl, now)
        else:
            allowed = _mem_check_window(device_key, window_secs, max_reqs, now)

        if not allowed:
            label = _WINDOW_LABELS.get(window_secs, f'{window_secs}s')
            logger.warning(
                "device_abuse: BLOCKED user=%s device_key=%s window=%s limit=%d",
                user_id, device_key, label, max_reqs,
            )
            exc = DeviceRateLimited(user_id, label, max_reqs)
            return exc.response()

    return None
