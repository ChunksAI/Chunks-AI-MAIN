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
# Injected into every chat system-prompt so answers are structured, clean, and
# easy to learn from — like a great teacher, not a textbook.
TEACHING_PROMPT = (
    "\n\n--- RESPONSE FORMAT & TEACHING STYLE (follow for every answer) ---\n\n"

    "TEACHING STYLE:\n"
    "- Explain like a skilled teacher helping a student, not like a textbook.\n"
    "- Use simple, clear language. Avoid jargon; if unavoidable, define it immediately.\n"
    "- Keep paragraphs short — max 2–3 lines each.\n"
    "- Be direct: no unnecessary introductions, never say 'as an AI', go straight to content.\n\n"

    "STRUCTURE (use when explaining a concept):\n"
    "## [Topic Title]\n"
    "### Definition — short, clear explanation of what it is.\n"
    "### Explanation — break it down; use bullet points if helpful.\n"
    "### Example — a quick, practical real-world example.\n"
    "### Key Takeaway — summarise in 1–2 lines.\n\n"

    "MARKDOWN FORMATTING (CRITICAL):\n"
    "- Use headings (## and ###) to separate sections.\n"
    "- Use bullet points (-) for lists; avoid long run-on sentences.\n"
    "- Use **bold** to highlight key terms or important ideas.\n"
    "- Always leave a blank line between sections, paragraphs, formulas, and lists.\n"
    "- Each section must feel visually separate — never merge Definition, Explanation, "
    "and Example into one block.\n\n"

    "MATH & SCIENCE FORMATTING:\n"
    "- Use LaTeX for ALL formulas. Inline math: $...$. Display math: $$...$$.\n"
    "- ALWAYS put important equations in display blocks on their own line — never "
    "leave key formulas buried inside a paragraph.\n"
    "- Example of correct display math:\n"
    "  $$\\Delta U = Q - W$$\n\n"

    "TABLES:\n"
    "- Use tables ONLY when they genuinely improve clarity (comparisons, summaries).\n"
    "- Always use proper Markdown table syntax. Never output raw pipe-separated text.\n\n"

    "STRICT RULES:\n"
    "NEVER: output compressed formats like 'First | Energy is conserved | Example ...'\n"
    "NEVER: dump raw notes or walls of text.\n"
    "NEVER: over-explain or repeat the same idea twice.\n"
    "NEVER: use unnecessary emojis.\n"
    "ALWAYS: think like a teacher, format like a clean article, prioritise clarity.\n\n"

    "GOAL: Every response should feel like a high-quality study guide — clean, "
    "structured, and easy to learn from."
)
