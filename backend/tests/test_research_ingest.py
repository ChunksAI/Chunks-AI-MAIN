"""
backend/tests/test_research_ingest.py — Tests for POST /api/research/ingest.

All upstream HTTP calls are mocked so the tests run fully offline.
"""
from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ── Helper: build a fake httpx response ──────────────────────────────────────

def _make_httpx_response(text: str = '', status_code: int = 200,
                          content_type: str = 'text/html; charset=utf-8',
                          json_data: dict | None = None) -> MagicMock:
    """Return a MagicMock that behaves like an httpx.Response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    resp.headers = {'content-type': content_type}
    if json_data is not None:
        resp.json.return_value = json_data
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.raise_for_status.side_effect = Exception(f'HTTP {status_code}')
    return resp


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_extract_user(monkeypatch):
    """Bypass authentication for all research ingest tests."""
    monkeypatch.setattr(
        'services.auth._extract_verified_user',
        lambda req: ('user-123', 'pro', False),
    )


# ── Route registration ────────────────────────────────────────────────────────

def test_research_ingest_route_registered(app):
    """POST /api/research/ingest is registered in the FastAPI app."""
    paths = [r.path for r in app.routes]
    assert '/api/research/ingest' in paths


# ── Input validation ──────────────────────────────────────────────────────────

def test_missing_url_returns_400(client, mock_extract_user):
    resp = client.post('/api/research/ingest', json={})
    assert resp.status_code == 400
    assert resp.json()['success'] is False
    assert 'url is required' in resp.json()['error']


def test_invalid_type_returns_400(client, mock_extract_user):
    resp = client.post('/api/research/ingest',
                       json={'url': 'https://arxiv.org/abs/2301.12345', 'type': 'bibtex'})
    assert resp.status_code == 400
    assert resp.json()['success'] is False
    assert 'type must be' in resp.json()['error']


def test_unauthenticated_returns_401(client):
    """Without auth the endpoint must return 401."""
    with patch('services.auth._extract_verified_user',
               side_effect=Exception('no token')):
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://arxiv.org/abs/2301.12345'})
    assert resp.status_code == 401
    assert resp.json()['success'] is False


# ── arXiv ingestion ───────────────────────────────────────────────────────────

_ARXIV_HTML = """
<html>
<body>
<h1 class="title mathjax">Title: Attention Is All You Need</h1>
<div class="authors">
  <a href="/search/?query=Vaswani">Ashish Vaswani</a>,
  <a href="/search/?query=Shazeer">Noam Shazeer</a>
