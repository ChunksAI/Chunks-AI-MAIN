"""
backend/routes/flashcards.py — Flashcard generation endpoint.

Endpoints
---------
POST /generate-flashcards
"""
from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.shared import ctx
from routes.schemas import FlashcardsRequest
from guest_limits import GuestLimitExceeded, guest_gate

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post('/generate-flashcards')
def generate_flashcards(request: Request, body: FlashcardsRequest):
    try:
        data = body.model_dump()
        try:
            guest_gate(request, 'workspace', ctx.redis)
        except GuestLimitExceeded as _gle:
            return _gle.response()

        topic   = data.get('topic', 'chemistry').strip()
        count   = min(int(data.get('count', 10)), 20)
        book_id = data.get('bookId') or None

        # Verify JWT and enforce daily limit
        from services.auth import _extract_verified_user
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
                check_plan_limit(verified_user_id, _tier, 'monthly_flashcard_sets')
            except PlanLimitExceeded as _ple:
                return _ple.response()

        from services.material_cache import _cache_key, _cache_get, _cache_set
        from ai_router import route
        from services.books import get_book_index
        from services.ai import call_ai

        # ── Cache check ───────────────────────────────────────────────────────
        cache_k = _cache_key(book_id, topic, 'flashcards', count)
        cached  = _cache_get(cache_k)
        if cached:
            logger.info(f"⚡ Cache HIT flashcards: {topic} ({book_id})")
            return {**cached, 'cached': True}
        logger.info(f"🔄 Cache MISS flashcards: {topic} ({book_id})")

        context_block = ""
        if book_id:
            searcher = get_book_index(book_id)
            if searcher.chunks:
                context, score, is_relevant, _, _ = searcher.smart_search(topic, top_k=5)
                if is_relevant:
                    context_block = f"Use this source material as your primary reference:\n{context}\n\n"

        prompt = f"""{context_block}Create exactly {count} flashcards about: {topic}

Follow these Anki-style best practices for every card:
- MINIMUM INFORMATION PRINCIPLE: Each card tests exactly ONE atomic concept.
- ACTIVE RECALL: FRONT must be a specific question that forces retrieval, never a vague prompt.
- Prefer "What/Why/How" questions over "Define X" when possible.
- BACK should be a concise, precise answer (max 50 words). Start with the key fact, then add brief context if needed.
- Include a short HINT (max 15 words) — a nudge that helps recall without giving the answer away (e.g. a category, related concept, or first-letter cue).
- Use $LaTeX$ for all formulas and equations.

STRICT OUTPUT FORMAT — output ONLY this, no intro text, no numbering:
CARD
FRONT: [specific recall question — max 20 words]
BACK: [precise answer — max 50 words]
HINT: [brief memory cue — max 15 words]
END

Repeat the CARD / FRONT / BACK / HINT / END block exactly {count} times.
Rules:
- Cover definitions, key mechanisms, relationships, and important facts
- Each card must be self-contained and test a single concept
- No duplicate or overlapping questions
- Vary question types: definition, cause/effect, comparison, application"""

        raw = call_ai(prompt, system_prompt=(
            "You are an expert flashcard creator following Anki best practices. "
            "You apply the minimum information principle: one simple concept per card, "
            "clear active-recall questions, and concise answers. "
            "Output ONLY the CARD blocks in the exact format requested. "
            "No preamble, no extra commentary, no numbering outside the format."
        ), model=route('flashcard_complex' if count > 10 else 'flashcard_simple', complexity=5),
           endpoint='flashcards', user_id=verified_user_id)

        flashcards = []
        blocks = re.split(r'\bCARD\b', raw, flags=re.IGNORECASE)
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            front_match = re.search(r'FRONT:\s*(.+?)(?=BACK:|HINT:|$)', block, re.IGNORECASE | re.DOTALL)
            back_match  = re.search(r'BACK:\s*(.+?)(?=HINT:|END|CARD|$)', block, re.IGNORECASE | re.DOTALL)
            hint_match  = re.search(r'HINT:\s*(.+?)(?=END|CARD|$)', block, re.IGNORECASE | re.DOTALL)
            if front_match and back_match:
                front = front_match.group(1).strip().rstrip('END').strip()
                back  = back_match.group(1).strip().rstrip('END').strip()
                hint  = hint_match.group(1).strip().rstrip('END').strip() if hint_match else ''
                if front and back:
                    card = {'front': front, 'back': back}
                    if hint:
                        card['hint'] = hint
                    flashcards.append(card)

        if not flashcards:
            # Fallback: Q:/A: format
            for block in re.split(r'\n(?=Q\d*[:.\s])', raw):
                q_match = re.search(r'Q\d*[:.\s]\s*(.+?)(?=A[:.\s]\s|$)', block, re.DOTALL)
                a_match = re.search(r'A[:.\s]\s*(.+)', block, re.DOTALL)
                if q_match and a_match:
                    flashcards.append({'front': q_match.group(1).strip(), 'back': a_match.group(1).strip()})

        if not flashcards:
            return JSONResponse({'success': False, 'error': 'Failed to parse flashcards', 'raw': raw}, status_code=500)

        logger.info(f"Generated {len(flashcards)} flashcards for: {topic}")
        result_payload = {'success': True, 'flashcards': flashcards, 'count': len(flashcards), 'topic': topic}
        _cache_set(cache_k, result_payload)
        return result_payload

    except Exception as e:
        logger.exception("Unhandled error")
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)
