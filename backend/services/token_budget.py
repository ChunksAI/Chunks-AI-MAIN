"""
backend/services/token_budget.py — Token limits and cost budgeting.

Provides:
  - ENDPOINT_MAX_TOKENS  per-endpoint default token ceilings
  - max_tokens_for_endpoint()  resolve the right limit for a given endpoint/task
  - check_daily_budget()  verify daily spending is within the configured budget
  - record_usage()        record prompt/completion tokens + cost for a request
  - get_daily_usage()     return today's aggregated usage stats
  - get_user_monthly_usage()  return per-user aggregated usage for a month
  - get_monthly_usage_report()  return all-users aggregated usage for a month

All state is Redis-backed (24 h TTL daily / 35 d monthly) with in-memory
fallback when Redis is unavailable — identical resilience pattern to
answer_cache / embedding_cache.
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
    # Ceiling raised to 20 000 to accommodate Deep Think mode (16 000 tokens)
    # and Think mode (4 000 tokens) which must fit the reasoning chain plus
    # the final answer within the same budget.
    'chat':            20_000,   # must fit deep think (16k) + prompt overhead
    'chat_exam':       10_000,
    'chat_visual':      4_000,
    'chat_practice':    6_000,
    'chat_summary':     6_000,
    'chat_generate':    6_000,
    'chat_web_search':  4_000,
    # /ask-image
    'image':            2_000,
    # /generate-flashcards
    'flashcards':       6_000,
    # /generate-study-materials
    'study_materials':  8_000,
    # /generate-quiz
    'quiz':            12_000,
    # /ask-async  (mirrors /ask)
    'async_chat':       6_000,
}

# Hard ceiling across all endpoints — no single request may exceed this.
ABSOLUTE_MAX_TOKENS: int = int(os.environ.get('ABSOLUTE_MAX_TOKENS', '20000'))


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
_KEY_NS_PREFIX: str = os.environ.get('REDIS_KEY_PREFIX', '')
_REDIS_DAILY_KEY_PREFIX = f'{_KEY_NS_PREFIX}token_budget:daily:'
_REDIS_USER_MONTH_KEY_PREFIX = f'{_KEY_NS_PREFIX}token_usage:user:'
_REDIS_USER_DAILY_TOKEN_PREFIX = f'{_KEY_NS_PREFIX}user_daily_tokens:'

# In-memory fallback accumulators (lost on process restart).
_mem_usage: dict[str, dict] = {}
_mem_user_usage: dict[str, list[dict]] = {}  # key: "{user_id}:{YYYY-MM}"
_mem_user_daily_tokens: dict[str, int] = {}  # key: "{user_id}:{YYYY-MM-DD}"

# ── Per-user daily token caps ─────────────────────────────────────────────────
#
# Default caps per subscription tier (total prompt + completion tokens/day).
# Override any tier by setting the corresponding environment variable:
#   TOKEN_CAP_FREE=20000  TOKEN_CAP_PRO=400000  TOKEN_CAP_ULTRA=2000000
#
# Set a cap to 0 to make that tier unlimited.

_DEFAULT_USER_DAILY_TOKEN_CAPS: dict[str, int] = {
    'free':  int(os.environ.get('TOKEN_CAP_FREE',  '20000')),
    'pro':   int(os.environ.get('TOKEN_CAP_PRO',   '400000')),
    'ultra': int(os.environ.get('TOKEN_CAP_ULTRA', '2000000')),
}


def _today_key() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')


def _month_key() -> str:
    """Return current UTC month as ``YYYY-MM``."""
    return datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m')


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
    user_id: str = '',
) -> None:
    """Record token usage + cost for today and per-user monthly."""
    day = _today_key()
    month = _month_key()
    entry = {
        'model': model,
        'prompt_tokens': prompt_tokens,
        'completion_tokens': completion_tokens,
        'total_cost': total_cost,
        'endpoint': endpoint,
        'user_id': user_id,
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

    # ── Per-user monthly recording ────────────────────────────────────────
    if user_id:
        _record_user_month(user_id, month, entry)

    # ── Per-user daily token counter ──────────────────────────────────────
    # Authenticated users (non-ip: prefix) have their daily token consumption
    # tracked here so check_user_daily_token_budget() can enforce tier caps.
    if user_id and not user_id.startswith('ip:'):
        _total = prompt_tokens + completion_tokens
        if _total > 0:
            record_user_daily_tokens(user_id, _total)


def _mem_record(day: str, entry: dict) -> None:
    logger.warning(
        "token_budget: writing to per-process in-memory fallback for day=%s. "
        "Cross-worker consistency is NOT guaranteed — usage totals will be "
        "under-counted when multiple workers are running.",
        day,
    )
    _mem_usage.setdefault(day, {'entries': []})
    _mem_usage[day]['entries'].append(entry)


def _record_user_month(user_id: str, month: str, entry: dict) -> None:
    """Persist a usage entry to the per-user monthly store."""
    if _redis:
        try:
            rkey = f'{_REDIS_USER_MONTH_KEY_PREFIX}{user_id}:{month}'
            _redis.rpush(rkey, json.dumps(entry))
            _redis.expire(rkey, 35 * 86_400)  # 35 days
            return
        except Exception:
            logger.debug("token_budget: Redis user-month write failed, memory fallback")
    logger.warning(
        "token_budget: writing user-month data to per-process in-memory fallback "
        "(user=%s, month=%s). Cross-worker consistency is NOT guaranteed.",
        user_id, month,
    )
    _mem_user_usage.setdefault(f'{user_id}:{month}', []).append(entry)


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


# ── Per-user monthly usage ────────────────────────────────────────────────────

def _load_user_month_entries(user_id: str, month: str) -> list[dict]:
    """Load raw entries for a user/month from Redis or memory."""
    entries: list[dict] = []
    if _redis:
        try:
            rkey = f'{_REDIS_USER_MONTH_KEY_PREFIX}{user_id}:{month}'
            raw_list = _redis.lrange(rkey, 0, -1)
            for raw in (raw_list or []):
                try:
                    entries.append(json.loads(raw))
                except (json.JSONDecodeError, TypeError):
                    pass
            return entries
        except Exception:
            logger.debug("token_budget: Redis user-month read failed, memory fallback")
    return list(_mem_user_usage.get(f'{user_id}:{month}', []))


def _aggregate_entries(entries: list[dict]) -> dict:
    """Aggregate a list of usage entries into a summary dict."""
    total_cost = 0.0
    total_prompt = 0
    total_completion = 0
    model_breakdown: dict[str, dict] = {}
    endpoint_breakdown: dict[str, dict] = {}

    for e in entries:
        cost = float(e.get('total_cost', 0) or 0)
        pt   = int(e.get('prompt_tokens', 0) or 0)
        ct   = int(e.get('completion_tokens', 0) or 0)
        mdl  = e.get('model', 'unknown')
        ep   = e.get('endpoint', 'unknown')

        total_cost += cost
        total_prompt += pt
        total_completion += ct

        if mdl not in model_breakdown:
            model_breakdown[mdl] = {'cost': 0.0, 'tokens': 0, 'requests': 0}
        model_breakdown[mdl]['cost'] += cost
        model_breakdown[mdl]['tokens'] += pt + ct
        model_breakdown[mdl]['requests'] += 1

        if ep not in endpoint_breakdown:
            endpoint_breakdown[ep] = {'cost': 0.0, 'tokens': 0, 'requests': 0}
        endpoint_breakdown[ep]['cost'] += cost
        endpoint_breakdown[ep]['tokens'] += pt + ct
        endpoint_breakdown[ep]['requests'] += 1

    return {
        'total_cost_usd':           round(total_cost, 6),
        'total_prompt_tokens':      total_prompt,
        'total_completion_tokens':  total_completion,
        'total_requests':           len(entries),
        'model_breakdown':          model_breakdown,
        'endpoint_breakdown':       endpoint_breakdown,
    }


def get_user_monthly_usage(user_id: str, month: str | None = None) -> dict:
    """Return aggregated usage for a single user in a given month.

    Parameters
    ----------
    user_id : str
        The user identifier (UUID or ``ip:<addr>``).
    month : str | None
        Month in ``YYYY-MM`` format.  Defaults to the current UTC month.

    Returns
    -------
    dict
        ``{user_id, month, total_cost_usd, total_prompt_tokens,
           total_completion_tokens, total_requests,
           model_breakdown, endpoint_breakdown}``
    """
    month = month or _month_key()
    entries = _load_user_month_entries(user_id, month)
    result = _aggregate_entries(entries)
    result['user_id'] = user_id
    result['month'] = month
    return result


def get_monthly_usage_report(month: str | None = None) -> dict:
    """Return per-user aggregated usage for admin reporting.

    Scans all per-user monthly keys for the given month and returns a
    breakdown keyed by user_id.

    Parameters
    ----------
    month : str | None
        Month in ``YYYY-MM`` format.  Defaults to the current UTC month.

    Returns
    -------
    dict
        ``{month, users: {user_id: {total_cost_usd, ...}},
           totals: {total_cost_usd, ...}}``
    """
    month = month or _month_key()
    users: dict[str, dict] = {}

    if _redis:
        try:
            pattern = f'{_REDIS_USER_MONTH_KEY_PREFIX}*:{month}'
            cursor, keys = _redis.scan(0, match=pattern, count=500)
            all_keys = list(keys or [])
            while cursor:
                cursor, keys = _redis.scan(cursor, match=pattern, count=500)
                all_keys.extend(keys or [])

            prefix_len = len(_REDIS_USER_MONTH_KEY_PREFIX)
            suffix = f':{month}'
            for rkey in all_keys:
                key_str = rkey if isinstance(rkey, str) else rkey.decode('utf-8')
                uid = key_str[prefix_len:]
                if uid.endswith(suffix):
                    uid = uid[:-len(suffix)]
                entries = _load_user_month_entries(uid, month)
                if entries:
                    users[uid] = _aggregate_entries(entries)
        except Exception:
            logger.debug("token_budget: Redis scan failed, using memory fallback")
            users = _scan_mem_user_month(month)
    else:
        users = _scan_mem_user_month(month)

    # Compute totals across all users
    all_entries: list[dict] = []
    for uid, summary in users.items():
        # Re-load raw entries for proper aggregation
        all_entries.extend(_load_user_month_entries(uid, month))

    return {
        'month': month,
        'users': users,
        'totals': _aggregate_entries(all_entries),
    }


def _scan_mem_user_month(month: str) -> dict[str, dict]:
    """Scan in-memory user-month store for all users in a given month."""
    users: dict[str, dict] = {}
    suffix = f':{month}'
    for key, entries in _mem_user_usage.items():
        if key.endswith(suffix):
            uid = key[:-len(suffix)]
            if entries:
                users[uid] = _aggregate_entries(entries)
    return users


# ── Per-user daily token budget ───────────────────────────────────────────────

class UserDailyTokenBudgetExceeded(Exception):
    """Raised when a user has consumed their daily token allowance for their tier."""

    def __init__(self, used: int, cap: int, tier: str) -> None:
        self.used = used
        self.cap  = cap
        self.tier = tier
        super().__init__(
            f'Daily token budget exceeded: {used}/{cap} tokens ({tier} plan)'
        )

    def response(self):
        """Return a 429 JSONResponse ready to be returned from a route handler."""
        from fastapi.responses import JSONResponse
        tier_label = self.tier.capitalize()
        cap_k      = self.cap // 1_000
        return JSONResponse(
            {
                'success':            False,
                'token_limited':      True,
                'daily_tokens_used':  self.used,
                'daily_token_cap':    self.cap,
                'tier':               self.tier,
                'error': (
                    f"You've used your daily AI token allowance ({cap_k:,}K tokens) on the "
                    f"{tier_label} plan. Your quota resets at midnight UTC. "
                    "Upgrade for a higher daily limit!"
                ),
            },
            status_code=429,
        )


def _user_daily_token_key(user_id: str) -> str:
    """Build the Redis key for today's per-user token counter."""
    return f'{_REDIS_USER_DAILY_TOKEN_PREFIX}{user_id}:{_today_key()}'


