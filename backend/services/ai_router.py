"""
backend/ai_router.py — AI model router for Chunks

Maps (task_type, complexity) → the cheapest model that can do the job well.

Design goals
────────────
• ~70% cost reduction vs always using MODEL (the default medium model).
• Zero breaking changes: every call_ai() site passes task_type; the router
  returns the right model string; call_ai() uses it via model=route(...).
• Fully configurable via env vars — operators can swap any tier.
• Transparent fallback: unknown task_type → route by complexity alone.

Tier environment variables
──────────────────────────
  SMALL_MODEL   fast, cheap — definitions, simple recall, short answers
                default: openai/gpt-4o-mini
  MODEL         medium — standard study questions, explanations, flashcards
                default: openai/gpt-oss-20b:nitro  (or whatever
                         server.py sets as MODEL)
  LARGE_MODEL   large — research layers, complex derivations, exam writing
                default: openai/gpt-4o-mini  (or whatever is set)
  THINK_MODEL   chain-of-thought — activated by [THINKING_MODE] token
                default: openai/gpt-oss-20b:nitro
  DEEP_MODEL    deep reasoning — activated by [DEEP_THINKING_MODE] token
                default: google/gemini-2.5-flash

Task-type registry
──────────────────
Each key maps to a tier string ('small'|'medium'|'large') rather than a
model name directly, so changing MODEL/SMALL_MODEL/LARGE_MODEL env vars
cascades correctly to all tasks.

Complexity override: if a task_type calls for 'small' but complexity ≥ 8,
it is promoted to 'medium'.  If it calls for 'medium' but complexity == 10,
it is promoted to 'large'.  This prevents sending a legitimately hard
question to an under-powered model.
"""

import os
import logging

logger = logging.getLogger(__name__)

# ── Tier resolution ────────────────────────────────────────────────────────────

def _get_models() -> dict:
    """
    Read model names from env at call-time (not module load time) so that
    tests and Railway can override MODEL without restarting the process.
    """
    # Import MODEL from server context — fall back to env directly if called
    # before server.py initialises the constant.
    medium = os.environ.get('MODEL', 'openai/gpt-oss-20b:nitro')
    return {
        'small':  os.environ.get('SMALL_MODEL',  'openai/gpt-4o-mini'),
        'medium': medium,
        'large':  os.environ.get('LARGE_MODEL',  'google/gemini-2.5-flash'),
        'think':  os.environ.get('THINK_MODEL',  'deepseek/deepseek-r1-distill-llama-70b:free'),
        'deep':   os.environ.get('DEEP_MODEL',   'deepseek/deepseek-r1:free'),
    }


# ── Task → base tier ──────────────────────────────────────────────────────────

TASK_TIERS: dict[str, str] = {
    # ── Workspace / chat ──────────────────────────────────────────────────
    'workspace_concise':   'small',    # one-liner answers, quick definitions
    'workspace_study':     'medium',   # standard study mode (default)
    'workspace_detailed':  'large',    # deep-dive mode, derivations
    'workspace_practice':  'medium',   # step-by-step problem solving
    'workspace_summary':   'medium',   # chapter/section summaries
    'workspace_generate':  'medium',   # structured generation (study plans etc.)
    'workspace_exam':      'large',    # in-chat exam question generation

    # ── Home screen ───────────────────────────────────────────────────────
    'home_general':        'small',    # general chat, topic overview
    'home_study':          'medium',   # home screen study questions

    # ── Flashcards ────────────────────────────────────────────────────────
    'flashcard_simple':    'medium',   # ≤ 10 cards — medium for Anki-quality output
    'flashcard_complex':   'medium',   # > 10 cards or advanced topic
    'flashcard_tutor':     'medium',   # AI tutor explanation for a card

    # ── Study plan ────────────────────────────────────────────────────────
    'study_plan':          'medium',   # full critical-path generation
    'study_plan_explain':  'medium',   # drawer: explain a concept
    'study_plan_flashcard':'small',    # drawer: mini flashcard set
    'study_plan_practice': 'medium',   # drawer: practice questions
    'study_plan_grade':    'small',    # grading a short-answer response
    'study_plan_exam':     'medium',   # drawer: mini exam

    # ── Research ──────────────────────────────────────────────────────────
    'research_outline':    'medium',   # paper structure / outline layer
    'research_layer':      'large',    # full paragraph/section generation
    'research_search':     'small',    # paper search / keyword extraction

    # ── Exam screen ───────────────────────────────────────────────────────
    'exam_easy':           'small',    # complexity 1-4
    'exam_medium':         'medium',   # complexity 5-7
    'exam_hard':           'large',    # complexity 8-10

    # ── Visual tutor ──────────────────────────────────────────────────────
    'visual_simple':       'small',    # pre-built scene chat
    'visual_medium':       'medium',   # custom diagram chat
    'visual_complex':      'large',    # multi-step visual derivation
    'visual_tutor':        'large',    # blueprint generation — needs best spatial reasoning

    # ── Admin / internal ──────────────────────────────────────────────────
    'admin_bug_summary':   'small',
}


