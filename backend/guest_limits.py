"""
backend/guest_limits.py — Server-side guest rate limiting by IP address.

Why this exists:
  Guests can bypass localStorage-based limits by using incognito mode,
  clearing storage, or switching browsers. This module stores counters
  in Redis (keyed by IP + feature + day), so limits survive any
  client-side tricks.

Limits per IP per day (matches frontend guestLimits.js):
  general   → 10 requests
  workspace →  5 requests
  library   →  1 book load
  studyplan →  1 generation
  visual    →  1 lesson
  research  →  1 generation
  exam      →  1 exam (MCQ only, max 5 questions enforced separately)

Usage in any endpoint:
    from guest_limits import guest_gate, GuestLimitExceeded

    @app.route('/ask', methods=['POST'])
    def ask():
        guest_gate(request, 'general', _redis)
        ...

guest_gate() is a no-op for logged-in users (Authorization header present).

IMPORTANT — in-memory fallback:
  When Redis is unavailable, counters fall back to a process-level dict.
  This is NOT shared across Gunicorn workers or server restarts.
  Set REDIS_URL in your Railway environment for production-grade enforcement.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from collections import defaultdict

from flask import request, jsonify

logger = logging.getLogger(__name__)

# ── Per-feature daily limits ───────────────────────────────────────────────────
GUEST_LIMITS: dict[str, int] = {
    'general':   10,
    'workspace':  5,
    'library':    1,
    'studyplan':  1,
    'visual':     1,
    'research':   1,
    'exam':       1,
}

# ── In-memory fallback (when Redis is unavailable) ────────────────────────────
# Thread-safe counter dict: key → count
# Resets on server restart — acceptable degraded mode.
# In production always set REDIS_URL so this path is never hit.
_mem_lock: threading.Lock = threading.Lock()
_mem_counters: dict[str, int] = defaultdict(int)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_client_ip() -> str:
    """Return the real client IP, respecting Railway/Vercel proxy headers."""
    xff = request.headers.get('X-Forwarded-For', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.headers.get('X-Real-IP', '') or request.remote_addr or '0.0.0.0'


def _today() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')


def _redis_key(ip: str, feature: str, day: str) -> str:
    return f'guest_limit:{feature}:{ip}:{day}'


def _is_guest() -> bool:
    """Return True when the request has NO valid Authorization header (i.e. is a guest)."""
    auth = request.headers.get('Authorization', '').strip()
    return not auth or not auth.startswith('Bearer ')


def _check_and_increment(key: str, limit: int, redis_client) -> tuple[int, int]:
    """
    Atomically check and increment the counter.
    Returns (current_count_BEFORE_increment, new_count_AFTER_increment).
    Uses a Lua script on Redis for true atomicity — no race conditions.
    Falls back to thread-safe in-memory dict.
    """
    # ── Redis path (atomic via Lua) ───────────────────────────────────────────
    if redis_client is not None:
        lua_script = """
local current = tonumber(redis.call('GET', KEYS[1])) or 0
if current >= tonumber(ARGV[1]) then
    return {current, current}
end
local new = redis.call('INCR', KEYS[1])
if new == 1 then
    redis.call('EXPIRE', KEYS[1], 90000)
end
return {current, new}
"""
        try:
            result = redis_client.eval(lua_script, 1, key, limit)
            before = int(result[0])
            after  = int(result[1])
            return before, after
        except Exception as exc:
            logger.warning("guest_limits: Redis Lua error (%s) — using in-memory fallback", exc)

    # ── In-memory fallback (thread-safe) ──────────────────────────────────────
    with _mem_lock:
        current = _mem_counters[key]
        if current >= limit:
            return current, current
        _mem_counters[key] += 1
        new_count = _mem_counters[key]
        return current, new_count


# ── Public API ────────────────────────────────────────────────────────────────

class GuestLimitExceeded(Exception):
    """Raised when a guest has exhausted their daily quota for a feature."""

    def __init__(self, feature: str, limit: int, used: int):
        self.feature = feature
        self.limit   = limit
        self.used    = used
        super().__init__(f"Guest limit exceeded: {feature} ({used}/{limit})")

    def response(self):
        """Return a Flask (response, status_code) tuple ready to be returned from a view."""
        return jsonify({
            'success':       False,
            'guest_limited': True,
            'feature':       self.feature,
            'limit':         self.limit,
            'used':          self.used,
            'error':         (
                f'Guest limit reached for {self.feature}. '
                'Sign up for free to keep going!'
            ),
        }), 429


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
    if not _is_guest():
        return  # logged-in users are never rate-limited here

    if redis_client is None:
        logger.warning(
            "guest_gate: Redis unavailable — using in-memory fallback. "
            "Limits will NOT persist across workers or restarts. "
            "Set REDIS_URL in Railway environment for production enforcement."
        )

    limit = GUEST_LIMITS.get(feature)
    if limit is None:
        logger.debug("guest_gate: unknown feature '%s' — skipping", feature)
        return

    ip  = _get_client_ip()
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

    logger.debug(
        "guest_gate: ALLOWED ip=%s feature=%s count=%d/%d",
        ip, feature, after, limit,
    )


def enforce_exam_constraints_for_guest(data: dict) -> dict:
    """
    If the caller is a guest, force exam mode to MCQ-only with max 5 questions.
    Returns the (possibly mutated) data dict.
    """
    if not _is_guest():
        return data

    data = dict(data)           # don't mutate caller's dict
    data['exam_type']      = 'mcq'
    data['question_count'] = min(int(data.get('question_count', 5)), 5)
    return data
