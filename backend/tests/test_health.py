"""Tests for the health blueprint (/, /ping, /health, /api/config, /api/me/plan)."""
import pytest
from unittest.mock import MagicMock, patch


def test_home(client):
    """GET / returns 200 with API metadata."""
    resp = client.get('/')
    assert resp.status_code == 200
    data = resp.json()
    assert data['name'] == 'Chunks Chemistry API'
    assert data['status'] == 'running'
    assert 'endpoints' in data


def test_ping(client):
    """GET /ping returns ok status."""
    resp = client.get('/ping')
    assert resp.status_code == 200
    data = resp.json()
    assert data['status'] == 'ok'
    assert 'model' in data


def test_health(client):
    """GET /health returns healthy status."""
    resp = client.get('/health')
    assert resp.status_code == 200
    data = resp.json()
    assert data['status'] == 'healthy'
    assert 'books_available' in data


def test_api_config(client):
    """GET /api/config returns supabase config keys."""
    resp = client.get('/api/config')
    assert resp.status_code == 200
    data = resp.json()
    assert 'supabaseUrl' in data
    assert 'supabaseAnonKey' in data


def test_api_config_options(client):
    """OPTIONS /api/config returns 200 (CORS preflight)."""
    resp = client.options('/api/config')
    # OPTIONS on an endpoint with explicit GET allowed returns 200
    assert resp.status_code in (200, 204)


def test_api_plan_limits(client):
    """GET /api/plan-limits returns plan limits for all tiers."""
    resp = client.get('/api/plan-limits')
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'free' in data['plans']
    assert 'pro' in data['plans']
    assert 'ultra' in data['plans']
    # Verify storage_mb is present
    assert 'storage_mb' in data['plans']['free']


def test_api_me_plan_unauthenticated(client, mock_extract_user):
    """GET /api/me/plan without auth returns 401."""
    # mock_extract_user returns ip:127.0.0.1 (guest) by default
    resp = client.get('/api/me/plan')
    assert resp.status_code == 401
    data = resp.json()
    assert data['success'] is False


def test_api_me_plan_authenticated(client, monkeypatch):
    """GET /api/me/plan with valid auth returns plan info."""
    import services.auth as auth_svc
    from services.auth import Tier
    mock = MagicMock(return_value=('user-123', Tier.FREE, False))
    monkeypatch.setattr(auth_svc, '_extract_verified_user', mock)

    resp = client.get('/api/me/plan')
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['plan'] == 'free'
    assert 'limits' in data
    assert 'usage' in data
    assert 'daily_messages' in data['limits']
    assert 'storage_mb' in data['limits']


def test_api_me_plan_pro_user(client, monkeypatch):
    """GET /api/me/plan for pro user returns pro limits."""
    import services.auth as auth_svc
    from services.auth import Tier
    mock = MagicMock(return_value=('user-456', Tier.PRO, False))
    monkeypatch.setattr(auth_svc, '_extract_verified_user', mock)

    resp = client.get('/api/me/plan')
    assert resp.status_code == 200
    data = resp.json()
    assert data['plan'] == 'pro'
    assert data['limits']['daily_messages'] == -1


# ── POST /api/verify-access ───────────────────────────────────────────────────

def test_api_verify_access_unauthenticated(client, mock_extract_user):
    """POST /api/verify-access without auth returns 401.

    mock_extract_user patches _extract_verified_user to return an IP-based
    (unauthenticated) user — the endpoint checks for the 'ip:' prefix and
    returns 401.
    """
    resp = client.post('/api/verify-access')
    assert resp.status_code == 401
    data = resp.json()
    assert data['success'] is False


def test_api_verify_access_free_user(client, monkeypatch):
    """POST /api/verify-access for a free user returns correct tier and flags."""
    import services.auth as auth_svc
    from services.auth import Tier
    monkeypatch.setattr(auth_svc, '_extract_verified_user',
                        MagicMock(return_value=('user-123', Tier.FREE, False)))
    monkeypatch.setattr(auth_svc, '_get_user_info_from_db',
                        MagicMock(return_value=(Tier.FREE, '')))

    resp = client.post('/api/verify-access')
    assert resp.status_code == 200
    data = resp.json()
    assert data['tier'] == 'free'
    assert data['is_admin'] is False
    assert data['is_owner'] is False
    assert data['role'] == ''


def test_api_verify_access_pro_user(client, monkeypatch):
    """POST /api/verify-access for a pro user returns pro tier."""
    import services.auth as auth_svc
    from services.auth import Tier
    monkeypatch.setattr(auth_svc, '_extract_verified_user',
                        MagicMock(return_value=('user-456', Tier.PRO, False)))
    monkeypatch.setattr(auth_svc, '_get_user_info_from_db',
                        MagicMock(return_value=(Tier.PRO, '')))

    resp = client.post('/api/verify-access')
    assert resp.status_code == 200
    data = resp.json()
    assert data['tier'] == 'pro'
    assert data['is_admin'] is False
    assert data['is_owner'] is False


