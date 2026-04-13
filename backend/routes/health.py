"""
backend/routes/health.py — Health and config endpoints.

Endpoints
---------
GET  /                  Home / index
GET  /ping              Liveness check (no AI call)
GET  /health            Full status report
GET  /api/config        Public Supabase config for the frontend
GET  /api/plan-limits   Plan limits for all tiers (public)
GET  /api/me/plan       Authenticated user's plan, limits, and usage
POST /api/verify-access Authenticated user's tier + admin/owner status (called on login)
"""
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

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
            'pdf': '/pdf/<book_id>',
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
    # Static liveness check — does NOT call the AI API.
    return {
        'status':      'ok',
        'model':       ctx.MODEL,
        'api_key_set': ctx.OPENROUTER_API_KEY != 'your-key-here',
        'r2_set':      ctx.R2_BUCKET_URL != 'https://pub-xxxxx.r2.dev',
    }


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
