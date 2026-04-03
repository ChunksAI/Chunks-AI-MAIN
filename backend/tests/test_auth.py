"""
Tests for backend/services/auth.py — local JWT verification + tier caching.
"""
from __future__ import annotations

import time
import sys
import os
from unittest.mock import MagicMock, patch

import jwt
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import services.auth as auth_svc
from services.auth import (
    Tier,
    _verify_jwt_local,
    _verify_supabase_jwt,
    _get_user_tier_from_db,
    _extract_verified_user,
    _TIER_CACHE_TTL,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

_SECRET = "test-jwt-secret-that-is-at-least-32-bytes!"
_USER_ID = "aaaabbbb-cccc-dddd-eeee-ffffffffffff"
_EMAIL   = "user@example.com"


def _make_token(secret=_SECRET, sub=_USER_ID, email=_EMAIL,
                audience="authenticated", offset=3600):
    """Mint a valid HS256 JWT."""
    now = int(time.time())
    payload = {
        "sub":   sub,
        "email": email,
        "aud":   audience,
        "role":  "authenticated",
        "iat":   now,
        "exp":   now + offset,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def _expired_token():
    return _make_token(offset=-10)


def _mock_redis():
    """In-memory fake compatible with Redis get/setex."""
    store: dict = {}

    r = MagicMock()
    r.get.side_effect  = lambda k: store.get(k)
    r.setex.side_effect = lambda k, ttl, v: store.__setitem__(k, v)
    r.incr.side_effect  = lambda k: store.__setitem__(k, store.get(k, 0) + 1) or store[k]
    r.expire.return_value = True
    return r, store


# ── _verify_jwt_local ─────────────────────────────────────────────────────────

class TestVerifyJwtLocal:
    def setup_method(self):
        auth_svc._jwt_secret = _SECRET

    def teardown_method(self):
        auth_svc._jwt_secret = ''

    def test_valid_token_returns_user_dict(self):
        token = _make_token()
        result = _verify_jwt_local(token)
        assert result is not None
        assert result["id"] == _USER_ID
        assert result["email"] == _EMAIL

    def test_expired_token_returns_none(self):
        token = _expired_token()
        result = _verify_jwt_local(token)
        assert result is None

    def test_wrong_secret_returns_none(self):
        token = _make_token(secret="wrong-secret-also-at-least-32-bytes!!")
        result = _verify_jwt_local(token)
        assert result is None

    def test_wrong_audience_returns_none(self):
        token = _make_token(audience="anon")
        result = _verify_jwt_local(token)
        assert result is None

    def test_empty_token_returns_none(self):
        assert _verify_jwt_local("") is None

    def test_garbage_token_returns_none(self):
        assert _verify_jwt_local("not.a.jwt") is None

    def test_no_secret_returns_none(self):
        auth_svc._jwt_secret = ''
        token = _make_token()
        assert _verify_jwt_local(token) is None


# ── _verify_supabase_jwt ─────────────────────────────────────────────────────

class TestVerifySupabaseJwt:
    def setup_method(self):
        auth_svc._jwt_secret = ''
        auth_svc.SUPABASE_URL = ''
        auth_svc.SUPABASE_SERVICE_KEY = ''
        auth_svc._session = None

    def teardown_method(self):
        auth_svc._jwt_secret = ''

    def test_uses_local_verify_when_secret_configured(self):
        auth_svc._jwt_secret = _SECRET
        token = _make_token()
        result = _verify_supabase_jwt(token)
        assert result is not None
        assert result["id"] == _USER_ID

    def test_local_path_does_not_call_session(self):
        auth_svc._jwt_secret = _SECRET
        mock_session = MagicMock()
        auth_svc._session = mock_session
        token = _make_token()
        _verify_supabase_jwt(token)
        mock_session.get.assert_not_called()

    def test_falls_back_to_rest_api_when_no_secret(self):
        auth_svc.SUPABASE_URL = "https://example.supabase.co"
        auth_svc.SUPABASE_SERVICE_KEY = "service-key"
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"id": _USER_ID, "email": _EMAIL}
        mock_session.get.return_value = mock_resp
        auth_svc._session = mock_session

        result = _verify_supabase_jwt("some-opaque-token")
        assert result is not None
        assert result["id"] == _USER_ID
        mock_session.get.assert_called_once()

    def test_rest_api_401_returns_none(self):
        auth_svc.SUPABASE_URL = "https://example.supabase.co"
        auth_svc.SUPABASE_SERVICE_KEY = "service-key"
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_session.get.return_value = mock_resp
        auth_svc._session = mock_session

        assert _verify_supabase_jwt("bad-token") is None

    def test_no_secret_and_no_supabase_config_returns_none(self):
        assert _verify_supabase_jwt("some-token") is None

    def test_empty_token_returns_none(self):
        auth_svc._jwt_secret = _SECRET
        assert _verify_supabase_jwt("") is None


# ── _get_user_tier_from_db (with caching) ────────────────────────────────────

class TestGetUserTier:
    def setup_method(self):
        auth_svc._redis = None
        auth_svc.SUPABASE_URL = "https://example.supabase.co"
        auth_svc.SUPABASE_SERVICE_KEY = "service-key"

    def teardown_method(self):
        auth_svc._redis = None
        auth_svc.SUPABASE_URL = ''
        auth_svc.SUPABASE_SERVICE_KEY = ''
        auth_svc._session = None

    def test_returns_free_when_no_user_id(self):
        assert _get_user_tier_from_db('') == Tier.FREE

    def test_fetches_tier_from_supabase_on_cache_miss(self):
        mock_r, store = _mock_redis()
        auth_svc._redis = mock_r

        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"plan": "pro"}]
        mock_session.get.return_value = mock_resp
        auth_svc._session = mock_session

        tier = _get_user_tier_from_db(_USER_ID)
        assert tier == Tier.PRO
        mock_session.get.assert_called_once()
        # Result should be written to cache
        assert store.get(f"tier:{_USER_ID}") == "pro"

    def test_returns_cached_tier_without_rest_call(self):
        mock_r, store = _mock_redis()
        store[f"tier:{_USER_ID}"] = "ultra"
        auth_svc._redis = mock_r

        mock_session = MagicMock()
        auth_svc._session = mock_session

        tier = _get_user_tier_from_db(_USER_ID)
        assert tier == Tier.ULTRA
        mock_session.get.assert_not_called()

    def test_defaults_to_free_on_supabase_error(self):
        mock_r, store = _mock_redis()
        auth_svc._redis = mock_r

        mock_session = MagicMock()
        mock_session.get.side_effect = Exception("network error")
        auth_svc._session = mock_session

        tier = _get_user_tier_from_db(_USER_ID)
        assert tier == Tier.FREE

    def test_cache_written_with_correct_ttl(self):
        mock_r, store = _mock_redis()
        auth_svc._redis = mock_r

        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"plan": "paid"}]
        mock_session.get.return_value = mock_resp
        auth_svc._session = mock_session

        _get_user_tier_from_db(_USER_ID)
        # setex should have been called with the TTL constant
        mock_r.setex.assert_called_once_with(
            f"tier:{_USER_ID}", _TIER_CACHE_TTL, "paid"
        )


