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
import os
import re

from flask import Blueprint, jsonify, request

logger = logging.getLogger(__name__)

youtube_bp = Blueprint('youtube', __name__)

# Maximum characters of transcript to return (~120k matches the IndexedDB cap)
_MAX_TRANSCRIPT_CHARS = 120_000
# Target characters per chunk (shown as one "slide" card in the viewer)
_CHUNK_SIZE = 1_200


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
    first entry in the chunk.
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
                'slide_number': slide_num,
                'title': f"[{_ts(chunk_start)}]",
                'content': [' '.join(buf)],
                'notes': '',
            })
            buf = []
            buf_chars = 0
            chunk_start = 0.0

    if buf:
        slide_num += 1
        slides.append({
            'slide_number': slide_num,
            'title': f"[{_ts(chunk_start)}]",
            'content': [' '.join(buf)],
            'notes': '',
        })

    return slides


@youtube_bp.route('/ingest-youtube', methods=['POST', 'OPTIONS'])
def ingest_youtube():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True})

    try:
        from services.auth import _extract_verified_user

        _extract_verified_user()

        body = request.get_json(silent=True) or {}
        url = (body.get('url') or '').strip()
        if not url:
            return jsonify({'success': False, 'error': 'url is required'}), 400

        video_id = _extract_video_id(url)
        if not video_id:
            return jsonify({'success': False, 'error': 'Could not parse a YouTube video ID from that URL'}), 400

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
            return jsonify({'success': False, 'error': 'Server transcript support not installed'}), 500

        try:
            proxy_config = _build_proxy_config()
            api = YouTubeTranscriptApi(proxy_config=proxy_config)
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
        except (NoTranscriptFound, TranscriptsDisabled) as e:
            return jsonify({'success': False, 'error': 'No transcript available for this video'}), 422
        except (IpBlocked, RequestBlocked) as e:
            logger.warning("YouTube blocked transcript request for %s: %s", video_id, e)
            return jsonify({
                'success': False,
                'error': (
                    'YouTube is blocking transcript requests from this server. '
                    'To fix this, set the YOUTUBE_PROXY_URL environment variable '
                    'to a residential proxy URL, or set WEBSHARE_PROXY_USERNAME '
                    'and WEBSHARE_PROXY_PASSWORD to use Webshare rotating proxies.'
                ),
            }), 422
        except Exception as e:
            logger.warning("Transcript fetch failed for %s: %s", video_id, e)
            return jsonify({'success': False, 'error': f'Could not fetch transcript: {str(e)}'}), 422

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

        return jsonify({
            'success':    True,
            'video_id':   video_id,
            'title':      title,
            'slides':     slides,
            'total_slides': len(slides),
            'transcript': full_text,
        })

    except Exception as e:
        logger.exception("Unhandled error in /ingest-youtube")
        return jsonify({'success': False, 'error': str(e)}), 500
