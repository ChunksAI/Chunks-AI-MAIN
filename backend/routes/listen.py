"""
backend/routes/listen.py — Professor Listen Mode endpoint.

Endpoints
---------
POST /listen/page

Generates a short professor-style narration for the current PDF page,
synthesises it to MP3 audio via the TTS service, and returns the raw
audio bytes as audio/mpeg.

Flow
----
1. Validate the request body (Pydantic → ListenRequest).
2. Reject empty visible_text with 400.
3. Truncate visible_text to _MAX_VISIBLE_TEXT chars server-side.
4. Generate a narration script using call_ai_async().
5. Synthesise the script using services.tts.synthesize_speech_async().
6. Return the MP3 bytes as an audio/mpeg Response.
7. Log request_id, uid_hash, doc_title, page, mode, script_chars,
   audio_bytes, latency_ms, and success/error at INFO level.
   Raw PDF text is never logged.
"""
from __future__ import annotations

import hashlib
import logging
import time

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from routes.limiter import limiter, _rate_limit_key
from routes.schemas import ListenRequest
from services.auth import _extract_verified_user
from services.ai import call_ai_async, sanitize_text

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Constants ──────────────────────────────────────────────────────────────────

# Server-side cap on visible text fed to the script prompt (chars).
_MAX_VISIBLE_TEXT = 4_000

# AI model token budget for the narration script (~400 words target).
_SCRIPT_MAX_TOKENS = 600

# Rate-limit strings: generous for auth users, tight for guests.
_LIMIT_AUTH  = '10/minute'
_LIMIT_GUEST = '3/minute'

# Narration prompt templates keyed by mode.
_NARRATION_PROMPTS: dict[str, str] = {
    'professor': (
        "You are narrating a study guide for a student as a calm, engaging professor. "
        "Your output will be spoken aloud by a text-to-speech engine, so:\n"
        "- Do NOT use markdown, bullet symbols (• or -), or any formatting.\n"
        "- Do NOT read the page text word-for-word.\n"
        "- Do NOT mention page numbers or 'this page'.\n"
        "- Explain the idea naturally as if speaking to a student in a lecture.\n"
        "- Use simple analogies to clarify abstract concepts.\n"
        "- Spell out any equations in plain words (e.g. 'E equals m c squared').\n"
        "- Keep the narration to 60–120 seconds of spoken content (roughly 150–300 words).\n"
        "- Speak in a warm, clear, unhurried tone.\n"
        "- End with one short check-your-understanding question, phrased naturally.\n"
        "- Do NOT add introductions like 'Welcome' or farewells like 'See you next time'.\n"
        "- Go straight into the explanation."
    ),
    'simple': (
        "You are narrating a study guide for a student as a friendly tutor. "
        "Your output will be spoken aloud, so:\n"
        "- Do NOT use markdown, bullet symbols, or any formatting.\n"
        "- Use the simplest possible language — explain as if to a 12-year-old.\n"
        "- Do NOT read the page text word-for-word.\n"
        "- Use one concrete everyday analogy.\n"
        "- Keep it under 90 seconds (roughly 200 words).\n"
        "- End with one very simple check question.\n"
        "- Go straight into the explanation without any greeting."
    ),
    'exam_review': (
        "You are doing a rapid exam-review narration for a student about to sit an exam. "
        "Your output will be spoken aloud, so:\n"
        "- Do NOT use markdown, bullet symbols, or any formatting.\n"
        "- Focus only on the most testable facts, definitions, and common pitfalls.\n"
        "- Spell out equations in plain words.\n"
        "- Keep it under 90 seconds (roughly 200 words).\n"
        "- End with one high-probability exam question.\n"
        "- Go straight into the review without any greeting."
    ),
}


def _listen_limit(key: str) -> str:
    """Return rate limit string based on whether the request is authenticated."""
    return _LIMIT_AUTH if key.startswith('bearer:') else _LIMIT_GUEST


