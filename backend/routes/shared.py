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