def test_api_verify_access_admin_user(client, monkeypatch):
    """POST /api/verify-access for an admin user returns is_admin=True."""
    import services.auth as auth_svc
    from services.auth import Tier
    monkeypatch.setattr(auth_svc, '_extract_verified_user',
                        MagicMock(return_value=('user-789', Tier.PRO, True)))
    monkeypatch.setattr(auth_svc, '_get_user_info_from_db',
                        MagicMock(return_value=(Tier.PRO, 'admin')))

    resp = client.post('/api/verify-access')
    assert resp.status_code == 200
    data = resp.json()
    assert data['is_admin'] is True
    assert data['is_owner'] is False
    assert data['role'] == 'admin'


def test_api_verify_access_owner_user(client, monkeypatch):
    """POST /api/verify-access for an owner returns is_admin=True and is_owner=True."""
    import services.auth as auth_svc
    from services.auth import Tier
    monkeypatch.setattr(auth_svc, '_extract_verified_user',
                        MagicMock(return_value=('user-999', Tier.PRO, True)))
    monkeypatch.setattr(auth_svc, '_get_user_info_from_db',
                        MagicMock(return_value=(Tier.PRO, 'owner')))

    resp = client.post('/api/verify-access')
    assert resp.status_code == 200
    data = resp.json()
    assert data['is_admin'] is True
    assert data['is_owner'] is True
    assert data['role'] == 'owner'


# ── GET /ready (readiness probe, lines 75-104) ────────────────────────────────

def test_ready_all_healthy(client, monkeypatch):
    """GET /ready returns 200 when Redis and Supabase are both reachable."""
    import routes.shared as shared_mod
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    monkeypatch.setattr(shared_mod.ctx, 'redis', mock_redis)

    with patch('routes.health._requests') as mock_req:
        mock_req.get.return_value = MagicMock(ok=True)
        resp = client.get('/ready')

    assert resp.status_code == 200
    data = resp.json()
    assert data['status'] == 'ready'
    assert data['checks']['redis'] == 'ok'
    assert data['checks']['supabase'] == 'ok'


def test_ready_redis_error(client, monkeypatch):
    """GET /ready returns 503 when Redis ping fails."""
    import routes.shared as shared_mod
    mock_redis = MagicMock()
    mock_redis.ping.side_effect = Exception("Connection refused")
    monkeypatch.setattr(shared_mod.ctx, 'redis', mock_redis)

    with patch('routes.health._requests') as mock_req:
        mock_req.get.return_value = MagicMock(ok=True)
        resp = client.get('/ready')

    assert resp.status_code == 503
    data = resp.json()
    assert data['status'] == 'degraded'
    assert 'error' in data['checks']['redis']


def test_ready_redis_not_configured(client, monkeypatch):
    """GET /ready treats Redis=None as non-blocking; returns ready if Supabase is ok."""
    import routes.shared as shared_mod
    monkeypatch.setattr(shared_mod.ctx, 'redis', None)

    with patch('routes.health._requests') as mock_req:
        mock_req.get.return_value = MagicMock(ok=True)
        resp = client.get('/ready')

    assert resp.status_code == 200
    data = resp.json()
    assert data['checks']['redis'] == 'not configured'
    assert data['checks']['supabase'] == 'ok'


def test_ready_supabase_error(client, monkeypatch):
    """GET /ready returns 503 when Supabase health check raises an exception."""
    import routes.shared as shared_mod
    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    monkeypatch.setattr(shared_mod.ctx, 'redis', mock_redis)

    with patch('routes.health._requests') as mock_req:
        mock_req.get.side_effect = Exception("Supabase unreachable")
        resp = client.get('/ready')

    assert resp.status_code == 503
    data = resp.json()
    assert data['status'] == 'degraded'
    assert 'error' in data['checks']['supabase']


# ── Limiter helpers (lines 22, 27-29) ────────────────────────────────────────

def test_is_rate_limit_disabled_during_pytest():
    """_is_rate_limit_disabled returns True when PYTEST_CURRENT_TEST is set (line 22)."""
    from routes.limiter import _is_rate_limit_disabled
    # PYTEST_CURRENT_TEST is always present while pytest is running
    assert _is_rate_limit_disabled() is True


def test_rate_limit_key_options_exempt():
    """_rate_limit_key returns the exempt key for OPTIONS requests (line 27-28)."""
    from routes.limiter import _rate_limit_key
    req = MagicMock()
    req.method = "OPTIONS"
    assert _rate_limit_key(req) == "options-preflight-exempt"


def test_rate_limit_key_returns_remote_address():
    """_rate_limit_key delegates to get_remote_address for non-OPTIONS requests (line 29)."""
    from routes.limiter import _rate_limit_key
    req = MagicMock()
    req.method = "POST"
    req.client = MagicMock()
    req.client.host = "1.2.3.4"
    result = _rate_limit_key(req)
    assert result == "1.2.3.4"
