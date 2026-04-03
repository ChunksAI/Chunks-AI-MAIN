"""
backend/services/job_queue.py — Async job queue backed by RQ (Redis Queue).

Workers run in a separate process started via the Procfile ``worker`` entry.
The web process only enqueues jobs and polls for their status via Redis.

Usage
-----
    from services.job_queue import job_queue
    job_queue.init(redis=redis_client)          # call once at startup
    job_id = job_queue.enqueue(fn, *args)       # fire-and-forget
    info   = job_queue.get_status(job_id)        # poll for result
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# Job result/failure TTL in seconds (kept for 1 hour)
_JOB_TTL = 3600

# ── Job states ────────────────────────────────────────────────────────────────
STATUS_QUEUED     = "queued"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED  = "completed"
STATUS_FAILED     = "failed"

# Mapping from RQ internal statuses to our public status strings
_RQ_STATUS_MAP: dict[str, str] = {
    "queued":    STATUS_QUEUED,
    "deferred":  STATUS_QUEUED,
    "scheduled": STATUS_QUEUED,
    "started":   STATUS_PROCESSING,
    "finished":  STATUS_COMPLETED,
    "failed":    STATUS_FAILED,
    "stopped":   STATUS_FAILED,
    "canceled":  STATUS_FAILED,
}


class JobQueue:
    """Async job queue backed by RQ (Redis Queue).

    Jobs are executed in a dedicated worker process, decoupled from the web
    process so background tasks cannot starve HTTP request handling.
    """

    def __init__(self) -> None:
        self._conn: Any = None   # Redis connection
        self._queue: Any = None  # rq.Queue
        self._ready = False

    # ── lifecycle ─────────────────────────────────────────────────────────────

    def init(self, *, redis: Any = None, max_workers: int = 4,
             _is_async: bool = True) -> None:
        """Initialise the queue.  Call once at application startup.

        Requires a working Redis connection.  If Redis is unavailable the
        queue is marked ready but ``enqueue()`` will raise ``RuntimeError``.

        ``_is_async=False`` executes jobs synchronously in the calling thread;
        intended for unit tests only.
        """
        if redis is not None:
            try:
                from rq import Queue
                redis.ping()
                self._conn = redis
                self._queue = Queue(connection=redis, is_async=_is_async)
                logger.info("JobQueue: using RQ (async=%s)", _is_async)
            except Exception:
                logger.warning("JobQueue: RQ/Redis unavailable — job queue will not function")
                self._conn = None
                self._queue = None
        else:
            logger.warning("JobQueue: no Redis provided — job queue will not function")
            self._conn = None
            self._queue = None

        self._ready = True

    # ── public API ────────────────────────────────────────────────────────────

    def enqueue(self, fn: Callable[..., dict], *args: Any, **kwargs: Any) -> str:
        """Submit *fn* for execution in the dedicated worker process.

        Returns the job ID (32-char hex string).
        """
        if not self._ready:
            raise RuntimeError("JobQueue not initialised — call job_queue.init() first")
        if self._queue is None:
            raise RuntimeError("JobQueue requires Redis — set REDIS_URL")

        job_id = uuid.uuid4().hex
        self._queue.enqueue(
            fn,
            *args,
            job_id=job_id,
            result_ttl=_JOB_TTL,
            failure_ttl=_JOB_TTL,
            **kwargs,
        )
        logger.info("JobQueue: enqueued job %s -> %s", job_id, fn.__name__)
        return job_id

    def get_status(self, job_id: str) -> Optional[dict]:
        """Return the current state of a job, or *None* if unknown."""
        if self._conn is None:
            return None
        try:
            from rq.job import Job
            job = Job.fetch(job_id, connection=self._conn)
        except Exception:
            return None

        rq_status_obj = job.get_status()
        # In RQ 1.16+ get_status() returns a JobStatus enum; use .value for the string
        if hasattr(rq_status_obj, 'value'):
            rq_status = rq_status_obj.value
        else:
            rq_status = str(rq_status_obj)
        mapped = _RQ_STATUS_MAP.get(rq_status, rq_status)

        data: dict = {
            "status": mapped,
            "created_at": job.created_at.timestamp() if job.created_at else time.time(),
            "result": None,
            "error": None,
        }

        if mapped == STATUS_COMPLETED:
            data["result"] = job.return_value()
            if job.ended_at:
                data["completed_at"] = job.ended_at.timestamp()
        elif mapped == STATUS_FAILED:
            try:
                latest = job.latest_result()
                exc_str = getattr(latest, 'exc_string', None) or ''
                lines = [ln for ln in exc_str.splitlines() if ln.strip()]
                data["error"] = lines[-1] if lines else "Unknown error"
            except Exception:
                data["error"] = "Unknown error"
            if job.ended_at:
                data["completed_at"] = job.ended_at.timestamp()

        return data


# Module-level singleton
job_queue = JobQueue()
