"""Tests for the study blueprint (/generate-study-materials, /generate-quiz)."""
import pytest
from unittest.mock import MagicMock


def _study_mocks(monkeypatch):
    """Set up shared mocks for study endpoint tests."""
    import services.ai as ai_svc
    import services.device_abuse as device_mod
    import services.plan_limits as plan_mod

    monkeypatch.setattr(device_mod, 'check_device_rate_limit', MagicMock(return_value=None))
    monkeypatch.setattr(plan_mod, 'check_plan_limit', MagicMock(return_value=None))
    mock_ai = MagicMock(return_value="# Generated Materials\nContent here...")
    monkeypatch.setattr(ai_svc, 'call_ai', mock_ai)
    return mock_ai


SAMPLE_SLIDES = [
    {'slide_number': 1, 'title': 'Intro', 'content': ['Hello world'], 'notes': ''},
    {'slide_number': 2, 'title': 'Details', 'content': ['More content here'], 'notes': 'Speaker note'},
]


def test_study_materials_options(client):
    """OPTIONS /generate-study-materials returns 200."""
    resp = client.options('/generate-study-materials')
    assert resp.status_code == 200


def test_study_materials_no_slides(client, mock_guest_gate, mock_extract_user):
    """POST /generate-study-materials with no slides returns 400."""
    resp = client.post('/generate-study-materials', json={'type': 'notes', 'slides': []})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False


def test_study_materials_success(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """POST /generate-study-materials returns materials when AI works."""
    import services.ai as ai_svc
    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value="# Study Notes\nKey concepts..."))

    slides = [{'slide_number': 1, 'title': 'Intro', 'content': ['Hello world'], 'notes': ''}]
    resp = client.post('/generate-study-materials', json={'type': 'notes', 'slides': slides})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert 'materials' in data


def test_quiz_options(client):
    """OPTIONS /generate-quiz returns 200."""
    resp = client.options('/generate-quiz')
    assert resp.status_code == 200


def test_quiz_no_slides(client, mock_guest_gate, mock_extract_user):
    """POST /generate-quiz with no slides returns 400."""
    resp = client.post('/generate-quiz', json={'slides': [], 'count': 5})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False


def test_study_blueprints_registered(app):
    """Both study endpoints are registered."""
    rules = [r.rule for r in app.url_map.iter_rules()]
    assert '/generate-study-materials' in rules
    assert '/generate-quiz' in rules


# ── generate-study-materials with different material types ───────────────────

def test_study_materials_reviewer(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Reviewer material type generates exam review content."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'reviewer', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert 'reviewer' in data['materials']


def test_study_materials_flashcards(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Flashcards material type generates Q&A cards."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'flashcards', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert 'flashcards' in data['materials']


def test_study_materials_summary(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Summary material type generates a summary sheet."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'summary', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert 'summary' in data['materials']


def test_study_materials_quiz(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz material type generates practice questions."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'quiz', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert 'quiz' in data['materials']


def test_study_materials_all(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """'all' material type generates comprehensive materials."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'all', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert 'all' in data['materials']


def test_study_materials_unknown_type(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Unknown material type still generates materials using fallback prompt."""
    _study_mocks(monkeypatch)
    resp = client.post('/generate-study-materials', json={'type': 'custom_thing', 'slides': SAMPLE_SLIDES})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert 'custom_thing' in data['materials']


def test_study_materials_truncation(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Long slide content is truncated to char_limit."""
    _study_mocks(monkeypatch)
    big_slides = [{'slide_number': 1, 'title': 'Big', 'content': ['x' * 30000], 'notes': ''}]
    resp = client.post('/generate-study-materials', json={'type': 'notes', 'slides': big_slides})
    assert resp.status_code == 200
    assert resp.get_json()['success'] is True


def test_study_materials_empty_content_slides(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Slides with empty content and no notes return 400."""
    _study_mocks(monkeypatch)
    empty_slides = [{'slide_number': 1, 'title': 'Empty', 'content': ['', '  '], 'notes': ''}]
    resp = client.post('/generate-study-materials', json={'type': 'notes', 'slides': empty_slides})
    assert resp.status_code == 400
    assert resp.get_json()['success'] is False


# ── generate-quiz with different difficulties and modes ──────────────────────

def test_quiz_success_easy(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz generation with easy difficulty succeeds."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. What is water?\nA) H2O\nB) NaCl\nC) CO2\nD) N2\nAnswer: A\nExplanation: Water is H2O."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[
        {'question': 'What is water?', 'options': ['H2O', 'NaCl', 'CO2', 'N2'], 'answer': 'A'}
    ]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'difficulty': 'easy',
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert data['difficulty'] == 'easy'
    assert len(data['questions']) == 1


def test_quiz_success_hard(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz generation with hard difficulty succeeds."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. Advanced question..."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[{'question': 'Advanced'}]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 10,
        'difficulty': 'hard',
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert data['difficulty'] == 'hard'


def test_quiz_success_medium(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz generation with default (medium) difficulty succeeds."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. Medium question..."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[{'question': 'Medium'}]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 10,
        'difficulty': 'medium',
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert data['difficulty'] == 'medium'


def test_quiz_situational_mode(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Situational quiz mode adds scenario-based instruction."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. A patient presents with..."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[{'question': 'Situational'}]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'difficulty': 'medium',
        'mode': 'situational',
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True


def test_quiz_no_readable_content(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz with slides that have no readable content returns 400."""
    _study_mocks(monkeypatch)
    empty_slides = [{'slide_number': 1, 'title': 'Empty', 'content': ['', '  '], 'notes': ''}]
    resp = client.post('/generate-quiz', json={
        'slides': empty_slides,
        'count': 5,
    })
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False
    assert 'No readable content' in data['error']


def test_quiz_parse_failure(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz returns 500 if MCQ parsing returns empty list."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Unparseable garbled output"
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
    })
    assert resp.status_code == 500
    data = resp.get_json()
    assert data['success'] is False
    assert 'Could not parse' in data['error']


def test_quiz_with_existing_questions(client, monkeypatch, mock_guest_gate, mock_extract_user):
    """Quiz generation with existingQuestions avoids repeats."""
    import server as srv
    mock_ai = _study_mocks(monkeypatch)
    mock_ai.return_value = "Q1. New question..."
    monkeypatch.setattr(srv, '_parse_mcq', MagicMock(return_value=[{'question': 'New'}]))

    resp = client.post('/generate-quiz', json={
        'slides': SAMPLE_SLIDES,
        'count': 5,
        'existingQuestions': ['What is water?', 'Define pH'],
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
