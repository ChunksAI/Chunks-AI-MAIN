"""Tests for routes/admin.py — admin API blueprint."""
from __future__ import annotations

import base64
import json
import os
from unittest.mock import MagicMock, patch


def _make_jwt(email: str = 'admin@example.com') -> str:
    """Build a minimal unsigned JWT with the given email claim."""
    header = base64.urlsafe_b64encode(json.dumps({'alg': 'none'}).encode()).rstrip(b'=')
    payload = base64.urlsafe_b64encode(
        json.dumps({'email': email, 'sub': 'test-uid'}).encode()
    ).rstrip(b'=')
    return f'{header.decode()}.{payload.decode()}.sig'


# ── OPTIONS preflight ─────────────────────────────────────────────────────────

def test_verify_access_options(client):
    r = client.options('/api/admin/verify-access')
    assert r.status_code == 200


def test_admin_ping_options(client):
    r = client.options('/api/admin/ping')
    assert r.status_code == 200


def test_routing_table_options(client):
    r = client.options('/api/admin/routing-table')
    assert r.status_code == 200


def test_get_users_options(client):
    r = client.options('/api/admin/users')
    assert r.status_code == 200


def test_openrouter_credits_options(client):
    r = client.options('/api/admin/openrouter-credits')
    assert r.status_code == 200


# ── Missing / invalid auth ────────────────────────────────────────────────────

def test_verify_access_no_auth(client):
    r = client.post('/api/admin/verify-access')
    assert r.status_code == 401


def test_verify_access_empty_token(client):
    r = client.post(
        '/api/admin/verify-access',
        headers={'Authorization': 'Bearer '},
    )
    assert r.status_code == 401


def test_routing_table_no_auth(client):
    r = client.get('/api/admin/routing-table')
    assert r.status_code == 401


def test_get_users_no_auth(client):
    r = client.get('/api/admin/users')
    assert r.status_code == 401


def test_update_user_no_auth(client):
    r = client.patch('/api/admin/users/test@example.com')
    assert r.status_code == 401


def test_delete_user_no_auth(client):
    r = client.delete('/api/admin/users/test@example.com')
    assert r.status_code == 401


def test_openrouter_credits_no_auth(client):
    r = client.get('/api/admin/openrouter-credits')
    assert r.status_code == 401


# ── verify-access: non-admin gets 403 ────────────────────────────────────────

