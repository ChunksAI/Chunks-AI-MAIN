"""
backend/services/plan_limits.py — Per-plan feature limits and enforcement.

Provides:
  - PLAN_LIMITS          dict of tier → feature → limit
  - check_plan_limit()   verify a user has not exceeded a feature limit
  - get_plan_limits()    return the limits dict for a given tier
  - PlanLimitExceeded    exception with a ready-made Flask response

Limits are tracked in Redis (daily / monthly keys with auto-expiry) with an
in-memory fallback when Redis is unavailable — same resilience pattern as
token_budget / answer_cache / embedding_cache.

Usage in any endpoint::

    from services.plan_limits import check_plan_limit, PlanLimitExceeded
    from services.auth import Tier

    user_id, tier = _extract_verified_user()
    try:
        check_plan_limit(user_id, tier, 'daily_messages')
    except PlanLimitExceeded as exc:
        return exc.response()
"""
from __future__ import annotations

import datetime
import logging
from typing import Optional

from flask import jsonify

logger = logging.getLogger(__name__)

# ── Module-level state (injected by init()) ───────────────────────────────────
_redis = None
_mem_counters: dict[str, int] = {}   # fallback when Redis is unavailable


def init(redis=None) -> None:
    """Inject Redis handle.  Call once from server.py at startup."""
    global _redis
    _redis = redis


# ── Plan definitions ──────────────────────────────────────────────────────────
#
#   -1 means unlimited (never blocked).
#   Limits are checked per calendar day (UTC) or per calendar month (UTC).
#
#   Feature key naming:
#     daily_*   → reset every UTC day
#     monthly_* → reset every UTC month

PLAN_LIMITS: dict[str, dict[str, int]] = {
    'free': {
        'daily_messages':         25,
        'daily_image_questions':   5,
        'monthly_flashcard_sets': 10,
        'monthly_study_plans':     5,
        'monthly_quizzes':         5,
        'monthly_research':        0,     # not available on Free
        'monthly_exam_prep':       0,     # not available on Free
        'max_workspaces':          3,
        'max_file_uploads':        3,
    },
    'pro': {
        'daily_messages':         -1,     # unlimited
        'daily_image_questions':  -1,
        'monthly_flashcard_sets': -1,
        'monthly_study_plans':    -1,
        'monthly_quizzes':        -1,
        'monthly_research':       -1,
        'monthly_exam_prep':      -1,
        'max_workspaces':         -1,
        'max_file_uploads':       -1,
    },
    'ultra': {
        'daily_messages':         -1,
        'daily_image_questions':  -1,
        'monthly_flashcard_sets': -1,
        'monthly_study_plans':    -1,
        'monthly_quizzes':        -1,
        'monthly_research':       -1,
        'monthly_exam_prep':      -1,
        'max_workspaces':         -1,
        'max_file_uploads':       -1,
    },
}

# Human-readable feature names for error messages
_FEATURE_LABELS: dict[str, str] = {
    'daily_messages':         'daily AI messages',
    'daily_image_questions':  'daily image questions',
    'monthly_flashcard_sets': 'monthly flashcard generations',
    'monthly_study_plans':    'monthly study plan generations',
    'monthly_quizzes':        'monthly quiz generations',
    'monthly_research':       'research assistant',
    'monthly_exam_prep':      'exam prep',
    'max_workspaces':         'workspaces',
    'max_file_uploads':       'file uploads',
}


# ── Exception ─────────────────────────────────────────────────────────────────

class PlanLimitExceeded(Exception):
    """Raised when a user has exceeded a feature limit for their plan."""

    def __init__(self, feature: str, limit: int, used: int, tier: str):
        self.feature = feature
        self.limit   = limit
        self.used    = used
        self.tier    = tier
        super().__init__(
            f"Plan limit exceeded: {feature} ({used}/{limit}) on {tier} plan"
        )

    def response(self):
        """Return a Flask (response, status_code) tuple."""
        label = _FEATURE_LABELS.get(self.feature, self.feature)

        if self.limit == 0:
            msg = (
                f'{label.capitalize()} is not available on the {self.tier.capitalize()} plan. '
                'Upgrade to Pro to unlock this feature!'
            )
        else:
            msg = (
                f'You\'ve reached your {label} limit ({self.limit}) '
                f'on the {self.tier.capitalize()} plan. Upgrade to Pro for unlimited access!'
            )

        return jsonify({
            'success':        False,
            'plan_limited':   True,
            'feature':        self.feature,
            'limit':          self.limit,
            'used':           self.used,
            'tier':           self.tier,
            'upgrade_needed': True,
            'error':          msg,
        }), 429