# ── Route ──────────────────────────────────────────────────────────────────────

@router.post('/listen/page')
@limiter.limit(_listen_limit)
async def listen_page(request: Request, body: ListenRequest) -> Response:
    """Generate and return a professor-narrated MP3 for the requested PDF page."""
    req_id = getattr(request.state, 'request_id', request.headers.get('X-Request-Id', '-'))
    t0 = time.monotonic()

    # ── Auth & identity ────────────────────────────────────────────────────────
    try:
        verified_user_id, _tier, _is_exempt = _extract_verified_user(request)
    except Exception as _auth_err:
        logger.warning('[listen] auth failed req_id=%s: %s', req_id, _auth_err)
        return JSONResponse(
            {'success': False, 'error': 'Authentication error. Please sign in and try again.'},
            status_code=401,
        )

    uid_hash = hashlib.sha256(
        (verified_user_id or '').encode(), usedforsecurity=False,
    ).hexdigest()[:16]

    # ── Input validation ───────────────────────────────────────────────────────
    visible_text_raw = body.visible_text.strip()
    if not visible_text_raw:
        return JSONResponse(
            {'success': False, 'error': 'No readable text found on this page.'},
            status_code=400,
        )

    # Enforce server-side length cap even though Pydantic already validated max_length.
    visible_text = sanitize_text(visible_text_raw, max_len=_MAX_VISIBLE_TEXT)
    doc_title    = sanitize_text(body.doc_title or 'this document', max_len=200)
    page         = body.page
    mode         = body.mode
    voice        = body.voice

    logger.info(
        '[listen:start] req_id=%s uid=%s doc_title=%r page=%d mode=%s',
        req_id, uid_hash, doc_title, page, mode,
    )

    # ── Build narration prompt ─────────────────────────────────────────────────
    system_instruction = _NARRATION_PROMPTS.get(mode, _NARRATION_PROMPTS['professor'])

    user_prompt = (
        f"Document: {doc_title}\n\n"
        f"Page content:\n{visible_text}\n\n"
        f"Now narrate this content for the student."
    )

    # ── Generate narration script ──────────────────────────────────────────────
    try:
        script = await call_ai_async(
            prompt=user_prompt,
            system_prompt=system_instruction,
            max_tokens_override=_SCRIPT_MAX_TOKENS,
            endpoint='listen_script',
            user_id=verified_user_id,
            timeout=25,
        )
    except RuntimeError as _ai_err:
        _msg = str(_ai_err)[:200]
        logger.warning(
            '[listen] script generation failed req_id=%s uid=%s: %s',
            req_id, uid_hash, _msg,
        )
        return JSONResponse(
            {'success': False, 'error': 'Audio generation failed. Please try again.'},
            status_code=503,
        )

    script = script.strip()
    script_chars = len(script)

    # ── Synthesise audio ───────────────────────────────────────────────────────
    try:
        from services.tts import synthesize_speech_async
        audio_bytes = await synthesize_speech_async(script, voice=voice)
    except RuntimeError as _tts_err:
        _msg = str(_tts_err)[:200]
        logger.warning(
            '[listen] TTS synthesis failed req_id=%s uid=%s: %s',
            req_id, uid_hash, _msg,
        )
        return JSONResponse(
            {'success': False, 'error': 'Audio generation failed. Please try again.'},
            status_code=503,
        )

    latency_ms = round((time.monotonic() - t0) * 1000)
    logger.info(
        '[listen:done] req_id=%s uid=%s page=%d mode=%s script_chars=%d '
        'audio_bytes=%d latency_ms=%d success=True',
        req_id, uid_hash, page, mode, script_chars, len(audio_bytes), latency_ms,
    )

    return Response(
        content=audio_bytes,
        media_type='audio/mpeg',
        headers={
            'X-Request-Id': req_id,
            'Cache-Control': 'no-store',
        },
    )