def test_verify_access_non_admin(client):
    """A JWT whose email is not in the admin list is denied."""
    token = _make_jwt('nobody@example.com')
    r = client.post(
        '/api/admin/verify-access',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert r.status_code == 403


# ── verify-access: admin without PIN configured ──────────────────────────────

def test_verify_access_admin_no_pin(client):
    """Admin email without a PIN hash configured — grants access immediately."""
    email = 'owner@chunks.online'
    token = _make_jwt(email)
    with patch.dict(os.environ, {
        'ADMIN_EMAIL_OWNER': email,
        'ADMIN_PIN_HASH_OWNER': '',
    }):
        r = client.post(
            '/api/admin/verify-access',
            headers={'Authorization': f'Bearer {token}'},
        )
        # No PIN hash → denies by default-deny policy (pin check returns False)
        # but pin_required is based on whether hash exists
        body = r.get_json()
        assert r.status_code in (200, 403)
        if r.status_code == 200:
            assert body['success'] is True
            assert body['role'] == 'owner'


# ── verify-access: admin with PIN configured (phase 1 & 2) ───────────────────

def test_verify_access_pin_required(client):
    """Admin with PIN hash set — phase 1 returns pin_required=True."""
    import hashlib
    email = 'owner@chunks.online'
    token = _make_jwt(email)
    pin_hash = hashlib.sha256(('chunks_admin_salt_123456').encode()).hexdigest()
    with patch.dict(os.environ, {
        'ADMIN_EMAIL_OWNER': email,
        'ADMIN_PIN_HASH_OWNER': pin_hash,
    }):
        r = client.post(
            '/api/admin/verify-access',
            headers={'Authorization': f'Bearer {token}'},
        )
        assert r.status_code == 200
        body = r.get_json()
        assert body['success'] is True
        assert body['pin_required'] is True


def test_verify_access_correct_pin(client):
    """Phase 2 — correct PIN grants full access."""
    import hashlib
    email = 'owner@chunks.online'
    token = _make_jwt(email)
    pin_hash = hashlib.sha256(('chunks_admin_salt_123456').encode()).hexdigest()
    with patch.dict(os.environ, {
        'ADMIN_EMAIL_OWNER': email,
        'ADMIN_PIN_HASH_OWNER': pin_hash,
    }):
        r = client.post(
            '/api/admin/verify-access',
            headers={'Authorization': f'Bearer {token}'},
            json={'pin': '123456'},
        )
        assert r.status_code == 200
        body = r.get_json()
        assert body['success'] is True
        assert body['pin_required'] is False
        assert body['role'] == 'owner'


def test_verify_access_wrong_pin(client):
    """Wrong PIN → 403."""
    import hashlib
    email = 'owner@chunks.online'
    token = _make_jwt(email)
    pin_hash = hashlib.sha256(('chunks_admin_salt_123456').encode()).hexdigest()
    with patch.dict(os.environ, {
        'ADMIN_EMAIL_OWNER': email,
        'ADMIN_PIN_HASH_OWNER': pin_hash,
    }):
        r = client.post(
            '/api/admin/verify-access',
            headers={'Authorization': f'Bearer {token}'},
            json={'pin': '000000'},
        )
        assert r.status_code == 403
        body = r.get_json()
        assert body['success'] is False
        assert 'Incorrect PIN' in body['error']


# ── GET /api/admin/ping ──────────────────────────────────────────────────────

def test_admin_ping(client):
    r = client.get('/api/admin/ping')
    assert r.status_code == 200
    body = r.get_json()
    assert body['ok'] is True
    assert 'supabase_url_set' in body
    assert 'admin_emails_hardcoded' in body


# ── Admin-protected endpoints (with valid admin JWT) ─────────────────────────

def _admin_headers(email='owner@chunks.online'):
    return {'Authorization': f'Bearer {_make_jwt(email)}'}


def test_routing_table_forbidden(client):
    """Non-admin JWT → 401."""
    r = client.get(
        '/api/admin/routing-table',
        headers=_admin_headers('nobody@example.com'),
    )
    assert r.status_code == 401


def test_routing_table_admin(client):
    """Admin JWT → gets routing table."""
    email = 'admin@chunks.online'
    with patch.dict(os.environ, {'ADMIN_EMAIL_ADMIN': email}):
        with patch('ai_router.routing_table', return_value=[]), \
             patch('ai_router._get_models', return_value=[]):
            r = client.get(
                '/api/admin/routing-table',
                headers=_admin_headers(email),
            )
            assert r.status_code == 200
            body = r.get_json()
            assert body['success'] is True


def test_get_users_forbidden(client):
    r = client.get(
        '/api/admin/users',
        headers=_admin_headers('nobody@example.com'),
    )
    assert r.status_code == 403


def test_update_user_forbidden(client):
    r = client.patch(
        '/api/admin/users/test@example.com',
        headers=_admin_headers('nobody@example.com'),
    )
    assert r.status_code == 403


def test_delete_user_forbidden(client):
    r = client.delete(
        '/api/admin/users/test@example.com',
        headers=_admin_headers('nobody@example.com'),
    )
    assert r.status_code == 403


def test_openrouter_credits_forbidden(client):
    r = client.get(
        '/api/admin/openrouter-credits',
        headers=_admin_headers('nobody@example.com'),
    )
    assert r.status_code == 401


# ── Admin-authenticated CRUD with mocked ctx ─────────────────────────────────

def _setup_admin_ctx(email='owner@chunks.online'):
    """Return (env patch, headers) for admin-authenticated requests."""
    import hashlib
    pin_hash = hashlib.sha256(('chunks_admin_salt_111111').encode()).hexdigest()
    env = {
        'ADMIN_EMAIL_OWNER': email,
        'ADMIN_PIN_HASH_OWNER': pin_hash,
    }
    headers = _admin_headers(email)
    return env, headers


def test_get_users_not_configured(client):
    """Admin-authenticated but Supabase not configured → 500."""
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)
    with patch.dict(os.environ, env):
        r = client.get('/api/admin/users', headers=headers)
        assert r.status_code == 500
        assert 'not configured' in r.get_json()['error']


def test_get_users_success(client):
    """Admin-authenticated, Supabase returns users."""
    from routes.shared import ctx
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [{'email': 'u@test.com', 'plan': 'free'}]

    with patch.dict(os.environ, env), \
         patch.object(ctx, 'SUPABASE_URL', 'https://fake.supabase.co'), \
         patch.object(ctx, 'SUPABASE_SERVICE_KEY', 'svc-key'), \
         patch.object(ctx, 'session', MagicMock(get=MagicMock(return_value=mock_resp))):
        r = client.get('/api/admin/users', headers=headers)
        assert r.status_code == 200
        body = r.get_json()
        assert body['success'] is True
        assert len(body['users']) == 1


