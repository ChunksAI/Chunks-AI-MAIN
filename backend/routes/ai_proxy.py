"""
backend/routes/ai_proxy.py — AI task proxy (FBD, research-summary).

Endpoints
---------
POST /api/ai

Accepts a task-based JSON body and proxies to OpenRouter.
Model selection and prompt construction happen server-side.
The OPENROUTER_API_KEY is never exposed to the browser.

Security
--------
Rate limiting uses **real Supabase JWT verification** (via _verify_supabase_jwt)
so a fake Authorization header cannot escalate to the authenticated tier:

  - Verified Supabase JWT user: 20 req/min, keyed by SHA-256(user_id)[:32]
  - Guest / invalid / missing token: 5 req/min, keyed by client IP

The counter is backed by Redis (shared across all workers and survives
restarts).  When Redis is unavailable the limiter falls back to an in-process
sliding window — less reliable across serverless instances but still better
than nothing for bursty traffic.

Supported tasks
---------------
POST /api/ai  { task: "fbd", question: string, aiText?: string }
  → { content: [{ text: string }] }

POST /api/ai  { task: "research-summary", title: string, abstract: string }
  → { content: [{ text: string }] }

Error status codes
------------------
- 429  Rate limit exceeded
- 400  Bad request (missing/invalid fields)
- 503  OPENROUTER_API_KEY or task model env var not configured
- 504  OpenRouter call timed out
- 502  OpenRouter unreachable (other network error)
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from typing import TYPE_CHECKING

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.shared import ctx

if TYPE_CHECKING:  # pragma: no cover
    pass

logger = logging.getLogger(__name__)

router = APIRouter()

_OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
_TIMEOUT_SECS = 15.0

# ---------------------------------------------------------------------------
# Redis-backed rate limiter with real JWT verification
# ---------------------------------------------------------------------------
# In-memory fallback: { bucket_key: [timestamp, ...] }
_rl_fallback: dict[str, list[float]] = {}
_RL_WINDOW_SECS = 60


def _check_ai_rate_limit(request: Request) -> JSONResponse | None:
    """Return a 429 JSONResponse if the request is rate-limited, else None.

    Authenticates the caller by verifying the Supabase JWT (local RS256 check
    against the JWKS cache — no extra network call on the hot path).  Only a
    *valid* JWT receives the higher 20 req/min tier; a fake/expired token is
    treated as a guest.

    The counter is stored in Redis (atomic INCR + EXPIRE) when available so
    that limits persist across restarts and are shared across all instances.
    """
    from services.auth import _verify_supabase_jwt  # avoid circular at module load

    auth = request.headers.get('authorization', '')
    token = auth[7:] if auth.startswith('Bearer ') else ''

    # Verify JWT — fast (local JWKS cache, no network on the hot path)
    user_id: str | None = None
    if token:
        try:
            verified = _verify_supabase_jwt(token)
            if verified:
                user_id = verified.get('id') or verified.get('sub') or None
        except Exception:
            user_id = None

    # Rate-limit key + per-minute limit
    if user_id:
        digest = hashlib.sha256(user_id.encode()).hexdigest()[:32]
        rl_key = f'ai_rl:user:{digest}'
        limit = 20
    else:
        ip = (
            (request.headers.get('x-forwarded-for') or '').split(',')[0].strip()
            or (request.client.host if request.client else 'unknown')
        )
        rl_key = f'ai_rl:ip:{ip}'
        limit = 5

    # ── Redis path (production) ───────────────────────────────────────────────
    redis = ctx.redis
    if redis is not None:
        try:
            count = redis.incr(rl_key)
            if count == 1:
                redis.expire(rl_key, _RL_WINDOW_SECS)
            if count > limit:
                logger.info('[ai_proxy] rate limited key=%s count=%d limit=%d', rl_key, count, limit)
                return JSONResponse(
                    {'error': 'Too many requests. Please wait a moment before trying again.'},
                    status_code=429,
                )
            return None
        except Exception as exc:
            logger.warning('[ai_proxy] Redis rate-limit error (falling back): %s', exc)

    # ── In-memory fallback (dev / Redis unavailable) ──────────────────────────
    now = time.monotonic()
    cutoff = now - _RL_WINDOW_SECS
    timestamps = [t for t in _rl_fallback.get(rl_key, []) if t > cutoff]
    if len(timestamps) >= limit:
        _rl_fallback[rl_key] = timestamps
        return JSONResponse(
            {'error': 'Too many requests. Please wait a moment before trying again.'},
            status_code=429,
        )
    timestamps.append(now)
    _rl_fallback[rl_key] = timestamps
    return None


# ---------------------------------------------------------------------------
# Task request builders
# ---------------------------------------------------------------------------

def _build_fbd_request(body: dict) -> dict | JSONResponse:
    """Build the OpenRouter payload for the 'fbd' task."""
    fbd_model = os.environ.get('FBD_MODEL')
    if not fbd_model:
        return JSONResponse({'error': 'FBD model not configured'}, status_code=503)

    question = (body.get('question') or '').strip()
    ai_text = (body.get('aiText') or '').strip()

    if not question:
        return JSONResponse({'error': 'question is required'}, status_code=400)
    if len(question) > 1000:
        return JSONResponse({'error': 'question exceeds 1000 character limit'}, status_code=400)
    if len(ai_text) > 2500:
        return JSONResponse({'error': 'aiText exceeds 2500 character limit'}, status_code=400)

    prompt = (
        'You are a physics diagram generator. Analyze the physics problem below '
        'and output ONLY a valid JSON object for a Free Body Diagram. '
        'Do NOT include any explanation or markdown fences \u2014 output raw JSON only.\n\n'
        'Schema:\n'
        '{\n'
        '  "object": "box" | "ball" | "hanging_mass",\n'
        '  "surface": "flat" | "incline" (optional),\n'
        '  "inclineAngle": number (optional, 0\u201390 degrees),\n'
        '  "forces": [\n'
        '    { "label": string, "magnitude": number (Newtons), '
        '"angle": number (0=right 90=up 180=left 270=down), "color": "#hex" (optional) }\n'
        '  ]\n'
        '}\n\n'
        'Rules:\n'
        '- Always include Weight (angle=270) and Normal force (angle=90 for flat surface).\n'
        '- Add Friction (angle=0 or 180), Tension, or Applied Force when mentioned.\n'
        '- Estimate realistic magnitudes in Newtons if not explicitly given '
        '(Weight=100 for typical objects).\n'
        '- Output ONLY the JSON object.\n\n'
        f'Physics problem:\n{question}\n\n'
        + (f'AI explanation (context):\n{ai_text}' if ai_text else '')
    )

    return {
        'model': fbd_model,
        'max_tokens': 500,
        'messages': [{'role': 'user', 'content': prompt}],
    }


def _build_research_summary_request(body: dict) -> dict | JSONResponse:
    """Build the OpenRouter payload for the 'research-summary' task."""
    model = os.environ.get('RESEARCH_SUMMARY_MODEL') or os.environ.get('FBD_MODEL')
    if not model:
        return JSONResponse({'error': 'Research summary model not configured'}, status_code=503)

    title = (body.get('title') or '').strip()
    abstract = (body.get('abstract') or '').strip()

    if not title and not abstract:
        return JSONResponse({'error': 'title or abstract is required'}, status_code=400)
    if len(title) > 500:
        return JSONResponse({'error': 'title exceeds 500 character limit'}, status_code=400)
    if len(abstract) > 4000:
        return JSONResponse({'error': 'abstract exceeds 4000 character limit'}, status_code=400)

    prompt = (
        'You are a research assistant. In 3\u20134 sentences, summarize the key findings '
        'and contributions of this paper for a student.\n\n'
        + (f'Title: {title}\n\n' if title else '')
        + (f'Abstract: {abstract}' if abstract else '')
    )

    return {
        'model': model,
        'max_tokens': 300,
        'messages': [{'role': 'user', 'content': prompt}],
    }


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------

@router.post('/api/ai')
async def ai_task_proxy(request: Request) -> JSONResponse:
    """AI task proxy with Redis-backed rate limiting and real JWT verification.

    Rate limiting is enforced before the body is parsed so large payloads from
    rate-limited callers are rejected early.
    """
    # ── Rate limit (verified JWT or IP) ───────────────────────────────────────
    limit_response = _check_ai_rate_limit(request)
    if limit_response is not None:
        return limit_response

    # ── API key guard ─────────────────────────────────────────────────────────
    api_key: str = ctx.OPENROUTER_API_KEY
    if not api_key or api_key == 'your-key-here':
        return JSONResponse({'error': 'AI service not configured'}, status_code=503)

    # ── Parse body ────────────────────────────────────────────────────────────
    try:
        body = await request.json()
        if not isinstance(body, dict):
            return JSONResponse({'error': 'Request body must be a JSON object'}, status_code=400)
    except Exception:
        return JSONResponse({'error': 'Invalid JSON'}, status_code=400)

    task = body.get('task')
    if not isinstance(task, str) or not task:
        return JSONResponse({'error': 'Missing required field: task'}, status_code=400)

    # ── Build task-specific OpenRouter request ────────────────────────────────
    if task == 'fbd':
        or_request = _build_fbd_request(body)
    elif task == 'research-summary':
        or_request = _build_research_summary_request(body)
    else:
        return JSONResponse({'error': f'Unknown task: {task}'}, status_code=400)

    if isinstance(or_request, JSONResponse):
        return or_request

    # ── Call OpenRouter ───────────────────────────────────────────────────────
    async_client: httpx.AsyncClient = ctx.async_client
    try:
        resp = await asyncio.wait_for(
            async_client.post(
                _OPENROUTER_API_URL,
                json=or_request,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {api_key}',
                },
            ),
            timeout=_TIMEOUT_SECS,
        )
    except asyncio.TimeoutError:
        logger.warning('[ai_proxy] OpenRouter timed out (task=%s)', task)
        return JSONResponse({'error': 'AI service timed out'}, status_code=504)
    except Exception as exc:
        logger.warning('[ai_proxy] OpenRouter unreachable (task=%s): %s', task, exc)
        return JSONResponse({'error': 'Failed to reach AI service'}, status_code=502)

    if resp.status_code != 200:
        logger.warning('[ai_proxy] OpenRouter error %d (task=%s)', resp.status_code, task)
        return JSONResponse({'error': 'AI service error'}, status_code=resp.status_code)

    data = resp.json()
    text: str = ((data.get('choices') or [{}])[0].get('message') or {}).get('content') or ''
    return JSONResponse({'content': [{'text': text}]})
