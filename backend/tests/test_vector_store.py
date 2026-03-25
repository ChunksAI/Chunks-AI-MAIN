"""
backend/tests/test_vector_store.py — Unit tests for the pgvector vector store.

Tests cover:
  - init() and is_available() behaviour
  - upsert_chunks() batching and REST call
  - search() RPC call and result parsing
  - _format_vector() edge cases
  - Graceful fallback when Supabase is not configured
"""
from __future__ import annotations

import importlib
import json
from unittest.mock import MagicMock, patch

import pytest

import services.vector_store as vs


# ── Helpers ───────────────────────────────────────────────────────────────────

def _reset_module():
    """Reset module-level state between tests."""
    vs._session = None
    vs._supabase_url = ""
    vs._supabase_service_key = ""
    vs._available = False


@pytest.fixture(autouse=True)
def reset_vs():
    """Ensure every test starts with a clean vector_store state."""
    _reset_module()
    yield
    _reset_module()


def _init_available(session=None):
    """Helper: initialise the module with valid Supabase config."""
    vs.init(
        session=session or MagicMock(),
        supabase_url="https://test-project.supabase.co",
        supabase_service_key="test-service-key",
    )


# ── init / is_available ──────────────────────────────────────────────────────

class TestInit:
    def test_available_when_configured(self):
        _init_available()
        assert vs.is_available() is True

    def test_not_available_when_url_missing(self):
        vs.init(session=MagicMock(), supabase_url="", supabase_service_key="key")
        assert vs.is_available() is False

    def test_not_available_when_key_missing(self):
        vs.init(
            session=MagicMock(),
            supabase_url="https://x.supabase.co",
            supabase_service_key="",
        )
        assert vs.is_available() is False

    def test_url_trailing_slash_stripped(self):
        vs.init(
            session=MagicMock(),
            supabase_url="https://x.supabase.co/",
            supabase_service_key="key",
        )
        assert vs._supabase_url == "https://x.supabase.co"


# ── _format_vector ───────────────────────────────────────────────────────────

class TestFormatVector:
    def test_formats_list(self):
        result = vs._format_vector([0.1, 0.2, 0.3])
        assert result.startswith("[")
        assert result.endswith("]")
        # Should contain comma-separated values
        parts = result[1:-1].split(",")
        assert len(parts) == 3

    def test_formats_numpy_array(self):
        try:
            import numpy as np
            arr = np.array([0.1, 0.2], dtype=np.float32)
            result = vs._format_vector(arr)
            parts = result[1:-1].split(",")
            assert len(parts) == 2
        except ImportError:
            pytest.skip("numpy not installed")


# ── upsert_chunks ────────────────────────────────────────────────────────────

