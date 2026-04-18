"""
backend/routes/research_ingest.py — Research paper ingestion endpoint.

Endpoints
---------
POST /api/research/ingest
    Accepts a URL and a type hint ('doi'|'arxiv'|'url'), fetches the paper
    metadata from the appropriate upstream source, and returns a normalised
    record that the frontend can store and pass as viewer_state.

Supported sources
-----------------
arxiv  — Parses the arXiv ID from the URL, fetches the abstract page at
         https://export.arxiv.org/abs/{id} and HTML-parses title, authors,
         year, and abstract using the stdlib html.parser.  No third-party
         HTML library is required.

doi    — Calls the free CrossRef REST API at
         https://api.crossref.org/works/{doi} (no API key) to obtain title,
         authors, publication year, and abstract where available.

url    — Fetches the page with httpx and extracts the <title> and body text
         from <p> elements as a best-effort fallback for generic web pages.
"""
from __future__ import annotations

import logging
import re
from html.parser import HTMLParser
from typing import Any
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, Request, Body
from fastapi.responses import JSONResponse

from routes.limiter import limiter
from routes.shared import ctx

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/api/research')

# Maximum characters of body text returned for generic URL ingestion
_MAX_BODY_CHARS = 8_000

# ── arXiv ID patterns ─────────────────────────────────────────────────────────
# Matches both old-style (hep-th/9901001) and new-style (2301.12345, 2301.12345v2)
_ARXIV_ID_RE = re.compile(
    r'(?:arxiv\.org/(?:abs|pdf|html)/|arxiv:)'
    r'([a-zA-Z0-9.-]+/\d{7}|\d{4}\.\d{4,5}(?:v\d+)?)',
    re.IGNORECASE,
)
# Bare ID (no URL prefix) — e.g. "2301.12345" or "2301.12345v2"
_ARXIV_BARE_ID_RE = re.compile(
    r'^([a-zA-Z0-9.-]+/\d{7}|\d{4}\.\d{4,5}(?:v\d+)?)$'
)

# ── DOI patterns ──────────────────────────────────────────────────────────────
# Handles doi.org/10.…, https://doi.org/10.…, or a bare DOI string
_DOI_RE = re.compile(
    r'(?:https?://(?:dx\.)?doi\.org/|^)(10\.\d{4,9}/\S+)',
    re.IGNORECASE,
)


# ── HTML parsers (stdlib html.parser) ────────────────────────────────────────

class _ArxivHTMLParser(HTMLParser):
    """Extract title, authors, year, and abstract from export.arxiv.org/abs/."""

    def __init__(self) -> None:
        super().__init__()
        self.title: str = ''
        self.authors: list[str] = []
        self.abstract: str = ''
        self.year: int | None = None

        # Internal state
        self._in_title = False
        self._in_authors = False
        self._in_author_span = False
        self._in_abstract = False
        self._in_dateline = False
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        # Split each class attribute value so "title mathjax" → {'title', 'mathjax'}
        classes: set[str] = set()
        for k, v in attrs:
            if k == 'class' and v:
                classes.update(v.split())

        if tag == 'h1' and 'title' in classes:
            self._in_title = True
            self._buf = []
        elif tag == 'div' and 'authors' in classes:
            self._in_authors = True
        elif tag == 'a' and self._in_authors:
            self._in_author_span = True
            self._buf = []
        elif tag == 'blockquote' and 'abstract' in classes:
            self._in_abstract = True
            self._buf = []
        elif tag == 'div' and 'dateline' in classes:
            self._in_dateline = True
            self._buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag == 'h1' and self._in_title:
            self._in_title = False
            raw = ''.join(self._buf).strip()
            # Strip leading "Title:" prefix that arxiv sometimes includes
            self.title = re.sub(r'^Title:\s*', '', raw, flags=re.IGNORECASE).strip()
            self._buf = []
        elif tag == 'div' and self._in_authors:
            self._in_authors = False
        elif tag == 'a' and self._in_author_span:
            self._in_author_span = False
            name = ''.join(self._buf).strip()
            if name:
                self.authors.append(name)
            self._buf = []
        elif tag == 'blockquote' and self._in_abstract:
            self._in_abstract = False
            raw = ''.join(self._buf).strip()
            # Strip "Abstract:" prefix
            self.abstract = re.sub(r'^Abstract:\s*', '', raw, flags=re.IGNORECASE).strip()
            self._buf = []
        elif tag == 'div' and self._in_dateline:
            self._in_dateline = False
            text = ''.join(self._buf).strip()
            m = re.search(r'\b(19|20)\d{2}\b', text)
            if m:
                self.year = int(m.group())
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._in_title or self._in_author_span or self._in_abstract or self._in_dateline:
            self._buf.append(data)


