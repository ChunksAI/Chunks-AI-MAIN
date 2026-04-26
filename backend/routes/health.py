"""
backend/routes/health.py — Health and config endpoints.

Endpoints
---------
GET  /                  Home / index
GET  /ping              Liveness check — is the process alive? (no dependency checks)
GET  /ready             Readiness check — can the process serve traffic? (checks Redis + Supabase)
GET  /health            Full status report
GET  /api/config        Public Supabase config for the frontend
GET  /api/plan-limits   Plan limits for all tiers (public)
GET  /api/me/plan       Authenticated user's plan, limits, and usage
POST /api/verify-access Authenticated user's tier + admin/owner status (called on login)

Probe semantics
---------------
/ping  = liveness   — is the process alive?   Restart if this fails.
/ready = readiness  — can it serve traffic?   Remove from load-balancer if this fails.
"""
from __future__ import annotations

import os

import requests as _requests

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.limiter import limiter
from routes.shared import ctx

router = APIRouter()


@router.get('/')
def home(request: Request):
    return {
        'name': 'Chunks Chemistry API',
        'version': '2.0',
        'status': 'running',
        'endpoints': {
            'health': '/health',
            'ask': '/ask',
            'load_book': '/load-book',
            'pdf': '/books/<book_id>/pdf',
            'library': '/get-library',
            'flashcards': '/generate-flashcards',
            'upload_document': '/upload-document',
            'study_materials': '/generate-study-materials',
            'quiz': '/generate-quiz',
            'ask_image': '/ask-image'
        }
    }


@router.get('/ping')
def ping(request: Request):
    # Liveness probe — is the process alive?
    # Must stay fast and dependency-free; no Redis/DB/network calls here.
    return {
        'status':      'ok',
        'model':       ctx.MODEL,
        'api_key_set': ctx.OPENROUTER_API_KEY != 'your-key-here',
        'r2_set':      ctx.R2_BUCKET_URL != 'https://pub-xxxxx.r2.dev',
    }


@router.get('/ready')
async def readiness(request: Request):
    """Readiness probe — can this instance serve traffic?

    Returns 200 + ``{"status": "ready"}`` only when all required dependencies
    are reachable.  Returns 503 + ``{"status": "degraded"}`` otherwise so that
    load balancers / orchestrators can remove the instance from rotation until
    it recovers.
    """
    checks: dict[str, str] = {}

    # ── Redis ──────────────────────────────────────────────────────────────
    redis = ctx.redis
    if redis is None:
        # Redis is optional (falls back to in-memory); treat as non-blocking.
        checks['redis'] = 'not configured'
    else:
        try:
            redis.ping()
            checks['redis'] = 'ok'
        except Exception as exc:
            checks['redis'] = f'error: {exc}'

    # ── Supabase ───────────────────────────────────────────────────────────
    try:
        r = _requests.get(f"{ctx.SUPABASE_URL}/auth/v1/health", timeout=3)
        checks['supabase'] = 'ok' if r.ok else f'error: {r.status_code}'
    except Exception as exc:
        checks['supabase'] = f'error: {exc}'

    # Redis 'not configured' is non-blocking; only 'error:*' values fail readiness.
    all_ok = all(
        v == 'ok' or v == 'not configured'
        for v in checks.values()
    ) and any(v == 'ok' for v in checks.values())

    return JSONResponse(
        {'status': 'ready' if all_ok else 'degraded', 'checks': checks},
        status_code=200 if all_ok else 503,
    )


@router.get('/health')
def health(request: Request):
    from services.books import BOOK_LIBRARY
    return {
        'status': 'healthy',
        'mode': 'production' if ctx.PRODUCTION else 'development',
        'books_available': list(BOOK_LIBRARY.keys()),
        'r2_configured': ctx.R2_BUCKET_URL != 'https://pub-xxxxx.r2.dev',
        'api_configured': ctx.OPENROUTER_API_KEY != 'your-key-here'
    }


@router.get('/api/config')
def get_client_config(request: Request):
    """Return public config values the frontend needs (no secrets here)."""
    return {
        'supabaseUrl':     ctx.SUPABASE_URL,
        'supabaseAnonKey': ctx.SUPABASE_ANON_KEY,
    }


