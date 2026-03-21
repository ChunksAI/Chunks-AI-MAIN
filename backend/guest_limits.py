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
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from collections import defaultdict
from typing import Optional

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
# Dict: key → count  (resets on restart — acceptable degraded mode)
_mem_counters: dict[str, int] = defaultdict(int)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_client_ip() -> str:
    """Return the real client IP, respecting Railway/Vercel proxy headers."""
    # X-Forwarded-For may contain a chain: "client, proxy1, proxy2"
    xff = request.headers.get('X-Forwarded-For', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.headers.get('X-Real-IP', '') or request.remote_addr or '0.0.0.0'


def _today() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')


def _redis_key(ip: str, feature: str, day: str) -> str:
    return f'guest_limit:{feature}:{ip}:{day}'


def _is_guest() -> bool:
    """Return True when the request has NO Authorization header (i.e. is a guest)."""
    auth = request.headers.get('Authorization', '').strip()
    return not auth or not auth.startswith('Bearer ')


def _increment(key: str, redis_client) -> int:
    """
    Atomically increment the counter for *key* and return the new value.
    TTL is set to 25 hours on first write (a little over one calendar day).
    Falls back to in-memory dict when Redis is unavailable.
    """
    if redis_client is not None:
        try:
            count = redis_client.incr(key)
            if count == 1:
                redis_client.expire(key, 90_000)   # 25 hours
            return count
        except Exception as exc:
            logger.warning("guest_limits: Redis error (%s) — using in-memory fallback", exc)

    # In-memory fallback
    _mem_counters[key] += 1
    return _mem_counters[key]


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
    - Otherwise: increments the counter and returns normally.

    Call this at the TOP of an endpoint, before any expensive work.
    """
    if not _is_guest():
        return  # logged-in users are never rate-limited here

    limit = GUEST_LIMITS.get(feature)
    if limit is None:
        logger.debug("guest_gate: unknown feature '%s' — skipping", feature)
        return

    ip  = _get_client_ip()
    day = _today()
    key = _redis_key(ip, feature, day)

    # Peek at current count without incrementing yet
    current = 0
    if redis_client is not None:
        try:
            raw = redis_client.get(key)
            current = int(raw) if raw else 0
        except Exception as exc:
            logger.warning("guest_gate: Redis GET error (%s) — using in-memory", exc)
            current = _mem_counters.get(key, 0)
    else:
        current = _mem_counters.get(key, 0)

    if current >= limit:
        logger.info(
            "guest_gate: BLOCKED ip=%s feature=%s count=%d limit=%d",
            ip, feature, current, limit,
        )
        raise GuestLimitExceeded(feature, limit, current)

    # Increment (will now be current+1, which is ≤ limit)
    new_count = _increment(key, redis_client)
    logger.debug(
        "guest_gate: ALLOWED ip=%s feature=%s count=%d/%d",
        ip, feature, new_count, limit,
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
