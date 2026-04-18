"""
backend/orchestrator.py — Stateless, deterministic context-routing logic.

The ``decide`` function controls what context is fetched before every LLM
call.  It is pure Python (no I/O, no LLM calls) and must complete in <1 ms.

Routing is score-based: a float score is computed for each named route from
a weighted sum of input signals.  The route with the highest score wins.
All weight constants live in :data:`ROUTE_WEIGHTS` and are tunable without
a code deploy.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from services.intent_classifier import ClassificationResult

ToolType = Literal['youtube', 'search', 'doc', 'none']

# ---------------------------------------------------------------------------
# Tunable weight constants — change these without touching routing logic
# ---------------------------------------------------------------------------

ROUTE_WEIGHTS: dict[str, dict[str, float]] = {
    # Chitchat — no enrichment, highest priority when detected
    'socratic': {
        'chitchat_intent': 8.0,
    },
    # Explicit web-search request — overrides most signals except chitchat
    'web_search': {
        'web_search_requested': 7.0,
    },
    # Confused student with failing gaps + PAEV available — deep remediation
    'paev_deep': {
        # Composite gate: all three conditions must be true simultaneously.
        # A value of 10.0 ensures this beats web_search (7.0) and socratic (8.0)
        # when all conditions fire, but stays at 0 when any condition is missing.
        'paev_deep_eligible': 10.0,
        # Additional boost from sustained confusion signal
        'confusion_level': 2.0,
    },
    # Concept question with any gaps + PAEV available — light enrichment
    'paev_light': {
        # Composite gate: concept + has_gaps + paev_ready must all be true
        'paev_light_eligible': 7.0,
    },
    # Viewer context — question references what the student is currently watching
    'viewer_context': {
        'viewer_active': 2.0,
        'is_viewer_reference': 4.0,
    },
    # Default fallback — direct answer, no enrichment
    'direct_chat': {
        'base': 0.5,
    },
}


@dataclass(frozen=True)
class OrchestratorDecision:
    use_paev: bool
    use_tool: bool
    tool_type: ToolType
    paev_prereq_limit: int   # max prerequisites to inject (1–3)
    tool_token_budget: int   # max tokens for tool context
    cache_eligible: bool     # False if profile exists (personalised)
    reason: str              # human-readable, for logging only
    viewer_route: bool = field(default=False)
    confusion_escalated: bool = field(default=False)
    session_momentum: str = field(default='direct')


def decide(
    *,
    intent: 'str | ClassificationResult',
    student_gaps: list[dict],
    paev_ready: bool,
    has_doc_context: bool,   # reserved for Phase 2 doc-tool routing
    mode: str,
    question: str,
    student_profile: str,
    web_search_requested: bool,
    viewer_state: dict | None = None,
) -> OrchestratorDecision:
    """Return a routing decision for the current request.

    Routing is score-based: a float score is computed for each named route
    from a weighted sum of input signals (see :data:`ROUTE_WEIGHTS`).  The
    route with the highest score wins.  All prior if/else priority rules are
    preserved by appropriate weight design.

    Parameters
    ----------
    intent : str | ClassificationResult
        Either the legacy string intent (``'concept'`` | ``'procedural'`` |
        ``'confused'`` | ``'chitchat'``) or a rich
        :class:`~services.intent_classifier.ClassificationResult`.  Strings
        are normalised internally for backward compatibility.
    viewer_state : dict | None
        Optional viewer context dict.  Expected key:
        ``"visible_transcript_segment"`` (str).  When present and the
        question references it, the ``viewer_context`` route is boosted
        by ``ROUTE_WEIGHTS['viewer_context']['is_viewer_reference']``.
    """
    from services.intent_classifier import ClassificationResult  # local to avoid cycle

    # ── Normalise intent ──────────────────────────────────────────────────────
    if isinstance(intent, str):
        clf = ClassificationResult(
            primary_intent=intent,  # type: ignore[arg-type]
            secondary_intent=None,
            confusion_level=0.0,
            is_viewer_reference=False,
            is_multi_intent=False,
        )
    else:
        clf = intent

    primary = clf.primary_intent

    # ── Derive boolean signals ────────────────────────────────────────────────
    failing_gaps = [g for g in student_gaps if g.get('status') == 'failing']

    sig: dict[str, float] = {
        'chitchat_intent':     float(primary == 'chitchat'),
        'confused_intent':     float(primary == 'confused'),
        'concept_intent':      float(primary == 'concept'),
        'procedural_intent':   float(primary == 'procedural'),
        'web_search_requested': float(web_search_requested),
        'has_failing_gaps':    float(bool(failing_gaps)),
        'has_any_gaps':        float(bool(student_gaps)),
        'paev_ready':          float(paev_ready),
        'viewer_active':       float(viewer_state is not None),
        'is_viewer_reference': float(clf.is_viewer_reference),
        'confusion_level':     clf.confusion_level,
        'is_multi_intent':     float(clf.is_multi_intent),
        # Composite gate signals — 1.0 only when ALL constituent conditions met
        'paev_deep_eligible':  float(
            primary == 'confused' and bool(failing_gaps) and paev_ready
        ),
        'paev_light_eligible': float(
            primary == 'concept' and bool(student_gaps) and paev_ready
        ),
        'base': 1.0,
    }

    # ── Score each route ──────────────────────────────────────────────────────
    scores: dict[str, float] = {}
    for route, weights in ROUTE_WEIGHTS.items():
        scores[route] = sum(weights.get(k, 0.0) * v for k, v in sig.items())

    winning_route = max(scores, key=lambda r: scores[r])

    # ── Map winning route → OrchestratorDecision ─────────────────────────────
    cache_ok = not bool(student_profile)

    if winning_route == 'socratic':
        return OrchestratorDecision(
            use_paev=False, use_tool=False, tool_type='none',
            paev_prereq_limit=0, tool_token_budget=0,
            cache_eligible=cache_ok,
            reason='chitchat — no enrichment needed',
            viewer_route=False,
            confusion_escalated=False,
            session_momentum='chat',
        )

    if winning_route == 'web_search':
        return OrchestratorDecision(
            use_paev=False, use_tool=True, tool_type='search',
            paev_prereq_limit=0, tool_token_budget=800,
            cache_eligible=False,
            reason='explicit web search requested',
            viewer_route=False,
            confusion_escalated=False,
            session_momentum='explore',
        )

    if winning_route == 'paev_deep':
        return OrchestratorDecision(
            use_paev=True, use_tool=False, tool_type='none',
            paev_prereq_limit=2,
            tool_token_budget=0,
            cache_eligible=False,
            reason=f'confused student with {len(failing_gaps)} failing gaps — PAEV prereq chain',
            viewer_route=False,
            confusion_escalated=True,
            session_momentum='scaffold',
        )

    if winning_route == 'paev_light':
        return OrchestratorDecision(
            use_paev=True, use_tool=False, tool_type='none',
            paev_prereq_limit=3,
            tool_token_budget=0,
            cache_eligible=False,
            reason='concept question with known gaps — PAEV prereq lookup',
            viewer_route=False,
            confusion_escalated=False,
            session_momentum='deepen',
        )

    if winning_route == 'viewer_context':
        return OrchestratorDecision(
            use_paev=False, use_tool=True, tool_type='youtube',
            paev_prereq_limit=0, tool_token_budget=600,
            cache_eligible=False,
            reason='viewer reference detected — grounding in viewed content',
            viewer_route=True,
            confusion_escalated=False,
            session_momentum='anchor',
        )

    # direct_chat (default)
    return OrchestratorDecision(
        use_paev=False, use_tool=False, tool_type='none',
        paev_prereq_limit=0, tool_token_budget=0,
        cache_eligible=cache_ok,
        reason='default — no enrichment signals',
        viewer_route=False,
        confusion_escalated=False,
        session_momentum='direct',
    )