# ── _extract_verified_user (integration) ─────────────────────────────────────

class TestExtractVerifiedUser:
    def setup_method(self):
        auth_svc._jwt_secret = _SECRET
        auth_svc._redis = None
        auth_svc.SUPABASE_URL = "https://example.supabase.co"
        auth_svc.SUPABASE_SERVICE_KEY = "service-key"

    def teardown_method(self):
        auth_svc._jwt_secret = ''
        auth_svc._redis = None
        auth_svc.SUPABASE_URL = ''
        auth_svc.SUPABASE_SERVICE_KEY = ''
        auth_svc._session = None

    def _make_request(self, token=None):
        req = MagicMock()
        req.headers = {"authorization": f"Bearer {token}"} if token else {}
        req.client.host = "1.2.3.4"
        return req

    def test_valid_jwt_returns_user_id(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"plan": "free"}]
        mock_session.get.return_value = mock_resp
        auth_svc._session = mock_session

        token = _make_token()
        uid, tier = _extract_verified_user(self._make_request(token))
        assert uid == _USER_ID
        assert tier == Tier.FREE

    def test_no_token_returns_ip_fallback(self):
        uid, tier = _extract_verified_user(self._make_request())
        assert uid == "ip:1.2.3.4"
        assert tier == Tier.FREE

    def test_expired_jwt_returns_ip_fallback(self):
        uid, tier = _extract_verified_user(self._make_request(_expired_token()))
        assert uid == "ip:1.2.3.4"
        assert tier == Tier.FREE

    def test_no_request_returns_ip_fallback(self):
        uid, tier = _extract_verified_user(None)
        assert uid.startswith("ip:")
        assert tier == Tier.FREE

    def test_pro_user_returns_pro_tier(self):
        mock_session = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = [{"plan": "pro"}]
        mock_session.get.return_value = mock_resp
        auth_svc._session = mock_session

        token = _make_token()
        uid, tier = _extract_verified_user(self._make_request(token))
        assert uid == _USER_ID
        assert tier == Tier.PRO
        assert tier.is_paid is True


# ── Tier enum helpers ─────────────────────────────────────────────────────────

class TestTier:
    def test_from_db_unknown_defaults_to_free(self):
        assert Tier.from_db("enterprise") == Tier.FREE
        assert Tier.from_db("") == Tier.FREE
        assert Tier.from_db("   ") == Tier.FREE

    def test_str_equality(self):
        assert Tier.PRO == "pro"
        assert Tier.FREE == "free"

    def test_is_paid_logic(self):
        assert Tier.PAID.is_paid is True
        assert Tier.PRO.is_paid is True
        assert Tier.ULTRA.is_paid is True
        assert Tier.FREE.is_paid is False
