"""
backend/orchestrator.py — Stateless, deterministic context-routing logic.

The ``decide`` function controls what context is fetched before every LLM
call.  It is pure Python (no I/O, no LLM calls) and must complete in <1 ms.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ToolType = Literal['youtube', 'search', 'doc', 'none']


@dataclass(frozen=True)
class OrchestratorDecision:
    use_paev: bool
    use_tool: bool
    tool_type: ToolType
    paev_prereq_limit: int   # max prerequisites to inject (1–3)
    tool_token_budget: int   # max tokens for tool context
    cache_eligible: bool     # False if profile exists (personalised)
    reason: str              # human-readable, for logging only


def decide(
    *,
    intent: str,                 # 'concept' | 'procedural' | 'chitchat' | 'confused'
    student_gaps: list[dict],    # from student model
    paev_ready: bool,            # Redis flag for this book
    has_doc_context: bool,   # reserved for Phase 2 doc-tool routing
    mode: str,
    question: str,
    student_profile: str,
    web_search_requested: bool,
) -> OrchestratorDecision:
    """Return a routing decision for the current request.

    Rules are evaluated in priority order; the first match wins.
    """

    # Rule 1: Chitchat never uses tools or PAEV
    if intent == 'chitchat':
        return OrchestratorDecision(
            use_paev=False, use_tool=False, tool_type='none',
            paev_prereq_limit=0, tool_token_budget=0,
            cache_eligible=not bool(student_profile),
            reason='chitchat — no enrichment needed',
        )

    # Rule 2: Explicit web search request → search tool, no PAEV
    if web_search_requested:
        return OrchestratorDecision(
            use_paev=False, use_tool=True, tool_type='search',
            paev_prereq_limit=0, tool_token_budget=800,
            cache_eligible=False,
            reason='explicit web search requested',
        )

    # Rule 3: Student is confused AND has failing gaps AND PAEV ready → PAEV first
    failing_gaps = [g for g in student_gaps if g.get('status') == 'failing']
    if intent == 'confused' and failing_gaps and paev_ready:
        return OrchestratorDecision(
            use_paev=True, use_tool=False, tool_type='none',
            paev_prereq_limit=2,  # max 2 prereqs when confused — keep it focused
            tool_token_budget=0,
            cache_eligible=False,
            reason=f'confused student with {len(failing_gaps)} failing gaps — PAEV prereq chain',
        )

    # Rule 4: Concept question + PAEV ready + has gaps → PAEV enrichment
    if intent == 'concept' and paev_ready and student_gaps:
        return OrchestratorDecision(
            use_paev=True, use_tool=False, tool_type='none',
            paev_prereq_limit=3,
            tool_token_budget=0,
            cache_eligible=False,
            reason='concept question with known gaps — PAEV prereq lookup',
        )

    # Rule 5: Procedural question → no PAEV, no tool (textbook search handles it)
    if intent == 'procedural':
        return OrchestratorDecision(
            use_paev=False, use_tool=False, tool_type='none',
            paev_prereq_limit=0, tool_token_budget=0,
            cache_eligible=not bool(student_profile),
            reason='procedural question — textbook search sufficient',
        )

    # Default: concept question, no gaps or PAEV not ready
    return OrchestratorDecision(
        use_paev=False, use_tool=False, tool_type='none',
        paev_prereq_limit=0, tool_token_budget=0,
        cache_eligible=not bool(student_profile),
        reason='default — no enrichment signals',
    )
