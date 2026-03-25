"""
backend/services/vector_store.py — pgvector (Supabase) backed vector store.

Provides similarity search using pgvector via the Supabase REST API.
Falls back gracefully when Supabase is not configured or unreachable;
callers should check ``is_available()`` or treat ``None`` returns as
"not available" and use the in-memory fallback.

Call ``init()`` once from server.py to inject shared state.
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Namespace prefix for PAEV paragraph embeddings in the book_chunks table.
PAEV_PREFIX = "paev:"

# ── Module-level state (injected at startup) ──────────────────────────────────
_session = None
_supabase_url: str = ""
_supabase_service_key: str = ""
_available: bool = False

# Maximum rows per REST-API upsert batch (PostgREST has body-size limits).
_UPSERT_BATCH_SIZE = 200


# ── Initialisation ────────────────────────────────────────────────────────────

def init(
    session,
    supabase_url: str,
    supabase_service_key: str,
) -> None:
    """Inject dependencies.  Call once from server.py at startup."""
    global _session, _supabase_url, _supabase_service_key, _available
    _session = session
    _supabase_url = supabase_url.rstrip("/") if supabase_url else ""
    _supabase_service_key = supabase_service_key
    _available = bool(_supabase_url and _supabase_service_key)

    if _available:
        logger.info("✅ Vector store (pgvector/Supabase) configured")
    else:
        logger.info(
            "Vector store disabled — set SUPABASE_URL and "
            "SUPABASE_SERVICE_KEY to enable pgvector search"
        )


def is_available() -> bool:
    """Return True when the pgvector back-end is configured."""
    return _available


# ── Internal helpers ──────────────────────────────────────────────────────────

def _headers(*, prefer: str = "return=minimal") -> dict:
    return {
        "apikey": _supabase_service_key,
        "Authorization": f"Bearer {_supabase_service_key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


# ── Public API: upsert ────────────────────────────────────────────────────────

def upsert_chunks(
    book_id: str,
    chunks: list[dict],
) -> bool:
    """
    Upsert chunk embeddings into the ``book_chunks`` pgvector table.

    Each element of *chunks* is expected to carry at least
    ``embedding`` (list[float]) and ``page`` (int).

    Returns True on success, False if the vector store is unavailable or
    the upsert fails.
    """
    if not _available:
        return False

    rows = []
    for i, chunk in enumerate(chunks):
        emb = chunk.get("embedding")
        if not emb:
            continue
        rows.append({
            "book_id": book_id,
            "chunk_index": i,
            "page": chunk.get("page", 0),
            "text_preview": chunk.get("text", "")[:200],
            "embedding": _format_vector(emb),
            "metadata": {},
        })

    if not rows:
        logger.info("No embeddings to upsert for book '%s'", book_id)
        return True

    url = f"{_supabase_url}/rest/v1/book_chunks"
    headers = _headers(prefer="return=minimal,resolution=merge-duplicates")

    ok = True
    for start in range(0, len(rows), _UPSERT_BATCH_SIZE):
        batch = rows[start : start + _UPSERT_BATCH_SIZE]
        try:
            resp = _session.post(url, json=batch, headers=headers, timeout=30)
            if resp.status_code not in (200, 201):
                logger.warning(
                    "pgvector upsert batch %d–%d failed (%d): %s",
                    start,
                    start + len(batch),
                    resp.status_code,
                    resp.text[:300],
                )
                ok = False
        except Exception as exc:
            logger.warning("pgvector upsert error: %s", exc)
            ok = False

    if ok:
        logger.info(
            "✅ Upserted %d chunk embeddings for book '%s'", len(rows), book_id
        )
    return ok


# ── Public API: similarity search ─────────────────────────────────────────────

def search(
    query_embedding: list[float],
    book_id: str,
    top_k: int = 50,
) -> Optional[list[dict]]:
    """
    Cosine-similarity search via the ``match_book_chunks`` RPC.

    Returns a list of ``{"chunk_index": int, "page": int, "similarity": float}``
    sorted by descending similarity, or ``None`` when the vector store is
    unavailable.
    """
    if not _available:
        return None

    url = f"{_supabase_url}/rest/v1/rpc/match_book_chunks"
    payload = {
        "query_embedding": _format_vector(query_embedding),
        "p_book_id": book_id,
        "p_top_k": top_k,
    }

    try:
        resp = _session.post(
            url, json=payload, headers=_headers(prefer="return=representation"),
            timeout=15,
        )
        if resp.status_code == 200:
            return resp.json()
        logger.warning(
            "pgvector search RPC error (%d): %s",
            resp.status_code,
            resp.text[:300],
        )
    except Exception as exc:
        logger.warning("pgvector search failed: %s", exc)

    return None


def search_paragraphs(
    query_embedding: list[float],
    book_id: str,
    top_k: int = 50,
) -> Optional[list[dict]]:
    """
    Cosine-similarity search for PAEV paragraphs via ``match_paragraphs`` RPC.

    Returns a list of dicts with ``chunk_index``, ``page``, ``similarity``,
    and ``metadata``, or ``None`` when unavailable.
    """
    if not _available:
        return None

    url = f"{_supabase_url}/rest/v1/rpc/match_paragraphs"
    payload = {
        "query_embedding": _format_vector(query_embedding),
        "p_book_id": book_id,
        "p_top_k": top_k,
    }

    try:
        resp = _session.post(
            url, json=payload, headers=_headers(prefer="return=representation"),
            timeout=15,
        )
        if resp.status_code == 200:
            return resp.json()
        logger.warning(
            "pgvector paragraph search error (%d): %s",
            resp.status_code,
            resp.text[:300],
        )
    except Exception as exc:
        logger.warning("pgvector paragraph search failed: %s", exc)

    return None


def upsert_paragraphs(
    book_id: str,
    paragraphs: list,
) -> bool:
    """
    Upsert paragraph embeddings for the PAEV engine.

    *paragraphs* should be ``Paragraph``-like objects with ``.id``,
    ``.embedding``, ``.page``, and ``.text`` attributes.
    """
    if not _available:
        return False

    rows = []
    for i, para in enumerate(paragraphs):
        emb = getattr(para, "embedding", None) or (
            para.get("embedding") if isinstance(para, dict) else None
        )
        if not emb:
            continue
        pid = getattr(para, "id", None) or (
            para.get("id") if isinstance(para, dict) else str(i)
        )
        page = getattr(para, "page", 0) or (
            para.get("page", 0) if isinstance(para, dict) else 0
        )
        text = getattr(para, "text", "") or (
            para.get("text", "") if isinstance(para, dict) else ""
        )
        rows.append({
            "book_id": f"{PAEV_PREFIX}{book_id}",
            "chunk_index": i,
            "page": page,
            "text_preview": text[:200],
            "embedding": _format_vector(emb),
            "metadata": {"paragraph_id": pid},
        })

    if not rows:
        return True

    url = f"{_supabase_url}/rest/v1/book_chunks"
    headers = _headers(prefer="return=minimal,resolution=merge-duplicates")

    ok = True
    for start in range(0, len(rows), _UPSERT_BATCH_SIZE):
        batch = rows[start : start + _UPSERT_BATCH_SIZE]
        try:
            resp = _session.post(url, json=batch, headers=headers, timeout=30)
            if resp.status_code not in (200, 201):
                logger.warning(
                    "pgvector paragraph upsert batch failed (%d): %s",
                    resp.status_code,
                    resp.text[:300],
                )
                ok = False
        except Exception as exc:
            logger.warning("pgvector paragraph upsert error: %s", exc)
            ok = False

    if ok:
        logger.info(
            "✅ Upserted %d paragraph embeddings for '%s'", len(rows), book_id
        )
    return ok


# ── Vector formatting ─────────────────────────────────────────────────────────

def _format_vector(vec) -> str:
    """
    Format a vector for the pgvector ``vector`` column type.

    pgvector expects the literal format ``[0.1,0.2,0.3,...]`` as a string
    when inserting via PostgREST JSON.
    """
    # Handle numpy arrays by converting to list first
    items = vec
    if hasattr(vec, "tolist"):
        items = vec.tolist()
    return "[" + ",".join(f"{v:.8g}" for v in items) + "]"
