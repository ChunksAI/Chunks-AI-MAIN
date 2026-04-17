"""
backend/services/usage.py — Single enforcement entry point for all request limits.

Wraps the three independent limit systems (guest IP quotas, per-device sliding
windows, per-plan feature quotas) into one call so route handlers have no
boilerplate.

Usage::

    from services.usage import enforce, UsageLimitExceeded

    try:
        enforce(request, user_id=user_id, tier=tier, is_exempt=is_exempt,
                guest_feature='workspace', plan_feature='daily_messages',
                redis_client=redis)
    except UsageLimitExceeded as e:
        return e.response()

Fail behaviour when Redis is unavailable
-----------------------------------------
* Guest users  → **fail CLOSED** (deny the request, HTTP 503).
  Rationale: without Redis there is no reliable way to enforce IP quotas, so
  unauthenticated requests are blocked to prevent abuse during outages.
* Paid users   → **fail OPEN** (allow the request with a ``log.warning``).
  Rationale: transient Redis unavailability should not interrupt paying users.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


# ── Public exception ──────────────────────────────────────────────────────────

class UsageLimitExceeded(Exception):
    """Raised by :func:`enforce` when any request-limit check fails.

    Carries a ready-made :class:`~fastapi.responses.JSONResponse` that can be
    returned directly from a route handler::

        except UsageLimitExceeded as e:
            return e.response()
    """

    def __init__(self, json_response: JSONResponse) -> None:
        self._response = json_response
        super().__init__("Usage limit exceeded")

    def response(self) -> JSONResponse:
        """Return the JSONResponse for this limit breach."""
        return self._response


# ── Public API ────────────────────────────────────────────────────────────────

def enforce(
    request,
    *,
    user_id: str,
    tier,
    is_exempt: bool = False,
    guest_feature: str = 'workspace',
    plan_feature: Optional[str] = None,
    redis_client=None,
) -> None:
    """Run all request-limit checks in the correct order.

    Parameters
    ----------
    request:
        Starlette/FastAPI ``Request`` object — used to read IP, headers, and
        the Authorization header for guest detection.
    user_id:
        Resolved user identity.  An ``'ip:'``-prefixed value (e.g.
        ``'ip:1.2.3.4'``) indicates an unauthenticated guest; any other value
        is treated as a signed-in user.
    tier:
        Subscription tier (``Tier`` enum or plain string).  Passed through to
        :func:`~services.plan_limits.check_plan_limit`.
    is_exempt:
        When ``True`` all checks are skipped (owner / admin accounts).
    guest_feature:
        Guest rate-limit bucket, e.g. ``'workspace'``, ``'exam'``,
        ``'studyplan'``, ``'visual'``, ``'research'``, ``'general'``.
        Only used when the caller is a guest.
    plan_feature:
        Plan quota key, e.g. ``'daily_messages'``,
        ``'monthly_flashcard_sets'``.  ``None`` means no plan check is run.
    redis_client:
        Live Redis client (or ``None`` if unavailable).

    Raises
    ------
    UsageLimitExceeded
        When any of the three checks rejects the request.
    """
    is_guest = (not user_id) or user_id.startswith('ip:')

    # ── 1. Guest IP quota ─────────────────────────────────────────────────────
    if is_guest:
        _enforce_guest(request, guest_feature, redis_client)
        return  # guests bypass device + plan checks

    # Exempt accounts (owner / admin) skip all further checks
    if is_exempt:
        return

    # ── 2. Per-device sliding-window rate limit ───────────────────────────────
    from services.device_abuse import check_device_rate_limit
    block = check_device_rate_limit(user_id, request)
    if block is not None:
        raise UsageLimitExceeded(block)

    # ── 3. Per-plan feature quota ─────────────────────────────────────────────
    if plan_feature:
        from services.plan_limits import check_plan_limit, PlanLimitExceeded
        try:
            check_plan_limit(user_id, tier, plan_feature)
        except PlanLimitExceeded as exc:
            raise UsageLimitExceeded(exc.response()) from exc


# ── Internal guest enforcement ────────────────────────────────────────────────

def _guest_unavailable_response() -> JSONResponse:
    return JSONResponse(
        {
            'success':       False,
            'guest_limited': True,
            'error':         (
                'Service temporarily unavailable. '
                'Please sign in to continue.'
            ),
        },
        status_code=503,
    )


def _enforce_guest(request, feature: str, redis_client) -> None:
    """Enforce per-IP daily rate limit for unauthenticated (guest) requests.

    Unlike :func:`~guest_limits.guest_gate`, which fails **open** when Redis
    is unavailable, this function fails **closed**: guests are denied when
    Redis cannot be reached, preventing quota bypass during outages.
    """
    from services.guest_limits import GUEST_LIMITS, GuestLimitExceeded

    limit = GUEST_LIMITS.get(feature)
    if limit is None:
        logger.info("usage._enforce_guest: unknown feature '%s' — skipping", feature)
        return

    ip = _client_ip(request)

    # ── Fail CLOSED when Redis is unconfigured ────────────────────────────────
    if redis_client is None:
        logger.warning(
            "usage._enforce_guest: Redis unavailable — BLOCKING guest "
            "(fail-closed) feature=%s ip=%s",
            feature, ip,
        )
        raise UsageLimitExceeded(_guest_unavailable_response())

    key = _guest_redis_key(ip, feature)

    try:
        from redis.exceptions import WatchError as _WatchError
    except ImportError:
        _WatchError = Exception

    try:
        pipe = redis_client.pipeline(True)
        for _attempt in range(3):
            try:
                pipe.watch(key)
                raw     = pipe.get(key)
                current = int(raw) if raw else 0
                if current >= limit:
                    pipe.reset()
                    logger.info(
                        "usage._enforce_guest: BLOCKED ip=%s feature=%s "
                        "count=%d limit=%d",
                        ip, feature, current, limit,
                    )
                    raise UsageLimitExceeded(
                        GuestLimitExceeded(feature, limit, current).response()
                    )
                pipe.multi()
                pipe.incr(key)
                pipe.expire(key, 90_000)   # ~25 h TTL
                results = pipe.execute()
                after   = int(results[0])
                logger.info(
                    "usage._enforce_guest: ALLOWED ip=%s feature=%s "
                    "count=%d/%d",
                    ip, feature, after, limit,
                )
                return
            except _WatchError:
                continue   # concurrent write — retry

        # All retries exhausted — fail CLOSED for guests
        logger.warning(
            "usage._enforce_guest: Redis retries exhausted — BLOCKING guest "
            "(fail-closed) feature=%s ip=%s",
            feature, ip,
        )
        raise UsageLimitExceeded(_guest_unavailable_response())

    except UsageLimitExceeded:
        raise   # propagate our own exceptions unchanged
    except Exception as exc:
        # Redis error during check — fail CLOSED for guests
        logger.warning(
            "usage._enforce_guest: Redis error (%s) — BLOCKING guest "
            "(fail-closed) feature=%s ip=%s",
            exc, feature, ip,
        )
        raise UsageLimitExceeded(_guest_unavailable_response())


# ── Private helpers (inlined from guest_limits to avoid coupling to its internals) ──

def _client_ip(request) -> str:
    """Return the real client IP from a Starlette/FastAPI Request object."""
    if request is not None and request.client:
        return request.client.host or '0.0.0.0'
    return '0.0.0.0'


def _guest_redis_key(ip: str, feature: str) -> str:
    """Build the Redis key for a guest IP + feature + current UTC day."""
    from datetime import datetime, timezone
    day = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    return f'guest_limit:{feature}:{ip}:{day}'
