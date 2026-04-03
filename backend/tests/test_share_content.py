"""Tests for routes/share_content.py — POST /api/share + GET /api/share/<id>."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


# ── Helpers ────────────────────────────────────────────────────────────────────

def _auth_mock(monkeypatch, user_id="user-abc", tier="free"):
    """Patch _extract_verified_user to return a fixed authenticated user."""
    import services.auth as auth_svc
    mock = MagicMock(return_value=(user_id, tier, False))
    monkeypatch.setattr(auth_svc, "_extract_verified_user", mock)
    return mock


SAMPLE_DECK_DATA = {
    "title": "Acid-Base Equilibrium",
    "subtitle": "Atkins Ch. 6",
    "author": "Test User",
    "cards": [
        {"q": "What is pH?", "a": "pH = -log[H+]"},
        {"q": "What is Ka?", "a": "Acid dissociation constant"},
    ],
}

SAMPLE_EXAM_DATA = {
    "title": "Thermodynamics Exam",
    "subtitle": "Chapter 3",
    "author": "Test User",
    "score": 75,
    "correct": 6,
    "wrong": 2,
    "total": 8,
    "duration": "12 min",
    "date": "2026-03-01",
    "questions": [
        {
            "q": "What is enthalpy?",
            "opts": ["Heat content", "Entropy", "Gibbs energy", "Work"],
            "correct": 0,
            "feedback": "Correct!",
            "wrongFeedback": "Not quite.",
        }
    ],
    "review": [],
}

SAMPLE_PLAN_DATA = {
    "title": "Chemistry Master Plan",
    "subtitle": "8-Week Plan",
    "author": "Test User",
    "daysUntilExam": 56,
    "readiness": 40,
    "stats": {"weeks": 8, "mastered": 2, "flashcards": 30, "studyTime": "8h"},
    "nodes": [
        {
            "week": "W1",
            "title": "Thermodynamics",
            "desc": "First law, enthalpy.",
            "status": "mastered",
            "mastery": 90,
        }
    ],
}


# ── OPTIONS preflight ──────────────────────────────────────────────────────────

def test_create_share_options(client):
    """OPTIONS /api/share returns 200 (CORS preflight)."""
    resp = client.options("/api/share")
    assert resp.status_code == 200


# ── Auth guard ─────────────────────────────────────────────────────────────────

def test_create_share_requires_auth(client, monkeypatch):
    """POST /api/share without valid auth returns 401."""
    import services.auth as auth_svc

    def _raise(*_a, **_kw):
        raise Exception("Not authenticated")

    monkeypatch.setattr(auth_svc, "_extract_verified_user", _raise)

    resp = client.post(
        "/api/share",
        json={"type": "deck", "data": SAMPLE_DECK_DATA},
    )
    assert resp.status_code == 401
    assert resp.json()["success"] is False


# ── Deck share ─────────────────────────────────────────────────────────────────

def test_create_deck_share(client, monkeypatch):
    """POST /api/share with type=deck creates a share and returns share_id + url."""
    _auth_mock(monkeypatch)
    resp = client.post(
        "/api/share",
        json={"type": "deck", "data": SAMPLE_DECK_DATA},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "share_id" in data
    assert len(data["share_id"]) == 32  # UUID4 hex
    assert "/share/deck.html?id=" in data["url"]


def test_get_deck_share(client, monkeypatch):
    """GET /api/share/<id> returns the stored deck data."""
    _auth_mock(monkeypatch)
    # Create first
    create_resp = client.post(
        "/api/share",
        json={"type": "deck", "data": SAMPLE_DECK_DATA},
    )
    share_id = create_resp.json()["share_id"]

    # Retrieve (no auth needed)
    resp = client.get(f"/api/share/{share_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["type"] == "deck"
    assert data["data"]["title"] == "Acid-Base Equilibrium"
    assert len(data["data"]["cards"]) == 2
    assert "created_at" in data


# ── Exam share ─────────────────────────────────────────────────────────────────

def test_create_exam_share(client, monkeypatch):
    """POST /api/share with type=exam creates a share correctly."""
    _auth_mock(monkeypatch)
    resp = client.post(
        "/api/share",
        json={"type": "exam", "data": SAMPLE_EXAM_DATA},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "/share/exam.html?id=" in data["url"]


def test_get_exam_share(client, monkeypatch):
    """GET /api/share/<id> returns stored exam data."""
    _auth_mock(monkeypatch)
    create_resp = client.post(
        "/api/share",
        json={"type": "exam", "data": SAMPLE_EXAM_DATA},
    )
    share_id = create_resp.json()["share_id"]

    resp = client.get(f"/api/share/{share_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "exam"
    assert data["data"]["score"] == 75
    assert data["data"]["total"] == 8


# ── Plan share ─────────────────────────────────────────────────────────────────

def test_create_plan_share(client, monkeypatch):
    """POST /api/share with type=plan creates a share correctly."""
    _auth_mock(monkeypatch)
    resp = client.post(
        "/api/share",
        json={"type": "plan", "data": SAMPLE_PLAN_DATA},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "/share/study-plan.html?id=" in data["url"]


def test_get_plan_share(client, monkeypatch):
    """GET /api/share/<id> returns stored plan data."""
    _auth_mock(monkeypatch)
    create_resp = client.post(
        "/api/share",
        json={"type": "plan", "data": SAMPLE_PLAN_DATA},
    )
    share_id = create_resp.json()["share_id"]

    resp = client.get(f"/api/share/{share_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "plan"
    assert data["data"]["readiness"] == 40
    assert len(data["data"]["nodes"]) == 1


# ── Error cases ────────────────────────────────────────────────────────────────

def test_get_share_not_found(client):
    """GET /api/share/<unknown_id> returns 404."""
    resp = client.get("/api/share/doesnotexist00000000000000000000")
    assert resp.status_code == 404
    assert resp.json()["success"] is False


def test_get_share_invalid_id_too_long(client):
    """GET /api/share/<very_long_id> returns 400."""
    resp = client.get("/api/share/" + "x" * 65)
    assert resp.status_code == 400


def test_create_share_invalid_type(client, monkeypatch):
    """POST /api/share with invalid type returns 422 (validation error)."""
    _auth_mock(monkeypatch)
    resp = client.post(
        "/api/share",
        json={"type": "invalid", "data": {}},
    )
    assert resp.status_code == 422


def test_create_share_missing_type(client, monkeypatch):
    """POST /api/share with no type field returns 422."""
    _auth_mock(monkeypatch)
    resp = client.post(
        "/api/share",
        json={"data": {}},
    )
    assert resp.status_code == 422


# ── share_store unit tests ─────────────────────────────────────────────────────

class TestShareStore:
    """Unit tests for services/share_store.py in isolation."""

    def test_create_and_get(self):
        """create_share + get_share round-trip works in memory."""
        import services.share_store as ss
        ss.init(redis=None)   # ensure in-memory mode

        sid = ss.create_share("deck", {"cards": [{"q": "Q1", "a": "A1"}]})
        assert len(sid) == 32

        record = ss.get_share(sid)
        assert record is not None
        assert record["type"] == "deck"
        assert record["data"]["cards"][0]["q"] == "Q1"

    def test_invalid_type_raises(self):
        """create_share with an unknown type raises ValueError."""
        import services.share_store as ss
        with pytest.raises(ValueError, match="Invalid share_type"):
            ss.create_share("quiz", {})

    def test_get_missing_returns_none(self):
        """get_share with an unknown ID returns None."""
        import services.share_store as ss
        assert ss.get_share("nonexistent00000000000000000000000") is None

    def test_get_empty_id_returns_none(self):
        """get_share with empty string returns None."""
        import services.share_store as ss
        assert ss.get_share("") is None

    def test_get_too_long_id_returns_none(self):
        """get_share with an ID >64 chars returns None."""
        import services.share_store as ss
        assert ss.get_share("x" * 65) is None

    def test_plan_roundtrip(self):
        """Plan data is stored and retrieved intact."""
        import services.share_store as ss
        ss.init(redis=None)

        nodes = [{"week": "W1", "title": "Thermo", "status": "mastered"}]
        sid = ss.create_share("plan", {"nodes": nodes, "readiness": 60})
        record = ss.get_share(sid)
        assert record["data"]["readiness"] == 60
        assert record["data"]["nodes"][0]["week"] == "W1"