# ── Complexity promotion thresholds ───────────────────────────────────────────

# small → medium if complexity ≥ this
_PROMOTE_SMALL_AT  = 8
# medium → large if complexity ≥ this
_PROMOTE_MEDIUM_AT = 10


# ── Public API ─────────────────────────────────────────────────────────────────

def route(task_type: str | None, complexity: int = 5) -> str:
    """
    Return the model string for a given task and complexity.

    Parameters
    ----------
    task_type : str | None
        One of the keys in TASK_TIERS.  If None or unknown, routing falls
        back to complexity alone.
    complexity : int
        1–10 scale.  Higher values promote cheaper base tiers upward.

    Returns
    -------
    str
        OpenRouter model identifier ready to pass to call_ai(model=...).
    """
    models = _get_models()
    complexity = max(1, min(10, int(complexity)))

    # Resolve base tier
    if task_type and task_type in TASK_TIERS:
        tier = TASK_TIERS[task_type]
    else:
        # Unknown task_type — route purely by complexity
        if complexity <= 3:
            tier = 'small'
        elif complexity <= 7:
            tier = 'medium'
        else:
            tier = 'large'
        if task_type:
            logger.debug("ai_router: unknown task_type %r — routing by complexity %d → %s",
                         task_type, complexity, tier)

    # Complexity promotion
    if tier == 'small' and complexity >= _PROMOTE_SMALL_AT:
        tier = 'medium'
    if tier == 'medium' and complexity >= _PROMOTE_MEDIUM_AT:
        tier = 'large'

    model = models[tier]
    logger.debug("ai_router: task=%r complexity=%d tier=%s model=%s",
                 task_type, complexity, tier, model)
    return model


def route_for_mode(mode: str, complexity: int = 5) -> str:
    """
    Convenience wrapper: maps the /ask 'mode' field to a task_type and
    calls route().  Used by the /ask endpoint to avoid repeating the
    mode→task_type mapping everywhere.

    Mode → task_type mapping
    ─────────────────────────
    concise   → workspace_concise
    study     → workspace_study
    detailed  → workspace_detailed
    practice  → workspace_practice
    summary   → workspace_summary
    generate  → workspace_generate
    exam      → workspace_exam  (then complexity sub-splits handled by route)
    general   → home_general
    *         → workspace_study  (safe default)
    """
    MODE_MAP: dict[str, str] = {
        'concise':  'workspace_concise',
        'study':    'workspace_study',
        'detailed': 'workspace_detailed',
        'practice': 'workspace_practice',
        'summary':  'workspace_summary',
        'generate': 'workspace_generate',
        'exam':     'workspace_exam',
        'general':  'home_general',
    }
    task_type = MODE_MAP.get(mode, 'workspace_study')
    return route(task_type, complexity)


# ── Introspection helper (used by admin endpoint) ─────────────────────────────

def routing_table() -> list[dict]:
    """Return the full task→tier→model table for the admin dashboard."""
    models = _get_models()
    rows = []
    for task, tier in sorted(TASK_TIERS.items()):
        rows.append({
            'task':       task,
            'tier':       tier,
            'model':      models[tier],
            'model_name': models[tier].split('/')[-1],
        })
    return rows
