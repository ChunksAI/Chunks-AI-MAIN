"""
backend/routes/validation.py — Pydantic-powered request validation decorator.

Usage
-----
::

    from routes.validation import validate_request
    from routes.schemas    import FlashcardsRequest

    @bp.route('/generate-flashcards', methods=['POST', 'OPTIONS'])
    @validate_request(FlashcardsRequest)
    def generate_flashcards():
        ...

The decorator:

1. Skips validation for OPTIONS (CORS preflight) requests.
2. Parses the JSON body through the given Pydantic model.
3. On validation failure returns **422 Unprocessable Entity** with a
   machine-readable ``details`` array.
4. On success stores the validated model on ``flask.g.body`` so the
   route can (optionally) use ``g.body.field`` instead of
   ``data.get('field', default)``.  The raw ``request.get_json()``
   dict is still available as before — nothing is removed.
"""
from __future__ import annotations

import logging
from functools import wraps
from typing import Type

from flask import g, jsonify, request
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)


def validate_request(model_cls: Type[BaseModel], *, allow_empty: bool = False):
    """Decorator that validates the JSON request body against *model_cls*.

    Parameters
    ----------
    model_cls:
        The Pydantic model class to validate against.
    allow_empty:
        When ``True``, a missing or empty JSON body is treated as ``{}``
        instead of returning 400.  Useful for endpoints where the body
        is optional (e.g. admin verify-access Phase 1).
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            # CORS preflight — nothing to validate
            if request.method == 'OPTIONS':
                return fn(*args, **kwargs)

            data = request.get_json(silent=True)
            if data is None:
                if allow_empty:
                    data = {}
                else:
                    return jsonify({
                        'success': False,
                        'error':   'Invalid or missing JSON body',
                    }), 400

            try:
                g.body = model_cls.model_validate(data)
            except ValidationError as exc:
                errors = exc.errors(include_url=False)
                logger.info(
                    "Request validation failed for %s: %s",
                    request.path, errors,
                )
                return jsonify({
                    'success': False,
                    'error':   'Validation error',
                    'details': errors,
                }), 422

            return fn(*args, **kwargs)
        return wrapper
    return decorator
