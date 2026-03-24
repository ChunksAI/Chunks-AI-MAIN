"""Tests for the study blueprint (/generate-study-materials, /generate-quiz)."""
import pytest
from unittest.mock import MagicMock


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
