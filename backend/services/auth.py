"""
backend/services/auth.py — Authentication and authorisation helpers.

Provides:
  - Tier enum (subscription tiers)
  - _verify_supabase_jwt() — verify a JWT locally (fast path) or via REST API
  - _get_user_tier_from_db() — look up a user's tier in Supabase (Redis-cached)
  - _get_and_increment_daily_count() — atomic free-tier daily counter
  - _extract_verified_user() — one-stop helper called by every endpoint

All functions rely on module-level state injected by init() at startup.
Call init() once from server.py before handling any requests.

JWT verification strategy
-------------------------
When ``SUPABASE_JWT_SECRET`` is supplied the token is verified **locally**
using PyJWT (HS256, audience ``authenticated``).  This is a pure in-process
crypto operation — no network round-trip — and the latency is < 0.1 ms.

If the secret is absent (e.g. legacy deployments) we fall back to the
Supabase ``/auth/v1/user`` REST endpoint so existing behaviour is preserved.

Tier caching
------------
``_get_user_tier_from_db`` caches each user's plan in Redis with a 5-minute
TTL.  The Supabase REST call is only made on cache miss or after the key
expires, removing a second network round-trip from the hot path.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)

# ── Module-level state injected at startup ─────────────────────────────────────
_session = None
SUPABASE_URL: str = ''
SUPABASE_SERVICE_KEY: str = ''
_redis = None
_jwt_secret: str = ''   # SUPABASE_JWT_SECRET — enables local verification

FREE_TIER_DAILY_LIMIT = 20   # matches the 20-message client-side limit
MAX_HISTORY_TURNS     = 10   # consistent conversation context window

# Redis TTL for cached tier values (5 minutes)
_TIER_CACHE_TTL = 300


def init(session, supabase_url: str, supabase_service_key: str,
         redis: Any = None, jwt_secret: str = '') -> None:
    """Inject shared dependencies. Call once from server.py at startup."""
    global _session, SUPABASE_URL, SUPABASE_SERVICE_KEY, _redis, _jwt_secret
    _session            = session
    SUPABASE_URL        = supabase_url
    SUPABASE_SERVICE_KEY = supabase_service_key
    _redis              = redis
    _jwt_secret         = jwt_secret or ''
    if _jwt_secret:
        logger.info("Auth: local JWT verification enabled (SUPABASE_JWT_SECRET set)")
    else:
        logger.warning(
            "Auth: SUPABASE_JWT_SECRET not set — falling back to Supabase REST API "
            "for JWT verification (adds latency on every authenticated request)."
        )


# ── Tier enum ─────────────────────────────────────────────────────────────────
class Tier(str, Enum):
    """Canonical subscription tiers.

    Inherits from ``str`` so instances compare equal to their string values
    and can be passed wherever a plain string is expected (JSON serialisation,
    f-strings, logging, etc.) without an explicit ``.value`` call.

    Ordering (weakest → strongest): FREE < PAID < PRO < ULTRA.

    Usage
    -----
    Tier('pro')          # → Tier.PRO   (construct from DB string)
    Tier.PRO.is_paid     # → True
    Tier.FREE.is_paid    # → False
    server_tier == Tier.FREE          # direct equality
    """

    FREE  = 'free'
    PAID  = 'paid'
    PRO   = 'pro'
    ULTRA = 'ultra'

    @property
    def is_paid(self) -> bool:
        """Return True for any tier that grants paid-level access."""
        return self in (Tier.PAID, Tier.PRO, Tier.ULTRA)

    @classmethod
    def from_db(cls, value: str) -> 'Tier':
        """Parse a raw DB string, defaulting to FREE on any unknown value."""
        try:
            return cls(value.lower().strip())
        except (ValueError, AttributeError):
            return cls.FREE


def _verify_jwt_local(token: str) -> dict | None:
    """Verify *token* locally using PyJWT and the configured JWT secret.

    Returns a minimal user dict ``{'id': <uuid>, 'email': <str>}`` on
    success, or ``None`` if the token is invalid, expired, or the secret
    is not configured.

    Supabase issues HS256 tokens with the audience ``"authenticated"``.
    The ``sub`` claim contains the user UUID.
    """
    if not _jwt_secret or not token:
        return None
    try:
        import jwt  # PyJWT
        payload = jwt.decode(
            token,
            _jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            return None
        return {
            "id":    user_id,
            "email": payload.get("email", ""),
        }
    except Exception as exc:
        logger.debug("Local JWT verification failed: %s", exc)
        return None


def _verify_supabase_jwt(token: str) -> dict | None:
    """Verify a Supabase JWT and return the user record, or None if invalid.

    Fast path: if ``SUPABASE_JWT_SECRET`` is configured, the token is decoded
    locally with PyJWT — no network call.

    Slow path: falls back to the Supabase ``/auth/v1/user`` REST endpoint
    when the secret is absent (preserves backward compatibility).

    Returns dict with at least: {'id': <uuid>, 'email': <str>}
    """
    # ── 1. Local verification (fast, no network) ──────────────────────────────
    if _jwt_secret:
        return _verify_jwt_local(token)

    # ── 2. REST API fallback ──────────────────────────────────────────────────
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY or not token:
        return None
    try:
        resp = _session.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_SERVICE_KEY,
            },
            timeout=5
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"JWT verify error: {e}")
    return None


def _get_user_tier_from_db(user_id: str) -> Tier:
    """Look up the user's subscription tier in Supabase.

    Results are cached in Redis for ``_TIER_CACHE_TTL`` seconds (5 min) to
    avoid a REST round-trip on every authenticated request.

    Returns a :class:`Tier` enum value; defaults to ``Tier.FREE`` on any error.
    Expects a 'users' table with columns: id (uuid), plan (text).
    """
    if not user_id:
        return Tier.FREE

    # ── 1. Redis cache ────────────────────────────────────────────────────────
    # The Redis client is expected to have decode_responses=True (as set in
    # server.py), so get() returns a str directly.
    cache_key = f"tier:{user_id}"
    if _redis is not None:
        try:
            cached = _redis.get(cache_key)
            if cached is not None:
                return Tier.from_db(cached)
        except Exception as exc:
            logger.warning("Tier cache read error: %s", exc)

    # ── 2. Supabase REST lookup ───────────────────────────────────────────────
    tier = Tier.FREE
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            resp = _session.get(
                f"{SUPABASE_URL}/rest/v1/users",
                params={"id": f"eq.{user_id}", "select": "plan"},
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "apikey": SUPABASE_SERVICE_KEY,
                },
                timeout=5
            )
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    tier = Tier.from_db(rows[0].get('plan', ''))
        except Exception as e:
            logger.warning(f"Tier lookup error: {e}")

    # ── 3. Write result back to cache ─────────────────────────────────────────
    if _redis is not None:
        try:
            _redis.setex(cache_key, _TIER_CACHE_TTL, tier.value)
        except Exception as exc:
            logger.warning("Tier cache write error: %s", exc)

    return tier


def _get_and_increment_daily_count(user_id: str, date_str: str) -> int:
    """
    Atomically increment a daily message counter for a user.
    Returns the NEW count after incrementing.

    Priority:
      1. Redis  — atomic INCR + EXPIRE; shared across all Gunicorn workers;
                  survives deploys as long as Redis persists.
      2. Supabase RPC — cross-deploy persistence; used to sync popular counts.
      3. In-memory dict — local dev / last resort; not shared across workers.
    """
    key = f"freetier:{user_id}:{date_str}"

    # ── 1. Redis (production path) ────────────────────────────────────────────
    if _redis is not None:
        try:
            count = _redis.incr(key)          # atomic: creates key at 1 if absent
            if count == 1:
                _redis.expire(key, 86400)     # expire after 24 h on first write
            return count
        except Exception as e:
            logger.warning("Redis counter error (falling through): %s", e)

    # ── 2. Supabase RPC ───────────────────────────────────────────────────────
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            resp = _session.post(
                f"{SUPABASE_URL}/rest/v1/rpc/increment_free_tier_usage",
                json={"p_user_id": user_id, "p_date": date_str},
                headers={
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Content-Type": "application/json",
                },
                timeout=5
            )
            if resp.status_code == 200:
                result = resp.json()
                if isinstance(result, int):
                    return result
                if isinstance(result, dict):
                    return result.get('count', 1)
        except Exception as e:
            logger.warning("Supabase daily count error (falling through): %s", e)

    # ── 3. No storage available — allow the request ─────────────────────────────
    logger.warning("No counter storage available — allowing request")
    return 1


def _extract_verified_user(request=None):
    """
    Extract and verify the Supabase JWT from the current request's
    Authorization header and look up the user's tier.

    Accepts an optional Starlette/FastAPI ``Request`` object.  When provided,
    the JWT is read from its headers; otherwise falls back to a guest identity.

    Returns (verified_user_id: str, server_tier: Tier).
    Never raises — on any failure it returns an IP-based fallback ID
    and Tier.FREE so callers can decide whether to block or allow.

    Signed-in users (free, pro, or ultra) have NO daily message limit.
    Guest limits are enforced separately via guest_gate() before this is called.

    Usage in any endpoint::

        user_id, tier = _extract_verified_user(request)
    """
    if request is not None:
        auth_header = request.headers.get('authorization', '') or request.headers.get('Authorization', '')
    else:
        auth_header = ''
    jwt_token        = auth_header[7:] if auth_header.startswith('Bearer ') else ''
    verified_user    = _verify_supabase_jwt(jwt_token) if jwt_token else None
    verified_user_id = verified_user.get('id') if verified_user else None

    if verified_user_id:
        server_tier = _get_user_tier_from_db(verified_user_id)
    else:
        server_tier      = Tier.FREE
        # Use a placeholder IP since we don't have the request object always
        if request is not None and request.client:
            ip = request.client.host or '0.0.0.0'
        else:
            ip = '0.0.0.0'
        verified_user_id = f'ip:{ip}'

    # No daily limit for signed-in users — free, pro, or ultra all get unlimited access.
    # Guest limits are handled separately by guest_gate() before this function is called.

    return verified_user_id, server_tier
