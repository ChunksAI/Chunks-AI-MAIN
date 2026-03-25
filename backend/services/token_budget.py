"""
backend/services/token_budget.py — Token limits and cost budgeting.

Provides:
  - ENDPOINT_MAX_TOKENS  per-endpoint default token ceilings
  - max_tokens_for_endpoint()  resolve the right limit for a given endpoint/task
  - check_daily_budget()  verify daily spending is within the configured budget
  - record_usage()        record prompt/completion tokens + cost for a request
  - get_daily_usage()     return today's aggregated usage stats

All state is Redis-backed (24 h TTL) with in-memory fallback when Redis is
unavailable — identical resilience pattern to answer_cache / embedding_cache.
"""
from __future__ import annotations

import datetime
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Module-level state (injected by init()) ───────────────────────────────────
_redis = None

# ── Per-endpoint token ceilings ───────────────────────────────────────────────
# These are *hard caps* — the max_tokens value sent to the upstream model.
# Endpoints may request fewer tokens; this is the ceiling they cannot exceed.

ENDPOINT_MAX_TOKENS: dict[str, int] = {
    # /ask  (default study mode)
    'chat':             6_000,
    'chat_exam':       10_000,
    'chat_visual':      4_000,
    'chat_practice':    6_000,
    'chat_summary':     6_000,
    'chat_generate':    6_000,
    'chat_web_search':  4_000,
    # /ask-image
    'image':            2_000,
    # /generate-flashcards
    'flashcards':       4_000,
    # /generate-study-materials
    'study_materials':  8_000,
    # /generate-quiz
    'quiz':            12_000,
    # /ask-async  (mirrors /ask)
    'async_chat':       6_000,
}

# Hard ceiling across all endpoints — no single request may exceed this.
ABSOLUTE_MAX_TOKENS: int = int(os.environ.get('ABSOLUTE_MAX_TOKENS', '16000'))


def init(redis=None) -> None:
    """Inject Redis handle.  Call once from server.py at startup."""
    global _redis
    _redis = redis


# ── Token limit resolution ────────────────────────────────────────────────────

def max_tokens_for_endpoint(
    endpoint: str,
    override: int | None = None,
) -> int:
    """Return the effective max_tokens for an endpoint.

    Parameters
    ----------
    endpoint : str
        Key into ENDPOINT_MAX_TOKENS (e.g. ``'chat'``, ``'quiz'``).
    override : int | None
        Caller-requested max_tokens.  If provided, the returned value is
        ``min(override, ceiling)`` so callers can request *fewer* tokens but
        never *more* than the endpoint ceiling.

    Returns
    -------
    int
        Token limit to send to the upstream model.
    """
    ceiling = ENDPOINT_MAX_TOKENS.get(endpoint, 6_000)
    if override is not None and override > 0:
        effective = min(override, ceiling)
    else:
        effective = ceiling
    return min(effective, ABSOLUTE_MAX_TOKENS)


# ── Daily cost budget ─────────────────────────────────────────────────────────
#
# Set DAILY_COST_BUDGET_USD to a dollar amount (e.g. "5.00") to enforce a
# daily spending cap.  When the cap is reached, all AI calls are blocked
# until the next UTC day.  Default: 0 → unlimited.

_BUDGET_ENV = 'DAILY_COST_BUDGET_USD'
_REDIS_DAILY_KEY_PREFIX = 'token_budget:daily:'

# In-memory fallback accumulator (lost on process restart).
_mem_usage: dict[str, dict] = {}


def _today_key() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')


def _daily_budget_usd() -> float:
    """Return the configured daily budget, or 0.0 for unlimited."""
    try:
        return float(os.environ.get(_BUDGET_ENV, '0'))
    except (TypeError, ValueError):
        return 0.0


def check_daily_budget() -> bool:
    """Return True if spending is still within budget.

    Returns True (allowed) when:
    - no budget is configured (DAILY_COST_BUDGET_USD = 0 or unset)
    - today's total cost is below the budget
    """
    budget = _daily_budget_usd()
    if budget <= 0:
        return True
    usage = get_daily_usage()
    return usage.get('total_cost_usd', 0.0) < budget


def record_usage(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_cost: float,
    endpoint: str = '',
) -> None:
    """Record token usage + cost for today."""
    day = _today_key()
    entry = {
        'model': model,
        'prompt_tokens': prompt_tokens,
        'completion_tokens': completion_tokens,
        'total_cost': total_cost,
        'endpoint': endpoint,
    }

    if _redis:
        try:
            rkey = f'{_REDIS_DAILY_KEY_PREFIX}{day}'
            _redis.rpush(rkey, json.dumps(entry))
            _redis.expire(rkey, 90_000)  # 25 h
        except Exception:
            logger.debug("token_budget: Redis write failed, using memory fallback")
            _mem_record(day, entry)
    else:
        _mem_record(day, entry)


def _mem_record(day: str, entry: dict) -> None:
    _mem_usage.setdefault(day, {'entries': []})
    _mem_usage[day]['entries'].append(entry)


def get_daily_usage() -> dict:
    """Return aggregated usage for today.

    Returns
    -------
    dict
        ``{total_cost_usd, total_prompt_tokens, total_completion_tokens,
           total_requests, model_breakdown: {model: {cost, tokens, requests}}}``
    """
    day = _today_key()
    entries: list[dict] = []

    if _redis:
        try:
            raw_list = _redis.lrange(f'{_REDIS_DAILY_KEY_PREFIX}{day}', 0, -1)
            for raw in (raw_list or []):
                try:
                    entries.append(json.loads(raw))
                except (json.JSONDecodeError, TypeError):
                    pass
        except Exception:
            logger.debug("token_budget: Redis read failed, using memory fallback")
            entries = list((_mem_usage.get(day) or {}).get('entries', []))
    else:
        entries = list((_mem_usage.get(day) or {}).get('entries', []))

    total_cost = 0.0
    total_prompt = 0
    total_completion = 0
    model_breakdown: dict[str, dict] = {}

    for e in entries:
        cost = float(e.get('total_cost', 0) or 0)
        pt   = int(e.get('prompt_tokens', 0) or 0)
        ct   = int(e.get('completion_tokens', 0) or 0)
        mdl  = e.get('model', 'unknown')

        total_cost += cost
        total_prompt += pt
        total_completion += ct

        if mdl not in model_breakdown:
            model_breakdown[mdl] = {'cost': 0.0, 'tokens': 0, 'requests': 0}
        model_breakdown[mdl]['cost'] += cost
        model_breakdown[mdl]['tokens'] += pt + ct
        model_breakdown[mdl]['requests'] += 1

    return {
        'total_cost_usd':           round(total_cost, 6),
        'total_prompt_tokens':      total_prompt,
        'total_completion_tokens':  total_completion,
        'total_requests':           len(entries),
        'model_breakdown':          model_breakdown,
    }
