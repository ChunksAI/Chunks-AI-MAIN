"""
backend/routes/youtube.py — YouTube transcript processing endpoint.

Endpoints
---------
POST /api/youtube/process
    Accepts a pre-fetched transcript from the browser (video_id, title,
    entries[]).  Checks Redis then Supabase for a cached result before
    chunking the entries.  Saves slides to both caches on a cache miss.

    The server never calls YouTube directly — transcript fetching is done
    entirely in the browser by fetchYouTubeTranscript() in youtubeTranscript.ts.
"""
from __future__ import annotations

import hashlib
import hmac as _hmac_mod
import logging
import json
import os
import re

from fastapi import APIRouter, Request, Body
from fastapi.responses import JSONResponse

from routes.limiter import limiter

logger = logging.getLogger(__name__)

# Optional environment prefix for Redis key namespacing
_KEY_NS_PREFIX: str = os.environ.get('REDIS_KEY_PREFIX', '')

# HMAC secret shared with the Next.js /api/youtube/transcript proxy.
# When set, every POST to /api/youtube/process must include a valid ``sig``
# field produced by the proxy to prevent cache-poisoning attacks.
_TRANSCRIPT_HMAC_SECRET: str = os.environ.get('TRANSCRIPT_HMAC_SECRET', '')
if not _TRANSCRIPT_HMAC_SECRET:
    logger.warning(
        '[youtube/process] TRANSCRIPT_HMAC_SECRET is not set — '
        'transcript signature verification is DISABLED.  '
        'Set this environment variable in production to prevent cache poisoning.'
    )


def _verify_transcript_sig(video_id: str, entries: list, sig: str) -> bool:
    """Return True iff *sig* is a valid HMAC-SHA256 over the transcript content.

    The message is ``"video_id:<entry_texts_joined_by_newline>"`` encoded as
    UTF-8, matching the computation in ``app/api/youtube/transcript/route.ts``.
    Uses :func:`hmac.compare_digest` for timing-safe comparison.
    """
    text_blob = '\n'.join(
        (e.get('text', '') if isinstance(e, dict) else getattr(e, 'text', ''))
        for e in entries
    )
    msg = f"{video_id}:{text_blob}".encode('utf-8')
    expected = _hmac_mod.new(
        _TRANSCRIPT_HMAC_SECRET.encode(), msg, hashlib.sha256
    ).hexdigest()
    return _hmac_mod.compare_digest(expected, sig)


# Maximum characters of transcript to return (~120k matches the IndexedDB cap)
_MAX_TRANSCRIPT_CHARS = 120_000
# Target characters per chunk (shown as one "slide" card in the viewer)
_CHUNK_SIZE = 1_200

# Valid YouTube video ID: exactly 11 URL-safe characters
_VIDEO_ID_RE = re.compile(r'^[A-Za-z0-9_-]{11}$')

# Payload size limits for /api/youtube/process (DoS / OOM prevention)
_MAX_ENTRIES = 10_000        # maximum number of transcript entries
_MAX_ENTRY_CHARS = 5_000     # maximum characters in a single entry's text
_MAX_TOTAL_CHARS = 500_000   # maximum total characters across all entries


def _chunk_transcript(entries: list[dict], chunk_size: int = _CHUNK_SIZE) -> list[dict]:
    """
    Merge transcript entries into slide-like chunks.

    Each entry has keys: text, start, duration.
    We accumulate entries until we reach ``chunk_size`` characters, then emit
    one "slide" object.  The slide title is a formatted timestamp of the
    first entry in the chunk.  ``timestamp_seconds`` is the numeric start time
    of the chunk so callers can deep-link directly to that position.
    """
    slides: list[dict] = []
    buf: list[str] = []
    buf_chars = 0
    chunk_start: float = 0.0
    slide_num = 0

    def _ts(seconds: float) -> str:
        s = int(seconds)
        h, rem = divmod(s, 3600)
        m, sec = divmod(rem, 60)
        return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"

    for entry in entries:
        # Support both dict entries and dataclass-like objects
        if isinstance(entry, dict):
            text = (entry.get('text') or '').strip()
            start_val = entry.get('start', 0.0)
        else:
            text = (getattr(entry, 'text', '') or '').strip()
            start_val = getattr(entry, 'start', 0.0)
        if not text:
            continue
        if not buf:
            chunk_start = start_val
        buf.append(text)
        buf_chars += len(text) + 1  # +1 for space

        if buf_chars >= chunk_size:
            slide_num += 1
            slides.append({
                'slide_number':      slide_num,
                'title':             f"[{_ts(chunk_start)}]",
                'timestamp_seconds': float(chunk_start),
                'content':           [' '.join(buf)],
                'notes':             '',
            })
            buf = []
            buf_chars = 0
            chunk_start = 0.0

    if buf:
        slide_num += 1
        slides.append({
            'slide_number':      slide_num,
            'title':             f"[{_ts(chunk_start)}]",
            'timestamp_seconds': float(chunk_start),
            'content':           [' '.join(buf)],
            'notes':             '',
        })

    return slides


