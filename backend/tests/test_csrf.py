"""Tests for CSRF origin validation on state-changing endpoints."""
import pytest
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Fixture — temporarily enable CSRF on the shared test app
# ---------------------------------------------------------------------------

@pytest.fixture
def csrf_client(app, client):
    """Test client with CSRF enforcement turned ON."""
    app.config['WTF_CSRF_ENABLED'] = True
    yield client
    app.config['WTF_CSRF_ENABLED'] = False     # restore for other tests


# ---------------------------------------------------------------------------
# Unit tests — helper functions
# ---------------------------------------------------------------------------

def test_origin_is_allowed_production():
    """Production origins are recognised as trusted."""
    import server
    assert server._origin_is_allowed('https://chunks.online') is True
    assert server._origin_is_allowed('https://www.chunks.online') is True
    assert server._origin_is_allowed('https://chunks-ai.vercel.app') is True


def test_origin_is_allowed_vercel_preview():
    """Vercel preview deployments scoped to the project are trusted."""
    import server
    assert server._origin_is_allowed('https://chunks-ai-abc123.vercel.app') is True


def test_origin_is_allowed_rejects_unknown():
    """Unknown origins must be rejected."""
    import server
    assert server._origin_is_allowed('https://evil-site.example.com') is False
    assert server._origin_is_allowed('https://random-app.vercel.app') is False
    assert server._origin_is_allowed('null') is False


def test_extract_origin_from_referer():
    """Origin extraction from Referer URLs works correctly."""
    import server
    assert server._extract_origin_from_referer(
        'https://chunks.online/some/path?q=1'
    ) == 'https://chunks.online'
    assert server._extract_origin_from_referer(
        'http://localhost:5173/app.html'
    ) == 'http://localhost:5173'
    assert server._extract_origin_from_referer('not-a-url') == ''
    assert server._extract_origin_from_referer('') == ''


# ---------------------------------------------------------------------------
# Integration tests — CSRF blocks POST with bad Origin
# ---------------------------------------------------------------------------

def test_post_with_trusted_origin_allowed(csrf_client):
    """POST from a trusted origin is allowed through CSRF check."""
    resp = csrf_client.post(
        '/ping',
        headers={'Origin': 'https://chunks.online'},
    )
    # /ping is GET-only -> 405 Method Not Allowed, but NOT 403 (CSRF passed)
    assert resp.status_code != 403


def test_post_with_untrusted_origin_blocked(csrf_client):
    """POST from an untrusted origin is blocked with 403."""
    resp = csrf_client.post(
        '/ask',
        headers={'Origin': 'https://evil-site.example.com'},
        json={'question': 'hi'},
    )
    assert resp.status_code == 403
    data = resp.get_json()
    assert data['success'] is False
    assert 'origin not allowed' in data['error'].lower()


def test_post_with_untrusted_referer_blocked(csrf_client):
    """POST with no Origin but untrusted Referer is blocked."""
    resp = csrf_client.post(
        '/ask',
        headers={'Referer': 'https://evil-site.example.com/page'},
        json={'question': 'hi'},
    )
    assert resp.status_code == 403
    data = resp.get_json()
    assert 'origin not allowed' in data['error'].lower()


def test_post_with_trusted_referer_allowed(csrf_client):
    """POST with no Origin but trusted Referer is allowed."""
    resp = csrf_client.post(
        '/ping',
        headers={'Referer': 'https://chunks.online/app.html'},
    )
    # Not 403 -- CSRF check passed
    assert resp.status_code != 403


def test_post_without_origin_or_referer_allowed(csrf_client):
    """POST without Origin or Referer is allowed (non-browser client)."""
    resp = csrf_client.post(
        '/ping',
    )
    assert resp.status_code != 403


def test_get_with_untrusted_origin_not_blocked(csrf_client):
    """GET requests are never blocked by CSRF, even with bad Origin."""
    resp = csrf_client.get(
        '/ping',
        headers={'Origin': 'https://evil-site.example.com'},
    )
    assert resp.status_code != 403


def test_options_with_untrusted_origin_not_blocked(csrf_client):
    """OPTIONS (CORS preflight) is never blocked by CSRF."""
    resp = csrf_client.options(
        '/ask',
        headers={'Origin': 'https://evil-site.example.com'},
    )
    assert resp.status_code != 403


# ---------------------------------------------------------------------------
# Verify CSRF is disabled in the default test fixtures
# ---------------------------------------------------------------------------

def test_default_fixtures_bypass_csrf(client):
    """The standard test client (WTF_CSRF_ENABLED=False) bypasses CSRF."""
    resp = client.post(
        '/ask',
        headers={'Origin': 'https://evil-site.example.com'},
        json={'question': 'test'},
    )
    # Should NOT be 403 — CSRF is disabled in the default test fixtures,
    # so even an evil origin passes through to the route handler.
    assert resp.status_code != 403


# ---------------------------------------------------------------------------
# PATCH and DELETE verbs
# ---------------------------------------------------------------------------

def test_patch_with_untrusted_origin_blocked(csrf_client):
    """PATCH from untrusted origin is blocked."""
    resp = csrf_client.patch(
        '/api/admin/users/test@example.com',
        headers={'Origin': 'https://evil-site.example.com'},
        json={},
    )
    assert resp.status_code == 403


def test_delete_with_untrusted_origin_blocked(csrf_client):
    """DELETE from untrusted origin is blocked."""
    resp = csrf_client.delete(
        '/api/admin/users/test@example.com',
        headers={'Origin': 'https://evil-site.example.com'},
    )
    assert resp.status_code == 403


def test_vercel_preview_origin_passes_csrf(csrf_client):
    """Vercel preview origin matching via regex passes CSRF check."""
    resp = csrf_client.post(
        '/ping',
        headers={'Origin': 'https://chunks-ai-abc123.vercel.app'},
    )
    assert resp.status_code != 403


# ---------------------------------------------------------------------------
# Verify multiple POST endpoints are protected
# ---------------------------------------------------------------------------

def test_csrf_protects_ask_endpoint(csrf_client):
    """CSRF blocks /ask with untrusted Origin."""
    resp = csrf_client.post(
        '/ask',
        headers={'Origin': 'https://malicious.example.com'},
        json={'question': 'hi'},
    )
    assert resp.status_code == 403


def test_csrf_protects_generate_flashcards(csrf_client):
    """CSRF blocks /generate-flashcards with untrusted Origin."""
    resp = csrf_client.post(
        '/generate-flashcards',
        headers={'Origin': 'https://malicious.example.com'},
        json={'topic': 'test'},
    )
    assert resp.status_code == 403


def test_csrf_protects_upload_document(csrf_client):
    """CSRF blocks /upload-document with untrusted Origin."""
    resp = csrf_client.post(
        '/upload-document',
        headers={'Origin': 'https://malicious.example.com'},
    )
    assert resp.status_code == 403


def test_csrf_protects_admin_verify(csrf_client):
    """CSRF blocks /api/admin/verify-access with untrusted Origin."""
    resp = csrf_client.post(
        '/api/admin/verify-access',
        headers={'Origin': 'https://malicious.example.com'},
        json={},
    )
    assert resp.status_code == 403
