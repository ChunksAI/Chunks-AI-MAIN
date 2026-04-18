"""
backend/services/supabase_client.py — Pooled async HTTP client for Supabase REST API.

Provides a single, shared ``httpx.AsyncClient`` pre-configured with the
Supabase base URL and service-key authentication headers so that every
caller gets connection reuse without repeating credentials.

Public API
----------
init(supabase_url, service_key)
    Create the client.  Call once from server.py at startup.

get_client()
    Return the shared ``httpx.AsyncClient`` (or ``None`` if not initialised).

aclose()
    Drain keep-alive connections.  Call from the ASGI shutdown handler.
"""
from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def init(supabase_url: str, service_key: str) -> None:
    """Create the shared Supabase HTTP client.  Call once from server.py at startup."""
    global _client
    if not supabase_url or not service_key:
        logger.warning(
            "supabase_client.init(): SUPABASE_URL or SUPABASE_SERVICE_KEY is empty "
            "— Supabase REST calls will be unavailable."
        )
        return
    _client = httpx.AsyncClient(
        base_url=supabase_url,
        headers={
            'apikey':        service_key,
            'Authorization': f'Bearer {service_key}',
        },
        limits=httpx.Limits(
            max_connections=20,
            max_keepalive_connections=10,
            keepalive_expiry=30,
        ),
        timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
    )
    logger.info("Supabase HTTP client initialised (base_url=%s)", supabase_url)


def get_client() -> httpx.AsyncClient | None:
    """Return the shared client, or ``None`` if :func:`init` was not called."""
    return _client


async def aclose() -> None:
    """Close the shared client and drain pooled connections."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
        logger.info("Supabase HTTP client closed.")
