"""
backend/routes/youtube.py — YouTube transcript ingestion endpoint.

Endpoints
---------
POST /ingest-youtube
    Accepts a YouTube URL, fetches its transcript via the YouTube Transcript
    API, and returns the text chunked into slide-like objects that the
    frontend can store in IndexedDB exactly like a PPT document.
"""
from __future__ import annotations

import logging
import json
import os
import re
import time
from typing import Optional

from fastapi import APIRouter, Request, Body
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Optional environment prefix for Redis key namespacing
_KEY_NS_PREFIX: str = os.environ.get('REDIS_KEY_PREFIX', '')

# Maximum characters of transcript to return (~120k matches the IndexedDB cap)
_MAX_TRANSCRIPT_CHARS = 120_000
# Target characters per chunk (shown as one "slide" card in the viewer)
_CHUNK_SIZE = 1_200
# Retry settings for transient YouTube rate-limit (429) errors
_MAX_RETRIES = 3
_BACKOFF_BASE = 1  # seconds; doubles each attempt (1 s, 2 s, …)


def _extract_video_id(url: str) -> str | None:
    """Return the 11-char YouTube video ID from a URL, or None if invalid."""
    patterns = [
        r'(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})',
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    return None


def _is_rate_limited(exc: Exception) -> bool:
    """Return True when *exc* looks like a YouTube HTTP 429 / rate-limit error."""
    msg = str(exc).lower()
    return '429' in msg or 'too many' in msg


def _build_proxy_config():
    """
    Return a youtube_transcript_api ProxyConfig based on environment variables,
    or None if no proxy is configured.

    Priority:
    1. WEBSHARE_PROXY_USERNAME + WEBSHARE_PROXY_PASSWORD → WebshareProxyConfig
       (rotating residential proxies, most reliable for bypassing IP bans)
    2. YOUTUBE_PROXY_URL → GenericProxyConfig
       (any HTTP/HTTPS/SOCKS proxy URL, e.g. "http://user:pass@host:port")
    3. No proxy configured → None
    """
    try:
        from youtube_transcript_api.proxies import GenericProxyConfig, WebshareProxyConfig
    except ImportError:
        return None

    ws_user = os.environ.get('WEBSHARE_PROXY_USERNAME', '').strip()
    ws_pass = os.environ.get('WEBSHARE_PROXY_PASSWORD', '').strip()
    if ws_user and ws_pass:
        return WebshareProxyConfig(proxy_username=ws_user, proxy_password=ws_pass)

    proxy_url = os.environ.get('YOUTUBE_PROXY_URL', '').strip()
    if proxy_url:
        return GenericProxyConfig(http_url=proxy_url, https_url=proxy_url)

    return None


def _chunk_transcript(entries: list[dict], chunk_size: int = _CHUNK_SIZE) -> list[dict]:
    """
    Merge transcript entries into slide-like chunks.

    Each entry from youtube-transcript-api has keys: text, start, duration.
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
        # Support both dict entries and FetchedTranscriptSnippet dataclass objects
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
                'slide_number':     slide_num,
                'title':            f"[{_ts(chunk_start)}]",
                'timestamp_seconds': float(chunk_start),
                'content':          [' '.join(buf)],
                'notes':            '',
            })
            buf = []
            buf_chars = 0
            chunk_start = 0.0

    if buf:
        slide_num += 1
        slides.append({
            'slide_number':     slide_num,
            'title':            f"[{_ts(chunk_start)}]",
            'timestamp_seconds': float(chunk_start),
            'content':          [' '.join(buf)],
            'notes':            '',
        })

    return slides


@router.post('/ingest-youtube')
def ingest_youtube(request: Request, body: dict = Body(default={})):
    logger.warning("DEPRECATED: /ingest-youtube is only called by the legacy /src frontend. Migrate callers to chunks-v2 before removing.")
    try:
        from services.auth import _extract_verified_user

        _extract_verified_user(request)

        url = (body.get('url') or '').strip()
        if not url:
            return JSONResponse({'success': False, 'error': 'url is required'}, status_code=400)

        video_id = _extract_video_id(url)
        if not video_id:
            return JSONResponse({'success': False, 'error': 'Could not parse a YouTube video ID from that URL'}, status_code=400)

        try:
            from youtube_transcript_api import (
                YouTubeTranscriptApi,
                IpBlocked,
                NoTranscriptFound,
                RequestBlocked,
                TranscriptsDisabled,
            )
        except ImportError:
            logger.error("youtube-transcript-api not installed")
            return JSONResponse({'success': False, 'error': 'Server transcript support not installed'}, status_code=500)

        try:
            proxy_config = _build_proxy_config()
            api = YouTubeTranscriptApi(proxy_config=proxy_config)

            entries: list[dict] = []
            for attempt in range(_MAX_RETRIES):
                try:
                    transcript_list = api.list(video_id)
                    # Prefer manually created transcripts; fall back to any auto-generated one
                    try:
                        transcript = transcript_list.find_manually_created_transcript(['en', 'en-US', 'en-GB'])
                    except Exception:
                        try:
                            transcript = transcript_list.find_generated_transcript(['en', 'en-US', 'en-GB'])
                        except Exception:
                            # Last resort: grab whichever transcript is first in the list
                            transcript = next(iter(transcript_list))
                    fetched = transcript.fetch()
                    # Support both old list-of-dicts API and new FetchedTranscript iterable
                    if hasattr(fetched, 'to_raw_data'):
                        entries = fetched.to_raw_data()
                    else:
                        entries = list(fetched)
                    break  # success — exit retry loop
                except (NoTranscriptFound, TranscriptsDisabled):
                    raise  # never retry these
                except Exception as retry_exc:
                    if _is_rate_limited(retry_exc) and attempt < _MAX_RETRIES - 1:
                        delay = _BACKOFF_BASE * (2 ** attempt)
                        logger.warning(
                            "YouTube rate-limited for %s (attempt %d/%d); retrying in %ds",
                            video_id, attempt + 1, _MAX_RETRIES, delay,
                        )
                        time.sleep(delay)
                    else:
                        raise

        except (NoTranscriptFound, TranscriptsDisabled) as e:
            return JSONResponse({'success': False, 'error': 'No transcript available for this video'}, status_code=422)
        except (IpBlocked, RequestBlocked) as e:
            logger.warning("YouTube blocked transcript request for %s: %s", video_id, e)
            return JSONResponse({
                'success': False,
                'error': (
                    'YouTube is blocking transcript requests from this server. '
                    'To fix this, set the YOUTUBE_PROXY_URL environment variable '
                    'to a residential proxy URL, or set WEBSHARE_PROXY_USERNAME '
                    'and WEBSHARE_PROXY_PASSWORD to use Webshare rotating proxies.'
                ),
            }, status_code=422)
        except Exception as e:
            if _is_rate_limited(e):
                logger.warning("YouTube rate-limited for %s after %d attempts: %s", video_id, _MAX_RETRIES, e)
                if _build_proxy_config() is not None:
                    err_msg = (
                        'YouTube is rate-limiting requests through your proxy (HTTP 429). '
                        'The proxy IP may be temporarily blocked — wait a few minutes and try again, '
                        'or check your Webshare/proxy configuration.'
                    )
                else:
                    err_msg = (
                        'YouTube is rate-limiting transcript requests from this server (HTTP 429). '
                        'Set the WEBSHARE_PROXY_USERNAME and WEBSHARE_PROXY_PASSWORD environment '
                        'variables to use Webshare rotating proxies, or set YOUTUBE_PROXY_URL '
                        'to a residential proxy URL.'
                    )
                return JSONResponse({'success': False, 'error': err_msg}, status_code=429)
            logger.warning("Transcript fetch failed for %s: %s", video_id, e)
            return JSONResponse({'success': False, 'error': f'Could not fetch transcript: {str(e)}'}, status_code=422)

        slides = _chunk_transcript(entries)

        # Build a flat transcript string (capped) for the extractedText field
        full_text = ' '.join(
            (e.get('text', '') if isinstance(e, dict) else getattr(e, 'text', ''))
            for e in entries
        )[:_MAX_TRANSCRIPT_CHARS]

        # Attempt to get the video title via oEmbed (no API key required)
        title = f"YouTube — {video_id}"
        try:
            import requests as req_lib
            oembed = req_lib.get(
                f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json",
                timeout=4,
            )
            if oembed.ok:
                title = oembed.json().get('title') or title
        except Exception:
            pass  # title stays as fallback

        return {
            'success':    True,
            'video_id':   video_id,
            'title':      title,
            'slides':     slides,
            'total_slides': len(slides),
            'transcript': full_text,
        }

    except Exception as e:
        logger.exception("Unhandled error in /ingest-youtube")
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


# ── v2 router — POST /api/youtube/ingest ──────────────────────────────────────

router_v2 = APIRouter(prefix='/api/youtube')

# TTL for transcript segments cached in Redis
_YT_TRANSCRIPT_TTL = 3_600  # 1 hour


def _compute_duration_seconds(entries: list) -> float:
    """Return the approximate total duration of a transcript from its entries."""
    if not entries:
        return 0.0
    last = entries[-1]
    if isinstance(last, dict):
        return float(last.get('start', 0.0)) + float(last.get('duration', 0.0))
    return float(getattr(last, 'start', 0.0)) + float(getattr(last, 'duration', 0.0))


@router_v2.post('/ingest')
async def ingest_youtube_v2(request: Request, body: dict = Body(default={})):
    """POST /api/youtube/ingest — v2 timestamped YouTube transcript ingestion.

    Returns slide chunks with numeric ``timestamp_seconds`` fields and caches
    the slides in Redis so the orchestrator can retrieve individual segments
    without re-fetching from YouTube.

    Response shape::

        {
          "success": true,
          "video_id": "...",
          "title": "...",
          "duration_seconds": 427.3,
          "slides": [
            {
              "slide_number": 1,
              "title": "[0:00]",
              "timestamp_seconds": 0.0,
              "content": ["..."],
              "notes": ""
            },
            ...
          ],
          "transcript_full": "...",
          "total_slides": 12
        }
    """
    from routes.shared import ctx

    try:
        from services.auth import _extract_verified_user
        _extract_verified_user(request)

        url = (body.get('url') or '').strip()
        if not url:
            return JSONResponse({'success': False, 'error': 'url is required'}, status_code=400)

        video_id = _extract_video_id(url)
        if not video_id:
            return JSONResponse(
                {'success': False, 'error': 'Could not parse a YouTube video ID from that URL'},
                status_code=400,
            )

        try:
            from youtube_transcript_api import (
                YouTubeTranscriptApi,
                IpBlocked,
                NoTranscriptFound,
                RequestBlocked,
                TranscriptsDisabled,
            )
        except ImportError:
            logger.error("youtube-transcript-api not installed")
            return JSONResponse(
                {'success': False, 'error': 'Server transcript support not installed'},
                status_code=500,
            )

        try:
            proxy_config = _build_proxy_config()
            api = YouTubeTranscriptApi(proxy_config=proxy_config)

            entries: list = []
            for attempt in range(_MAX_RETRIES):
                try:
                    transcript_list = api.list(video_id)
                    try:
                        transcript = transcript_list.find_manually_created_transcript(['en', 'en-US', 'en-GB'])
                    except Exception:
                        try:
                            transcript = transcript_list.find_generated_transcript(['en', 'en-US', 'en-GB'])
                        except Exception:
                            transcript = next(iter(transcript_list))
                    fetched = transcript.fetch()
                    if hasattr(fetched, 'to_raw_data'):
                        entries = fetched.to_raw_data()
                    else:
                        entries = list(fetched)
                    break
                except (NoTranscriptFound, TranscriptsDisabled):
                    raise
                except Exception as retry_exc:
                    if _is_rate_limited(retry_exc) and attempt < _MAX_RETRIES - 1:
                        import asyncio
                        delay = _BACKOFF_BASE * (2 ** attempt)
                        logger.warning(
                            "YouTube rate-limited for %s (attempt %d/%d); retrying in %ds",
                            video_id, attempt + 1, _MAX_RETRIES, delay,
                        )
                        await asyncio.sleep(delay)
                    else:
                        raise

        except (NoTranscriptFound, TranscriptsDisabled):
            return JSONResponse(
                {'success': False, 'error': 'No transcript available for this video'},
                status_code=422,
            )
        except (IpBlocked, RequestBlocked) as e:
            logger.warning("YouTube blocked transcript request for %s: %s", video_id, e)
            return JSONResponse({
                'success': False,
                'error': (
                    'YouTube is blocking transcript requests from this server. '
                    'Set WEBSHARE_PROXY_USERNAME/WEBSHARE_PROXY_PASSWORD or YOUTUBE_PROXY_URL.'
                ),
            }, status_code=422)
        except Exception as e:
            if _is_rate_limited(e):
                logger.warning("YouTube rate-limited for %s after %d attempts: %s", video_id, _MAX_RETRIES, e)
                if _build_proxy_config() is not None:
                    err_msg = (
                        'YouTube is rate-limiting requests through your proxy (HTTP 429). '
                        'The proxy IP may be temporarily blocked — wait a few minutes and try again.'
                    )
                else:
                    err_msg = (
                        'YouTube is rate-limiting transcript requests from this server (HTTP 429). '
                        'Set WEBSHARE_PROXY_USERNAME and WEBSHARE_PROXY_PASSWORD, or YOUTUBE_PROXY_URL.'
                    )
                return JSONResponse({'success': False, 'error': err_msg}, status_code=429)
            logger.warning("Transcript fetch failed for %s: %s", video_id, e)
            return JSONResponse(
                {'success': False, 'error': 'Could not fetch transcript. Check server logs for details.'},
                status_code=422,
            )

        slides = _chunk_transcript(entries)
        duration_seconds = _compute_duration_seconds(entries)

        full_text = ' '.join(
            (e.get('text', '') if isinstance(e, dict) else getattr(e, 'text', ''))
            for e in entries
        )[:_MAX_TRANSCRIPT_CHARS]

        # Resolve video title via oEmbed (no API key required)
        title = f"YouTube — {video_id}"
        try:
            import httpx
            async with httpx.AsyncClient(timeout=4) as _hc:
                oembed_resp = await _hc.get(
                    f"https://www.youtube.com/oembed"
                    f"?url=https://www.youtube.com/watch?v={video_id}&format=json"
                )
                if oembed_resp.status_code == 200:
                    title = oembed_resp.json().get('title') or title
        except Exception:
            pass  # title stays as fallback

        # ── Cache slides in Redis so the orchestrator can retrieve segments ──
        _redis = getattr(ctx, 'redis', None)
        if _redis:
            try:
                _redis.setex(
                    f"{_KEY_NS_PREFIX}yt_transcript:{video_id}",
                    _YT_TRANSCRIPT_TTL,
                    json.dumps(slides),
                )
            except Exception as exc:
                logger.debug('[youtube/ingest] Redis cache write error: %s', exc)

        return {
            'success':          True,
            'video_id':         video_id,
            'title':            title,
            'duration_seconds': duration_seconds,
            'slides':           slides,
            'transcript_full':  full_text,
            'total_slides':     len(slides),
        }

    except Exception as e:
        logger.exception("Unhandled error in POST /api/youtube/ingest")
        return JSONResponse({'success': False, 'error': 'An unexpected error occurred. Check server logs.'}, status_code=500)
