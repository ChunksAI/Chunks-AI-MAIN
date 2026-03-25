"""
backend/services/job_queue.py — Lightweight async job queue.

Provides an in-process thread-pool executor with Redis-backed job storage
(in-memory ``dict`` fallback when Redis is unavailable).

Usage
-----
    from services.job_queue import job_queue
    job_queue.init(redis=redis_client)          # call once at startup
    job_id = job_queue.enqueue(fn, *args)       # fire-and-forget
    info   = job_queue.get_status(job_id)        # poll for result
"""
from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)

# Job TTL in seconds (results kept for 1 hour)
_JOB_TTL = 3600
_REDIS_PREFIX = "job:"

# ── Job states ────────────────────────────────────────────────────────────────
STATUS_QUEUED     = "queued"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED  = "completed"
STATUS_FAILED     = "failed"


class _JobStore:
    """Abstract job storage.  Two implementations below."""

    def save(self, job_id: str, data: dict) -> None:  # pragma: no cover
        raise NotImplementedError

    def load(self, job_id: str) -> Optional[dict]:  # pragma: no cover
        raise NotImplementedError


class _MemoryStore(_JobStore):
    """Thread-safe in-memory dict store (single-process only)."""

    def __init__(self) -> None:
        self._data: Dict[str, dict] = {}
        self._lock = threading.Lock()

    def save(self, job_id: str, data: dict) -> None:
        with self._lock:
            self._data[job_id] = data

    def load(self, job_id: str) -> Optional[dict]:
        with self._lock:
            return self._data.get(job_id)


class _RedisStore(_JobStore):
    """Redis-backed store with automatic TTL expiry."""

    def __init__(self, redis_client: Any) -> None:
        self._r = redis_client

    def save(self, job_id: str, data: dict) -> None:
        key = f"{_REDIS_PREFIX}{job_id}"
        self._r.setex(key, _JOB_TTL, json.dumps(data, default=str))

    def load(self, job_id: str) -> Optional[dict]:
        key = f"{_REDIS_PREFIX}{job_id}"
        raw = self._r.get(key)
        if raw is None:
            return None
        return json.loads(raw)


class JobQueue:
    """In-process async job queue backed by a thread pool."""

    def __init__(self) -> None:
        self._store: _JobStore = _MemoryStore()
        self._pool: Optional[ThreadPoolExecutor] = None
        self._ready = False

    # ── lifecycle ─────────────────────────────────────────────────────────────

    def init(self, *, redis: Any = None, max_workers: int = 4) -> None:
        """Initialise the queue.  Call once at application startup."""
        if redis is not None:
            try:
                redis.ping()
                self._store = _RedisStore(redis)
                logger.info("JobQueue: using Redis store")
            except Exception:
                logger.warning("JobQueue: Redis unavailable, falling back to in-memory store")
                self._store = _MemoryStore()
        else:
            self._store = _MemoryStore()
            logger.info("JobQueue: using in-memory store")

        self._pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="job")
        self._ready = True

    # ── public API ────────────────────────────────────────────────────────────

    def enqueue(self, fn: Callable[..., dict], *args: Any, **kwargs: Any) -> str:
        """Submit *fn* for background execution. Returns the job ID."""
        if not self._ready:
            raise RuntimeError("JobQueue not initialised — call job_queue.init() first")

        job_id = uuid.uuid4().hex
        self._store.save(job_id, {
            "status": STATUS_QUEUED,
            "created_at": time.time(),
            "result": None,
            "error": None,
        })

        self._pool.submit(self._run, job_id, fn, *args, **kwargs)  # type: ignore[union-attr]
        logger.info("JobQueue: enqueued job %s", job_id)
        return job_id

    def get_status(self, job_id: str) -> Optional[dict]:
        """Return the current state of a job, or *None* if unknown."""
        return self._store.load(job_id)

    # ── internal ──────────────────────────────────────────────────────────────

    def _run(self, job_id: str, fn: Callable[..., dict], *args: Any, **kwargs: Any) -> None:
        # Preserve the original created_at timestamp
        existing = self._store.load(job_id)
        created_at = existing["created_at"] if existing else time.time()
        self._store.save(job_id, {
            "status": STATUS_PROCESSING,
            "created_at": created_at,
            "result": None,
            "error": None,
        })
        try:
            result = fn(*args, **kwargs)
            self._store.save(job_id, {
                "status": STATUS_COMPLETED,
                "created_at": created_at,
                "completed_at": time.time(),
                "result": result,
                "error": None,
            })
            logger.info("JobQueue: job %s completed", job_id)
        except Exception as exc:
            logger.exception("JobQueue: job %s failed", job_id)
            self._store.save(job_id, {
                "status": STATUS_FAILED,
                "created_at": created_at,
                "completed_at": time.time(),
                "result": None,
                "error": str(exc),
            })


# Module-level singleton
job_queue = JobQueue()