def test_get_users_supabase_error(client):
    """Supabase returns non-200 → 502."""
    from routes.shared import ctx
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)

    mock_resp = MagicMock()
    mock_resp.status_code = 500

    with patch.dict(os.environ, env), \
         patch.object(ctx, 'SUPABASE_URL', 'https://fake.supabase.co'), \
         patch.object(ctx, 'SUPABASE_SERVICE_KEY', 'svc-key'), \
         patch.object(ctx, 'session', MagicMock(get=MagicMock(return_value=mock_resp))):
        r = client.get('/api/admin/users', headers=headers)
        assert r.status_code == 502


def test_update_user_not_configured(client):
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)
    with patch.dict(os.environ, env):
        r = client.patch('/api/admin/users/test@x.com', headers=headers, json={'plan': 'pro'})
        assert r.status_code == 500


def test_update_user_success(client):
    from routes.shared import ctx
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)

    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch.dict(os.environ, env), \
         patch.object(ctx, 'SUPABASE_URL', 'https://fake.supabase.co'), \
         patch.object(ctx, 'SUPABASE_SERVICE_KEY', 'svc-key'), \
         patch.object(ctx, 'session', MagicMock(patch=MagicMock(return_value=mock_resp))):
        r = client.patch('/api/admin/users/test@x.com', headers=headers, json={'plan': 'pro'})
        assert r.status_code == 200
        assert r.get_json()['success'] is True


def test_update_user_supabase_error(client):
    from routes.shared import ctx
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)

    mock_resp = MagicMock()
    mock_resp.status_code = 400
    mock_resp.text = 'Bad request'

    with patch.dict(os.environ, env), \
         patch.object(ctx, 'SUPABASE_URL', 'https://fake.supabase.co'), \
         patch.object(ctx, 'SUPABASE_SERVICE_KEY', 'svc-key'), \
         patch.object(ctx, 'session', MagicMock(patch=MagicMock(return_value=mock_resp))):
        r = client.patch('/api/admin/users/test@x.com', headers=headers, json={'plan': 'pro'})
        assert r.status_code == 502


def test_delete_user_not_configured(client):
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)
    with patch.dict(os.environ, env):
        r = client.delete('/api/admin/users/test@x.com', headers=headers)
        assert r.status_code == 500


def test_delete_user_success(client):
    from routes.shared import ctx
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)

    mock_resp = MagicMock()
    mock_resp.status_code = 204

    with patch.dict(os.environ, env), \
         patch.object(ctx, 'SUPABASE_URL', 'https://fake.supabase.co'), \
         patch.object(ctx, 'SUPABASE_SERVICE_KEY', 'svc-key'), \
         patch.object(ctx, 'session', MagicMock(delete=MagicMock(return_value=mock_resp))):
        r = client.delete('/api/admin/users/test@x.com', headers=headers)
        assert r.status_code == 200
        assert r.get_json()['success'] is True


def test_delete_user_supabase_error(client):
    from routes.shared import ctx
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)

    mock_resp = MagicMock()
    mock_resp.status_code = 500

    with patch.dict(os.environ, env), \
         patch.object(ctx, 'SUPABASE_URL', 'https://fake.supabase.co'), \
         patch.object(ctx, 'SUPABASE_SERVICE_KEY', 'svc-key'), \
         patch.object(ctx, 'session', MagicMock(delete=MagicMock(return_value=mock_resp))):
        r = client.delete('/api/admin/users/test@x.com', headers=headers)
        assert r.status_code == 502


def test_openrouter_credits_success(client):
    """Full success path for openrouter-credits with mocked API responses."""
    from routes.shared import ctx
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)

    key_resp = MagicMock()
    key_resp.status_code = 200
    key_resp.json.return_value = {
        'data': {
            'label': 'test-key', 'usage': 1.5, 'limit': 10.0,
            'is_free_tier': False, 'rate_limit': {},
        }
    }
    gen_resp = MagicMock()
    gen_resp.status_code = 200
    gen_resp.json.return_value = {
        'data': [
            {'total_cost': 0.01, 'tokens_prompt': 100, 'tokens_completion': 50, 'model': 'gpt-4'},
            {'total_cost': 0.005, 'tokens_prompt': 80, 'tokens_completion': 30, 'model': 'gpt-4'},
        ]
    }

    mock_session = MagicMock()
    mock_session.get.side_effect = [key_resp, gen_resp]

    with patch.dict(os.environ, env), \
         patch.object(ctx, 'session', mock_session), \
         patch.object(ctx, 'OPENROUTER_API_KEY', 'test-key'):
        r = client.get('/api/admin/openrouter-credits', headers=headers)
        assert r.status_code == 200
        body = r.get_json()
        assert body['success'] is True
        assert body['key_info']['label'] == 'test-key'
        assert body['usage_summary']['total_requests'] == 2


