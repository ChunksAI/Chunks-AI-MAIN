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
    ctx.supabase_client.post = AsyncMock(return_value=mock_resp)
    ctx.supabase_client.get = AsyncMock(return_value=mock_resp)
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


# ── Redis caching tests ────────────────────────────────────────────────────────

class TestStudentModelCache:
    """Unit tests for get_student_model_cached and _profile_from_model."""

    def test_returns_none_when_redis_is_none(self):
        from routes.tutor_brain import get_student_model_cached
        result = get_student_model_cached('user1', 'book1', None)
        assert result is None

    def test_returns_none_when_user_id_is_empty(self):
        from routes.tutor_brain import get_student_model_cached
        result = get_student_model_cached('', 'book1', MagicMock())
        assert result is None

    def test_returns_model_on_cache_hit(self):
        from routes.tutor_brain import get_student_model_cached
        import json
        model = {'mastered': ['entropy'], 'gaps': [], 'quizHistory': []}
        redis = MagicMock()
        redis.get.return_value = json.dumps(model)
        result = get_student_model_cached('user1', 'book1', redis)
        assert result == model
        redis.get.assert_called_once_with('student_model:user1:book1')

    def test_returns_none_on_cache_miss(self):
        from routes.tutor_brain import get_student_model_cached
        redis = MagicMock()
        redis.get.return_value = None
        result = get_student_model_cached('user1', 'book1', redis)
        assert result is None

    def test_uses_global_scope_when_no_book_id(self):
        from routes.tutor_brain import get_student_model_cached
        import json
        model = {'mastered': [], 'gaps': [], 'quizHistory': []}
        redis = MagicMock()
        redis.get.return_value = json.dumps(model)
        get_student_model_cached('user1', None, redis)
        redis.get.assert_called_once_with('student_model:user1:global')

    def test_returns_none_on_redis_error(self):
        from routes.tutor_brain import get_student_model_cached
        redis = MagicMock()
        redis.get.side_effect = Exception('connection error')
        result = get_student_model_cached('user1', 'book1', redis)
        assert result is None

    def test_profile_from_model_formats_profile_block(self):
        from routes.tutor_brain import _profile_from_model
        model = {
            'mastered': ['thermodynamics', 'entropy'],
            'gaps': [{'concept': 'Gibbs energy', 'status': 'failing'}],
            'quizHistory': [{'topic': 'Gibbs energy', 'score': 30}],
        }
        profile = _profile_from_model(model)
        assert '[STUDENT PROFILE]' in profile
        assert 'Gibbs energy' in profile
        assert 'thermodynamics' in profile

    def test_profile_from_model_empty_model(self):
        from routes.tutor_brain import _profile_from_model
        profile = _profile_from_model({'mastered': [], 'gaps': [], 'quizHistory': []})
        assert '[STUDENT PROFILE]' in profile


