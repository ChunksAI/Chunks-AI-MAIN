"""
backend/routes/validation.py — Pydantic request validation decorator (no-op stub).

With FastAPI, request body validation is handled natively by declaring the
request body as a Pydantic model parameter in the route function signature.
This module retains a no-op ``validate_request`` decorator so that existing
imports compile without modification during the migration; the decorator is
simply a pass-through that applies no logic.
"""
from __future__ import annotations

from functools import wraps
from typing import Type

from pydantic import BaseModel


def validate_request(model_cls: Type[BaseModel], *, allow_empty: bool = False):
    """No-op decorator — FastAPI handles body validation natively."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            return fn(*args, **kwargs)
        return wrapper
    return decorator