class _GenericHTMLParser(HTMLParser):
    """Extract <title> and visible body text from arbitrary HTML pages."""

    def __init__(self) -> None:
        super().__init__()
        self.title: str = ''
        self.paragraphs: list[str] = []

        self._in_title = False
        self._in_p = False
        self._in_script_or_style = False
        self._buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == 'title':
            self._in_title = True
            self._buf = []
        elif tag == 'p':
            self._in_p = True
            self._buf = []
        elif tag in ('script', 'style'):
            self._in_script_or_style = True

    def handle_endtag(self, tag: str) -> None:
        if tag == 'title' and self._in_title:
            self._in_title = False
            self.title = ''.join(self._buf).strip()
            self._buf = []
        elif tag == 'p' and self._in_p:
            self._in_p = False
            text = ''.join(self._buf).strip()
            if text:
                self.paragraphs.append(text)
            self._buf = []
        elif tag in ('script', 'style'):
            self._in_script_or_style = False

    def handle_data(self, data: str) -> None:
        if self._in_script_or_style:
            return
        if self._in_title or self._in_p:
            self._buf.append(data)


# ── ID extraction helpers ─────────────────────────────────────────────────────

def _parse_arxiv_id(url: str) -> str | None:
    """Return a normalised arXiv ID (without version suffix) or None."""
    m = _ARXIV_ID_RE.search(url)
    if not m:
        # Try bare ID
        m = _ARXIV_BARE_ID_RE.match(url.strip())
    if m:
        # Strip version suffix (v1, v2, …) for the canonical ID
        raw_id = m.group(1)
        return re.sub(r'v\d+$', '', raw_id)
    return None


def _parse_doi(url: str) -> str | None:
    """Return the DOI string (without scheme) or None."""
    m = _DOI_RE.search(url)
    if m:
        return unquote(m.group(1).rstrip('.'))
    return None


# ── Per-source fetch functions ────────────────────────────────────────────────

async def _ingest_arxiv(arxiv_id: str, http: Any) -> dict:
    """Fetch metadata from the arXiv abstract page and return a paper record."""
    abs_url = f'https://export.arxiv.org/abs/{arxiv_id}'
    try:
        resp = await http.get(abs_url, timeout=15, follow_redirects=True,
                               headers={'User-Agent': 'ChunksAI/1.0 (research ingest)'})
        resp.raise_for_status()
    except Exception as exc:
        raise ValueError(f'Could not fetch arXiv page for {arxiv_id}: {exc}') from exc

    parser = _ArxivHTMLParser()
    parser.feed(resp.text)

    # Derive year from the arXiv ID when the dateline couldn't be parsed
    if parser.year is None:
        yr_match = re.match(r'(\d{2})(\d{2})\.\d+', arxiv_id)
        if yr_match:
            prefix = int(yr_match.group(1))
            parser.year = 2000 + prefix if prefix < 90 else 1900 + prefix

    return {
        'paper_id':   arxiv_id,
        'type':       'arxiv',
        'title':      parser.title or f'arXiv:{arxiv_id}',
        'authors':    parser.authors,
        'year':       parser.year,
        'abstract':   parser.abstract,
        'source_url': abs_url,
    }


