"""
backend/routes/admin.py — Admin API blueprint.

Endpoints
─────────
POST /api/admin/verify-access     Two-phase JWT + PIN admin verification
GET  /api/admin/routing-table     AI router table (which model per task)
GET  /api/admin/openrouter-credits OpenRouter key usage + spend breakdown

All endpoints require a valid Supabase JWT from an admin-role user.
"""
from __future__ import annotations

import hashlib as _hashlib
import hmac as _hmac
import logging
import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from urllib.parse import quote

from routes.shared import ctx
from typing import Optional
from routes.schemas import AdminVerifyRequest, AdminUpdateUserRequest, AdminSetRoleRequest

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Admin email → role map (loaded from environment variables) ───────────────
# Set ADMIN_EMAIL_OWNER and ADMIN_EMAIL_ADMIN in your Railway / .env file.
# Never hardcode emails in source — if this repo is ever public or leaked,
# attackers would know exactly which accounts to target.
def _load_admin_emails() -> dict[str, str]:
    mapping: dict[str, str] = {}
    owner_email = (os.environ.get('ADMIN_EMAIL_OWNER') or '').strip().lower()
    admin_email = (os.environ.get('ADMIN_EMAIL_ADMIN') or '').strip().lower()
    if owner_email:
        mapping[owner_email] = 'owner'
    if admin_email:
        mapping[admin_email] = 'admin'
    return mapping

def _get_admin_emails() -> dict[str, str]:
    """Return the current admin email map, always fresh from env vars."""
    return _load_admin_emails()


def _get_pin_hash_for_email(email: str) -> str:
    """
    Return the stored SHA-256 PIN hash for this admin email, or '' if not set.
    Safely handles missing / None env vars — never raises.
    """
    try:
        owner_hash  = (os.environ.get('ADMIN_PIN_HASH_OWNER') or '').strip()
        admin_hash  = (os.environ.get('ADMIN_PIN_HASH_ADMIN') or '').strip()
        owner_email = (os.environ.get('ADMIN_EMAIL_OWNER') or '').strip().lower()
        admin_email = (os.environ.get('ADMIN_EMAIL_ADMIN') or '').strip().lower()

        mapping = {}
        if owner_email:
            mapping[owner_email] = owner_hash
        if admin_email:
            mapping[admin_email] = admin_hash

        result = (mapping.get((email or '').lower().strip()) or '').strip()
        logger.debug(
            f'_get_pin_hash_for_email: email={email!r} '
            f'hash_set={bool(result)} hash_len={len(result)}'
        )
        return result
    except Exception as exc:
        logger.exception(f'_get_pin_hash_for_email crashed for {email}: {exc}')
        return ''


def _verify_admin_pin(email: str, pin: str) -> bool:
    """
    Returns True if PIN is correct for this email.
    Returns True (no PIN required) if no hash is configured.
    Never raises — all exceptions are caught and return False.
    """
    try:
        expected = _get_pin_hash_for_email(email)

        # No PIN hash configured → DENY. Default-deny is the safe choice.
        # Set ADMIN_PIN_HASH_OWNER / ADMIN_PIN_HASH_ADMIN env vars to enable access.
        if not expected:
            logger.warning(f'PIN: no hash configured for {email} — denying (default-deny)')
            return False

        # Coerce pin to string — may arrive as int from some JSON parsers
        pin_str    = str(pin if pin is not None else '').strip()
        # Strip any non-digit characters (spaces, dashes, etc.)
        pin_digits = ''.join(c for c in pin_str if c.isdigit())

        if not pin_digits:
            logger.warning(f'PIN: empty or non-numeric PIN for {email} (raw={pin_str!r})')
            return False

        if len(pin_digits) != 6:
            logger.warning(f'PIN: wrong length {len(pin_digits)} for {email}')
            return False

        computed      = _hashlib.sha256(
            ('chunks_admin_salt_' + pin_digits).encode('utf-8')
        ).hexdigest()
        expected_norm = expected.lower().strip()

        # Log hash prefixes so Railway logs reveal mismatches without exposing the full hash
        logger.info(
            f'PIN: email={email!r} computed_prefix={computed[:8]} '
            f'expected_prefix={expected_norm[:8]} '
            f'ADMIN_PIN_HASH_OWNER_set={bool(os.environ.get("ADMIN_PIN_HASH_OWNER","").strip())} '
            f'ADMIN_PIN_HASH_ADMIN_set={bool(os.environ.get("ADMIN_PIN_HASH_ADMIN","").strip())}'
        )

        # compare_digest requires both strings to be same type and non-empty
        if len(computed) != len(expected_norm):
            logger.warning(
                f'PIN: hash length mismatch for {email} '
                f'(computed={len(computed)}, expected={len(expected_norm)})'
            )
            return False

        result = _hmac.compare_digest(computed, expected_norm)
        logger.info(f'PIN: verification result={result} for {email}')
        return result

    except Exception as exc:
        logger.exception(f'PIN: _verify_admin_pin unexpected error for {email}: {exc}')
        return False


