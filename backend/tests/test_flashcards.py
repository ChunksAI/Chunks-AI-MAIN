"""Tests for the flashcards blueprint (/generate-flashcards)."""
import pytest
from unittest.mock import MagicMock


def test_flashcards_options(client):
    """OPTIONS /generate-flashcards returns 200 (CORS preflight)."""
    resp = client.options('/generate-flashcards')
    assert resp.status_code == 200


def test_flashcards_no_body(client, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards with no JSON body returns 400."""
    resp = client.post('/generate-flashcards', content_type='application/json', data='')
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False


def test_flashcards_success(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards returns parsed flashcards when AI works."""
    import services.ai as ai_svc
    import services.books as books_svc

    # Mock AI to return a well-formed CARD block response
    ai_response = (
        "CARD\nFRONT: What is an acid?\nBACK: A proton donor.\nEND\n"
        "CARD\nFRONT: What is a base?\nBACK: A proton acceptor.\nEND\n"
    )
    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value=ai_response))

    # Mock book index to return empty (no R2 access needed)
    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    resp = client.post('/generate-flashcards', json={'topic': 'acids and bases', 'count': 2})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert 'flashcards' in data
    assert len(data['flashcards']) >= 1


def test_flashcards_blueprint_registered(app):
    """The flashcards blueprint is registered with correct route."""
    rules = [r.rule for r in app.url_map.iter_rules()]
    assert '/generate-flashcards' in rules
