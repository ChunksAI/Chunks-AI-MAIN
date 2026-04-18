"""Tests for /tutor/save-model and /tutor/load-model endpoints."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


_VALID_MODEL = {
    'mastered': ['thermodynamics'],
    'gaps': [{'concept': 'entropy', 'status': 'failing'}],
    'quizHistory': [{'topic': 'entropy', 'score': 35}],
}

_VALID_JWT = 'Bearer test.jwt.token'
_VERIFIED_USER_ID = 'user-abc-123'


def _mock_extract_verified(monkeypatch, user_id=_VERIFIED_USER_ID):
    """Patch _extract_verified_user at the import site used by tutor_brain."""
    import services.auth as auth_svc
    from services.auth import Tier
    mock = MagicMock(return_value=(user_id, Tier.FREE, False))
    monkeypatch.setattr(auth_svc, '_extract_verified_user', mock)
    return mock


def _mock_supabase_ok(monkeypatch):
    """Make the Supabase async_client return 200 on upsert/select."""
    from unittest.mock import AsyncMock
    from routes import shared as shared_mod
    ctx = MagicMock()
    ctx.SUPABASE_URL = 'https://fake.supabase.co'
    ctx.SUPABASE_SERVICE_KEY = 'fake-key'
    mock_resp = MagicMock()
    mock_resp.status_code = 204
    mock_resp.json.return_value = []
    ctx.async_client.post = AsyncMock(return_value=mock_resp)
    ctx.async_client.get = AsyncMock(return_value=mock_resp)
    monkeypatch.setattr(shared_mod, 'ctx', ctx)
    return ctx


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestSaveModel:
    def test_valid_jwt_returns_200(self, client, monkeypatch):
        """POST /tutor/save-model with a valid JWT and valid body → 200."""
        _mock_extract_verified(monkeypatch)
        _mock_supabase_ok(monkeypatch)

        resp = client.post(
            '/tutor/save-model',
            json={'student_model': _VALID_MODEL},
            headers={'Authorization': _VALID_JWT},
        )
        assert resp.status_code == 200
        assert resp.json().get('success') is True

    def test_no_auth_header_returns_401(self, client, monkeypatch):
        """POST /tutor/save-model with no auth header → 401."""
        import services.auth as auth_svc
        from services.auth import Tier
        # Return None for verified_user_id to simulate no/invalid JWT
        monkeypatch.setattr(
            auth_svc, '_extract_verified_user',
            MagicMock(return_value=(None, Tier.FREE, False)),
        )

        resp = client.post(
            '/tutor/save-model',
            json={'student_model': _VALID_MODEL},
        )
        assert resp.status_code == 401

    def test_oversized_model_returns_400(self, client, monkeypatch):
        """POST /tutor/save-model with model > 64 KB → 400."""
        _mock_extract_verified(monkeypatch)

        # Build a model whose JSON serialisation exceeds 64 KB
        big_model = {
            'mastered': ['x' * 100] * 700,
            'gaps': [],
            'quizHistory': [],
        }

        resp = client.post(
            '/tutor/save-model',
            json={'student_model': big_model},
            headers={'Authorization': _VALID_JWT},
        )
        assert resp.status_code == 400
        assert 'maximum size' in resp.json().get('error', '')

    def test_missing_gaps_key_returns_422(self, client, monkeypatch):
        """POST /tutor/save-model missing 'gaps' key → 422."""
        _mock_extract_verified(monkeypatch)

        bad_model = {
            'mastered': [],
            # 'gaps' is intentionally absent
            'quizHistory': [],
        }

        resp = client.post(
            '/tutor/save-model',
            json={'student_model': bad_model},
            headers={'Authorization': _VALID_JWT},
        )
        assert resp.status_code == 422
        assert 'schema' in resp.json().get('error', '')


class TestLoadModel:
    def test_no_auth_returns_401(self, client, monkeypatch):
        """GET /tutor/load-model with no auth → 401."""
        import services.auth as auth_svc
        from services.auth import Tier
        monkeypatch.setattr(
            auth_svc, '_extract_verified_user',
            MagicMock(return_value=(None, Tier.FREE, False)),
        )

        resp = client.get('/tutor/load-model')
        assert resp.status_code == 401