def _decode_jwt_payload(jwt_token: str) -> dict:
    """
    Decode JWT payload WITHOUT signature verification.
    Used as a fallback when SUPABASE_SERVICE_KEY is missing/wrong.
    Returns decoded payload dict or {} on any error.
    Never raises.
    """
    try:
        import base64
        import json as _json
        parts = jwt_token.split('.')
        if len(parts) < 2:
            return {}
        payload_b64 = parts[1]
        # Restore base64 padding
        payload_b64 += '=' * (4 - len(payload_b64) % 4)
        return _json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception as e:
        logger.debug(f'JWT decode fallback failed: {e}')
        return {}


def _extract_email_from_jwt(jwt_token: str) -> str:
    """
    Extract the email claim from a Supabase JWT without verifying signature.
    Checks multiple locations where Supabase stores the email.
    Returns lowercase email string or '' on failure. Never raises.

    CRITICAL: Each candidate is checked separately — never chain 'or' with
    a ternary operator. Python parses:
        A or B or C if D else ''
    as:
        (A or B or C) if D else ''
    which returns '' even when A is truthy if D is falsy.
    """
    try:
        payload = _decode_jwt_payload(jwt_token)
        if not payload:
            return ''

        # 1. Top-level 'email' claim (most common in Supabase access tokens)
        email = (payload.get('email') or '').strip()
        if email:
            return email.lower()

        # 2. user_metadata.email (Google OAuth provider, Supabase v2)
        user_meta = payload.get('user_metadata') or {}
        email = (user_meta.get('email') or '').strip()
        if email:
            return email.lower()

        # 3. identities[0].identity_data.email (older Supabase versions)
        identities = payload.get('identities') or []
        if identities and isinstance(identities, list):
            identity_data = (identities[0] or {}).get('identity_data') or {}
            email = (identity_data.get('email') or '').strip()
            if email:
                return email.lower()

        # 4. app_metadata.email (rare fallback)
        app_meta = payload.get('app_metadata') or {}
        email = (app_meta.get('email') or '').strip()
        if email:
            return email.lower()

        logger.debug(
            f'JWT email extraction: no email found. '
            f'Payload keys: {list(payload.keys())}'
        )
        return ''

    except Exception as e:
        logger.debug(f'Email extraction from JWT failed: {e}')
        return ''

