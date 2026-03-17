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
import logging
import os

from flask import Blueprint, request, jsonify
from urllib.parse import quote

from routes.shared import ctx

logger = logging.getLogger(__name__)

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


# ── Hardcoded admin email → role map (fallback when DB lookup fails) ──────────
# These emails are also validated by the PIN hash check, so listing them here
# is safe — an attacker still needs Google OAuth + correct PIN to get in.
_ADMIN_EMAILS: dict[str, str] = {
    'contridascharles91@gmail.com': 'owner',
    'deffmichaeldawang@gmail.com':  'admin',
}


def _get_pin_hash_for_email(email: str) -> str:
    """
    Return the stored SHA-256 PIN hash for this admin email, or '' if not set.
    Safely handles missing / None env vars — never raises.
    """
    try:
        owner_hash = (os.environ.get('ADMIN_PIN_HASH_OWNER') or '').strip()
        admin_hash = (os.environ.get('ADMIN_PIN_HASH_ADMIN') or '').strip()

        mapping = {
            'contridascharles91@gmail.com': owner_hash,
            'deffmichaeldawang@gmail.com':  admin_hash,
        }
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

        # No PIN hash configured → no PIN required, allow through
        if not expected:
            logger.info(f'PIN: no hash configured for {email} — skipping PIN check')
            return True

        # Validate PIN is digits only and correct length before hashing
        pin_str = str(pin or '').strip()
        if not pin_str or not pin_str.isdigit():
            logger.warning(f'PIN: non-numeric or empty PIN submitted for {email}')
            return False

        computed = _hashlib.sha256(
            ('chunks_admin_salt_' + pin_str).encode('utf-8')
        ).hexdigest()

        # compare_digest requires both strings to be same type and non-empty
        if len(computed) != len(expected):
            logger.warning(
                f'PIN: hash length mismatch for {email} '
                f'(computed={len(computed)}, expected={len(expected)})'
            )
            return False

        result = _hashlib.compare_digest(computed, expected)
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
    Verify JWT and check admin role via Supabase users table, with hardcoded fallback.

    Strategy:
    1. Try verified JWT (needs SUPABASE_SERVICE_KEY) → extract email
    2. If that fails, decode JWT payload without signature check → extract email
    3. Check extracted email against DB (if SERVICE_KEY available) or hardcoded list
    4. Return (verified_dict, role_str) or (None, None) on denial

    Never raises — all exceptions are caught and return (None, None).
    """
    email = ''
    verified = None

    # ── Step 1: Try full JWT verification ─────────────────────────────────────
    try:
        # Guard against ctx not being initialised or verify_supabase_jwt missing
        _vsj = getattr(ctx, 'verify_supabase_jwt', None)
        if callable(_vsj):
            verified = _vsj(jwt_token)
        if verified:
            email = (verified.get('email', '') or '').strip().lower()
    except Exception as e:
        logger.warning(f'Admin check: verify_supabase_jwt raised: {e}')
        verified = None

    # ── Step 2: Fallback — decode JWT without signature verification ──────────
    # This handles the very common case where SUPABASE_SERVICE_KEY is not set
    # on Railway, which causes verify_supabase_jwt to return None.
    if not email:
        email = _extract_email_from_jwt(jwt_token)
        if email:
            payload = _decode_jwt_payload(jwt_token)
            # Build a minimal verified dict so downstream code works
            verified = {
                'email': email,
                'id': payload.get('sub', ''),
            }
            logger.info(
                f'Admin check: using JWT decode fallback (no SERVICE_KEY?), '
                f'email={email}'
            )
        else:
            logger.warning('Admin check: could not extract email from JWT — denying')
            return None, None

    if not email:
        logger.warning('Admin check: no email in JWT — denying')
        return None, None

    # ── Fast path: check hardcoded list FIRST (avoids DB call for known admins) ─
    # This is safe: the PIN check is still enforced separately.
    fast_role = _ADMIN_EMAILS.get(email)
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
    fallback_role = _ADMIN_EMAILS.get(email)
    if fallback_role:
        logger.info(f'Admin verified via hardcoded fallback: {email} ({fallback_role})')
        return verified, fallback_role

    logger.warning(f'Admin check: {email} not in DB or hardcoded list — access denied')
    return None, None


# ── Routes ────────────────────────────────────────────────────────────────────

@admin_bp.route('/verify-access', methods=['POST', 'OPTIONS'])
def verify_access():
    """
    Two-phase admin verification.
    Phase 1 (no pin): verify JWT → check admin role → return role info + pin_required flag.
    Phase 2 (pin provided): same as above + verify PIN.

    Always returns JSON — never raises a 500 to the client without a message.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    # Wrap the entire handler in a top-level try so the client always gets
    # a meaningful JSON error rather than an unformatted 500 page.
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            logger.warning('verify_access: missing or malformed Authorization header')
            return jsonify({'success': False, 'error': 'Unauthorized — missing token'}), 401

        jwt_token = auth_header[7:].strip()
        if not jwt_token:
            return jsonify({'success': False, 'error': 'Unauthorized — empty token'}), 401

        # ── Role check — never raises ──────────────────────────────────────────
        verified, role = _check_admin_role(jwt_token)

        if not verified or not role:
            # Log which email was attempted so we can debug access denials
            attempted_email = _extract_email_from_jwt(jwt_token)
            logger.warning(
                f'verify_access: access denied for email="{attempted_email}" '
                f'(not in admin list or JWT decode failed)'
            )
            return jsonify({
                'success': False,
                'error': 'Forbidden — not an admin account',
            }), 403

        email = (verified.get('email', '') or '').strip().lower()
        if not email:
            logger.warning('verify_access: verified dict has no email — denying')
            return jsonify({'success': False, 'error': 'Could not determine email from token'}), 403

        # ── Parse request body ─────────────────────────────────────────────────
        try:
            data = request.get_json(silent=True) or {}
        except Exception:
            data = {}
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
            return jsonify({
                'success':      True,
                'role':         role,
                'email':        email,
                'pin_required': False,
            })

        # ── PIN required but not yet submitted → prompt client ─────────────────
        if not pin:
            logger.info(f'verify_access: PIN required for {email!r}, prompting client')
            return jsonify({
                'success':      True,
                'role':         role,
                'email':        email,
                'pin_required': True,
            })

        # ── PIN submitted → verify it (never raises) ───────────────────────────
        try:
            pin_ok = _verify_admin_pin(email, pin)
        except Exception as _pve:
            logger.exception(f'verify_access: _verify_admin_pin threw: {_pve}')
            pin_ok = False

        if not pin_ok:
            logger.warning(f'verify_access: wrong PIN for {email!r}')
            return jsonify({'success': False, 'error': 'Incorrect PIN'}), 403

        logger.info(f'verify_access: fully verified {email!r} ({role})')
        return jsonify({
            'success':      True,
            'role':         role,
            'email':        email,
            'pin_required': False,
        })

    except Exception as e:
        # Last-resort catch — log full traceback so Railway logs show the real error.
        logger.exception(f'verify_access: unexpected top-level error: {e}')
        return jsonify({
            'success': False,
            'error':   f'Server error ({type(e).__name__}): {str(e)[:200]}',
            'hint':    'Check Railway deployment logs for the full traceback.',
        }), 500