class TestUpsertChunks:
    def test_returns_false_when_unavailable(self):
        assert vs.upsert_chunks("book1", [{"embedding": [0.1]}]) is False

    def test_returns_true_no_embeddings(self):
        _init_available()
        assert vs.upsert_chunks("book1", [{"text": "no emb"}]) is True

    def test_posts_to_supabase_rest(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_session.post.return_value = mock_resp
        _init_available(session=mock_session)

        chunks = [
            {"embedding": [0.1, 0.2], "page": 1, "text": "Hello world"},
            {"embedding": [0.3, 0.4], "page": 2, "text": "Second chunk"},
        ]
        result = vs.upsert_chunks("zumdahl", chunks)
        assert result is True
        assert mock_session.post.call_count == 1

        call_args = mock_session.post.call_args
        assert "/rest/v1/book_chunks" in call_args[0][0]
        body = call_args[1]["json"]
        assert len(body) == 2
        assert body[0]["book_id"] == "zumdahl"
        assert body[0]["chunk_index"] == 0

    def test_batching(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_session.post.return_value = mock_resp
        _init_available(session=mock_session)

        # Create more chunks than _UPSERT_BATCH_SIZE
        original_batch_size = vs._UPSERT_BATCH_SIZE
        vs._UPSERT_BATCH_SIZE = 2
        try:
            chunks = [
                {"embedding": [float(i)], "page": i, "text": f"chunk {i}"}
                for i in range(5)
            ]
            result = vs.upsert_chunks("book1", chunks)
            assert result is True
            # 5 chunks with batch size 2 → 3 batches
            assert mock_session.post.call_count == 3
        finally:
            vs._UPSERT_BATCH_SIZE = original_batch_size

    def test_returns_false_on_http_error(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"
        mock_session.post.return_value = mock_resp
        _init_available(session=mock_session)

        chunks = [{"embedding": [0.1], "page": 1, "text": "t"}]
        assert vs.upsert_chunks("book1", chunks) is False

    def test_returns_false_on_exception(self):
        mock_session = MagicMock()
        mock_session.post.side_effect = ConnectionError("timeout")
        _init_available(session=mock_session)

        chunks = [{"embedding": [0.1], "page": 1, "text": "t"}]
        assert vs.upsert_chunks("book1", chunks) is False


# ── search ────────────────────────────────────────────────────────────────────

class TestSearch:
    def test_returns_none_when_unavailable(self):
        result = vs.search([0.1, 0.2], "book1")
        assert result is None

    def test_calls_rpc_endpoint(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {"chunk_index": 3, "page": 42, "similarity": 0.95},
            {"chunk_index": 7, "page": 88, "similarity": 0.82},
        ]
        mock_session.post.return_value = mock_resp
        _init_available(session=mock_session)

        results = vs.search([0.1, 0.2], "zumdahl", top_k=10)

        assert results is not None
        assert len(results) == 2
        assert results[0]["chunk_index"] == 3
        assert results[0]["similarity"] == 0.95

        call_args = mock_session.post.call_args
        assert "/rest/v1/rpc/match_book_chunks" in call_args[0][0]
        body = call_args[1]["json"]
        assert body["p_book_id"] == "zumdahl"
        assert body["p_top_k"] == 10

    def test_returns_none_on_http_error(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Server Error"
        mock_session.post.return_value = mock_resp
        _init_available(session=mock_session)

        result = vs.search([0.1, 0.2], "book1")
        assert result is None

    def test_returns_none_on_exception(self):
        mock_session = MagicMock()
        mock_session.post.side_effect = ConnectionError("timeout")
        _init_available(session=mock_session)

        result = vs.search([0.1, 0.2], "book1")
        assert result is None


# ── search_paragraphs ────────────────────────────────────────────────────────

class TestSearchParagraphs:
    def test_returns_none_when_unavailable(self):
        result = vs.search_paragraphs([0.1], "book1")
        assert result is None

    def test_calls_match_paragraphs_rpc(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [
            {"chunk_index": 0, "page": 1, "similarity": 0.9, "metadata": {"paragraph_id": "p1"}},
        ]
        mock_session.post.return_value = mock_resp
        _init_available(session=mock_session)

        results = vs.search_paragraphs([0.1], "paev:zumdahl", top_k=5)
        assert results is not None
        assert len(results) == 1

        call_args = mock_session.post.call_args
        assert "/rest/v1/rpc/match_paragraphs" in call_args[0][0]


# ── upsert_paragraphs ────────────────────────────────────────────────────────

class TestUpsertParagraphs:
    def test_returns_false_when_unavailable(self):
        assert vs.upsert_paragraphs("book1", []) is False

    def test_handles_dataclass_like_objects(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_session.post.return_value = mock_resp
        _init_available(session=mock_session)

        class FakePara:
            def __init__(self):
                self.id = "p1"
                self.embedding = [0.1, 0.2]
                self.page = 5
                self.text = "A paragraph about chemistry"

        result = vs.upsert_paragraphs("zumdahl", [FakePara()])
        assert result is True
        assert mock_session.post.call_count == 1

        body = mock_session.post.call_args[1]["json"]
        assert body[0]["book_id"] == f"{vs.PAEV_PREFIX}zumdahl"

    def test_handles_dict_paragraphs(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_session.post.return_value = mock_resp
        _init_available(session=mock_session)

        para = {
            "id": "p2",
            "embedding": [0.3, 0.4],
            "page": 10,
            "text": "Another paragraph",
        }
        result = vs.upsert_paragraphs("atkins", [para])
        assert result is True
