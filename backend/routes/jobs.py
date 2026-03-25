"""
backend/routes/jobs.py — Async AI job endpoints.

Endpoints
---------
POST /ask-async       — enqueue an /ask request, return a jobId immediately
GET  /jobs/<job_id>   — poll for job status / result
"""
from __future__ import annotations

import logging

from flask import Blueprint, jsonify, request

from routes.shared import ctx
from routes.validation import validate_request
from routes.schemas import AskAsyncRequest

logger = logging.getLogger(__name__)

jobs_bp = Blueprint('jobs', __name__)


def _run_ask_job(data: dict) -> dict:
    """Execute the /ask logic inside a background thread.

    This is intentionally a thin wrapper that imports and calls
    the same helpers as :func:`routes.chat.ask`.  Running inside
    a worker thread lets the HTTP response return immediately.
    """
    from services.auth import _extract_verified_user, Tier
    from services.ai import (
        call_ai, call_ai_web_search, sanitize_user_memory,
        should_search_textbook, _INJECTION_PATTERNS,
    )
    from services.books import BOOK_LIBRARY, TextbookSearch, get_book_index
    from ai_router import route, route_for_mode
    from server import (
        _ask_cache_key, _ask_cache_get, _ask_cache_set, _ask_is_cacheable,
        _parse_mcq,
    )
    import json  # noqa: E401
    import os
    import random
    import re

    question      = data.get('question', '')
    complexity    = max(1, min(10, int(data.get('complexity', 3))))
    mode          = data.get('mode', 'study').lower().strip()
    book_id       = data.get('bookId', 'zumdahl')
    thinking_mode = data.get('thinking', None)
    web_search    = data.get('web_search', False)
    history       = data.get('history', [])
    selected_text = data.get('selected_text', '').strip()[:2000]
    doc_context   = data.get('doc_context', '').strip()[:80000]
    user_memory   = sanitize_user_memory(data.get('user_memory', ''))
    task_type     = data.get('task_type', None)

    # ── Redis query cache ─────────────────────────────────────────────────
    _cache_eligible = _ask_is_cacheable(mode, history, web_search, thinking_mode)
    _cache_key_val  = _ask_cache_key(book_id, task_type, mode, complexity, question) \
                      if _cache_eligible else None
    if _cache_eligible:
        cached_payload = _ask_cache_get(_cache_key_val)
        if cached_payload:
            cached_payload['cached'] = True
            return cached_payload

    # Parse injected token flags
    token_flags = []
    if question.startswith('['):
        tokens = re.findall(r'\[([A-Z_]+)\]', question)
        for tok in tokens:
            token_flags.append(tok)
            question = question.replace(f'[{tok}]', '', 1)
        question = question.strip()

    if 'WEB_SEARCH_ENABLED'  in token_flags: web_search    = True
    if 'THINKING_MODE'       in token_flags: thinking_mode = 'thinking'
    if 'DEEP_THINKING_MODE'  in token_flags: thinking_mode = 'deep'

    # ── Model selection via ai_router ─────────────────────────────────────
    if thinking_mode == 'deep':
        selected_model = os.environ.get('DEEP_MODEL', 'deepseek/deepseek-r1:free')
    elif thinking_mode == 'thinking':
        selected_model = os.environ.get('THINK_MODEL', 'deepseek/deepseek-r1-distill-llama-70b:free')
    elif task_type:
        selected_model = route(task_type, complexity)
    else:
        selected_model = route_for_mode(mode, complexity)

    # User-uploaded document: skip textbook index entirely
    if doc_context:
        context, similarity, is_relevant, source, all_sources = doc_context, 1.0, True, None, []
        searcher     = TextbookSearch()
        use_textbook = False
    else:
        searcher     = get_book_index(book_id)
        use_textbook = should_search_textbook(question, chunks_loaded=bool(searcher.chunks))
        if use_textbook:
            context, similarity, is_relevant, source, all_sources = searcher.smart_search(question, top_k=5)
        else:
            context, similarity, is_relevant, source, all_sources = "", 0.0, False, None, []

    # ── Semantic answer cache check ───────────────────────────────────────
    from services import answer_cache as _answer_cache
    _sem_eligible = (
        _cache_eligible
        and mode != 'generate'
        and use_textbook
        and searcher.has_embeddings
        and not selected_text
        and not user_memory
    )
    _sem_ctx_hash = None
    _query_emb_list = None
    if _sem_eligible:
        _query_emb = searcher.embed_query(question)
        if _query_emb is not None:
            _query_emb_list = (
                _query_emb.tolist()
                if hasattr(_query_emb, 'tolist')
                else list(_query_emb)
            )
            _sem_ctx_hash = _answer_cache.context_hash(mode, complexity, context)
            _sem_hit = _answer_cache.lookup(_query_emb_list, _sem_ctx_hash)
            if _sem_hit:
                _sem_hit['cached'] = True
                _sem_hit['semantic_cached'] = True
                return _sem_hit
        else:
            _sem_eligible = False

    # ── Shared prompt helpers ─────────────────────────────────────────────
    complexity_levels = {
        1:  "Explain in the simplest possible terms.",
        2:  "Explain simply for a beginner.",
        3:  "Explain clearly for a middle-school or early high school student.",
        4:  "Explain for a high school student.",
        5:  "Balanced explanation with proper terminology.",
        6:  "Detailed explanation for a first-year university student.",
        7:  "University-level explanation.",
        8:  "Advanced undergraduate level.",
        9:  "Graduate-level depth.",
        10: "Expert/research level.",
    }
    complexity_instruction = complexity_levels[complexity]

    EQUATION_SUBJECTS = {'chemistry', 'physics', 'biochemistry', 'mathematics', 'engineering'}
    if doc_context:
        book_name  = 'the uploaded document'
        book_label = "the student's uploaded document"
    else:
        book_info   = BOOK_LIBRARY.get(book_id, {})
        book_name   = book_info.get('name', 'the textbook')
        book_author = book_info.get('author', '')
        book_label  = f"{book_name} by {book_author}" if book_author else book_name

    needs_latex = any(s in book_name.lower() for s in EQUATION_SUBJECTS)
    latex_instruction = (
        "Use LaTeX notation for all equations and formulas. "
        "Inline math: $...$ — Display math: $$...$$ — "
        r"Example: $$K_{eq} = \frac{[C]^c[D]^d}{[A]^a[B]^b}$$"
    ) if needs_latex else "Use plain text for any formulas or technical notation."

    if selected_text:
        ctx_block = ""
    elif doc_context and is_relevant:
        ctx_block = f"DOCUMENT CONTENT:\n{context}\n\n"
    elif is_relevant:
        ctx_block = f"TEXTBOOK CONTEXT:\n{context}\n\n"
    else:
        ctx_block = ""

    sel_block = (
        f"SELECTED PASSAGE:\n\"{selected_text}\"\n\n"
    ) if selected_text else ""

    memory_block = f"\n\nUSER PROFILE:\n{user_memory}" if user_memory else ""

    base_system = (
        "You are Chunks AI, an intelligent AI study assistant. "
        f"{'Answer based on the textbook context. ' if is_relevant else ''}"
        f"{latex_instruction}{memory_block}"
    )

    # ── Build prompt and call AI ──────────────────────────────────────────
    if selected_text:
        prompt = f"""You are a tutor.

The student highlighted this passage:
\"{selected_text}\"

STUDENT QUESTION: {question}

COMPLEXITY LEVEL {complexity}/10: {complexity_instruction}
FORMATTING: {latex_instruction}

Explain based on the highlighted passage."""
    elif is_relevant:
        prompt = f"""You are a tutor.

{sel_block}TEXTBOOK CONTEXT:
{context}

STUDENT QUESTION: {question}

COMPLEXITY LEVEL {complexity}/10: {complexity_instruction}
FORMATTING: {latex_instruction}

Answer based on the textbook context."""
    else:
        prompt = f"""You are a knowledgeable tutor.

{sel_block}STUDENT QUESTION: {question}

COMPLEXITY LEVEL {complexity}/10: {complexity_instruction}
FORMATTING: {latex_instruction}

Answer helpfully and clearly."""

    answer = call_ai(prompt, system_prompt=base_system, model=selected_model, history=history,
                     endpoint='async_chat')
    _resp = {
        'success':        True,
        'mode':           mode,
        'answer':         answer,
        'context':        context,
        'similarity':     float(similarity),
        'is_relevant':    is_relevant,
        'source':         source,
        'sources':        all_sources,
        'complexity_used': complexity,
        'search_mode':    'hybrid' if searcher.has_embeddings else 'tfidf',
    }
    if _cache_eligible and _cache_key_val:
        _ask_cache_set(_cache_key_val, _resp,
                       task_type=task_type, mode=mode,
                       book_id=book_id, model_used=selected_model)
    if _sem_eligible and _sem_ctx_hash and _query_emb_list:
        _answer_cache.store(_query_emb_list, _sem_ctx_hash, _resp)
    return _resp


