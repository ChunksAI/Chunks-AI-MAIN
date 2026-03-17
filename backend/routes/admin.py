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
    mapping = {
        'contridascharles91@gmail.com': os.environ.get('ADMIN_PIN_HASH_OWNER', ''),
        'deffmichaeldawang@gmail.com':  os.environ.get('ADMIN_PIN_HASH_ADMIN', ''),
    }
    return (mapping.get(email.lower(), '') or '').strip()


def _verify_admin_pin(email: str, pin: str) -> bool:
    expected = _get_pin_hash_for_email(email)
    if not expected:
        return True
    computed = _hashlib.sha256(('chunks_admin_salt_' + pin).encode()).hexdigest()
    return _hashlib.compare_digest(computed, expected)


def _check_admin_role(jwt_token: str) -> tuple:
    """Verify JWT and check admin role via Supabase users table, with hardcoded fallback."""
    verified = ctx.verify_supabase_jwt(jwt_token)
    if not verified:
        logger.warning('Admin check: JWT verification failed')
        return None, None

    email = (verified.get('email', '') or '').strip().lower()
    if not email:
        logger.warning('Admin check: no email in JWT')
        return None, None

    # ── Try DB role lookup first ──────────────────────────────────────────────
    if ctx.SUPABASE_URL and ctx.SUPABASE_SERVICE_KEY:
        try:
            url = (
                f"{ctx.SUPABASE_URL}/rest/v1/users"
                f"?email=eq.{quote(email, safe='@')}"
                f"&select=email,role,plan"
            )
            resp = ctx.session.get(
                url,
                headers={
                    "Authorization": f"Bearer {ctx.SUPABASE_SERVICE_KEY}",
                    "apikey":        ctx.SUPABASE_SERVICE_KEY,
                },
                timeout=5,
            )
            logger.info(f'Admin DB lookup for {email}: status={resp.status_code}')
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    role = (rows[0].get('role') or '').strip().lower()
                    if role in ('admin', 'owner', 'superadmin'):
                        logger.info(f'Admin verified via DB role: {email} ({role})')
                        return verified, role
                    else:
                        logger.warning(f'Admin check: DB role="{role}" not in allowed list for {email}')
                else:
                    logger.warning(f'Admin check: no DB row found for {email} — trying hardcoded fallback')
            else:
                logger.warning(f'Admin DB lookup failed: {resp.status_code} — trying hardcoded fallback')
        except Exception as e:
            logger.warning(f'Admin role check DB exception: {e} — trying hardcoded fallback')

    # ── Hardcoded fallback ────────────────────────────────────────────────────
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
    """
    if request.method == 'OPTIONS':
        return jsonify({}), 200

    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401

        jwt_token = auth_header[7:]

        try:
            verified, role = _check_admin_role(jwt_token)
        except Exception as e:
            logger.exception(f'Admin role check crashed: {e}')
            return jsonify({'success': False, 'error': 'Server error during role check'}), 500

        if not verified or not role:
            return jsonify({'success': False, 'error': 'Forbidden — not an admin account'}), 403

        email = verified.get('email', '')
        if not email:
            logger.warning('verify_access: JWT has no email field')
            return jsonify({'success': False, 'error': 'Could not determine email from token'}), 403

        data    = request.get_json(silent=True) or {}
        pin     = str(data.get('pin', '') or '').strip()
        has_pin = bool(_get_pin_hash_for_email(email))

        logger.info(f'verify_access: email={email} role={role} has_pin={has_pin} pin_provided={bool(pin)}')

        if not has_pin:
            # No PIN configured for this account — let them straight in
            return jsonify({'success': True, 'role': role, 'email': email, 'pin_required': False})
        if not pin:
            # PIN required but not yet provided — prompt the client
            return jsonify({'success': True, 'role': role, 'email': email, 'pin_required': True})

        # PIN provided — verify it
        try:
            pin_ok = _verify_admin_pin(email, pin)
        except Exception as e:
            logger.exception(f'PIN verification crashed for {email}: {e}')
            return jsonify({'success': False, 'error': 'Server error during PIN check'}), 500

        if not pin_ok:
            logger.warning(f'Admin PIN failed for {email}')
            return jsonify({'success': False, 'error': 'Incorrect PIN'}), 403

        logger.info(f'Admin fully verified: {email} ({role})')
        return jsonify({'success': True, 'role': role, 'email': email, 'pin_required': False})

    except Exception as e:
        logger.exception(f'verify_access unexpected error: {e}')
        return jsonify({'success': False, 'error': 'Internal server error'}), 500


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