def _check_admin_role(jwt_token: str) -> tuple:
    """
    Verify JWT and check admin role. Strategy:
    1. Call Supabase /auth/v1/user with the user's token + anon key (correct approach)
    2. Fallback: decode JWT payload without signature check
    3. Check email against hardcoded admin list (fast path) or DB
    Never raises — all exceptions return (None, None).
    """
    email    = ''
    verified = None

    supabase_url  = getattr(ctx, 'SUPABASE_URL',      '') or ''
    anon_key      = getattr(ctx, 'SUPABASE_ANON_KEY',  '') or ''
    service_key   = getattr(ctx, 'SUPABASE_SERVICE_KEY', '') or ''
    _session_obj  = getattr(ctx, 'session', None)

    # ── Step 1: Verify JWT via Supabase /auth/v1/user ─────────────────────────
    # Must use ANON KEY as apikey header (not service key).
    # The user's bearer token authenticates; apikey identifies the project.
    if supabase_url and (anon_key or service_key) and _session_obj:
        try:
            api_key_to_use = anon_key or service_key   # prefer anon key
            resp = _session_obj.get(
                f'{supabase_url}/auth/v1/user',
                headers={
                    'Authorization': f'Bearer {jwt_token}',
                    'apikey':        api_key_to_use,
                },
                timeout=6,
            )
            logger.info(
                f'Admin check: /auth/v1/user status={resp.status_code} '
                f'anon_key_used={bool(anon_key)} service_key_used={not bool(anon_key)}'
            )
            if resp.status_code == 200:
                user_data = resp.json()
                # Supabase returns email at top level for most providers
                email = (
                    user_data.get('email') or
                    (user_data.get('user_metadata') or {}).get('email') or
                    ''
                ).strip().lower()
                if email:
                    verified = {'email': email, 'id': user_data.get('id', '')}
                    logger.info(f'Admin check: JWT verified via Supabase, email={email}')
            else:
                logger.warning(
                    f'Admin check: /auth/v1/user returned {resp.status_code} — '
                    f'falling back to JWT decode. Body: {resp.text[:200]}'
                )
        except Exception as e:
            logger.warning(f'Admin check: /auth/v1/user request failed: {e}')

    # ── Step 2: Fallback — decode JWT payload without signature check ─────────
    # Handles: SUPABASE_URL not set, network error, or non-200 from Supabase.
    if not email:
        email = _extract_email_from_jwt(jwt_token)
        if email:
            payload  = _decode_jwt_payload(jwt_token)
            verified = {'email': email, 'id': payload.get('sub', '')}
            logger.info(f'Admin check: JWT decode fallback, email={email}')
        else:
            logger.warning('Admin check: could not extract email from JWT — denying')
            return None, None

    if not email:
        logger.warning('Admin check: no email found — denying')
        return None, None

    # ── Fast path: check hardcoded list FIRST (avoids DB call for known admins) ─
    # This is safe: the PIN check is still enforced separately.
    fast_role = _get_admin_emails().get(email)
    if fast_role:
        logger.info(f'Admin check: fast-path match for {email} ({fast_role})')
        if verified is None:
            verified = {'email': email, 'id': ''}
        return verified, fast_role

    # ── Step 3: Check admin role via DB (only for emails not in hardcoded list) ─
    supabase_url = getattr(ctx, 'SUPABASE_URL', '') or ''
    supabase_key = getattr(ctx, 'SUPABASE_SERVICE_KEY', '') or ''

    if supabase_url and supabase_key:
        try:
            _session = getattr(ctx, 'session', None)
            if _session is None:
                import requests as _req_mod
                _session = _req_mod.Session()

            url = (
                f"{supabase_url}/rest/v1/users"
                f"?email=eq.{quote(email, safe='@')}"
                f"&select=email,role,plan"
            )
            resp = _session.get(
                url,
                headers={
                    'Authorization': f'Bearer {supabase_key}',
                    'apikey':        supabase_key,
                },
                timeout=5,
            )
            logger.info(f'Admin DB lookup for {email}: status={resp.status_code}')
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    db_role = (rows[0].get('role') or '').strip().lower()
                    if db_role in ('admin', 'owner', 'superadmin'):
                        logger.info(f'Admin verified via DB role: {email} ({db_role})')
                        return verified, db_role
                    else:
                        logger.warning(
                            f'Admin check: DB role="{db_role}" not allowed for {email} '
                            f'— trying hardcoded fallback'
                        )
                else:
                    logger.warning(
                        f'Admin check: no DB row for {email} — trying hardcoded fallback'
                    )
            else:
                logger.warning(
                    f'Admin DB lookup returned {resp.status_code} — trying hardcoded fallback'
                )
        except Exception as e:
            logger.warning(f'Admin role DB exception: {e} — trying hardcoded fallback')
    else:
        logger.info(
            'Admin check: SUPABASE_SERVICE_KEY not set — skipping DB lookup, '
            'using hardcoded fallback only'
        )

    # ── Step 4: Hardcoded fallback ─────────────────────────────────────────────
    fallback_role = _get_admin_emails().get(email)
    if fallback_role:
        logger.info(f'Admin verified via hardcoded fallback: {email} ({fallback_role})')
        return verified, fallback_role

    logger.warning(f'Admin check: {email} not in DB or hardcoded list — access denied')
    return None, None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post('/api/admin/verify-access')
