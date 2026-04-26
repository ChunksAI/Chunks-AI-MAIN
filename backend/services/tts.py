"""
backend/services/tts.py — Text-to-Speech service abstraction.

Exposes
-------
    synthesize_speech_async(text, voice=None) -> bytes

Currently backed by the OpenAI TTS REST API (model ``tts-1``).

Configuration (environment variables)
--------------------------------------
    OPENAI_TTS_API_KEY  — OpenAI API key for TTS synthesis.
                          Falls back to OPENAI_API_KEY when absent.
                          If neither is set, all synthesis calls raise a
                          RuntimeError with a clear message.
    TTS_VOICE           — Voice identifier (default: "alloy").
                          OpenAI voices: alloy, echo, fable, onyx, nova, shimmer.
    TTS_MODEL           — Model to use (default: "tts-1").
                          "tts-1-hd" gives higher quality at the cost of latency.
    TTS_SPEED           — Speech rate multiplier 0.25–4.0 (default: "1.0").

To swap providers, replace ``_synthesize_openai_async()`` with a new
implementation and update ``synthesize_speech_async()`` accordingly.
The public interface is unchanged: callers always receive raw MP3 bytes.
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"

# TODO: Set OPENAI_TTS_API_KEY (or OPENAI_API_KEY) in your environment.
_TTS_API_KEY: str = (
    os.environ.get('OPENAI_TTS_API_KEY', '')
    or os.environ.get('OPENAI_API_KEY', '')
)
_TTS_VOICE: str = os.environ.get('TTS_VOICE', 'alloy')
_TTS_MODEL: str = os.environ.get('TTS_MODEL', 'tts-1')

try:
    _TTS_SPEED = float(os.environ.get('TTS_SPEED', '1.0'))
    _TTS_SPEED = max(0.25, min(4.0, _TTS_SPEED))
except (TypeError, ValueError):
    _TTS_SPEED = 1.0

# TTS scripts are short (≤ ~1000 chars); a 30-second timeout is generous.
_TTS_TIMEOUT = 30

if not _TTS_API_KEY:
    logger.warning(
        '[tts] Neither OPENAI_TTS_API_KEY nor OPENAI_API_KEY is set. '
        'synthesize_speech_async() will raise RuntimeError until a key is configured.'
    )


# ── Provider implementation ────────────────────────────────────────────────────

async def _synthesize_openai_async(
    text: str,
    voice: str | None,
    *,
    model: str = _TTS_MODEL,
) -> bytes:
    """Call the OpenAI TTS API and return raw MP3 bytes.

    Raises
    ------
    RuntimeError
        When the API key is missing, the provider returns a non-200 response,
        or a network/timeout error occurs.
    """
    api_key = _TTS_API_KEY
    if not api_key:
        raise RuntimeError(
            'TTS provider is not configured. '
            'Set OPENAI_TTS_API_KEY (or OPENAI_API_KEY) in your environment.'
        )

    effective_voice = voice or _TTS_VOICE
    payload = {
        'model': model,
        'input': text,
        'voice': effective_voice,
        'response_format': 'mp3',
        'speed': _TTS_SPEED,
    }
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }

    try:
        async with httpx.AsyncClient(timeout=_TTS_TIMEOUT) as client:
            resp = await client.post(_OPENAI_TTS_URL, json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        raise RuntimeError('TTS provider timed out. Please try again.') from exc
    except httpx.RequestError as exc:
        raise RuntimeError(f'TTS provider network error: {exc}') from exc

    if resp.status_code != 200:
        snippet = resp.text[:200]
        logger.error('[tts] OpenAI TTS error %d: %s', resp.status_code, snippet)
        raise RuntimeError(
            f'Audio generation failed (provider returned {resp.status_code}). '
            'Please try again.'
        )

    audio_bytes = resp.content
    if not audio_bytes:
        raise RuntimeError('TTS provider returned empty audio. Please try again.')

    return audio_bytes


# ── Public interface ───────────────────────────────────────────────────────────

async def synthesize_speech_async(text: str, voice: str | None = None) -> bytes:
    """Convert *text* to speech and return raw MP3 bytes.

    Parameters
    ----------
    text:
        The narration script to synthesize.  Keep under 4096 characters for
        reliable results (OpenAI limit per request).
    voice:
        Provider-specific voice name.  Falls back to the ``TTS_VOICE``
        environment variable (default ``"alloy"``).

    Returns
    -------
    bytes
        Raw MP3 audio data.

    Raises
    ------
    RuntimeError
        On provider error, timeout, or missing API key.
    """
    return await _synthesize_openai_async(text, voice)