# ── Key helpers ───────────────────────────────────────────────────────────────

def _today() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')


def _this_month() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m')


def _redis_key(user_id: str, feature: str) -> str:
    """Build a Redis key scoped to the correct time window."""
    if feature.startswith('daily_'):
        return f'plan_limit:{user_id}:{feature}:{_today()}'
    elif feature.startswith('monthly_'):
        return f'plan_limit:{user_id}:{feature}:{_this_month()}'
    else:
        return f'plan_limit:{user_id}:{feature}'


def _ttl_for_feature(feature: str) -> int:
    """Return TTL in seconds for a feature counter."""
    if feature.startswith('daily_'):
        return 86_400 + 3_600        # 25 h (safety margin)
    elif feature.startswith('monthly_'):
        return 35 * 86_400           # 35 days
    return 90 * 86_400               # 90 days for static limits


# ── Public API ────────────────────────────────────────────────────────────────

def get_plan_limits(tier: str) -> dict[str, int]:
    """Return the limits dict for a given tier string."""
    return dict(PLAN_LIMITS.get(tier, PLAN_LIMITS['free']))


def get_usage(user_id: str, feature: str) -> int:
    """Return the current count for a user/feature combo."""
    key = _redis_key(user_id, feature)
    if _redis is not None:
        try:
            val = _redis.get(key)
            return int(val) if val is not None else 0
        except Exception:
            pass
    return _mem_counters.get(key, 0)


def _increment(user_id: str, feature: str) -> int:
    """Atomically increment a counter and return the new value."""
    key = _redis_key(user_id, feature)
    if _redis is not None:
        try:
            new_val = _redis.incr(key)
            if new_val == 1:
                _redis.expire(key, _ttl_for_feature(feature))
            return new_val
        except Exception as exc:
            logger.warning('plan_limits Redis incr error: %s', exc)
    # In-memory fallback
    _mem_counters[key] = _mem_counters.get(key, 0) + 1
    return _mem_counters[key]


def check_plan_limit(
    user_id: str,
    tier,   # Tier enum or str
    feature: str,
) -> None:
    """
    Check whether the user is within their plan limit for *feature*.

    - If the limit is -1 (unlimited) → no-op.
    - If the limit is  0 (feature disabled) → always raises.
    - Otherwise → increment counter; raise if it exceeds the limit.

    IP-prefixed user IDs (guests) are treated as ``free``.

    Raises :class:`PlanLimitExceeded` when the limit is breached.
    """
    tier_str = tier.value if hasattr(tier, 'value') else str(tier).lower()
    if tier_str not in PLAN_LIMITS:
        tier_str = 'free'

    limits = PLAN_LIMITS[tier_str]
    limit  = limits.get(feature)

    if limit is None:
        return            # unknown feature — fail open

    if limit == -1:
        return            # unlimited — always allowed

    if limit == 0:
        raise PlanLimitExceeded(feature, 0, 0, tier_str)

    # For daily/monthly counters, increment and check
    if feature.startswith('daily_') or feature.startswith('monthly_'):
        count = get_usage(user_id, feature)
        if count >= limit:
            raise PlanLimitExceeded(feature, limit, count, tier_str)
        _increment(user_id, feature)
        return

    # For static limits (max_*), just compare the current count
    count = get_usage(user_id, feature)
    if count >= limit:
        raise PlanLimitExceeded(feature, limit, count, tier_str)


def record_plan_usage(user_id: str, feature: str) -> int:
    """Record usage without checking limits.  Returns the new count."""
    return _increment(user_id, feature)
