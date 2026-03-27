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
        text = (entry.get('text') or '').strip()
        if not text:
            continue
        if not buf:
            chunk_start = entry.get('start', 0.0)
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
            from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound, TranscriptsDisabled
        except ImportError:
            logger.error("youtube-transcript-api not installed")
            return jsonify({'success': False, 'error': 'Server transcript support not installed'}), 500

        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            # Prefer manually created transcripts in any language; fall back to auto-generated
            try:
                transcript = transcript_list.find_manually_created_transcript(
                    transcript_list._manually_created_transcripts.keys()
                    or ['en']
                )
            except Exception:
                transcript = transcript_list.find_generated_transcript(
                    list(transcript_list._generated_transcripts.keys()) or ['en']
                )
            entries = transcript.fetch()
        except (NoTranscriptFound, TranscriptsDisabled) as e:
            return jsonify({'success': False, 'error': f'No transcript available: {e}'}), 422
        except Exception as e:
            logger.warning("Transcript fetch failed for %s: %s", video_id, e)
            return jsonify({'success': False, 'error': f'Could not fetch transcript: {e}'}), 422

        slides = _chunk_transcript(entries)

        # Build a flat transcript string (capped) for the extractedText field
        full_text = ' '.join(
            e.get('text', '') for e in entries
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