</div>
<blockquote class="abstract mathjax">Abstract: We propose a simple network
architecture, the Transformer, based solely on attention mechanisms.</blockquote>
<div class="dateline">Submitted 12 Jun, 2017</div>
</body>
</html>
"""


def test_arxiv_ingest_success(client, mock_extract_user):
    """POST /api/research/ingest with a valid arXiv URL returns paper metadata."""
    fake_resp = _make_httpx_response(text=_ARXIV_HTML)
    fake_http = AsyncMock()
    fake_http.get = AsyncMock(return_value=fake_resp)

    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://arxiv.org/abs/1706.03762',
                                 'type': 'arxiv'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['type'] == 'arxiv'
    assert data['paper_id'] == '1706.03762'
    assert 'Attention' in data['title']
    assert 'Ashish Vaswani' in data['authors']
    assert data['year'] == 2017
    assert 'Transformer' in data['abstract']
    assert 'arxiv.org/abs/1706.03762' in data['source_url']


def test_arxiv_auto_detected(client, mock_extract_user):
    """type field is optional — arxiv is auto-detected from a recognised URL."""
    fake_resp = _make_httpx_response(text=_ARXIV_HTML)
    fake_http = AsyncMock()
    fake_http.get = AsyncMock(return_value=fake_resp)

    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://arxiv.org/abs/1706.03762'})

    assert resp.status_code == 200
    assert resp.json()['type'] == 'arxiv'


def test_arxiv_invalid_id_returns_400(client, mock_extract_user):
    """Passing type=arxiv with a non-arxiv URL returns 400."""
    fake_http = AsyncMock()
    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://example.com/notarxiv',
                                 'type': 'arxiv'})

    assert resp.status_code == 400
    assert resp.json()['success'] is False


def test_arxiv_upstream_error_returns_422(client, mock_extract_user):
    """When the arXiv HTTP call fails the endpoint returns 422."""
    fake_http = AsyncMock()
    fake_http.get = AsyncMock(side_effect=Exception('connection refused'))

    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://arxiv.org/abs/1706.03762',
                                 'type': 'arxiv'})

    assert resp.status_code == 422
    assert resp.json()['success'] is False


# ── DOI ingestion ─────────────────────────────────────────────────────────────

_CROSSREF_PAYLOAD = {
    'message': {
        'title': ['Deep Residual Learning for Image Recognition'],
        'author': [
            {'given': 'Kaiming', 'family': 'He'},
            {'given': 'Xiangyu', 'family': 'Zhang'},
        ],
        'published': {'date-parts': [[2016]]},
        'abstract': '<jats:p>We present a residual learning framework.</jats:p>',
    }
}


def test_doi_ingest_success(client, mock_extract_user):
    """POST /api/research/ingest with a DOI URL returns CrossRef metadata."""
    fake_resp = _make_httpx_response(
        json_data=_CROSSREF_PAYLOAD, content_type='application/json'
    )
    fake_http = AsyncMock()
    fake_http.get = AsyncMock(return_value=fake_resp)

    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://doi.org/10.1109/CVPR.2016.90',
                                 'type': 'doi'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['type'] == 'doi'
    assert data['paper_id'] == '10.1109/CVPR.2016.90'
    assert 'Residual' in data['title']
    assert 'Kaiming He' in data['authors']
    assert data['year'] == 2016
    assert 'residual' in data['abstract']
    assert data['source_url'] == 'https://doi.org/10.1109/CVPR.2016.90'


def test_doi_auto_detected(client, mock_extract_user):
    """type=doi is auto-detected from a doi.org URL."""
    fake_resp = _make_httpx_response(
        json_data=_CROSSREF_PAYLOAD, content_type='application/json'
    )
    fake_http = AsyncMock()
    fake_http.get = AsyncMock(return_value=fake_resp)

    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://doi.org/10.1109/CVPR.2016.90'})

    assert resp.status_code == 200
    assert resp.json()['type'] == 'doi'


def test_doi_invalid_returns_400(client, mock_extract_user):
    """type=doi with a non-DOI URL returns 400."""
    fake_http = AsyncMock()
    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://example.com/not-a-doi',
                                 'type': 'doi'})

    assert resp.status_code == 400
    assert resp.json()['success'] is False


def test_doi_upstream_error_returns_422(client, mock_extract_user):
    """CrossRef API error propagates as 422."""
    fake_http = AsyncMock()
    fake_http.get = AsyncMock(side_effect=Exception('timeout'))

    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://doi.org/10.1109/CVPR.2016.90',
                                 'type': 'doi'})

    assert resp.status_code == 422
    assert resp.json()['success'] is False


# ── Generic URL ingestion ─────────────────────────────────────────────────────

_GENERIC_HTML = """
<html>
<head><title>Reinforcement Learning: An Introduction</title></head>
<body>
<p>This book provides an introduction to reinforcement learning.</p>
<p>Covers Markov decision processes and dynamic programming.</p>
</body>
</html>
"""


def test_url_ingest_success(client, mock_extract_user):
    """POST /api/research/ingest with type=url returns extracted text."""
    fake_resp = _make_httpx_response(text=_GENERIC_HTML)
    fake_http = AsyncMock()
    fake_http.get = AsyncMock(return_value=fake_resp)

    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://incompleteideas.net/book/the-book.html',
                                 'type': 'url'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['type'] == 'url'
    assert 'Reinforcement Learning' in data['title']
    assert 'reinforcement learning' in data['abstract']
    assert data['authors'] == []
    assert data['year'] is None


def test_url_auto_detected(client, mock_extract_user):
    """Non-arxiv/doi URLs are auto-detected as type=url."""
    fake_resp = _make_httpx_response(text=_GENERIC_HTML)
    fake_http = AsyncMock()
    fake_http.get = AsyncMock(return_value=fake_resp)

    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://example.com/paper'})

    assert resp.status_code == 200
    assert resp.json()['type'] == 'url'


def test_url_upstream_error_returns_422(client, mock_extract_user):
    """HTTP error on generic URL fetch returns 422."""
    fake_http = AsyncMock()
    fake_http.get = AsyncMock(side_effect=Exception('connection error'))

    with patch('routes.research_ingest.ctx') as mock_ctx:
        mock_ctx.async_client = fake_http
        resp = client.post('/api/research/ingest',
                           json={'url': 'https://example.com/paper',
                                 'type': 'url'})

    assert resp.status_code == 422
    assert resp.json()['success'] is False


# ── Unit tests for ID-parsing helpers ────────────────────────────────────────

class TestParseArxivId:
    def _parse(self, url):
        from routes.research_ingest import _parse_arxiv_id
        return _parse_arxiv_id(url)

    def test_abs_url(self):
        assert self._parse('https://arxiv.org/abs/2301.12345') == '2301.12345'

    def test_pdf_url(self):
        assert self._parse('https://arxiv.org/pdf/2301.12345v2') == '2301.12345'

    def test_versioned_stripped(self):
        assert self._parse('https://arxiv.org/abs/1706.03762v5') == '1706.03762'

    def test_bare_id(self):
        assert self._parse('2301.12345') == '2301.12345'

    def test_old_style(self):
        assert self._parse('https://arxiv.org/abs/hep-th/9901001') == 'hep-th/9901001'

    def test_non_arxiv_returns_none(self):
        assert self._parse('https://example.com/paper') is None

    def test_doi_returns_none(self):
        assert self._parse('https://doi.org/10.1109/CVPR.2016.90') is None


class TestParseDoi:
    def _parse(self, url):
        from routes.research_ingest import _parse_doi
        return _parse_doi(url)

    def test_doi_org_url(self):
        assert self._parse('https://doi.org/10.1109/CVPR.2016.90') == '10.1109/CVPR.2016.90'

    def test_dx_doi_org_url(self):
        assert self._parse('https://dx.doi.org/10.1038/nature12345') == '10.1038/nature12345'

    def test_bare_doi(self):
        assert self._parse('10.1109/CVPR.2016.90') == '10.1109/CVPR.2016.90'

    def test_non_doi_returns_none(self):
        assert self._parse('https://example.com/paper') is None

    def test_arxiv_returns_none(self):
        assert self._parse('https://arxiv.org/abs/2301.12345') is None


# ── Unit tests for HTML parsers ───────────────────────────────────────────────

def test_arxiv_html_parser():
    from routes.research_ingest import _ArxivHTMLParser
    parser = _ArxivHTMLParser()
    parser.feed(_ARXIV_HTML)
    assert parser.title == 'Attention Is All You Need'
    assert 'Ashish Vaswani' in parser.authors
    assert 'Noam Shazeer' in parser.authors
    assert 'Transformer' in parser.abstract
    assert parser.year == 2017


def test_generic_html_parser():
    from routes.research_ingest import _GenericHTMLParser
    parser = _GenericHTMLParser()
    parser.feed(_GENERIC_HTML)
    assert parser.title == 'Reinforcement Learning: An Introduction'
    assert any('reinforcement learning' in p.lower() for p in parser.paragraphs)


def test_doi_jats_tag_stripping():
    """CrossRef JATS XML tags are stripped from the abstract."""
    import re
    raw = '<jats:p>Hello <jats:italic>world</jats:italic>.</jats:p>'
    cleaned = re.sub(r'</?[a-zA-Z:][^>]*>', '', raw).strip()
    assert cleaned == 'Hello world.'
