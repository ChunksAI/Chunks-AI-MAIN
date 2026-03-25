"""
backend/routes/flashcards.py — Flashcard generation endpoint.

Endpoints
---------
POST /generate-flashcards
"""
from __future__ import annotations

import logging
import re

from flask import Blueprint, jsonify, request

from routes.shared import ctx
from routes.validation import validate_request
from routes.schemas import FlashcardsRequest
from guest_limits import GuestLimitExceeded, guest_gate

logger = logging.getLogger(__name__)

flashcards_bp = Blueprint('flashcards', __name__)


@flashcards_bp.route('/generate-flashcards', methods=['POST', 'OPTIONS'])
@validate_request(FlashcardsRequest)
def generate_flashcards():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True})
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'success': False, 'error': 'Invalid or missing JSON body'}), 400
        try:
            guest_gate(request, 'workspace', ctx.redis)
        except GuestLimitExceeded as _gle:
            return _gle.response()

        topic   = data.get('topic', 'chemistry').strip()
        count   = min(int(data.get('count', 10)), 20)
        book_id = data.get('bookId', 'zumdahl')

        # Verify JWT and enforce daily limit
        from services.auth import _extract_verified_user
        verified_user_id, _tier = _extract_verified_user()

        # ── Per-user, per-device rate limiting ────────────────────────────
        from services.device_abuse import check_device_rate_limit
        _device_block = check_device_rate_limit(verified_user_id)
        if _device_block is not None:
            return _device_block

        # ── Plan-based usage limit ────────────────────────────────────────
        from services.plan_limits import check_plan_limit, PlanLimitExceeded
        try:
            check_plan_limit(verified_user_id, _tier, 'monthly_flashcard_sets')
        except PlanLimitExceeded as _ple:
            return _ple.response()

        from server import _cache_key, _cache_get, _cache_set
        from ai_router import route
        from services.books import get_book_index
        from services.ai import call_ai

        # ── Cache check ───────────────────────────────────────────────────────
        cache_k = _cache_key(book_id, topic, 'flashcards', count)
        cached  = _cache_get(cache_k)
        if cached:
            logger.info(f"⚡ Cache HIT flashcards: {topic} ({book_id})")
            return jsonify({**cached, 'cached': True})
        logger.info(f"🔄 Cache MISS flashcards: {topic} ({book_id})")

        context_block = ""
        searcher = get_book_index(book_id)
        if searcher.chunks:
            context, score, is_relevant, _, _ = searcher.smart_search(topic, top_k=3)
            if is_relevant:
                context_block = f"Use this textbook content as your primary source:\n{context}\n\n"

        prompt = f"""{context_block}Create exactly {count} flashcards about: {topic}

STRICT OUTPUT FORMAT — output ONLY this, no intro text, no numbering prose:
CARD
FRONT: [concise question or term — max 20 words]
BACK: [clear precise answer — max 60 words, use LaTeX for equations: $...$]
END

Repeat the CARD / FRONT / BACK / END block exactly {count} times.
Rules:
- Cover definitions, equations, mechanisms, and key facts
- Each card must be self-contained
- No duplicate questions
- Use $LaTeX$ for all formulas/equations"""

        raw = call_ai(prompt, system_prompt=(
            "You are a chemistry flashcard generator. Output ONLY the CARD blocks in the exact format requested. "
            "No preamble, no extra commentary, no numbering outside the format."
        ), model=route('flashcard_complex' if count > 10 else 'flashcard_simple', complexity=5),
           endpoint='flashcards', user_id=verified_user_id)

        flashcards = []
        blocks = re.split(r'\bCARD\b', raw, flags=re.IGNORECASE)
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            front_match = re.search(r'FRONT:\s*(.+?)(?=BACK:|$)', block, re.IGNORECASE | re.DOTALL)
            back_match  = re.search(r'BACK:\s*(.+?)(?=END|CARD|$)', block, re.IGNORECASE | re.DOTALL)
            if front_match and back_match:
                front = front_match.group(1).strip().rstrip('END').strip()
                back  = back_match.group(1).strip().rstrip('END').strip()
                if front and back:
                    flashcards.append({'front': front, 'back': back})

        if not flashcards:
            # Fallback: Q:/A: format
            for block in re.split(r'\n(?=Q\d*[:.\s])', raw):
                q_match = re.search(r'Q\d*[:.\s]\s*(.+?)(?=A[:.\s]\s|$)', block, re.DOTALL)
                a_match = re.search(r'A[:.\s]\s*(.+)', block, re.DOTALL)
                if q_match and a_match:
                    flashcards.append({'front': q_match.group(1).strip(), 'back': a_match.group(1).strip()})

        if not flashcards:
            return jsonify({'success': False, 'error': 'Failed to parse flashcards', 'raw': raw}), 500

        logger.info(f"Generated {len(flashcards)} flashcards for: {topic}")
        result_payload = {'success': True, 'flashcards': flashcards, 'count': len(flashcards), 'topic': topic}
        _cache_set(cache_k, result_payload)
        return jsonify(result_payload)

    except Exception as e:
        logger.exception("Unhandled error")
        return jsonify({'success': False, 'error': str(e)}), 500
