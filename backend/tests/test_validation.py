"""Tests for Pydantic request validation across all endpoints."""
import pytest
from unittest.mock import MagicMock


def test_validate_request_decorator():
    """validate_request is a no-op pass-through decorator (covers routes/validation.py)."""
    from routes.validation import validate_request

    class DummyModel:
        pass

    @validate_request(DummyModel)
    def dummy():
        return 42

    assert dummy() == 42


# ── Chat /ask ─────────────────────────────────────────────────────────────────

def test_ask_invalid_complexity_type(client, mock_guest_gate, mock_extract_user):
    """POST /ask with non-numeric complexity returns 422."""
    resp = client.post('/ask', json={
        'question': 'hello',
        'complexity': 'not-a-number',
    })
    assert resp.status_code == 422
    data = resp.json()
    assert data['success'] is False
    assert data['error'] == 'Validation error'
    assert isinstance(data['details'], list)


def test_ask_complexity_out_of_range(client, mock_guest_gate, mock_extract_user):
    """POST /ask with complexity > 10 returns 422."""
    resp = client.post('/ask', json={
        'question': 'hello',
        'complexity': 99,
    })
    assert resp.status_code == 422


def test_ask_valid_defaults(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """POST /ask with minimal valid payload passes validation."""
    import services.ai as ai_svc
    import services.books as books_svc
    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value="Answer."))
    monkeypatch.setattr(ai_svc, 'should_search_textbook', MagicMock(return_value=False))
    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    mock_searcher.has_embeddings = False
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    resp = client.post('/ask', json={'question': 'hi'})
    assert resp.status_code == 200


# ── Flashcards /generate-flashcards ───────────────────────────────────────────

def test_flashcards_count_too_high(client, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards with count > 20 returns 422."""
    resp = client.post('/generate-flashcards', json={
        'topic': 'acids',
        'count': 100,
    })
    assert resp.status_code == 422


def test_flashcards_count_negative(client, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards with count < 1 returns 422."""
    resp = client.post('/generate-flashcards', json={
        'topic': 'acids',
        'count': 0,
    })
    assert resp.status_code == 422


def test_flashcards_count_non_integer(client, mock_guest_gate, mock_extract_user):
    """POST /generate-flashcards with string count returns 422."""
    resp = client.post('/generate-flashcards', json={
        'topic': 'acids',
        'count': 'many',
    })
    assert resp.status_code == 422


# ── Image /ask-image ──────────────────────────────────────────────────────────

def test_image_complexity_out_of_range(client, mock_extract_user):
    """POST /ask-image with complexity > 10 returns 422."""
    resp = client.post('/ask-image', json={
        'image_b64': 'dGVzdA==',
        'complexity': 20,
    })
    assert resp.status_code == 422


def test_image_complexity_non_integer(client, mock_extract_user):
    """POST /ask-image with string complexity returns 422."""
    resp = client.post('/ask-image', json={
        'image_b64': 'dGVzdA==',
        'complexity': 'high',
    })
    assert resp.status_code == 422


# ── Library /load-book ────────────────────────────────────────────────────────

def test_load_book_missing_book_id(client, mock_guest_gate, mock_extract_user):
    """POST /load-book with missing bookId returns 422."""
    resp = client.post('/load-book', json={})
    assert resp.status_code == 422
    data = resp.json()
    assert data['success'] is False


# ── Study /generate-quiz ──────────────────────────────────────────────────────

def test_quiz_count_out_of_range(client, mock_guest_gate, mock_extract_user):
    """POST /generate-quiz with count > 50 returns 422."""
    resp = client.post('/generate-quiz', json={
        'slides': [{'title': 'S1', 'content': ['hi'], 'notes': ''}],
        'count': 999,
    })
    assert resp.status_code == 422


def test_quiz_count_too_low(client, mock_guest_gate, mock_extract_user):
    """POST /generate-quiz with count < 5 returns 422."""
    resp = client.post('/generate-quiz', json={
        'slides': [{'title': 'S1', 'content': ['hi'], 'notes': ''}],
        'count': 2,
    })
    assert resp.status_code == 422


# ── General: OPTIONS pass through ─────────────────────────────────────────────

@pytest.mark.parametrize('url', [
    '/ask', '/generate-flashcards', '/generate-study-materials',
    '/generate-quiz', '/ask-image', '/load-book',
])
def test_options_bypass_validation(client, url):
    """OPTIONS requests must bypass validation and return 200."""
    resp = client.options(url)
    assert resp.status_code == 200


# ── General: missing JSON returns 400 ────────────────────────────────────────

@pytest.mark.parametrize('url', [
    '/ask', '/generate-flashcards', '/generate-study-materials',
    '/generate-quiz', '/ask-image', '/load-book',
])
def test_missing_json_returns_400(client, mock_guest_gate, mock_extract_user, url):
    """POST with no JSON body returns 422 from FastAPI body validation."""
    resp = client.post(url)
    assert resp.status_code == 422
    data = resp.json()
    assert data['success'] is False


# ── Validation error shape ────────────────────────────────────────────────────

def test_validation_error_has_details(client, mock_guest_gate, mock_extract_user):
    """422 responses include a 'details' list describing each error."""
    resp = client.post('/generate-flashcards', json={'count': 'not-int'})
    assert resp.status_code == 422
    data = resp.json()
    assert 'details' in data
    assert len(data['details']) >= 1
    # Each detail should have 'type', 'loc', and 'msg' (Pydantic v2 format)
    detail = data['details'][0]
    assert 'type' in detail
    assert 'loc' in detail
    assert 'msg' in detail