@router.get('/api/plan-limits')
def get_plan_limits(request: Request):
    """Return plan limits for all tiers (public — no auth required)."""
    from services.plan_limits import PLAN_LIMITS
    return {'success': True, 'plans': PLAN_LIMITS}


@router.get('/api/me/plan')
def get_my_plan(request: Request):
    """Return the authenticated user's plan, limits, and current usage.

    Requires a valid Supabase JWT in the Authorization header.
    Returns 401 if no valid token is provided.
    """
    from services.auth import _extract_verified_user
    from services.plan_limits import get_plan_limits, get_usage, PLAN_LIMITS

    user_id, tier, _is_exempt = _extract_verified_user(request)

    # Unauthenticated (IP-based) users get a 401
    if user_id.startswith('ip:'):
        return JSONResponse({'success': False, 'error': 'Authentication required'}, status_code=401)

    tier_str = tier.value if hasattr(tier, 'value') else str(tier).lower()
    limits = get_plan_limits(tier_str)

    # Build usage map for countable features
    usage = {}
    for feature in limits:
        usage[feature] = get_usage(user_id, feature)

    return {
        'success': True,
        'plan':    tier_str,
        'limits':  limits,
        'usage':   usage,
    }


@router.post('/api/verify-access')
@limiter.limit("20/minute")
def verify_access(request: Request):
    """Return the authenticated user's plan tier and admin/owner status.

    Called by the frontend immediately after Google/email sign-in to
    determine the user's subscription tier and privilege level.

    Requires a valid Supabase JWT in the Authorization header.
    Returns 401 if no valid token is provided.
    """
    from services.auth import _extract_verified_user, _get_user_info_from_db

    user_id, tier, is_exempt = _extract_verified_user(request)

    # Unauthenticated (IP-based) users get a 401
    if user_id.startswith('ip:'):
        return JSONResponse({'success': False, 'error': 'Authentication required'}, status_code=401)

    _, db_role = _get_user_info_from_db(user_id)
    # The tier from _extract_verified_user (which called _get_user_info_from_db
    # internally) is used for the response; the second DB call above is only to
    # retrieve the role string which _extract_verified_user does not expose.

    tier_str = tier.value if hasattr(tier, 'value') else str(tier).lower()

    return {
        'tier':     tier_str,
        'role':     db_role,
        'is_owner': db_role == 'owner',
        'is_admin': is_exempt,
    }


# ── Debug: list registered routes (env-gated) ─────────────────────────────────
# Diagnostic endpoint used to prove which routes the *deployed* binary actually
# serves (e.g. when a 404 in production cannot be reproduced locally and the
# suspicion is a stale Railway revision or a wrong-branch deploy).
#
# Disabled by default. Enable by setting environment variable DEBUG_ROUTES=true
# on the running server, hit the endpoint, then unset the variable.
#
# Returns ONLY route metadata (path, methods, handler name). It deliberately
# does not return env vars, secrets, code, or per-request data.


def _debug_routes_enabled() -> bool:
    return os.environ.get('DEBUG_ROUTES', '').lower() == 'true'


@router.get('/api/debug/routes')
def debug_routes(request: Request):
    """List every registered route on the live FastAPI app.

    Gated by ``DEBUG_ROUTES=true``. When disabled (the default), returns
    404 with the standard ``Endpoint not found.`` envelope so its absence
    is indistinguishable from any other unmapped path.
    """
    if not _debug_routes_enabled():
        return JSONResponse(
            {'success': False, 'error': 'Endpoint not found.'},
            status_code=404,
        )

    app = request.app
    out: list[dict] = []
    for r in app.routes:
        path = getattr(r, 'path', None)
        if not path:
            continue
        methods = sorted(getattr(r, 'methods', None) or [])
        # Filter out HEAD/OPTIONS noise — only the actionable verbs are useful.
        methods = [m for m in methods if m not in ('HEAD', 'OPTIONS')]
        if not methods:
            continue
        out.append({
            'path':    path,
            'methods': methods,
            'name':    getattr(r, 'name', '') or '',
        })
    out.sort(key=lambda e: (e['path'], ','.join(e['methods'])))
    return {'count': len(out), 'routes': out}