class TestSaveModelRedis:
    """save_model writes to Redis after a successful Supabase upsert."""

    def test_save_model_writes_to_redis(self, client, monkeypatch):
        import json
        from unittest.mock import AsyncMock
        from routes import shared as shared_mod

        _mock_extract_verified(monkeypatch)

        ctx = MagicMock()
        ctx.SUPABASE_URL = 'https://fake.supabase.co'
        ctx.SUPABASE_SERVICE_KEY = 'fake-key'
        mock_resp = MagicMock()
        mock_resp.status_code = 204
        ctx.supabase_client.post = AsyncMock(return_value=mock_resp)
        mock_redis = MagicMock()
        ctx.redis = mock_redis
        monkeypatch.setattr(shared_mod, 'ctx', ctx)

        resp = client.post(
            '/tutor/save-model',
            json={'student_model': _VALID_MODEL, 'book_id': 'book-xyz'},
            headers={'Authorization': _VALID_JWT},
        )
        assert resp.status_code == 200
        mock_redis.setex.assert_called_once()
        key_arg = mock_redis.setex.call_args[0][0]
        assert key_arg == f'student_model:{_VERIFIED_USER_ID}:book-xyz'
        value_arg = mock_redis.setex.call_args[0][2]
        assert json.loads(value_arg) == _VALID_MODEL

    def test_save_model_uses_global_scope_without_book_id(self, client, monkeypatch):
        from unittest.mock import AsyncMock
        from routes import shared as shared_mod

        _mock_extract_verified(monkeypatch)

        ctx = MagicMock()
        ctx.SUPABASE_URL = 'https://fake.supabase.co'
        ctx.SUPABASE_SERVICE_KEY = 'fake-key'
        mock_resp = MagicMock()
        mock_resp.status_code = 204
        ctx.supabase_client.post = AsyncMock(return_value=mock_resp)
        ctx.redis = MagicMock()
        monkeypatch.setattr(shared_mod, 'ctx', ctx)

        resp = client.post(
            '/tutor/save-model',
            json={'student_model': _VALID_MODEL},
            headers={'Authorization': _VALID_JWT},
        )
        assert resp.status_code == 200
        key_arg = ctx.redis.setex.call_args[0][0]
        assert key_arg == f'student_model:{_VERIFIED_USER_ID}:global'

    def test_save_model_redis_error_does_not_fail_request(self, client, monkeypatch):
        from unittest.mock import AsyncMock
        from routes import shared as shared_mod

        _mock_extract_verified(monkeypatch)

        ctx = MagicMock()
        ctx.SUPABASE_URL = 'https://fake.supabase.co'
        ctx.SUPABASE_SERVICE_KEY = 'fake-key'
        mock_resp = MagicMock()
        mock_resp.status_code = 204
        ctx.supabase_client.post = AsyncMock(return_value=mock_resp)
        ctx.redis = MagicMock()
        ctx.redis.setex.side_effect = Exception('Redis unavailable')
        monkeypatch.setattr(shared_mod, 'ctx', ctx)

        resp = client.post(
            '/tutor/save-model',
            json={'student_model': _VALID_MODEL, 'book_id': 'book-xyz'},
            headers={'Authorization': _VALID_JWT},
        )
        assert resp.status_code == 200
        assert resp.json().get('success') is True


class TestLoadModelRedis:
    """load_model checks Redis first and falls back to Supabase."""

    def test_load_model_returns_redis_hit_without_supabase(self, client, monkeypatch):
        import json
        from routes import shared as shared_mod

        _mock_extract_verified(monkeypatch)

        ctx = MagicMock()
        ctx.redis = MagicMock()
        ctx.redis.get.return_value = json.dumps(_VALID_MODEL)
        monkeypatch.setattr(shared_mod, 'ctx', ctx)

        resp = client.get(
            '/tutor/load-model?book_id=book-xyz',
            headers={'Authorization': _VALID_JWT},
        )
        assert resp.status_code == 200
        assert resp.json()['student_model'] == _VALID_MODEL
        ctx.supabase_client.get.assert_not_called()

    def test_load_model_falls_back_to_supabase_on_cache_miss(self, client, monkeypatch):
        import json
        from unittest.mock import AsyncMock
        from routes import shared as shared_mod

        _mock_extract_verified(monkeypatch)

        ctx = MagicMock()
        ctx.SUPABASE_URL = 'https://fake.supabase.co'
        ctx.SUPABASE_SERVICE_KEY = 'fake-key'
        ctx.redis = MagicMock()
        ctx.redis.get.return_value = None

        mock_sb_resp = MagicMock()
        mock_sb_resp.status_code = 200
        mock_sb_resp.json.return_value = [{'student_knowledge_model': json.dumps(_VALID_MODEL)}]
        ctx.supabase_client.get = AsyncMock(return_value=mock_sb_resp)
        monkeypatch.setattr(shared_mod, 'ctx', ctx)

        resp = client.get(
            '/tutor/load-model?book_id=book-xyz',
            headers={'Authorization': _VALID_JWT},
        )
        assert resp.status_code == 200
        assert resp.json()['student_model'] == _VALID_MODEL
        # Should backfill Redis
        ctx.redis.setex.assert_called_once()

