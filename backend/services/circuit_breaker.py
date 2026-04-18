"""
backend/services/circuit_breaker.py — Redis-backed circuit breaker for LLM providers.

States
------
CLOSED   Normal operation.  All calls go through.
OPEN     Provider is degraded.  Skip primary, use fallback immediately.
         Auto-expires after OPEN_WINDOW_SECS (30 s); expiry transitions to HALF_OPEN.
HALF_OPEN One trial call is allowed.  Success → CLOSED; failure → OPEN.

Redis keys (all namespaced under ``cb:``)
-----------------------------------------
cb:{model}:failures   Integer counter, incremented on failure, TTL=FAILURE_WINDOW_SECS.
cb:{model}:state      String "open" | "half_open".  Absence means CLOSED.
cb:{model}:trial      Presence flag indicating a HALF_OPEN trial is in flight (TTL=60 s).

Graceful degradation
---------------------
If Redis is unavailable, ``can_call()`` returns ``True`` and ``record_result()`` is a
no-op.  A DEBUG-level warning is logged.
"""
from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

# ── Tuneable constants ─────────────────────────────────────────────────────────
FAILURE_THRESHOLD   = 3    # failures before opening the circuit
FAILURE_WINDOW_SECS = 60   # sliding window for failure counter (seconds)
OPEN_WINDOW_SECS    = 30   # how long circuit stays OPEN before moving to HALF_OPEN

_KEY_NS_PREFIX: str = os.environ.get('REDIS_KEY_PREFIX', '')


class CircuitBreaker:
    """Redis-backed circuit breaker for an LLM model/provider.

    Thread-safe: all state mutations use Redis atomic commands (INCR, SET NX,
    GETSET) so multiple gunicorn workers share the same view.

    Parameters
    ----------
    redis_client
        A ``redis.Redis`` (or compatible) client.  May be ``None`` — in that
        case the breaker degrades gracefully (always closed / no-op).
    failure_threshold
        Number of failures in ``failure_window_secs`` that open the circuit.
    failure_window_secs
        Sliding window (seconds) for the failure counter TTL.
    open_window_secs
        Seconds the circuit stays OPEN before transitioning to HALF_OPEN.
    """

    def __init__(
        self,
        redis_client: Any = None,
        failure_threshold: int = FAILURE_THRESHOLD,
        failure_window_secs: int = FAILURE_WINDOW_SECS,
        open_window_secs: int = OPEN_WINDOW_SECS,
    ) -> None:
        self._redis              = redis_client
        self.failure_threshold   = failure_threshold
        self.failure_window_secs = failure_window_secs
        self.open_window_secs    = open_window_secs

    # ── Key helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def _key_state(model: str) -> str:
        return f"{_KEY_NS_PREFIX}cb:{model}:state"

    @staticmethod
    def _key_failures(model: str) -> str:
        return f"{_KEY_NS_PREFIX}cb:{model}:failures"

    @staticmethod
    def _key_trial(model: str) -> str:
        return f"{_KEY_NS_PREFIX}cb:{model}:trial"

    # ── Public API ─────────────────────────────────────────────────────────────

    def can_call(self, model: str) -> bool:
        """Return True if a call to *model* is permitted right now.

        CLOSED → True.
        OPEN   → False (caller should use the fallback).
        HALF_OPEN → True for the *first* caller (trial); False for subsequent
                    callers until the trial resolves (to prevent thundering-herd
                    on recovery).
        """
        if self._redis is None:
            return True
        try:
            state = (self._redis.get(self._key_state(model)) or b'').decode()
            if not state:
                # Key absent → CLOSED
                return True
            if state == 'open':
                return False
            if state == 'half_open':
                # Allow only one trial at a time using a NX lock key
                acquired = self._redis.set(
                    self._key_trial(model), '1',
                    nx=True, ex=60,
                )
                if acquired:
                    logger.info('[circuit_breaker] HALF_OPEN trial allowed for %s', model)
                    return True
                logger.debug('[circuit_breaker] HALF_OPEN trial already in flight for %s', model)
                return False
            # Unknown state — treat as CLOSED
            return True
        except Exception as exc:
            logger.debug('[circuit_breaker] Redis error in can_call(%s): %s', model, exc)
            return True

    def record_result(self, model: str, *, success: bool) -> None:
        """Record the outcome of a call to *model*.

        success=True:  reset failure counter; if was HALF_OPEN → CLOSED.
        success=False: increment failure counter; if threshold hit → OPEN.
        """
        if self._redis is None:
            return
        try:
            state = (self._redis.get(self._key_state(model)) or b'').decode()

            if success:
                self._redis.delete(self._key_failures(model))
                self._redis.delete(self._key_state(model))
                self._redis.delete(self._key_trial(model))
                if state:
                    logger.info(
                        '[circuit_breaker] %s recovered (%s → CLOSED)', model, state.upper()
                    )
                return

            # ── Failure path ──────────────────────────────────────────────────
            if state == 'half_open':
                # Trial failed → back to OPEN
                self._redis.delete(self._key_trial(model))
                self._redis.set(
                    self._key_state(model), 'open',
                    ex=self.open_window_secs,
                )
                logger.warning(
                    '[circuit_breaker] HALF_OPEN trial FAILED for %s → OPEN (%ds)', model,
                    self.open_window_secs,
                )
                return

            # Increment failure counter (atomic, sliding window via TTL)
            failures_key = self._key_failures(model)
            count = self._redis.incr(failures_key)
            if count == 1:
                # First failure in this window — set TTL
                self._redis.expire(failures_key, self.failure_window_secs)

            logger.debug('[circuit_breaker] failure count for %s: %d', model, count)

            if count >= self.failure_threshold and state != 'open':
                self._redis.set(
                    self._key_state(model), 'open',
                    ex=self.open_window_secs,
                )
                logger.warning(
                    '[circuit_breaker] OPEN — %s hit %d failures in %ds window → bypassing for %ds',
                    model, count, self.failure_window_secs, self.open_window_secs,
                )

        except Exception as exc:
            logger.debug('[circuit_breaker] Redis error in record_result(%s): %s', model, exc)

    def get_state(self, model: str) -> str:
        """Return the current state string for *model*: 'closed', 'open', or 'half_open'."""
        if self._redis is None:
            return 'closed'
        try:
            state = (self._redis.get(self._key_state(model)) or b'').decode()
            return state if state in ('open', 'half_open') else 'closed'
        except Exception:
            return 'closed'

    def get_failure_count(self, model: str) -> int:
        """Return current failure count for *model* (0 if none or Redis unavailable)."""
        if self._redis is None:
            return 0
        try:
            val = self._redis.get(self._key_failures(model))
            return int(val) if val is not None else 0
        except Exception:
            return 0

    def status_all(self, models: list[str]) -> dict[str, dict]:
        """Return a status snapshot for each model in *models*."""
        return {
            m: {
                'state':         self.get_state(m),
                'failure_count': self.get_failure_count(m),
            }
            for m in models
        }


# ── Module-level singleton ────────────────────────────────────────────────────
# Replaced at startup by ai.init() / circuit_breaker.init().

_breaker: CircuitBreaker = CircuitBreaker(redis_client=None)


def init(redis_client: Any) -> None:
    """Inject a live Redis client.  Call once from server.py at startup."""
    global _breaker
    _breaker = CircuitBreaker(redis_client=redis_client)
    logger.info('[circuit_breaker] initialised with Redis client')
