#!/usr/bin/env python3
"""
backend/worker.py — RQ worker entrypoint with Redis Sentinel support.

Run instead of the bare ``rq worker --url $REDIS_URL default`` command when
deploying on Kubernetes with Sentinel.  Builds the Redis connection using the
same factory as the web server so that both REDIS_SENTINEL_HOSTS and REDIS_URL
are respected.

Usage (Kubernetes worker pod):
    python worker.py

Usage (local dev — still works via docker-compose with REDIS_URL):
    python worker.py
    # or keep using: rq worker --url $REDIS_URL default
"""
from __future__ import annotations

import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    from services.redis_client import build_redis_client

    redis_conn = build_redis_client()
    if redis_conn is None:
        logger.error(
            "Redis not available — cannot start worker. "
            "Set REDIS_SENTINEL_HOSTS or REDIS_URL."
        )
        sys.exit(1)

    try:
        from rq import Worker, Queue

        queues = [Queue(name="default", connection=redis_conn)]
        worker = Worker(queues, connection=redis_conn)
        logger.info("RQ worker starting — listening on queue: default")
        worker.work(with_scheduler=True)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Worker exited with error: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
