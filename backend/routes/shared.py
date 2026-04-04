"""
backend/routes/shared.py — Shared context for all route blueprints.

Every blueprint imports from here instead of importing directly from server.py,
which avoids circular imports and makes the dependency graph explicit.

Usage in a blueprint:
    from routes.shared import ctx
    ctx.call_ai(...)
    ctx.logger.info(...)
    ctx._redis  # may be None if Redis not configured
"""
from __future__ import annotations
from typing import Any


class _AppContext:
    """
    Lazy-populated namespace. server.py calls ctx._init(**kwargs) once at
    startup to inject all shared objects. Blueprints then read from ctx.*.

    Accessing an attribute before _init() raises AttributeError with a
    helpful message so misconfiguration fails loudly.
    """
    _ready: bool = False

    def _init(self, **kwargs: Any) -> None:
        for k, v in kwargs.items():
            object.__setattr__(self, k, v)
        object.__setattr__(self, '_ready', True)

    def __getattr__(self, name: str) -> Any:
        if name.startswith('_'):
            raise AttributeError(name)
        raise AttributeError(
            f"routes.shared.ctx.{name} accessed before ctx._init() was called. "
            "Make sure server.py calls ctx._init() before registering blueprints."
        )


ctx = _AppContext()

# ── Teaching-assistant response guidelines ────────────────────────────────────
# Injected into every chat system-prompt so answers are structured, layered,
# and easy to understand for students and visual learners.
TEACHING_PROMPT = (
    "\n\nRESPONSE GUIDELINES — follow these for every answer:\n"
    "1. STRUCTURE: Start with a 1–2 sentence overview, then break the explanation "
    "into sections with headers, use bullet points, keep sentences short.\n"
    "2. EXPLAIN IN LAYERS: (a) What is it? — simple definition. "
    "(b) Parts or components. (c) How it works — step-by-step. "
    "(d) Real-life example. (e) Simple summary (Grade 6 level).\n"
    "3. LANGUAGE: Avoid jargon; if a complex term is unavoidable, define it immediately.\n"
    "4. READABILITY: Use spacing between sections; avoid long paragraphs; prefer bullets.\n"
    "5. LENGTH: Default 200–400 words. Expand only when the topic genuinely requires it. "
    "Never repeat or ramble.\n"
    "6. DIRECTNESS: No unnecessary introductions. Never say 'as an AI'. "
    "Go straight to the answer.\n"
    "7. IF ASKED FOR STEP-BY-STEP: Convert the explanation into numbered steps.\n"
    "8. IF ASKED FOR SIMPLE EXPLANATION: Use very basic words and analogies.\n"
    "9. IF ASKED FOR ADVANCED: Provide a deeper breakdown while keeping structure.\n"
    "10. OUTPUT FORMAT: [Title] → [Simple explanation] → [Sections with headers] "
    "→ [Example] → [Simple summary].\n"
    "Priority: Clarity > complexity. Structure > length. Understanding > completeness."
)
