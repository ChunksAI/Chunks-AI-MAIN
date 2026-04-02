"""Tests for CORS origin restrictions."""
import pytest


def test_cors_origins_is_not_wildcard():
    """CORS_ORIGINS must never be the string '*'."""
    import server
    assert server.CORS_ORIGINS != '*'
    assert isinstance(server.CORS_ORIGINS, list)


def test_production_origins_always_present():
    """Production domains must always be in the allowed list."""
    import server
    str_origins = [o for o in server.CORS_ORIGINS if isinstance(o, str)]
    assert 'https://chunks.online' in str_origins
    assert 'https://www.chunks.online' in str_origins
    assert 'https://chunks-ai.vercel.app' in str_origins


def test_null_origin_not_allowed():
    """The 'null' origin must never appear in the allowed list."""
    import server
    str_origins = [o for o in server.CORS_ORIGINS if isinstance(o, str)]
    assert 'null' not in str_origins


def test_vercel_regex_scoped_to_project():
    """The Vercel regex must match only chunks-ai* deployments."""
    import re, server
    # In FastAPI the regex is a string passed to allow_origin_regex
    assert hasattr(server, '_VERCEL_ORIGIN_REGEX')
    pat = re.compile(server._VERCEL_ORIGIN_REGEX)
    # Should match project preview deployments
    assert pat.match('https://chunks-ai.vercel.app')
    assert pat.match('https://chunks-ai-abc123.vercel.app')
    assert pat.match('https://chunks-ai-team-preview.vercel.app')
    # Should NOT match arbitrary Vercel apps
    assert not pat.match('https://evil-site.vercel.app')
    assert not pat.match('https://other-project.vercel.app')
    assert not pat.match('https://malicious.vercel.app')
    # Should NOT match invalid subdomains with trailing/double hyphens
    assert not pat.match('https://chunks-ai-.vercel.app')
    assert not pat.match('https://chunks-ai--.vercel.app')


def test_dev_mode_includes_localhost(client):
    """In dev mode (PRODUCTION unset), localhost origins are allowed."""
    import server
    str_origins = [o for o in server.CORS_ORIGINS if isinstance(o, str)]
    assert 'http://localhost:5173' in str_origins


def test_production_excludes_localhost():
    """Verify that production and dev origin lists are disjoint."""
    import server
    # In production mode _DEV_ORIGINS are not added to the allowed list.
    # Verify the lists are properly separated so the conditional works.
    prod_set = set(server._PRODUCTION_ORIGINS)
    dev_set = set(server._DEV_ORIGINS)
    assert prod_set.isdisjoint(dev_set), (
        "Production and development origin lists must not overlap"
    )
    # localhost should never be a production origin
    for origin in server._PRODUCTION_ORIGINS:
        assert 'localhost' not in origin
        assert '127.0.0.1' not in origin


def test_allowed_origin_gets_cors_header(client):
    """Requests from an allowed origin receive CORS headers."""
    resp = client.get('/ping', headers={'Origin': 'https://chunks.online'})
    assert resp.headers.get('Access-Control-Allow-Origin') == 'https://chunks.online'


def test_disallowed_origin_no_cors_header(client):
    """Requests from a disallowed origin must NOT receive CORS headers."""
    resp = client.get('/ping', headers={'Origin': 'https://evil-site.example.com'})
    assert resp.headers.get('Access-Control-Allow-Origin') is None


def test_wildcard_never_returned(client):
    """The Access-Control-Allow-Origin header must never be '*'."""
    resp = client.get('/ping', headers={'Origin': 'https://chunks.online'})
    assert resp.headers.get('Access-Control-Allow-Origin') != '*'
    # Even without an Origin header
    resp2 = client.get('/ping')
    assert resp2.headers.get('Access-Control-Allow-Origin') != '*'


def test_vercel_preview_origin_allowed(client):
    """Vercel preview deployment origins for this project are allowed."""
    origin = 'https://chunks-ai-abc123.vercel.app'
    resp = client.get('/ping', headers={'Origin': origin})
    assert resp.headers.get('Access-Control-Allow-Origin') == origin


def test_arbitrary_vercel_origin_rejected(client):
    """Arbitrary Vercel app origins are rejected."""
    origin = 'https://random-app.vercel.app'
    resp = client.get('/ping', headers={'Origin': origin})
    assert resp.headers.get('Access-Control-Allow-Origin') is None
