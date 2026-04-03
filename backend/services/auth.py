"""
backend/services/auth.py — Authentication and authorisation helpers.

Provides:
  - Tier enum (subscription tiers)
  - _verify_supabase_jwt() — verify a JWT via Supabase REST API
  - _get_user_tier_from_db() — look up a user's tier in Supabase
  - _get_user_role_from_db() — look up a user's role in Supabase
  - _get_and_increment_daily_count() — atomic free-tier daily counter
  - is_admin_exempt() — returns True for owner/admin users (no usage limits)
  - _extract_verified_user() — one-stop helper called by every endpoint

All functions rely on module-level state injected by init() at startup.
Call init() once from server.py before handling any requests.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from enum import Enum

logger = logging.getLogger(__name__)

# ── Module-level state injected at startup ─────────────────────────────────────
_session = None
SUPABASE_URL: str = ''
SUPABASE_SERVICE_KEY: str = ''
_redis = None

FREE_TIER_DAILY_LIMIT = 20   # matches the 20-message client-side limit
MAX_HISTORY_TURNS     = 10   # consistent conversation context window


def init(session, supabase_url: str, supabase_service_key: str, redis=None) -> None:
    """Inject shared dependencies. Call once from server.py at startup."""
    global _session, SUPABASE_URL, SUPABASE_SERVICE_KEY, _redis
    _session            = session
    SUPABASE_URL        = supabase_url
    SUPABASE_SERVICE_KEY = supabase_service_key
    _redis              = redis


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


def _verify_supabase_jwt(token: str) -> dict | None:
    """
    Verify a Supabase JWT and return the user record from the DB, or None if invalid.
    Uses the Supabase REST API so no extra Python libraries are needed.
    Returns dict with at least: {'id': <uuid>, 'email': <str>}
    """
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
    """
    Look up the user's subscription tier in Supabase.
    Returns a :class:`Tier` enum value; defaults to ``Tier.FREE`` on any error.
    Expects a 'users' table with columns: id (uuid), plan (text).
    """
    tier, _ = _get_user_info_from_db(user_id)
    return tier


def _get_user_info_from_db(user_id: str) -> tuple[Tier, str]:
    """
    Look up the user's subscription tier and role in Supabase.
    Returns a (Tier, role_str) tuple; defaults to (Tier.FREE, '') on any error.
    Expects a 'users' table with columns: id (uuid), plan (text), role (text).
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY or not user_id:
        return Tier.FREE, ''
    try:
        resp = _session.get(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"id": f"eq.{user_id}", "select": "plan,role"},
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
                role = (rows[0].get('role') or '').strip().lower()
                return tier, role
    except Exception as e:
        logger.warning(f"User info lookup error: {e}")
    return Tier.FREE, ''


# ── Admin / owner exemption ────────────────────────────────────────────────────

#: Role values that grant full bypass of all usage limits.
_EXEMPT_ROLES: frozenset[str] = frozenset({'owner', 'admin', 'superadmin'})


def _get_admin_exempt_emails() -> frozenset[str]:
    """Return the set of admin/owner email addresses from environment variables.

    Reads ADMIN_EMAIL_OWNER and ADMIN_EMAIL_ADMIN env vars.  These are the
    same variables used by routes/admin.py so there is a single source of
    truth.  Returns a frozenset of lowercased email strings.
    """
    emails: set[str] = set()
    for var in ('ADMIN_EMAIL_OWNER', 'ADMIN_EMAIL_ADMIN'):
        val = (os.environ.get(var) or '').strip().lower()
        if val:
            emails.add(val)
    return frozenset(emails)


def is_admin_exempt(email: str = '', role: str = '') -> bool:
    """Return True if this user should bypass all usage limits.

    Checks in order (fastest first):
      1. Role string against the known exempt roles (owner / admin / superadmin).
      2. Email address against the env-var admin list.

    Both the ``email`` and ``role`` values come from the JWT / DB so they are
    server-verified and cannot be spoofed by the client.

    This function is intentionally cheap: it performs no I/O.  Role and email
    are resolved once by ``_extract_verified_user()`` per request.
    """
    if role and role.strip().lower() in _EXEMPT_ROLES:
        return True
    if email:
        return email.strip().lower() in _get_admin_exempt_emails()
    return False


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
    Authorization header and look up the user's tier and role.

    Accepts an optional Starlette/FastAPI ``Request`` object.  When provided,
    the JWT is read from its headers; otherwise falls back to a guest identity.

    Returns (verified_user_id: str, server_tier: Tier, is_exempt: bool).
    Never raises — on any failure it returns an IP-based fallback ID,
    Tier.FREE, and is_exempt=False so callers can decide whether to block or
    allow.

    ``is_exempt`` is True for owner and admin accounts, which are completely
    exempt from all usage limits (daily message caps, device rate limiting,
    plan feature gates, etc.).

    Signed-in users (free, pro, or ultra) have NO daily message limit.
    Guest limits are enforced separately via guest_gate() before this is called.

    Usage in any endpoint::

        user_id, tier, is_exempt = _extract_verified_user(request)
    """
    if request is not None:
        auth_header = request.headers.get('authorization', '') or request.headers.get('Authorization', '')
    else:
        auth_header = ''
    jwt_token        = auth_header[7:] if auth_header.startswith('Bearer ') else ''
    verified_user    = _verify_supabase_jwt(jwt_token) if jwt_token else None
    verified_user_id = verified_user.get('id') if verified_user else None

    if verified_user_id:
        server_tier, db_role = _get_user_info_from_db(verified_user_id)
        # Email comes from the JWT payload (server-verified via Supabase)
        jwt_email = (verified_user.get('email') or '').strip().lower()
        # Also check app_metadata / user_metadata for role (Supabase auth layer)
        app_meta  = verified_user.get('app_metadata') or {}
        user_meta = verified_user.get('user_metadata') or {}
        jwt_role  = (
            app_meta.get('role') or user_meta.get('role') or db_role or ''
        ).strip().lower()
        is_exempt = is_admin_exempt(jwt_email, jwt_role)
    else:
        server_tier      = Tier.FREE
        is_exempt        = False
        # Use a placeholder IP since we don't have the request object always
        if request is not None and request.client:
            ip = request.client.host or '0.0.0.0'
        else:
            ip = '0.0.0.0'
        verified_user_id = f'ip:{ip}'

    if is_exempt:
        logger.debug("admin_exempt: user=%s — all usage limits bypassed", verified_user_id)

    # No daily limit for signed-in users — free, pro, or ultra all get unlimited access.
    # Guest limits are handled separately by guest_gate() before this function is called.

    return verified_user_id, server_tier, is_exempt
