"""Tests for the health blueprint (/, /ping, /health, /api/config)."""
import pytest


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
