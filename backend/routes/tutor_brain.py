"""
backend/routes/tutor_brain.py — AI Tutor Brain Endpoints

Endpoints
---------
POST /tutor/analyze-gaps    — detect knowledge gaps from quiz results and chat history
POST /tutor/next-topic      — recommend the next concept to study based on the PAEV graph
POST /tutor/save-model      — persist the full student knowledge model to user_settings
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from routes.paev import _paev_cache_get
from routes.limiter import limiter
from services.paev_engine import PrerequisiteChainResolver

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/tutor')

# ── Request schemas ───────────────────────────────────────────────────────────

class QuizResult(BaseModel):
    topic: str
    score: float                        # 0–100
    wrongAnswers: list[str] = []


class AnalyzeGapsRequest(BaseModel):
    book_id: str
    history: list[dict] = []            # conversation turns
    quiz_results: list[QuizResult] = []
    known_concepts: list[str] = []


class GapItem(BaseModel):
    concept: str
    status: str                         # failing | reviewing | recovering


class NextTopicRequest(BaseModel):
    book_id: str
    current_page: int = 0
    student_gaps: list[GapItem] = []


class SaveModelRequest(BaseModel):
    student_model: dict


# ── Helpers ───────────────────────────────────────────────────────────────────

_STATUS_PRIORITY = {"recovering": 0, "reviewing": 1, "failing": 2}

_LOW_SCORE_THRESHOLD    = 60    # below this → gap
_FAILING_THRESHOLD      = 40    # below this → failing
_RECOVERING_THRESHOLD   = 75    # at or above this but still wrong answers → recovering
_MIN_CHAIN_COMPLETENESS = 0.6   # discard gaps whose prereq chain is less complete than this


def _lifecycle_status(score: float) -> str:
    """Map a quiz score to a lifecycle status."""
    if score >= _RECOVERING_THRESHOLD:
        return "recovering"
    if score >= _FAILING_THRESHOLD:
        return "reviewing"
    return "failing"


def _build_student_profile(
    gaps: list[dict],
    mastered: list[str],
    low_scores: list[tuple[str, float]],
) -> str:
    """Return a plain-text student profile block."""
    gap_parts = ", ".join(
        f"{g['concept']} ({g['status']})" for g in gaps
    )
    mastered_part = ", ".join(mastered) if mastered else "none"
    score_parts   = ", ".join(
        f"{topic} ({int(score)}%)" for topic, score in low_scores
    )
    lines = [
        "[STUDENT PROFILE]",
        f"Gaps: {gap_parts or 'none'}",
        f"Mastered: {mastered_part}",
        f"Low quiz scores: {score_parts or 'none'}",
    ]
    return "\n".join(lines)


# ── POST /tutor/analyze-gaps ──────────────────────────────────────────────────

@router.post('/analyze-gaps')
@limiter.limit("20/minute")
def analyze_gaps(request: Request, body: AnalyzeGapsRequest):  # request required by @limiter.limit
    book_id        = body.book_id
    quiz_results   = body.quiz_results
    known_concepts = [c.lower().strip() for c in body.known_concepts]

    # 1. Load PAEV objects from cache
    idx, fps, graph = _paev_cache_get(book_id)
    if idx is None:
        return JSONResponse(
            {'error': 'PAEV index not built for this book. Run /paev/build-index first.'},
            status_code=404,
        )

    # 2. Identify gap concepts from quiz results
    gap_map: dict[str, dict] = {}   # concept_key → {concept, status, score}
    low_scores: list[tuple[str, float]] = []

    for qr in quiz_results:
        topic = qr.topic.strip()
        score = qr.score
        if score < _LOW_SCORE_THRESHOLD:
            key    = topic.lower()
            status = _lifecycle_status(score)
            if key not in gap_map:
                gap_map[key] = {'concept': topic, 'status': status, 'score': score}
            low_scores.append((topic, score))

    # 3. Resolve prerequisite chains for each gap concept
    resolver        = PrerequisiteChainResolver()
    detected_gaps   = []
    prereq_warnings = []

    for concept_key, info in gap_map.items():
        concept = info['concept']
        try:
            result = resolver.resolve([concept], graph, idx, fps)
        except Exception as exc:
            logger.warning(f'[tutor/analyze-gaps] resolve failed for "{concept}": {exc}')
            continue

        if result.chain_completeness <= _MIN_CHAIN_COMPLETENESS:
            # Chain too incomplete — surface as a warning, not a tracked gap
            prereq_warnings.append({
                'concept':              concept,
                'chain_completeness':   result.chain_completeness,
                'missing_from_book':    result.missing_from_book,
            })
            continue

        detected_gaps.append({
            'concept':             concept,
            'status':              info['status'],
            'score':               info['score'],
            'chain':               result.chain,
            'chain_completeness':  result.chain_completeness,
            'prereq_locations':    result.prerequisite_locations,
        })

    # 4. Mastered = known_concepts that are NOT gaps
    gap_keys = {g['concept'].lower() for g in detected_gaps}
    mastered = [c for c in body.known_concepts if c.lower() not in gap_keys]

    # 5. Build student profile block
    student_profile_block = _build_student_profile(detected_gaps, mastered, low_scores)

    return {
        'detected_gaps':        detected_gaps,
        'prereq_warnings':      prereq_warnings,
        'student_profile_block': student_profile_block,
    }


# ── POST /tutor/next-topic ────────────────────────────────────────────────────

@router.post('/next-topic')
@limiter.limit("20/minute")
def next_topic(request: Request, body: NextTopicRequest):  # request required by @limiter.limit
    book_id      = body.book_id
    current_page = body.current_page

    # 1. Load PAEV objects
    idx, fps, graph = _paev_cache_get(book_id)
    if idx is None:
        return JSONResponse(
            {'error': 'PAEV index not built for this book.'},
            status_code=404,
        )

    # 2. Build lookup structures
    gap_concepts: dict[str, str] = {
        g.concept.lower(): g.status for g in body.student_gaps
    }

    def _prereqs_satisfied(concept_key: str) -> bool:
        """All prerequisites of this concept are mastered (not in any gap).
        get_learning_path returns an ordered chain of prerequisite concepts
        that must be mastered before the target; the target concept itself is
        not included in the returned chain."""
        chain = graph.get_learning_path(concept_key)
        for prereq in chain:
            if prereq in gap_concepts:
                return False
        return True

    # 3. Collect candidates — concepts in the PAEV graph that are gap concepts
    #    with all prerequisites satisfied, grouped by priority tier
    tiers: dict[str, list[dict]] = {"recovering": [], "reviewing": [], "failing": []}

    for concept_key, node in graph.nodes.items():
        if concept_key not in gap_concepts:
            continue
        status = gap_concepts[concept_key]
        if not _prereqs_satisfied(concept_key):
            continue
        tiers[status].append({
            'concept_key': concept_key,
            'node':        node,
        })

    # 4. Pick the best candidate: highest-priority tier, then closest page
    candidate = None
    for tier_status in ("recovering", "reviewing", "failing"):
        tier_candidates = tiers[tier_status]
        if not tier_candidates:
            continue
        # Closest page to current_page
        tier_candidates.sort(key=lambda c: abs(c['node'].page - current_page))
        candidate     = tier_candidates[0]
        chosen_status = tier_status
        break

    if candidate is None:
        return JSONResponse(
            {'error': 'No suitable next topic found. All gap prerequisites are unmet.'},
            status_code=404,
        )

    node = candidate['node']
    reason = (
        f"This concept is {chosen_status} and its prerequisites are all covered; "
        f"it appears on page {node.page}, close to your current position."
    )

    return {
        'concept_name': node.name,
        'chapter':      node.chapter_num,
        'page':         node.page,
        'reason':       reason,
    }


# ── GET /tutor/load-model ─────────────────────────────────────────────────────

@router.get('/load-model')
@limiter.limit("60/minute")
async def load_model(request: Request):
    from routes.shared import ctx
    from services.auth import _extract_verified_user

    verified_user_id, _, _ = _extract_verified_user(request)
    if not verified_user_id:
        return JSONResponse({'error': 'Authentication required.'}, status_code=401)

    user_id = verified_user_id

    supabase_url  = getattr(ctx, 'SUPABASE_URL', '')
    service_key   = getattr(ctx, 'SUPABASE_SERVICE_KEY', '')
    async_client  = getattr(ctx, 'async_client', None)

    if not supabase_url or not service_key or not async_client:
        return JSONResponse(
            {'error': 'Supabase not configured on this server.'},
            status_code=500,
        )

    try:
        resp = await async_client.get(
            f'{supabase_url}/rest/v1/user_settings'
            f'?user_id=eq.{user_id}&select=student_knowledge_model',
            headers={
                'Authorization': f'Bearer {service_key}',
                'apikey':        service_key,
            },
            timeout=10,
        )
        if resp.status_code not in (200, 201, 204):
            logger.error('[tutor/load-model] Supabase query failed: status=%d body=%s',
                         resp.status_code, resp.text[:200])
            return JSONResponse(
                {'error': f'Supabase returned {resp.status_code}'},
                status_code=502,
            )
        rows = resp.json()
        if not rows:
            return {'student_model': None}

        raw = rows[0].get('student_knowledge_model')
        if not raw:
            return {'student_model': None}

        try:
            model = json.loads(raw) if isinstance(raw, str) else raw
        except (json.JSONDecodeError, TypeError):
            model = None

        return {'student_model': model}
    except Exception:
        logger.exception('[tutor/load-model] unexpected error')
        return JSONResponse({'error': 'Internal server error'}, status_code=500)


# ── POST /tutor/evaluate-socratic ─────────────────────────────────────────────

class EvaluateSocraticRequest(BaseModel):
    question: str
    student_answer: str
    topic: str = ''


@router.post('/evaluate-socratic')
async def evaluate_socratic(body: EvaluateSocraticRequest):
    """
    Ask the AI to evaluate whether a student's answer to a Socratic
    checking question is correct.

    Returns:
        { correct: bool, feedback: str }
    """
    try:
        from services.ai import call_ai_async
    except ImportError:
        call_ai_async = None

    if call_ai_async is None:
        return JSONResponse(
            {'error': 'AI service not available.'},
            status_code=500,
        )

    prompt = (
        f'A student was asked the following checking question:\n'
        f'"{body.question}"\n\n'
        f'The student answered:\n'
        f'"{body.student_answer}"\n\n'
        f'Evaluate whether the student\'s answer is essentially correct. '
        f'Reply ONLY with a JSON object in this exact format '
        f'(no other text): {{"correct": true/false, "feedback": "one sentence"}}'
    )

    try:
        raw = await call_ai_async(
            prompt,
            system_prompt='You are a helpful tutor evaluating a student answer. Return only valid JSON.',
            max_tokens_override=200,
            endpoint='chat',
        )
        cleaned = raw.strip()
        if cleaned.startswith('```'):
            cleaned = cleaned.split('\n', 1)[-1].rsplit('```', 1)[0].strip()
        result = json.loads(cleaned)
        return {
            'correct':  bool(result.get('correct', False)),
            'feedback': str(result.get('feedback', '')),
        }
    except Exception:
        logger.exception('[tutor/evaluate-socratic] unexpected error')
        return JSONResponse({'error': 'Internal server error'}, status_code=500)


# ── POST /tutor/save-model ────────────────────────────────────────────────────

@router.post('/save-model')
@limiter.limit("30/minute")
async def save_model(request: Request, body: SaveModelRequest):
    from routes.shared import ctx
    from services.auth import _extract_verified_user

    verified_user_id, _, _ = _extract_verified_user(request)
    if not verified_user_id:
        return JSONResponse({'error': 'Authentication required.'}, status_code=401)

    model = body.student_model
    if not (
        isinstance(model.get('mastered'), list)
        and isinstance(model.get('gaps'), list)
        and isinstance(model.get('quizHistory'), list)
    ):
        return JSONResponse({'error': 'Invalid student model schema.'}, status_code=422)

    if len(json.dumps(model).encode('utf-8')) > 65_536:
        return JSONResponse({'error': 'Student model exceeds maximum size.'}, status_code=400)

    supabase_url  = getattr(ctx, 'SUPABASE_URL', '')
    service_key   = getattr(ctx, 'SUPABASE_SERVICE_KEY', '')
    async_client  = getattr(ctx, 'async_client', None)

    if not supabase_url or not service_key or not async_client:
        return JSONResponse(
            {'error': 'Supabase not configured on this server.'},
            status_code=500,
        )

    payload = {
        'user_id':               verified_user_id,
        'student_knowledge_model': model,
    }

    try:
        resp = await async_client.post(
            f'{supabase_url}/rest/v1/user_settings',
            json=payload,
            headers={
                'Authorization': f'Bearer {service_key}',
                'apikey':        service_key,
                'Content-Type':  'application/json',
                'Prefer':        'resolution=merge-duplicates,return=minimal',
            },
            timeout=10,
        )
        if resp.status_code not in (200, 201, 204):
            logger.error('[tutor/save-model] Supabase upsert failed: status=%d body=%s',
                         resp.status_code, resp.text[:200])
            return JSONResponse(
                {'error': f'Supabase returned {resp.status_code}'},
                status_code=502,
            )
        return {'success': True}
    except Exception:
        logger.exception('[tutor/save-model] unexpected error')
        return JSONResponse({'error': 'Internal server error'}, status_code=500)


# ── GET /tutor/paev-status ────────────────────────────────────────────────────

@router.get('/paev-status')
@limiter.limit("60/minute")
def paev_status(request: Request, book_id: str):  # request required by @limiter.limit
    """Return whether the PAEV index has been built for a user-uploaded document."""
    from routes.shared import ctx
    redis = getattr(ctx, 'redis', None)
    if redis is not None:
        try:
            val = redis.get(f'paev_ready:{book_id}')
            if val == '1' or val == b'1':
                return {'ready': True}
        except Exception:
            logger.warning('[tutor/paev-status] redis error for %s', book_id)
    return {'ready': False}