async def _ingest_doi(doi: str, http: Any) -> dict:
    """Fetch metadata from the CrossRef REST API and return a paper record."""
    api_url = f'https://api.crossref.org/works/{doi}'
    try:
        resp = await http.get(
            api_url, timeout=15, follow_redirects=True,
            headers={
                'User-Agent': 'ChunksAI/1.0 (mailto:hi@chunks.online)',
                'Accept': 'application/json',
            },
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        raise ValueError(f'Could not fetch CrossRef record for DOI {doi}: {exc}') from exc

    msg: dict = data.get('message', {})

    # Title — CrossRef returns a list; take the first element
    titles = msg.get('title') or []
    title = titles[0] if titles else doi

    # Authors
    authors: list[str] = []
    for a in msg.get('author') or []:
        given = a.get('given', '')
        family = a.get('family', '')
        name = f'{given} {family}'.strip() if given or family else a.get('name', '')
        if name:
            authors.append(name)

    # Year — prefer 'published', fall back to 'created'
    year: int | None = None
    for date_key in ('published', 'published-print', 'published-online', 'created'):
        date_parts = (msg.get(date_key) or {}).get('date-parts')
        if date_parts and date_parts[0]:
            try:
                year = int(date_parts[0][0])
                break
            except (TypeError, ValueError, IndexError):
                continue

    # Abstract — present for some publishers; may contain JATS XML tags
    abstract_raw: str = msg.get('abstract', '')
    # Strip simple JATS XML tags (e.g. <jats:p>) that CrossRef sometimes includes
    abstract = re.sub(r'</?[a-zA-Z:][^>]*>', '', abstract_raw).strip()

    source_url = f'https://doi.org/{doi}'

    return {
        'paper_id':   doi,
        'type':       'doi',
        'title':      title,
        'authors':    authors,
        'year':       year,
        'abstract':   abstract,
        'source_url': source_url,
    }


async def _ingest_url(url: str, http: Any) -> dict:
    """Fetch a generic web page with httpx and extract title + body text."""
    try:
        resp = await http.get(
            url, timeout=15, follow_redirects=True,
            headers={'User-Agent': 'ChunksAI/1.0 (research ingest)'},
        )
        resp.raise_for_status()
    except Exception as exc:
        raise ValueError(f'Could not fetch URL {url}: {exc}') from exc

    content_type = resp.headers.get('content-type', '')
    if 'html' not in content_type and 'text' not in content_type:
        raise ValueError(f'URL returned non-HTML content-type: {content_type}')

    parser = _GenericHTMLParser()
    parser.feed(resp.text)

    body_text = ' '.join(parser.paragraphs)[:_MAX_BODY_CHARS]
    # Derive a short paper_id from the URL hostname + path
    parsed = urlparse(url)
    paper_id = (parsed.netloc + parsed.path).rstrip('/')

    return {
        'paper_id':   paper_id,
        'type':       'url',
        'title':      parser.title or url,
        'authors':    [],
        'year':       None,
        'abstract':   body_text,
        'source_url': url,
    }


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post('/ingest')
@limiter.limit('10/minute')
async def ingest_research(
    request: Request,
    body: dict = Body(default={}),
) -> JSONResponse:
    """POST /api/research/ingest

    Request body::

        {
          "url":  "<arxiv/doi/generic URL or bare identifier>",
          "type": "arxiv" | "doi" | "url"   (optional — auto-detected when absent)
        }

    Returns a normalised paper record::

        {
          "success":    true,
          "paper_id":   "<arxiv-id | doi | hostname+path>",
          "type":       "arxiv" | "doi" | "url",
          "title":      "...",
          "authors":    ["First Last", ...],
          "year":       2023,            # null when unknown
          "abstract":   "...",
          "source_url": "https://..."
        }
    """
    from services.auth import _extract_verified_user

    try:
        _extract_verified_user(request)
    except Exception:
        return JSONResponse(
            {'success': False, 'error': 'Authentication required'},
            status_code=401,
        )

    url: str = (body.get('url') or '').strip()
    if not url:
        return JSONResponse(
            {'success': False, 'error': 'url is required'},
            status_code=400,
        )

    ingest_type: str = (body.get('type') or '').strip().lower()

    # Auto-detect type when the caller omits it
    if not ingest_type:
        if _parse_arxiv_id(url) is not None:
            ingest_type = 'arxiv'
        elif _parse_doi(url) is not None:
            ingest_type = 'doi'
        else:
            ingest_type = 'url'

    if ingest_type not in ('arxiv', 'doi', 'url'):
        return JSONResponse(
            {'success': False, 'error': "type must be 'arxiv', 'doi', or 'url'"},
            status_code=400,
        )

    http = ctx.async_client

    try:
        if ingest_type == 'arxiv':
            arxiv_id = _parse_arxiv_id(url)
            if not arxiv_id:
                return JSONResponse(
                    {'success': False, 'error': f'Could not parse an arXiv ID from: {url}'},
                    status_code=400,
                )
            record = await _ingest_arxiv(arxiv_id, http)

        elif ingest_type == 'doi':
            doi = _parse_doi(url)
            if not doi:
                return JSONResponse(
                    {'success': False, 'error': f'Could not parse a DOI from: {url}'},
                    status_code=400,
                )
            record = await _ingest_doi(doi, http)

        else:
            record = await _ingest_url(url, http)

    except ValueError as exc:
        return JSONResponse({'success': False, 'error': str(exc)}, status_code=422)
    except Exception:
        logger.exception('Unexpected error in /api/research/ingest')
        return JSONResponse(
            {'success': False, 'error': 'Internal server error'},
            status_code=500,
        )

    return JSONResponse({'success': True, **record})
