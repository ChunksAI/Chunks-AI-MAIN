"""Tests for the flashcards blueprint (/generate-flashcards)."""
import pytest
from unittest.mock import MagicMock


def test_flashcards_options(client):
    """OPTIONS /generate-flashcards returns 200 (CORS preflight)."""
    resp = client.options('/generate-flashcards')
    assert resp.status_code == 200


def test_flashcards_no_body(client, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards with no JSON body returns 400."""
    resp = client.post('/generate-flashcards')
    assert resp.status_code in (400, 422)
    data = resp.json()
    assert data['success'] is False


def test_flashcards_success(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards returns parsed flashcards when AI works."""
    import services.ai as ai_svc
    import services.books as books_svc

    # Mock AI to return a well-formed CARD block response with hints
    ai_response = (
        "CARD\nFRONT: What is an acid?\nBACK: A proton donor.\nHINT: Think Brønsted-Lowry.\nEND\n"
        "CARD\nFRONT: What is a base?\nBACK: A proton acceptor.\nHINT: Opposite of acid role.\nEND\n"
    )
    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value=ai_response))

    # Mock book index to return empty (no R2 access needed)
    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    resp = client.post('/generate-flashcards', json={'topic': 'acids and bases', 'count': 2})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'flashcards' in data
    assert len(data['flashcards']) >= 1
    # Verify hint field is parsed when present
    assert data['flashcards'][0].get('hint')


def test_flashcards_success_without_hints(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards still works when AI omits HINT lines."""
    import services.ai as ai_svc
    import services.books as books_svc

    ai_response = (
        "CARD\nFRONT: What is an acid?\nBACK: A proton donor.\nEND\n"
        "CARD\nFRONT: What is a base?\nBACK: A proton acceptor.\nEND\n"
    )
    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value=ai_response))

    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    resp = client.post('/generate-flashcards', json={'topic': 'acids and bases', 'count': 2})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert len(data['flashcards']) == 2
    # Cards without HINT lines should not have the hint key
    assert 'hint' not in data['flashcards'][0]


def test_flashcards_markdown_fenced(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards succeeds when AI wraps output in markdown code fences."""
    import services.ai as ai_svc
    import services.books as books_svc

    ai_response = (
        "```plaintext\n"
        "CARD\nFRONT: What is an acid?\nBACK: A proton donor.\nHINT: Brønsted-Lowry.\nEND\n"
        "CARD\nFRONT: What is a base?\nBACK: A proton acceptor.\nHINT: Opposite of acid.\nEND\n"
        "```"
    )
    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value=ai_response))

    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    resp = client.post('/generate-flashcards', json={'topic': 'acids and bases', 'count': 2})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert len(data['flashcards']) == 2


def test_flashcards_no_card_markers(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards succeeds when AI omits CARD markers but uses FRONT/BACK."""
    import services.ai as ai_svc
    import services.books as books_svc

    ai_response = (
        "FRONT: What is an acid?\nBACK: A proton donor.\nHINT: Brønsted-Lowry.\nEND\n"
        "FRONT: What is a base?\nBACK: A proton acceptor.\nHINT: Opposite of acid.\nEND\n"
    )
    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value=ai_response))

    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    resp = client.post('/generate-flashcards', json={'topic': 'acids and bases', 'count': 2})
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert len(data['flashcards']) == 2


def test_flashcards_blueprint_registered(app):
    """The flashcards blueprint is registered with correct route."""
    rules = [r.path for r in app.routes]
    assert '/generate-flashcards' in rules