def _compute_duration_seconds(entries: list) -> float:
    """Return the approximate total duration of a transcript from its entries."""
    if not entries:
        return 0.0
    last = entries[-1]
    if isinstance(last, dict):
        return float(last.get('start', 0.0)) + float(last.get('duration', 0.0))
    return float(getattr(last, 'start', 0.0)) + float(getattr(last, 'duration', 0.0))


def _duration_from_slides(slides: list[dict]) -> float:
    """Estimate duration from the last slide's timestamp when entries are unavailable."""
    if not slides:
        return 0.0
    return float(slides[-1].get('timestamp_seconds', 0.0))


# ── Router ─────────────────────────────────────────────────────────────────────

router_v2 = APIRouter(prefix='/api/youtube')

# TTL for transcript segments cached in Redis
_YT_TRANSCRIPT_TTL = 3_600  # 1 hour

# Exceptions that mean "no transcript exists" (vs a transient/server error).
# Caught at the top of fetch_youtube_transcript to return HTTP 404.
_NO_TRANSCRIPT_EXCEPTIONS: tuple[type, ...] = ()
YouTubeTranscriptApi = None  # set below if the package is available

try:
    from youtube_transcript_api import (  # type: ignore[import-untyped]
        YouTubeTranscriptApi,
        TranscriptsDisabled,
        VideoUnavailable,
        NoTranscriptFound,
    )
    _NO_TRANSCRIPT_EXCEPTIONS = (TranscriptsDisabled, VideoUnavailable, NoTranscriptFound)
except ImportError:
    pass


@router_v2.get('/transcript')
@limiter.limit("10/minute")
async def fetch_youtube_transcript_py(request: Request):
    """GET /api/youtube/transcript?video_id=<11-char-id>

    Fetch a YouTube transcript using the ``youtube-transcript-api`` library.
    This endpoint acts as a fallback for the Next.js InnerTube proxy when
    InnerTube returns no caption tracks (e.g. for videos where the mobile
    client context is rejected or where poToken is required).

    The library fetches the video's watch-page HTML and extracts transcript
    URLs from the embedded player config, which is a different code path from
    the InnerTube API and succeeds for a wider range of videos.

    Response (success)::

        {
          "success":  true,
          "video_id": "dQw4w9WgXcQ",
          "title":    "...",
          "entries":  [{"text": "...", "start": 0.5, "duration": 2.3}, ...]
        }

    Response (no transcript)::

        {"success": false, "error": "No transcript available for this video"}
        HTTP 404
    """
    from services.auth import _extract_verified_user
    _extract_verified_user(request)

    video_id = (request.query_params.get('video_id') or '').strip()
    if not video_id or not _VIDEO_ID_RE.match(video_id):
        return JSONResponse(
            {'success': False, 'error': 'video_id must be an 11-character YouTube video ID'},
            status_code=400,
        )

    if YouTubeTranscriptApi is None:
        logger.error('[youtube/transcript] youtube-transcript-api is not installed')
        return JSONResponse(
            {'success': False, 'error': 'Transcript backend unavailable'},
            status_code=503,
        )

    try:
        api = YouTubeTranscriptApi()

        # Attempt 1: fetch English transcript directly.
        fetched = None
        fetch_error = None
        try:
            fetched = api.fetch(video_id, languages=['en'])
        except _NO_TRANSCRIPT_EXCEPTIONS:
            # No English transcript — fall through to attempt 2.
            pass
        except Exception as exc:
            fetch_error = exc

        # Attempt 2: list all transcripts and pick the best available one.
        if fetched is None and fetch_error is None:
            try:
                transcript_list = api.list(video_id)
                all_transcripts = list(transcript_list)
                if not all_transcripts:
                    return JSONResponse(
                        {'success': False, 'error': 'No transcript available for this video'},
                        status_code=404,
                    )
                # Prefer a manually-created transcript; fall back to auto-generated.
                manual = [t for t in all_transcripts if not getattr(t, 'is_generated', True)]
                chosen = manual[0] if manual else all_transcripts[0]
                fetched = chosen.fetch()
            except _NO_TRANSCRIPT_EXCEPTIONS:
                return JSONResponse(
                    {'success': False, 'error': 'No transcript available for this video'},
                    status_code=404,
                )

        if fetch_error is not None:
            raise fetch_error

        if fetched is None:
            return JSONResponse(
                {'success': False, 'error': 'No transcript available for this video'},
                status_code=404,
            )

        entries = [
            {
                'text':     snippet.text.strip(),
                'start':    float(snippet.start),
                'duration': float(snippet.duration),
            }
            for snippet in fetched
            if snippet.text.strip()
        ]

        if not entries:
            return JSONResponse(
                {'success': False, 'error': 'No transcript available for this video'},
                status_code=404,
            )

        return JSONResponse({'success': True, 'video_id': video_id, 'entries': entries})

    except _NO_TRANSCRIPT_EXCEPTIONS:
        return JSONResponse(
            {'success': False, 'error': 'No transcript available for this video'},
            status_code=404,
        )
    except Exception:
        logger.exception(
            '[youtube/transcript] Unexpected error fetching transcript for video %s', video_id
        )
        return JSONResponse(
            {'success': False, 'error': 'Failed to fetch transcript'},
            status_code=500,
        )


