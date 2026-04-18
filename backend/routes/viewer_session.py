"""
backend/routes/viewer_session.py — Server-side viewer-state persistence.

Endpoints
---------
POST /api/viewer/set-state
    Persist the current viewer state for the authenticated user.
    Body: { viewer_state: dict }
    Writes Redis key ``viewer_state:{user_id}`` with a 1-hour TTL so that
    chat.py can fall back to it when the frontend omits ``viewer_state`` from
    an /ask request.

GET /api/viewer/get-state
    Read back the persisted viewer state for the authenticated user.
    Returns ``{ success: true, viewer_state: dict | null }``.

Both endpoints require a valid Supabase JWT (Authorization: Bearer …).
"""
from __future__ import annotations

import json
import logging
import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.limiter import limiter
from routes.shared import ctx

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/viewer')

_VIEWER_STATE_TTL = 3600  # seconds (1 hour)
_KEY_NS_PREFIX: str = os.environ.get('REDIS_KEY_PREFIX', '')


def _redis_key(user_id: str) -> str:
    return f'{_KEY_NS_PREFIX}viewer_state:{user_id}'


@router.post('/set-state')
@limiter.limit('60/minute')
async def set_viewer_state(request: Request):
    """Persist viewer state for the authenticated user."""
    from services.auth import _extract_verified_user
    user_id, _tier, _exempt = _extract_verified_user(request)
    if not user_id or user_id.startswith('ip:'):
        return JSONResponse({'success': False, 'error': 'Authentication required'}, status_code=401)

    try:
        body = await request.json()
    except Exception:
        return JSONResponse({'success': False, 'error': 'Invalid JSON body'}, status_code=400)

    viewer_state = body.get('viewer_state')
    if viewer_state is None:
        return JSONResponse({'success': False, 'error': 'viewer_state is required'}, status_code=422)
    if not isinstance(viewer_state, dict):
        return JSONResponse(
            {'success': False, 'error': 'viewer_state must be an object'},
            status_code=422,
        )

    redis = getattr(ctx, 'redis', None)
    if redis is None:
        return JSONResponse({'success': False, 'error': 'Cache unavailable'}, status_code=503)

    try:
        redis.setex(_redis_key(user_id), _VIEWER_STATE_TTL, json.dumps(viewer_state))
    except Exception as exc:
        logger.warning('viewer set-state write failed for %s: %s', user_id, exc)
        return JSONResponse({'success': False, 'error': 'Failed to persist viewer state'}, status_code=503)

    return JSONResponse({'success': True})


@router.get('/get-state')
@limiter.limit('60/minute')
async def get_viewer_state(request: Request):
    """Read back the persisted viewer state for the authenticated user."""
    from services.auth import _extract_verified_user
    user_id, _tier, _exempt = _extract_verified_user(request)
    if not user_id or user_id.startswith('ip:'):
        return JSONResponse({'success': False, 'error': 'Authentication required'}, status_code=401)

    redis = getattr(ctx, 'redis', None)
    if redis is None:
        return JSONResponse({'success': False, 'error': 'Cache unavailable'}, status_code=503)

    try:
        raw = redis.get(_redis_key(user_id))
    except Exception as exc:
        logger.warning('viewer get-state read failed for %s: %s', user_id, exc)
        return JSONResponse({'success': False, 'error': 'Failed to read viewer state'}, status_code=503)

    viewer_state = json.loads(raw) if raw else None
    return JSONResponse({'success': True, 'viewer_state': viewer_state})