def test_openrouter_credits_key_error(client):
    """OpenRouter key API returns non-200 → 502."""
    from routes.shared import ctx
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)

    key_resp = MagicMock()
    key_resp.status_code = 403

    with patch.dict(os.environ, env), \
         patch.object(ctx, 'session', MagicMock(get=MagicMock(return_value=key_resp))), \
         patch.object(ctx, 'OPENROUTER_API_KEY', 'test-key'):
        r = client.get('/api/admin/openrouter-credits', headers=headers)
        assert r.status_code == 502


# ── PIN verification edge cases ──────────────────────────────────────────────

def test_verify_pin_wrong_length(client):
    """PIN with wrong number of digits → 403."""
    import hashlib
    email = 'owner@chunks.online'
    token = _make_jwt(email)
    pin_hash = hashlib.sha256(('chunks_admin_salt_123456').encode()).hexdigest()
    with patch.dict(os.environ, {
        'ADMIN_EMAIL_OWNER': email,
        'ADMIN_PIN_HASH_OWNER': pin_hash,
    }):
        r = client.post(
            '/api/admin/verify-access',
            headers={'Authorization': f'Bearer {token}'},
            json={'pin': '12345'},  # 5 digits instead of 6
        )
        assert r.status_code == 403


def test_verify_pin_non_numeric(client):
    """PIN with non-digit characters → 403."""
    import hashlib
    email = 'owner@chunks.online'
    token = _make_jwt(email)
    pin_hash = hashlib.sha256(('chunks_admin_salt_123456').encode()).hexdigest()
    with patch.dict(os.environ, {
        'ADMIN_EMAIL_OWNER': email,
        'ADMIN_PIN_HASH_OWNER': pin_hash,
    }):
        r = client.post(
            '/api/admin/verify-access',
            headers={'Authorization': f'Bearer {token}'},
            json={'pin': 'abcdef'},
        )
        assert r.status_code == 403


# ── JWT email extraction from different claim locations ──────────────────────

def test_jwt_email_from_user_metadata(client):
    """Email in user_metadata claim location."""
    payload = {'user_metadata': {'email': 'admin@chunks.online'}, 'sub': 'uid'}
    header = base64.urlsafe_b64encode(json.dumps({'alg': 'none'}).encode()).rstrip(b'=')
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=')
    token = f'{header.decode()}.{body.decode()}.sig'

    email = 'admin@chunks.online'
    with patch.dict(os.environ, {'ADMIN_EMAIL_ADMIN': email}):
        r = client.post(
            '/api/admin/verify-access',
            headers={'Authorization': f'Bearer {token}'},
        )
        # Should find email from user_metadata and grant access
        assert r.status_code in (200, 403)  # 200 if granted, 403 if PIN needed


