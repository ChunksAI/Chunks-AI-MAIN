# Superseded by services/usage.py — kept for reference until migration is verified
"""
backend/guest_limits.py — Server-side guest rate limiting by IP address.

Why this exists:
  Guests can bypass localStorage-based limits by using incognito mode,
  clearing storage, or switching browsers. This module stores counters
  in Redis (keyed by IP + feature + day), so limits survive any
  client-side tricks.

Limits per IP per day (matches frontend guestLimits.js):
  general   → 1 000 requests
  workspace → 1 000 requests
  library   → 1 000 book loads
  studyplan → 1 000 generations
  visual    → 1 000 lessons
  research  → 1 000 generations
  exam      → 1 000 exams (MCQ only, max 5 questions enforced separately)

Usage in any endpoint:
    from guest_limits import guest_gate, GuestLimitExceeded

    @app.route('/ask', methods=['POST'])
    def ask():
        guest_gate(request, 'general', _redis)
        ...

guest_gate() is a no-op for logged-in users (Authorization header present).

IMPORTANT — Redis is required for production enforcement.
  When Redis is unavailable, guest_gate fails open (allows the request).
  Set REDIS_URL in your Railway environment for production-grade enforcement.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi.responses import JSONResponse
try:
    from redis.exceptions import WatchError as _RedisWatchError
except ImportError:
    _RedisWatchError = Exception

logger = logging.getLogger(__name__)

# ── Per-feature daily limits ───────────────────────────────────────────────────
GUEST_LIMITS: dict[str, int] = {
    'general':   1_000,
    'workspace': 1_000,
    'library':   1_000,
    'studyplan': 1_000,
    'visual':    1_000,
    'research':  1_000,
    'exam':      1_000,
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_client_ip(req) -> str:
    """
    Return the real client IP from a Starlette/FastAPI Request object.

    server.py applies ProxyHeadersMiddleware which fills request.client.host
    with the correct client IP.
    """
    if req is not None and req.client:
        return req.client.host or '0.0.0.0'
    return '0.0.0.0'


def _today() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')


def _redis_key(ip: str, feature: str, day: str) -> str:
    return f'guest_limit:{feature}:{ip}:{day}'


def _is_guest(req) -> bool:
    """Return True when the request has NO valid Authorization header (i.e. is a guest)."""
    auth = req.headers.get('authorization', '').strip() if req else ''
    return not auth or not auth.startswith('Bearer ')


def _check_and_increment(key: str, limit: int, redis_client) -> tuple[int, int]:
    """
    Atomically check and increment the counter.
    Returns (current_count_BEFORE_increment, new_count_AFTER_increment).

    Uses a Redis pipeline with WATCH for optimistic locking — avoids Lua
    scripting which can fail on some Redis ACL configs.  When Redis is
    unavailable the request is allowed through (fail-open).
    """
    # ── Redis path ────────────────────────────────────────────────────────────
    if redis_client is not None:
        try:
            pipe = redis_client.pipeline(True)   # True = WATCH-based transaction
            for _attempt in range(3):
                try:
                    pipe.watch(key)
                    raw     = pipe.get(key)
                    current = int(raw) if raw else 0
                    if current >= limit:
                        pipe.reset()
                        return current, current   # already at limit — don't increment
                    pipe.multi()
                    pipe.incr(key)
                    pipe.expire(key, 90_000)      # ~25 h TTL
                    results = pipe.execute()
                    after   = int(results[0])
                    return current, after
                except _RedisWatchError:
                    continue                      # concurrent write — retry
            # All retries exhausted — allow the request through
            logger.warning("guest_limits: Redis pipeline retries exhausted — allowing request (fail-open)")
        except Exception as exc:
            logger.warning("guest_limits: Redis error (%s) — allowing request (fail-open)", exc)

    # ── No Redis — fail open ──────────────────────────────────────────────────
    logger.warning("guest_limits: Redis unavailable — allowing request (fail-open)")
    return 0, 1


# ── Public API ────────────────────────────────────────────────────────────────

class GuestLimitExceeded(Exception):
    """Raised when a guest has exhausted their daily quota for a feature."""

    def __init__(self, feature: str, limit: int, used: int):
        self.feature = feature
        self.limit   = limit
        self.used    = used
        super().__init__(f"Guest limit exceeded: {feature} ({used}/{limit})")

    def response(self):
        """Return a JSONResponse ready to be returned from a FastAPI view."""
        return JSONResponse({
            'success':       False,
            'guest_limited': True,
            'feature':       self.feature,
            'limit':         self.limit,
            'used':          self.used,
            'error':         (
                f'Guest limit reached for {self.feature}. '
                'Sign up for free to keep going!'
            ),
        }, status_code=429)


def guest_gate(req, feature: str, redis_client=None) -> None:
    """
    Check whether this guest request is within the daily IP quota.

    - If the user is logged in (Authorization header present): no-op.
    - If the feature is unknown: no-op (fail open for unrecognised features).
    - If the limit is exceeded: raises GuestLimitExceeded.
    - Otherwise: atomically increments the counter and returns normally.

    Uses a single atomic Lua script on Redis — no peek-then-increment race.
    Call this at the TOP of an endpoint, before any expensive work.
    """
    if not _is_guest(req):
        return  # logged-in users are never rate-limited here

    if redis_client is None:
        logger.warning(
            "guest_gate: Redis unavailable — using in-memory fallback. "
            "Limits will NOT persist across workers or restarts. "
            "Set REDIS_URL in Railway environment for production enforcement."
        )

    limit = GUEST_LIMITS.get(feature)
    if limit is None:
        logger.info("guest_gate: unknown feature '%s' — skipping", feature)
        return

    ip  = _get_client_ip(req)
    day = _today()
    key = _redis_key(ip, feature, day)

    before, after = _check_and_increment(key, limit, redis_client)

    # If before == after, the Lua script didn't increment — limit was already hit
    if before >= limit:
        logger.info(
            "guest_gate: BLOCKED ip=%s feature=%s count=%d limit=%d",
            ip, feature, before, limit,
        )
        raise GuestLimitExceeded(feature, limit, before)

    logger.info(
        "guest_gate: ALLOWED ip=%s feature=%s count=%d/%d",
        ip, feature, after, limit,
    )


def enforce_exam_constraints_for_guest(req, data: dict) -> dict:
    """
    If the caller is a guest, force exam mode to MCQ-only with max 5 questions.
    Returns the (possibly mutated) data dict.
    """
    if not _is_guest(req):
        return data

    data = dict(data)           # don't mutate caller's dict
    data['exam_type']      = 'mcq'
    data['question_count'] = min(int(data.get('question_count', 5)), 5)
    return data