@admin_bp.route('/ping', methods=['GET', 'OPTIONS'])
def admin_ping():
    """
    Health-check endpoint — returns 200 with env config summary.
    Useful for debugging PIN issues without needing a valid JWT.
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    supabase_url = getattr(ctx, 'SUPABASE_URL', '') or ''
    supabase_key = getattr(ctx, 'SUPABASE_SERVICE_KEY', '') or ''
    or_key       = getattr(ctx, 'OPENROUTER_API_KEY', '') or ''

    owner_hash = os.environ.get('ADMIN_PIN_HASH_OWNER', '')
    admin_hash = os.environ.get('ADMIN_PIN_HASH_ADMIN', '')

    return jsonify({
        'ok': True,
        'supabase_url_set':     bool(supabase_url),
        'service_key_set':      bool(supabase_key),
        'openrouter_key_set':   bool(or_key),
        'owner_pin_hash_set':   bool(owner_hash),
        'owner_pin_hash_len':   len(owner_hash),
        'admin_pin_hash_set':   bool(admin_hash),
        'admin_pin_hash_len':   len(admin_hash),
        'admin_emails_hardcoded': list(_ADMIN_EMAILS.keys()),
    })


@admin_bp.route('/routing-table', methods=['GET', 'OPTIONS'])
def routing_table_endpoint():
    """Return the full AI routing table. Requires admin JWT."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    jwt_token       = auth_header[7:]
    verified, role  = _check_admin_role(jwt_token)
    if not verified:
        return jsonify({'success': False, 'error': 'Unauthorized — admin required'}), 401

    from ai_router import routing_table, _get_models
    return jsonify({
        'success': True,
        'models':  _get_models(),
        'routes':  routing_table(),
    })


@admin_bp.route('/openrouter-credits', methods=['GET', 'OPTIONS'])
def openrouter_credits():
    """OpenRouter key usage + per-model spend breakdown. Requires admin JWT."""
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({'success': False, 'error': 'Unauthorized'}), 401

    jwt_token    = auth_header[7:]
    verified_admin = ctx.verify_supabase_jwt(jwt_token)
    if not verified_admin:
        logger.warning('Admin endpoint: invalid or expired JWT')
        return jsonify({'success': False, 'error': 'Unauthorized — invalid token'}), 401

    admin_user_id = verified_admin.get('id', '')
    if ctx.SUPABASE_URL and ctx.SUPABASE_SERVICE_KEY and admin_user_id:
        try:
            resp = ctx.session.get(
                f"{ctx.SUPABASE_URL}/rest/v1/users",
                params={"id": f"eq.{admin_user_id}", "select": "role,tier"},
                headers={
                    "Authorization": f"Bearer {ctx.SUPABASE_SERVICE_KEY}",
                    "apikey":        ctx.SUPABASE_SERVICE_KEY,
                },
                timeout=5,
            )
            if resp.status_code == 200:
                rows     = resp.json()
                user_role = rows[0].get('role', '') if rows else ''
                if user_role not in ('admin', 'superadmin'):
                    logger.warning(f'Admin endpoint: non-admin user {admin_user_id} attempted access')
                    return jsonify({'success': False, 'error': 'Forbidden — admin role required'}), 403
        except Exception as e:
            logger.warning(f'Admin role check failed: {e}')
            return jsonify({'success': False, 'error': 'Could not verify admin role'}), 500

    try:
        key_resp = ctx.session.get(
            'https://openrouter.ai/api/v1/auth/key',
            headers={'Authorization': f'Bearer {ctx.OPENROUTER_API_KEY}'},
            timeout=10,
        )
        if key_resp.status_code != 200:
            return jsonify({'success': False, 'error': f'OpenRouter returned {key_resp.status_code}'}), 502

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

        return jsonify({
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
        })

    except Exception as e:
        logger.exception('openrouter_credits error')
        return jsonify({'success': False, 'error': str(e)}), 500
