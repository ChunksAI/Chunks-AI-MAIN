"""
backend/routes/validation.py — No-op request validation decorator.

FastAPI handles request body validation natively via Pydantic model parameters.
This module exists as a permanent compatibility shim so any remaining imports
of ``validate_request`` from this module continue to compile without change.
The decorator is a simple pass-through that applies no logic.
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