@router_v2.post('/process')
@limiter.limit("10/minute")
async def process_youtube(request: Request, body: dict = Body(default={})):
    """POST /api/youtube/process — process a pre-fetched YouTube transcript.

    The browser fetches the transcript from YouTube directly using
    fetchYouTubeTranscript() and sends the parsed entries here.  The server
    only chunks the text and manages the cache — it never calls YouTube.

    Cache lookup order:
      1. Redis (hot cache, 1 h TTL)
      2. Supabase ``yt_transcripts`` table (persistent, survives Redis resets)
      3. Fresh chunking from the provided ``entries``

    Request body::

        {
          "video_id": "dQw4w9WgXcQ",
          "title":    "Never Gonna Give You Up",
          "entries":  [{"text": "...", "start": 0.0, "duration": 3.5}, ...]
        }

    Response shape::

        {
          "success":          true,
          "video_id":         "...",
          "title":            "...",
          "duration_seconds": 427.3,
          "slides":           [...],
          "transcript_full":  "...",
          "total_slides":     12,
          "cached":           false
        }
    """
    from routes.shared import ctx

    try:
        from services.auth import _extract_verified_user
        _extract_verified_user(request)

        video_id = (body.get('video_id') or '').strip()
        if not video_id or not _VIDEO_ID_RE.match(video_id):
            return JSONResponse(
                {'success': False, 'error': 'video_id must be an 11-character YouTube video ID'},
                status_code=400,
            )

        title = (body.get('title') or f'YouTube — {video_id}').strip()
        entries: list = body.get('entries') or []
        if not isinstance(entries, list):
            return JSONResponse(
                {'success': False, 'error': 'entries must be an array'},
                status_code=400,
            )

        # ── Payload size guards (DoS / OOM prevention) ────────────────────────
        if len(entries) > _MAX_ENTRIES:
            return JSONResponse(
                {'success': False, 'error': f'entries exceeds maximum of {_MAX_ENTRIES}'},
                status_code=400,
            )

        total_chars = 0
        for entry in entries:
            if not isinstance(entry, dict):
                return JSONResponse(
                    {'success': False, 'error': 'each entry must be an object'},
                    status_code=400,
                )
            text = entry.get('text')
            if text is None:
                text = ''
            if not isinstance(text, str):
                return JSONResponse(
                    {'success': False, 'error': 'each entry text must be a string'},
                    status_code=400,
                )
            if len(text) > _MAX_ENTRY_CHARS:
                return JSONResponse(
                    {'success': False, 'error': f'a single entry text exceeds maximum of {_MAX_ENTRY_CHARS} characters'},
                    status_code=400,
                )
            total_chars += len(text)

        if total_chars > _MAX_TOTAL_CHARS:
            return JSONResponse(
                {'success': False, 'error': f'total transcript text exceeds maximum of {_MAX_TOTAL_CHARS} characters'},
                status_code=400,
            )

        # ── HMAC signature verification (anti-cache-poisoning) ────────────────
        # The Next.js proxy signs (video_id + ":" + all entry texts) with
        # TRANSCRIPT_HMAC_SECRET.  Reject any request that cannot prove its
        # entries actually came from the trusted proxy.
        if _TRANSCRIPT_HMAC_SECRET:
            sig = (body.get('sig') or '').strip()
            if not sig:
                return JSONResponse(
                    {'success': False, 'error': 'Missing transcript signature'},
                    status_code=403,
                )
            if not _verify_transcript_sig(video_id, entries, sig):
                return JSONResponse(
                    {'success': False, 'error': 'Invalid transcript signature'},
                    status_code=403,
                )

        redis_key = f"{_KEY_NS_PREFIX}yt_transcript:{video_id}"

        # ── 1. Redis cache ────────────────────────────────────────────────────
        _redis = getattr(ctx, 'redis', None)
        if _redis:
            try:
                cached = _redis.get(redis_key)
                if cached:
                    slides = json.loads(cached)
                    return {
                        'success':          True,
                        'video_id':         video_id,
                        'title':            title,
                        'duration_seconds': _compute_duration_seconds(entries) if entries else _duration_from_slides(slides),
                        'slides':           slides,
                        'transcript_full':  '',
                        'total_slides':     len(slides),
                        'cached':           True,
                    }
            except Exception as exc:
                logger.debug('[youtube/process] Redis read error: %s', exc)

        # ── 2. Supabase cache ─────────────────────────────────────────────────
        _supabase = getattr(ctx, 'supabase_client', None)
        if _supabase:
            try:
                sb_resp = await _supabase.get(
                    f'/rest/v1/yt_transcripts'
                    f'?video_id=eq.{video_id}'
                    f'&select=slides,title,duration_seconds',
                )
                if sb_resp.status_code == 200:
                    rows = sb_resp.json()
                    if rows:
                        row = rows[0]
                        slides = row['slides']
                        # Backfill Redis so the next request is served from the hot cache
                        if _redis:
                            try:
                                _redis.setex(redis_key, _YT_TRANSCRIPT_TTL, json.dumps(slides))
                            except Exception as exc:
                                logger.debug('[youtube/process] Redis backfill error: %s', exc)
                        return {
                            'success':          True,
                            'video_id':         video_id,
                            'title':            row.get('title', title),
                            'duration_seconds': float(row.get('duration_seconds') or 0.0),
                            'slides':           slides,
                            'transcript_full':  '',
                            'total_slides':     len(slides),
                            'cached':           True,
                        }
            except Exception as exc:
                logger.debug('[youtube/process] Supabase read error: %s', exc)

        # ── 3. Chunk the provided entries ─────────────────────────────────────
        if not entries:
            return JSONResponse(
                {'success': False, 'error': 'entries are required when the transcript is not cached'},
                status_code=400,
            )

        slides = _chunk_transcript(entries)
        duration_seconds = _compute_duration_seconds(entries)

        full_text = ' '.join(
            (e.get('text', '') if isinstance(e, dict) else getattr(e, 'text', ''))
            for e in entries
        )[:_MAX_TRANSCRIPT_CHARS]

        # ── 4. Save to Redis ─────────────────────────────────────────────────
        if _redis:
            try:
                _redis.setex(redis_key, _YT_TRANSCRIPT_TTL, json.dumps(slides))
            except Exception as exc:
                logger.debug('[youtube/process] Redis write error: %s', exc)

        # ── 5. Save to Supabase ──────────────────────────────────────────────
        if _supabase:
            try:
                await _supabase.post(
                    '/rest/v1/yt_transcripts',
                    json={
                        'video_id':         video_id,
                        'title':            title,
                        'duration_seconds': duration_seconds,
                        'slides':           slides,
                    },
                    headers={'Prefer': 'resolution=ignore-duplicates'},
                )
            except Exception as exc:
                logger.debug('[youtube/process] Supabase write error: %s', exc)

        return {
            'success':          True,
            'video_id':         video_id,
            'title':            title,
            'duration_seconds': duration_seconds,
            'slides':           slides,
            'transcript_full':  full_text,
            'total_slides':     len(slides),
            'cached':           False,
        }

    except Exception:
        logger.exception("Unhandled error in POST /api/youtube/process")
        return JSONResponse(
            {'success': False, 'error': 'An unexpected error occurred. Check server logs.'},
            status_code=500,
        )