# ── Endpoints ─────────────────────────────────────────────────────────────────

@jobs_bp.route('/ask-async', methods=['POST', 'OPTIONS'])
@validate_request(AskAsyncRequest)
def ask_async():
    """Accept the same payload as /ask but return a jobId immediately."""
    if request.method == 'OPTIONS':
        return jsonify({'ok': True})
    try:
        from services.job_queue import job_queue

        data = request.get_json(silent=True)
        if not data:
            return jsonify({'success': False, 'error': 'Invalid or missing JSON body'}), 400

        question = data.get('question', '').strip()
        if not question:
            return jsonify({'success': False, 'error': 'question is required'}), 400

        job_id = job_queue.enqueue(_run_ask_job, data)

        return jsonify({
            'success': True,
            'jobId':   job_id,
            'status':  'queued',
        }), 202

    except Exception as e:
        logger.exception("Unhandled error in /ask-async")
        return jsonify({'success': False, 'error': str(e)}), 500


@jobs_bp.route('/jobs/<job_id>', methods=['GET'])
def get_job_status(job_id: str):
    """Poll for the status / result of an async job."""
    try:
        from services.job_queue import job_queue

        info = job_queue.get_status(job_id)
        if info is None:
            return jsonify({
                'success': False,
                'error':   'Job not found',
            }), 404

        status = info.get('status', 'unknown')
        resp: dict = {
            'success': True,
            'jobId':   job_id,
            'status':  status,
        }

        if status == 'completed':
            resp['result'] = info.get('result')
        elif status == 'failed':
            resp['error'] = info.get('error', 'Unknown error')

        return jsonify(resp)

    except Exception as e:
        logger.exception("Unhandled error in /jobs/<job_id>")
        return jsonify({'success': False, 'error': str(e)}), 500