def get_user_daily_tokens(user_id: str) -> int:
    """Return the number of tokens the user has consumed today (UTC).

    Reads from Redis when available, falls back to the in-process counter
    (which may under-count with multiple workers).
    """
    key = _user_daily_token_key(user_id)
    if _redis is not None:
        try:
            val = _redis.get(key)
            return int(val) if val is not None else 0
        except Exception as exc:
            logger.warning('token_budget.get_user_daily_tokens: Redis error: %s', exc)
    return _mem_user_daily_tokens.get(key, 0)


def record_user_daily_tokens(user_id: str, tokens: int) -> None:
    """Atomically add *tokens* to user_id's per-user daily counter.

    Called automatically by :func:`record_usage` for authenticated users; you
    should not need to call this directly.  TTL is 25 h (same as other daily
    keys) so the counter expires cleanly after UTC midnight.
    """
    if tokens <= 0 or not user_id:
        return
    key = _user_daily_token_key(user_id)
    if _redis is not None:
        try:
            new_val = _redis.incrby(key, tokens)
            if new_val == tokens:
                # First write today — stamp a 25 h TTL
                _redis.expire(key, 90_000)
            return
        except Exception as exc:
            logger.warning('token_budget.record_user_daily_tokens: Redis error: %s', exc)
    # In-memory fallback (per-process; under-counts with multiple workers)
    _mem_user_daily_tokens[key] = _mem_user_daily_tokens.get(key, 0) + tokens