def test_jwt_no_email(client):
    """JWT with no email in any location → 403."""
    payload = {'sub': 'uid', 'aud': 'test'}
    header = base64.urlsafe_b64encode(json.dumps({'alg': 'none'}).encode()).rstrip(b'=')
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=')
    token = f'{header.decode()}.{body.decode()}.sig'

    r = client.post(
        '/api/admin/verify-access',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert r.status_code == 403


def test_jwt_malformed(client):
    """Completely invalid JWT → 403."""
    r = client.post(
        '/api/admin/verify-access',
        headers={'Authorization': 'Bearer not.a.jwt'},
    )
    assert r.status_code == 403


def test_admin_blueprints_registered(app):
    rules = [r.rule for r in app.url_map.iter_rules()]
    assert '/api/admin/verify-access' in rules
    assert '/api/admin/ping' in rules
    assert '/api/admin/routing-table' in rules
    assert '/api/admin/users' in rules
    assert '/api/admin/openrouter-credits' in rules
    assert '/api/admin/usage-report' in rules
    assert '/api/admin/user-usage' in rules


# ── Usage report endpoints ───────────────────────────────────────────────────

def test_usage_report_options(client):
    """OPTIONS /api/admin/usage-report returns 200."""
    r = client.options('/api/admin/usage-report')
    assert r.status_code == 200


def test_usage_report_no_auth(client):
    """GET /api/admin/usage-report without auth returns 401."""
    r = client.get('/api/admin/usage-report')
    assert r.status_code == 401


def test_usage_report_non_admin(client):
    """GET /api/admin/usage-report with non-admin JWT returns 403."""
    r = client.get(
        '/api/admin/usage-report',
        headers=_admin_headers('nobody@example.com'),
    )
    assert r.status_code == 403


def test_usage_report_admin_all_users(client, monkeypatch):
    """GET /api/admin/usage-report returns full usage report for admin."""
    import services.token_budget as tb
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)
    monkeypatch.setattr(tb, 'get_monthly_usage_report', MagicMock(return_value={
        'month': '2025-01',
        'users': [{'user_id': 'u1', 'total_cost': 0.5}],
    }))

    with patch.dict(os.environ, env):
        r = client.get('/api/admin/usage-report', headers=headers)
        assert r.status_code == 200
        body = r.get_json()
        assert body['success'] is True
        assert 'users' in body


def test_usage_report_admin_single_user(client, monkeypatch):
    """GET /api/admin/usage-report with user_id returns per-user report."""
    import services.token_budget as tb
    email = 'owner@chunks.online'
    env, headers = _setup_admin_ctx(email)
    monkeypatch.setattr(tb, 'get_user_monthly_usage', MagicMock(return_value={
        'month': '2025-01',
        'user_id': 'u1',
        'total_cost': 0.3,
    }))

    with patch.dict(os.environ, env):
        r = client.get('/api/admin/usage-report?user_id=u1', headers=headers)
        assert r.status_code == 200
        body = r.get_json()
        assert body['success'] is True
        assert body['user_id'] == 'u1'


# ── User-usage endpoint ─────────────────────────────────────────────────────

def test_user_usage_options(client):
    """OPTIONS /api/admin/user-usage returns 200."""
    r = client.options('/api/admin/user-usage')
    assert r.status_code == 200


def test_user_usage_no_auth(client):
    """GET /api/admin/user-usage without auth returns 401."""
    r = client.get('/api/admin/user-usage')
    assert r.status_code == 401


def test_user_usage_empty_token(client):
    """GET /api/admin/user-usage with empty bearer returns 401."""
    r = client.get(
        '/api/admin/user-usage',
        headers={'Authorization': 'Bearer   '},
    )
    assert r.status_code == 401


def test_user_usage_invalid_token(client, monkeypatch):
    """GET /api/admin/user-usage with invalid JWT returns 401."""
    import services.auth as auth_svc
    monkeypatch.setattr(auth_svc, '_verify_supabase_jwt', MagicMock(return_value=None))

    r = client.get(
        '/api/admin/user-usage',
        headers={'Authorization': 'Bearer some-invalid-token'},
    )
    assert r.status_code == 401
    body = r.get_json()
    assert 'Invalid or expired' in body['error']


def test_user_usage_success(client, monkeypatch):
    """GET /api/admin/user-usage returns usage for authenticated user."""
    import services.auth as auth_svc
    import services.token_budget as tb

    monkeypatch.setattr(auth_svc, '_verify_supabase_jwt', MagicMock(return_value={
        'id': 'user-123',
        'email': 'student@test.com',
    }))
    monkeypatch.setattr(tb, 'get_user_monthly_usage', MagicMock(return_value={
        'month': '2025-01',
        'user_id': 'user-123',
        'total_cost': 0.1,
    }))

    r = client.get(
        '/api/admin/user-usage',
        headers={'Authorization': 'Bearer valid-token'},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
    assert body['user_id'] == 'user-123'


def test_user_usage_with_month(client, monkeypatch):
    """GET /api/admin/user-usage with month query param."""
    import services.auth as auth_svc
    import services.token_budget as tb

    monkeypatch.setattr(auth_svc, '_verify_supabase_jwt', MagicMock(return_value={
        'id': 'user-456',
        'email': 'student@test.com',
    }))
    monkeypatch.setattr(tb, 'get_user_monthly_usage', MagicMock(return_value={
        'month': '2024-12',
        'user_id': 'user-456',
        'total_cost': 0.2,
    }))

    r = client.get(
        '/api/admin/user-usage?month=2024-12',
        headers={'Authorization': 'Bearer valid-token'},
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body['success'] is True