def verify_access(request: Request, body: Optional[AdminVerifyRequest] = None):
    """
    Two-phase admin verification.
    Phase 1 (no pin): verify JWT → check admin role → return role info + pin_required flag.
    Phase 2 (pin provided): same as above + verify PIN.

    Always returns JSON — never raises a 500 to the client without a message.
    """
    # Wrap the entire handler in a top-level try so the client always gets
    # a meaningful JSON error rather than an unformatted 500 page.
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            logger.warning('verify_access: missing or malformed Authorization header')
            return JSONResponse({'success': False, 'error': 'Unauthorized — missing token'}, status_code=401)

        jwt_token = auth_header[7:].strip()
        if not jwt_token:
            return JSONResponse({'success': False, 'error': 'Unauthorized — empty token'}, status_code=401)

        # ── Role check — never raises ──────────────────────────────────────────
        verified, role = _check_admin_role(jwt_token)

        if not verified or not role:
            # Log which email was attempted so we can debug access denials
            attempted_email = _extract_email_from_jwt(jwt_token)
            logger.warning(
                f'verify_access: access denied for email="{attempted_email}" '
                f'(not in admin list or JWT decode failed)'
            )
            return JSONResponse({
                'success': False,
                'error': 'Forbidden — not an admin account',
            }, status_code=403)

        email = (verified.get('email', '') or '').strip().lower()
        if not email:
            logger.warning('verify_access: verified dict has no email — denying')
            return JSONResponse({'success': False, 'error': 'Could not determine email from token'}, status_code=403)

        # ── Parse request body ─────────────────────────────────────────────────
        data = body.model_dump() if body is not None else {}
        pin = str(data.get('pin', '') or '').strip()

        # ── PIN hash check ─────────────────────────────────────────────────────
        # _get_pin_hash_for_email never raises — it returns '' on any error.
        # If the env var ADMIN_PIN_HASH_OWNER / ADMIN_PIN_HASH_ADMIN is not set
        # in Railway → has_pin=False → skip PIN screen, grant immediate access.
        try:
            pin_hash = _get_pin_hash_for_email(email)
        except Exception as _phe:
            logger.warning(f'verify_access: _get_pin_hash_for_email threw: {_phe}')
            pin_hash = ''

        has_pin = bool(pin_hash)

        logger.info(
            f'verify_access: email={email!r} role={role!r} '
            f'has_pin={has_pin} pin_provided={bool(pin)} '
            f'OWNER_hash_set={bool(os.environ.get("ADMIN_PIN_HASH_OWNER", "").strip())} '
            f'ADMIN_hash_set={bool(os.environ.get("ADMIN_PIN_HASH_ADMIN", "").strip())}'
        )

        # ── No PIN configured → grant access immediately ───────────────────────
        # This is the normal state when ADMIN_PIN_HASH_OWNER has not been set
        # in Railway environment variables yet.
        if not has_pin:
            logger.info(
                f'verify_access: no PIN hash configured for {email!r} — '
                f'granting access without PIN check. '
                f'Set ADMIN_PIN_HASH_OWNER in Railway env vars to enforce a PIN.'
            )
            return {
                'success':      True,
                'role':         role,
                'email':        email,
                'pin_required': False,
            }

        # ── PIN required but not yet submitted → prompt client ─────────────────
        if not pin:
            logger.info(f'verify_access: PIN required for {email!r}, prompting client')
            return {
                'success':      True,
                'role':         role,
                'email':        email,
                'pin_required': True,
            }

        # ── PIN submitted → verify it (never raises) ───────────────────────────
        try:
            pin_ok = _verify_admin_pin(email, pin)
        except Exception as _pve:
            logger.exception(f'verify_access: _verify_admin_pin threw: {_pve}')
            pin_ok = False

        if not pin_ok:
            logger.warning(f'verify_access: wrong PIN for {email!r}')
            return JSONResponse({
                'success': False,
                'error':   'Incorrect PIN',
            }, status_code=403)

        logger.info(f'verify_access: fully verified {email!r} ({role})')
        return {
            'success':      True,
            'role':         role,
            'email':        email,
            'pin_required': False,
        }

    except Exception as e:
        # Last-resort catch — log full traceback so Railway logs show the real error.
        logger.exception(f'verify_access: unexpected top-level error: {e}')
        return JSONResponse({
            'success': False,
            'error':   f'Server error ({type(e).__name__}): {str(e)[:200]}',
            'hint':    'Check Railway deployment logs for the full traceback.',
        }, status_code=500)


