"""Tests for the library blueprint (/get-library, /load-book, /pdf/<book_id>)."""
import pytest
from unittest.mock import MagicMock, patch


def test_get_library(client):
    """GET /get-library returns the book list."""
    resp = client.get('/get-library')
    assert resp.status_code == 200
    data = resp.get_json()
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
    data = resp.get_json()
    assert data['success'] is False


def test_load_book_options(client):
    """OPTIONS /load-book returns 200 (CORS preflight)."""
    resp = client.options('/load-book')
    assert resp.status_code == 200


def test_pdf_unknown_book(client):
    """GET /pdf/<book_id> with an unknown book_id returns 404."""
    resp = client.get('/pdf/nonexistent_book_xyz')
    assert resp.status_code == 404
    data = resp.get_json()
    assert 'error' in data


def test_load_book_known_fails_gracefully(client, mock_guest_gate, mock_extract_user):
    """POST /load-book with a known bookId but no R2 access returns a safe error."""
    # The session is mocked so R2 fetching will fail gracefully
    resp = client.post('/load-book', json={'bookId': 'zumdahl'})
    # Either loads (unlikely in test) or returns a safe error or rate limited
    assert resp.status_code in (200, 429, 500)
    data = resp.get_json()
    assert 'success' in data
