"""Tests for the library blueprint (/get-library, /load-book, /books/<book_id>/pdf)."""
import pytest
from unittest.mock import MagicMock, patch


def test_get_library(client):
    """GET /get-library returns the book list."""
    resp = client.get('/get-library')
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert isinstance(data['books'], list)
    assert len(data['books']) > 0
    book = data['books'][0]
    assert 'id' in book
    assert 'name' in book
    assert 'author' in book


def test_load_book_unknown(client, mock_guest_gate, mock_extract_user):
    """POST /load-book with an unknown bookId returns 404."""
    resp = client.post('/load-book', json={'bookId': 'nonexistent_book_xyz'})
    assert resp.status_code == 404
    data = resp.json()
    assert data['success'] is False


def test_load_book_options(client):
    """OPTIONS /load-book returns 200 (CORS preflight)."""
    resp = client.options('/load-book')
    assert resp.status_code == 200


def test_pdf_unknown_book(client):
    """GET /books/<book_id>/pdf with an unknown book_id returns 404."""
    resp = client.get('/books/nonexistent_book_xyz/pdf')
    assert resp.status_code == 404
    data = resp.json()
    assert 'error' in data


def test_load_book_known_fails_gracefully(client, mock_guest_gate, mock_extract_user):
    """POST /load-book with a known bookId but no R2 access returns a safe error."""
    # The session is mocked so R2 fetching will fail gracefully
    resp = client.post('/load-book', json={'bookId': 'zumdahl'})
    # Either loads (unlikely in test) or returns a safe error or rate limited
    assert resp.status_code in (200, 429, 500)
    data = resp.json()
    assert 'success' in data


# ── PDF proxy success ────────────────────────────────────────────────────────

def test_pdf_proxy_success(client, monkeypatch):
    """GET /books/<book_id>/pdf proxies PDF from R2 successfully."""
    from routes.shared import ctx

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.iter_content = MagicMock(return_value=iter([b'%PDF-1.4 fake content']))
    mock_resp.raise_for_status = MagicMock()

    mock_session = MagicMock()
    mock_session.get.return_value = mock_resp
    monkeypatch.setattr(ctx, 'session', mock_session)

    resp = client.get('/books/zumdahl/pdf')
    assert resp.status_code == 200
    assert resp.headers['content-type'] == 'application/pdf'


def test_pdf_proxy_error(client, monkeypatch):
    """GET /books/<book_id>/pdf returns 500 when R2 fetch fails."""
    from routes.shared import ctx

    mock_session = MagicMock()
    mock_session.get.side_effect = Exception("Connection refused")
    monkeypatch.setattr(ctx, 'session', mock_session)

    resp = client.get('/books/zumdahl/pdf')
    assert resp.status_code == 500
    data = resp.json()
    assert 'error' in data


def test_pdf_legacy_redirect(client):
    """GET /pdf/<book_id> redirects to /books/<book_id>/pdf (301)."""
    resp = client.get('/pdf/zumdahl', follow_redirects=False)
    assert resp.status_code == 301
    assert resp.headers['location'] == '/books/zumdahl/pdf'