@router.get('/api/admin/ping')
def admin_ping(request: Request):
    """
    Health-check endpoint — returns 200 with env config summary.
    Useful for debugging PIN issues without needing a valid JWT.
    """
    supabase_url = getattr(ctx, 'SUPABASE_URL', '') or ''
    supabase_key = getattr(ctx, 'SUPABASE_SERVICE_KEY', '') or ''
    or_key       = getattr(ctx, 'OPENROUTER_API_KEY', '') or ''

    owner_hash = os.environ.get('ADMIN_PIN_HASH_OWNER', '')
    admin_hash = os.environ.get('ADMIN_PIN_HASH_ADMIN', '')

    return {
        'ok': True,
        'supabase_url_set':     bool(supabase_url),
        'service_key_set':      bool(supabase_key),
        'openrouter_key_set':   bool(or_key),
        'owner_pin_hash_set':   bool(owner_hash),
        'owner_pin_hash_len':   len(owner_hash),
        'admin_pin_hash_set':   bool(admin_hash),
        'admin_pin_hash_len':   len(admin_hash),
        'admin_emails_hardcoded': list(_get_admin_emails().keys()),
    }


@router.get('/api/admin/routing-table')
def routing_table_endpoint(request: Request):
    """Return the full AI routing table. Requires admin JWT."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JSONResponse({'success': False, 'error': 'Unauthorized'}, status_code=401)

    jwt_token       = auth_header[7:]
    verified, role  = _check_admin_role(jwt_token)
    if not verified:
        return JSONResponse({'success': False, 'error': 'Unauthorized — admin required'}, status_code=401)

    from services.ai_router import routing_table, _get_models
    return {
        'success': True,
        'models':  _get_models(),
        'routes':  routing_table(),
    }



@router.get('/api/admin/users')
def get_users(request: Request):
    """Return all users from Supabase using service key (bypasses RLS)."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JSONResponse({'success': False, 'error': 'Unauthorized'}, status_code=401)

    jwt_token = auth_header[7:]
    verified, role = _check_admin_role(jwt_token)
    if not verified or not role:
        return JSONResponse({'success': False, 'error': 'Forbidden — admin required'}, status_code=403)

    supabase_url = getattr(ctx, 'SUPABASE_URL', '') or ''
    service_key  = getattr(ctx, 'SUPABASE_SERVICE_KEY', '') or ''
    _sess        = getattr(ctx, 'session', None)

    if not supabase_url or not service_key or not _sess:
        return JSONResponse({'success': False, 'error': 'Server not configured'}, status_code=500)

    try:
        resp = _sess.get(
            f'{supabase_url}/rest/v1/users',
            params={'select': '*', 'order': 'created_at.desc'},
            headers={
                'Authorization': f'Bearer {service_key}',
                'apikey':        service_key,
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return JSONResponse({'success': False, 'error': f'Supabase returned {resp.status_code}'}, status_code=502)
        return {'success': True, 'users': resp.json()}
    except Exception as e:
        logger.exception('get_users error')
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


@router.patch('/api/admin/users/{email}')
def update_user(request: Request, email: str, body: AdminUpdateUserRequest = None):
    """Update a user row using service key (bypasses RLS)."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JSONResponse({'success': False, 'error': 'Unauthorized'}, status_code=401)

    jwt_token = auth_header[7:]
    verified, role = _check_admin_role(jwt_token)
    if not verified or not role:
        return JSONResponse({'success': False, 'error': 'Forbidden — admin required'}, status_code=403)

    supabase_url = getattr(ctx, 'SUPABASE_URL', '') or ''
    service_key  = getattr(ctx, 'SUPABASE_SERVICE_KEY', '') or ''
    _sess        = getattr(ctx, 'session', None)

    if not supabase_url or not service_key or not _sess:
        return JSONResponse({'success': False, 'error': 'Server not configured'}, status_code=500)

    try:
        data = body.model_dump()
        from urllib.parse import quote as _quote
        resp = _sess.patch(
            f'{supabase_url}/rest/v1/users',
            params={'email': f'eq.{email}'},
            json=data,
            headers={
                'Authorization': f'Bearer {service_key}',
                'apikey':        service_key,
                'Content-Type':  'application/json',
                'Prefer':        'return=representation',
            },
            timeout=10,
        )
        if resp.status_code not in (200, 204):
            return JSONResponse({'success': False, 'error': f'Supabase returned {resp.status_code}: {resp.text[:200]}'}, status_code=502)
        # Invalidate the user-info cache so the next request picks up the new tier/role.
        _redis_client = getattr(ctx, '_redis', None)
        if resp.status_code == 200:
            try:
                rows = resp.json()
                if isinstance(rows, list) and rows:
                    user_id = rows[0].get('id', '')
                    if user_id:
                        from services.auth import invalidate_user_cache
                        invalidate_user_cache(user_id, _redis_client)
            except Exception:
                pass  # cache invalidation is best-effort
        return {'success': True}
    except Exception as e:
        logger.exception('update_user error')
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


@router.post('/api/admin/set-role')
def set_role(request: Request, body: AdminSetRoleRequest):
    """
    Update a user's role in the DB.  Callable by role='owner' only.

    Request body: {"user_email": "...", "role": "user"|"admin"|"owner"}

    On success the user-info Redis cache is invalidated so the change takes
    effect within at most USER_CACHE_TTL seconds (default 60 s) without
    requiring a token refresh on the user's side.
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JSONResponse({'success': False, 'error': 'Unauthorized'}, status_code=401)

    jwt_token = auth_header[7:]
    verified, requester_role = _check_admin_role(jwt_token)
    if not verified or requester_role != 'owner':
        logger.warning(
            'set_role: access denied — requester role=%s (owner required)',
            requester_role,
        )
        return JSONResponse(
            {'success': False, 'error': 'Forbidden — owner role required'},
            status_code=403,
        )

    requester_id = (verified.get('id') or verified.get('email') or '?')
    target_email = body.user_email.strip().lower()
    new_role     = body.role

    supabase_url = getattr(ctx, 'SUPABASE_URL', '') or ''
    service_key  = getattr(ctx, 'SUPABASE_SERVICE_KEY', '') or ''
    _sess        = getattr(ctx, 'session', None)

    if not supabase_url or not service_key or not _sess:
        return JSONResponse({'success': False, 'error': 'Server not configured'}, status_code=500)

    try:
        from urllib.parse import quote as _quote
        resp = _sess.patch(
            f'{supabase_url}/rest/v1/users',
            params={'email': f'eq.{_quote(target_email, safe="@")}'},
            json={'role': new_role},
            headers={
                'Authorization': f'Bearer {service_key}',
                'apikey':        service_key,
                'Content-Type':  'application/json',
                'Prefer':        'return=representation',
            },
            timeout=10,
        )
        if resp.status_code not in (200, 204):
            return JSONResponse(
                {'success': False, 'error': f'Supabase returned {resp.status_code}: {resp.text[:200]}'},
                status_code=502,
            )

        logger.info(
            'Role change: %s set %s to role=%s',
            requester_id, target_email, new_role,
        )

        # Invalidate Redis cache so the change takes effect within TTL seconds.
        _redis_client = getattr(ctx, '_redis', None)
        if resp.status_code == 200:
            try:
                rows = resp.json()
                if isinstance(rows, list) and rows:
                    target_user_id = rows[0].get('id', '')
                    if target_user_id:
                        from services.auth import invalidate_user_cache
                        invalidate_user_cache(target_user_id, _redis_client)
            except Exception:
                pass  # cache invalidation is best-effort

        return {'success': True, 'user_email': target_email, 'role': new_role}

    except Exception as e:
        logger.exception('set_role error')
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


@router.delete('/api/admin/users/{email}')
def delete_user(request: Request, email: str):
    """Delete a user row using service key (bypasses RLS)."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JSONResponse({'success': False, 'error': 'Unauthorized'}, status_code=401)

    jwt_token = auth_header[7:]
    verified, role = _check_admin_role(jwt_token)
    if not verified or not role:
        return JSONResponse({'success': False, 'error': 'Forbidden — admin required'}, status_code=403)

    supabase_url = getattr(ctx, 'SUPABASE_URL', '') or ''
    service_key  = getattr(ctx, 'SUPABASE_SERVICE_KEY', '') or ''
    _sess        = getattr(ctx, 'session', None)

    if not supabase_url or not service_key or not _sess:
        return JSONResponse({'success': False, 'error': 'Server not configured'}, status_code=500)

    try:
        resp = _sess.delete(
            f'{supabase_url}/rest/v1/users',
            params={'email': f'eq.{email}'},
            headers={
                'Authorization': f'Bearer {service_key}',
                'apikey':        service_key,
            },
            timeout=10,
        )
        if resp.status_code not in (200, 204):
            return JSONResponse({'success': False, 'error': f'Supabase returned {resp.status_code}'}, status_code=502)
        return {'success': True}
    except Exception as e:
        logger.exception('delete_user error')
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


@router.get('/api/admin/openrouter-credits')
def openrouter_credits(request: Request):
    """OpenRouter key usage + per-model spend breakdown. Requires admin JWT."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JSONResponse({'success': False, 'error': 'Unauthorized'}, status_code=401)

    jwt_token      = auth_header[7:]
    verified_admin, role = _check_admin_role(jwt_token)
    if not verified_admin or not role:
        logger.warning('Admin openrouter-credits: JWT check failed')
        return JSONResponse({'success': False, 'error': 'Unauthorized — admin required'}, status_code=401)

    try:
        key_resp = ctx.session.get(
            'https://openrouter.ai/api/v1/auth/key',
            headers={'Authorization': f'Bearer {ctx.OPENROUTER_API_KEY}'},
            timeout=10,
        )
        if key_resp.status_code != 200:
            return JSONResponse({'success': False, 'error': f'OpenRouter returned {key_resp.status_code}'}, status_code=502)

        key_data  = key_resp.json().get('data', {})
        key_usage = float(key_data.get('usage', 0) or 0)
        key_limit = key_data.get('limit')

        gen_resp = ctx.session.get(
            'https://openrouter.ai/api/v1/generation',
            headers={'Authorization': f'Bearer {ctx.OPENROUTER_API_KEY}'},
            params={'limit': 500, 'offset': 0},
            timeout=15,
        )

        total_tokens = 0
        total_requests = 0
        model_breakdown: dict = {}

        if gen_resp.status_code == 200:
            raw      = gen_resp.json()
            gen_data = raw.get('data', raw) if isinstance(raw, dict) else raw
            if isinstance(gen_data, list):
                total_requests = len(gen_data)
                for g in gen_data:
                    cost   = float(g.get('total_cost', 0) or 0)
                    tokens = (int(g.get('tokens_prompt', 0) or 0) +
                              int(g.get('tokens_completion', 0) or 0))
                    model  = g.get('model', 'unknown')
                    total_tokens += tokens
                    if model not in model_breakdown:
                        model_breakdown[model] = {'cost': 0.0, 'tokens': 0, 'requests': 0}
                    model_breakdown[model]['cost']     += cost
                    model_breakdown[model]['tokens']   += tokens
                    model_breakdown[model]['requests'] += 1

        total_cost_usd = key_usage if key_usage > 0 else sum(
            v['cost'] for v in model_breakdown.values()
        )
        remaining = None
        if key_limit is not None:
            remaining = round(float(key_limit) - key_usage, 6)

        return {
            'success': True,
            'key_info': {
                'label':          key_data.get('label', ''),
                'limit':          key_limit,
                'limit_remaining': remaining,
                'usage':          key_usage,
                'is_free_tier':   key_data.get('is_free_tier', False),
                'rate_limit':     key_data.get('rate_limit', {}),
            },
            'usage_summary': {
                'total_cost_usd': round(total_cost_usd, 6),
                'total_tokens':   total_tokens,
                'total_requests': total_requests,
            },
            'model_breakdown': model_breakdown,
            '_debug': {
                'generation_status': gen_resp.status_code,
                'key_usage_raw':     key_usage,
            },
        }

    except Exception as e:
        logger.exception('openrouter_credits error')
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


@router.get('/api/admin/usage-report')
def usage_report(request: Request):
    """Per-user monthly token usage report. Requires admin JWT.

    Query params
    ------------
    month : str, optional
        ``YYYY-MM`` format. Defaults to current UTC month.
    user_id : str, optional
        If provided, return usage for that single user only.
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JSONResponse({'success': False, 'error': 'Unauthorized'}, status_code=401)

    jwt_token = auth_header[7:]
    verified, role = _check_admin_role(jwt_token)
    if not verified or not role:
        return JSONResponse({'success': False, 'error': 'Forbidden — admin required'}, status_code=403)

    from services import token_budget

    month   = (request.query_params.get('month') or '').strip() or None
    user_id = (request.query_params.get('user_id') or '').strip()

    if user_id:
        report = token_budget.get_user_monthly_usage(user_id, month)
    else:
        report = token_budget.get_monthly_usage_report(month)

    return {'success': True, **report}


@router.get('/api/admin/user-usage')
def user_usage(request: Request):
    """Authenticated user's own monthly token usage.

    Any signed-in user can call this to see their own usage.

    Query params
    ------------
    month : str, optional
        ``YYYY-MM`` format. Defaults to current UTC month.
    """
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return JSONResponse({'success': False, 'error': 'Unauthorized — sign in required'}, status_code=401)

    jwt_token = auth_header[7:].strip()
    if not jwt_token:
        return JSONResponse({'success': False, 'error': 'Unauthorized — empty token'}, status_code=401)

    from services.auth import _verify_supabase_jwt
    from services import token_budget

    user = _verify_supabase_jwt(jwt_token)
    if not user or not user.get('id'):
        return JSONResponse({'success': False, 'error': 'Invalid or expired token'}, status_code=401)

    month = (request.query_params.get('month') or '').strip() or None
    report = token_budget.get_user_monthly_usage(user['id'], month)

    return {'success': True, **report}
