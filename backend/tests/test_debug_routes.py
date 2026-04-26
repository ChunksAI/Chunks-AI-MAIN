"""Tests for the env-gated GET /api/debug/routes diagnostic endpoint."""
import json


def test_debug_routes_disabled_by_default(client):
    """When DEBUG_ROUTES is unset, the endpoint must look like an unmapped path."""
    resp = client.get('/api/debug/routes')
    assert resp.status_code == 404
    body = resp.json()
    # Indistinguishable from any other 404 — same envelope as the global handler.
    assert body == {'success': False, 'error': 'Endpoint not found.'}


def test_debug_routes_enabled_lists_canonical_paths(client, monkeypatch):
    """When DEBUG_ROUTES=true, the endpoint must return the live route table.

    Critical assertion: both the prefixed (/api/listen/page, /api/ask) and the
    legacy un-prefixed (/listen/page, /ask) routes are present so we can prove
    on the deployed Railway binary whether the canonical paths exist.
    """
    monkeypatch.setenv('DEBUG_ROUTES', 'true')
    resp = client.get('/api/debug/routes')
    assert resp.status_code == 200
    data = resp.json()
    assert 'count' in data and 'routes' in data
    assert isinstance(data['routes'], list)
    assert data['count'] == len(data['routes'])

    # Build a path → methods map for assertions.
    path_to_methods = {r['path']: set(r['methods']) for r in data['routes']}

    # Canonical Listen + Ask + stream paths must be present.
    assert 'POST' in path_to_methods.get('/api/listen/page', set())
    assert 'POST' in path_to_methods.get('/listen/page', set())
    assert 'POST' in path_to_methods.get('/api/ask', set())
    assert 'POST' in path_to_methods.get('/ask', set())
    assert 'POST' in path_to_methods.get('/api/ask/cancel', set())
    assert 'GET'  in path_to_methods.get('/api/stream/{stream_id}', set())


def test_debug_routes_does_not_leak_secrets(client, monkeypatch):
    """The response body must not contain env vars, secrets, or PII fields."""
    monkeypatch.setenv('DEBUG_ROUTES', 'true')
    monkeypatch.setenv('SUPABASE_SERVICE_KEY', 'super-secret-test-value-DO-NOT-LEAK')
    monkeypatch.setenv('OPENROUTER_API_KEY', 'sk-or-DO-NOT-LEAK')
    resp = client.get('/api/debug/routes')
    assert resp.status_code == 200
    raw = json.dumps(resp.json())
    assert 'super-secret-test-value-DO-NOT-LEAK' not in raw
    assert 'sk-or-DO-NOT-LEAK' not in raw
    # Each route entry is restricted to {path, methods, name}.
    for r in resp.json()['routes']:
        assert set(r.keys()) <= {'path', 'methods', 'name'}


def test_debug_routes_disabled_when_value_is_not_true(client, monkeypatch):
    """Only the literal string 'true' (case-insensitive) enables the endpoint."""
    monkeypatch.setenv('DEBUG_ROUTES', '1')  # truthy in many contexts, but not 'true'
    resp = client.get('/api/debug/routes')
    assert resp.status_code == 404

    monkeypatch.setenv('DEBUG_ROUTES', 'TRUE')
    resp = client.get('/api/debug/routes')
    assert resp.status_code == 200
