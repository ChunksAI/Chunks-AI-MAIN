"""
backend/routes/image.py — Vision / image analysis endpoint.

Endpoints
---------
POST /ask-image
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.shared import ctx
from routes.schemas import ImageRequest

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post('/ask-image')
def ask_image(request: Request, body: ImageRequest):
    # 10 MB decoded ≈ 13.4 MB of base64 chars.
    _B64_MAX_CHARS = 13_400_000

    _ALLOWED_IMAGE_TYPES = {
        'image/jpeg', 'image/jpg', 'image/png',
        'image/gif',  'image/webp', 'image/bmp',
    }

    try:
        from services.auth import _extract_verified_user
        from services.ai import sanitize_text
        from services import token_budget

        data = body.model_dump()

        image_b64  = data.get('image_b64', '')
        image_type = data.get('image_type', 'image/jpeg')
        complexity = data.get('complexity', 5)
        question   = sanitize_text(
            data.get('question', 'Describe what you see and explain any chemistry concepts visible.'),
            max_len=1000,
        )

        # Verify JWT and enforce daily limit
        verified_user_id, _tier, _is_exempt = _extract_verified_user(request)

        # ── Per-user, per-device rate limiting ────────────────────────────
        if not _is_exempt:
            from services.device_abuse import check_device_rate_limit
            _device_block = check_device_rate_limit(verified_user_id, request)
            if _device_block is not None:
                return _device_block

        # ── Plan-based usage limit ────────────────────────────────────────
        if not _is_exempt:
            from services.plan_limits import check_plan_limit, PlanLimitExceeded
            try:
                check_plan_limit(verified_user_id, _tier, 'daily_image_questions')
            except PlanLimitExceeded as _ple:
                return _ple.response()

        if not image_b64:
            return JSONResponse({'success': False, 'error': 'No image data provided'}, status_code=400)

        if len(image_b64) > _B64_MAX_CHARS:
            decoded_mb = round(len(image_b64) * 3 / 4 / 1_048_576, 1)
            logger.warning(
                "Vision endpoint: image rejected — base64 length %d (~%s MB decoded)",
                len(image_b64), decoded_mb,
            )
            return JSONResponse({
                'success': False,
                'error': f'Image too large (~{decoded_mb} MB). Maximum is 10 MB.',
            }, status_code=413)

        image_type_clean = image_type.strip().lower().split(';')[0]
        if image_type_clean not in _ALLOWED_IMAGE_TYPES:
            logger.warning(
                "Vision endpoint: rejected image_type %r (not in allowlist)", image_type
            )
            return JSONResponse({
                'success': False,
                'error': f'Unsupported image type "{image_type_clean}". Allowed: jpeg, png, gif, webp, bmp.',
            }, status_code=415)

        if not token_budget.check_daily_budget():
            return JSONResponse({
                'success': False,
                'error': 'Daily AI cost budget exceeded. Please try again after midnight UTC.',
            }, status_code=503)

        vision_model = os.environ.get('VISION_MODEL', 'nvidia/nemotron-nano-12b-v2-vl:free')
        effective_max_tokens = token_budget.max_tokens_for_endpoint('image')

        headers = {
            "Authorization": f"Bearer {ctx.OPENROUTER_API_KEY}",
            "Content-Type":  "application/json",
            "HTTP-Referer":  "https://chunks.online",
            "X-Title":       "Chunks Chemistry"
        }

        complexity_levels = {
            1: "very simple terms a child can understand",
            2: "simple terms for a beginner",
            3: "middle-school level",
            4: "high school level",
            5: "AP/IB chemistry level",
            6: "first-year university level",
            7: "university level with equations",
            8: "advanced undergraduate",
            9: "graduate level",
            10: "expert/research level"
        }
        level_desc = complexity_levels.get(max(1, min(10, int(complexity))), "university level")

        system_prompt = (
            f"You are an expert chemistry tutor with vision capabilities. "
            f"Analyze the image carefully and explain any chemistry concepts, "
            f"diagrams, equations, molecules, lab setups, or periodic table elements visible. "
            f"Explain at {level_desc}. "
            f"Use LaTeX for equations: inline $...$ and display $$...$$."
        )

        payload = {
            "model": vision_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:{image_type_clean};base64,{image_b64}"}},
                        {"type": "text", "text": question}
                    ]
                }
            ],
            "temperature": 0.15,
            "max_tokens": effective_max_tokens,
        }

        logger.info(f"Vision model: {vision_model} | max_tokens: {effective_max_tokens}")
        response = ctx.session.post(ctx.OPENROUTER_URL, headers=headers, json=payload, timeout=55)

        if response.status_code == 200:
            resp_json = response.json()
            answer = resp_json['choices'][0]['message']['content']
            # Record usage from the vision API call
            from services.ai import _record_usage_from_response
            _record_usage_from_response(resp_json, vision_model, 'image', user_id=verified_user_id)
            return {'success': True, 'answer': answer, 'model': vision_model}
        else:
            err_detail = response.text[:400]
            logger.error(f"Vision API error {response.status_code}: {err_detail}")
            return JSONResponse({
                'success': False,
                'error': f'Vision API error {response.status_code}',
                'detail': err_detail
            }, status_code=500)

    except Exception as e:
        logger.exception("Unhandled error")
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)