def check_user_daily_token_budget(user_id: str, tier) -> None:
    """Raise :class:`UserDailyTokenBudgetExceeded` if the user is over their daily cap.

    Parameters
    ----------
    user_id:
        Authenticated user identifier.  Guest (``ip:``-prefixed) IDs are
        *not* checked here — callers must skip this function for guests.
    tier:
        Subscription tier — either a ``Tier`` enum or a plain string
        (``'free'``, ``'pro'``, ``'ultra'``).

    Behaviour when Redis is unavailable
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    * Free users  → **fail closed** (blocked) to prevent abuse.
    * Paid users  → **fail open** (allowed) so transient Redis outages do
      not disrupt paying subscribers.
    """
    tier_str = tier.value if hasattr(tier, 'value') else str(tier).lower()
    cap = _DEFAULT_USER_DAILY_TOKEN_CAPS.get(tier_str)
    if cap is None:
        cap = _DEFAULT_USER_DAILY_TOKEN_CAPS.get('free', 20_000)

    if cap <= 0:
        return  # 0 means unlimited for this tier

    if _redis is not None:
        try:
            # Call Redis directly (not via get_user_daily_tokens) so that
            # Redis errors are caught here and can trigger fail-closed logic.
            key  = _user_daily_token_key(user_id)
            val  = _redis.get(key)
            used = int(val) if val is not None else 0
            if used >= cap:
                raise UserDailyTokenBudgetExceeded(used, cap, tier_str)
            return
        except UserDailyTokenBudgetExceeded:
            raise
        except Exception as exc:
            _fail_closed = (tier_str == 'free')
            logger.warning(
                'token_budget.check_user_daily_token_budget: Redis error (%s) — '
                'failing %s for user=%s tier=%s',
                exc, 'closed' if _fail_closed else 'open', user_id, tier_str,
            )
            if _fail_closed:
                raise UserDailyTokenBudgetExceeded(cap, cap, tier_str)
            return   # paid users: allow on Redis error
    else:
        # No Redis configured — use in-memory counter (unreliable across workers)
        used = _mem_user_daily_tokens.get(_user_daily_token_key(user_id), 0)
        if used >= cap:
            raise UserDailyTokenBudgetExceeded(used, cap, tier_str)

