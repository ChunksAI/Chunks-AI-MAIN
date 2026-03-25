"""Tests for the health blueprint (/, /ping, /health, /api/config, /api/me/plan)."""
import pytest
from unittest.mock import MagicMock, patch


def test_home(client):
    """GET / returns 200 with API metadata."""
    resp = client.get('/')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['name'] == 'Chunks Chemistry API'
    assert data['status'] == 'running'
    assert 'endpoints' in data


def test_ping(client):
    """GET /ping returns ok status."""
    resp = client.get('/ping')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['status'] == 'ok'
    assert 'model' in data


def test_health(client):
    """GET /health returns healthy status."""
    resp = client.get('/health')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['status'] == 'healthy'
    assert 'books_available' in data


def test_api_config(client):
    """GET /api/config returns supabase config keys."""
    resp = client.get('/api/config')
    assert resp.status_code == 200
    data = resp.get_json()
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
    data = resp.get_json()
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
    data = resp.get_json()
    assert data['success'] is False


def test_api_me_plan_authenticated(client, monkeypatch):
    """GET /api/me/plan with valid auth returns plan info."""
    import services.auth as auth_svc
    from services.auth import Tier
    mock = MagicMock(return_value=('user-123', Tier.FREE))
    monkeypatch.setattr(auth_svc, '_extract_verified_user', mock)

    resp = client.get('/api/me/plan')
    assert resp.status_code == 200
    data = resp.get_json()
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
    mock = MagicMock(return_value=('user-456', Tier.PRO))
    monkeypatch.setattr(auth_svc, '_extract_verified_user', mock)

    resp = client.get('/api/me/plan')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['plan'] == 'pro'
    assert data['limits']['daily_messages'] == -1
