"""Tests for the youtube blueprint (/ingest-youtube)."""
import pytest
from unittest.mock import MagicMock, call, patch


def test_ingest_youtube_options(client):
    """OPTIONS /ingest-youtube returns 200 (CORS preflight)."""
    resp = client.options('/ingest-youtube')
    assert resp.status_code == 200


def test_ingest_youtube_missing_url(client, mock_extract_user):
    """POST /ingest-youtube with no url returns 400."""
    resp = client.post('/ingest-youtube', json={})
    assert resp.status_code == 400
    data = resp.json()
    assert data['success'] is False
    assert 'url is required' in data['error']


def test_ingest_youtube_invalid_url(client, mock_extract_user):
    """POST /ingest-youtube with an unrecognised URL returns 400."""
    resp = client.post('/ingest-youtube', json={'url': 'https://example.com/not-youtube'})
    assert resp.status_code == 400
    data = resp.json()
    assert data['success'] is False
    assert 'video ID' in data['error']


def test_ingest_youtube_blueprint_registered(app):
    """The youtube blueprint is registered with the correct route."""
    rules = [r.path for r in app.routes]
    assert '/ingest-youtube' in rules


def _make_mock_transcript_api(entries):
    """
    Build a mock YouTubeTranscriptApi *class* (instance-based new API).
    YouTubeTranscriptApi() returns an instance; instance.list(video_id)
    returns a TranscriptList; transcript.fetch() returns a FetchedTranscript
    that has to_raw_data() returning a list of dicts.
    """
    # Mock FetchedTranscript returned by transcript.fetch()
    mock_fetched = MagicMock()
    mock_fetched.to_raw_data.return_value = entries

    # Mock individual Transcript
    mock_transcript = MagicMock()
    mock_transcript.fetch.return_value = mock_fetched

    # Mock TranscriptList returned by api_instance.list(video_id)
    mock_list = MagicMock()
    mock_list.find_manually_created_transcript.return_value = mock_transcript
    mock_list.find_generated_transcript.return_value = mock_transcript
    mock_list.__iter__ = MagicMock(return_value=iter([mock_transcript]))

    # Mock the instance returned by YouTubeTranscriptApi()
    mock_instance = MagicMock()
    mock_instance.list.return_value = mock_list

    # Mock the class (calling it returns the instance)
    mock_class = MagicMock(return_value=mock_instance)
    return mock_class


def test_ingest_youtube_success(client, mock_extract_user):
    """POST /ingest-youtube with a valid URL returns slides and transcript."""
    entries = [
        {'text': 'Hello world this is a test transcript.', 'start': 0.0, 'duration': 3.0},
        {'text': 'Second sentence here.', 'start': 3.0, 'duration': 2.0},
    ]

    mock_api_class = _make_mock_transcript_api(entries)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            NoTranscriptFound=Exception,
            TranscriptsDisabled=Exception,
        ),
    }), patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(ok=True, json=lambda: {'title': 'My Video'})

        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert data['video_id'] == 'dQw4w9WgXcQ'
    assert data['title'] == 'My Video'
    assert isinstance(data['slides'], list)
    assert data['total_slides'] >= 1
    assert 'Hello world' in data['transcript']


def test_ingest_youtube_youtu_be_url(client, mock_extract_user):
    """POST /ingest-youtube accepts youtu.be short URLs."""
    entries = [{'text': 'Short URL transcript.', 'start': 0.0, 'duration': 2.0}]
    mock_api_class = _make_mock_transcript_api(entries)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            NoTranscriptFound=Exception,
            TranscriptsDisabled=Exception,
        ),
    }), patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(ok=False)

        resp = client.post('/ingest-youtube',
                           json={'url': 'https://youtu.be/dQw4w9WgXcQ'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['video_id'] == 'dQw4w9WgXcQ'


def test_ingest_youtube_no_transcript(client, mock_extract_user):
    """POST /ingest-youtube returns 422 when no transcript is available."""
    class _NoTranscriptFound(Exception):
        pass
    class _TranscriptsDisabled(Exception):
        pass

    # Instance raises NoTranscriptFound when .list() is called
    mock_instance = MagicMock()
    mock_instance.list.side_effect = _NoTranscriptFound("no transcript")
    mock_api_class = MagicMock(return_value=mock_instance)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            NoTranscriptFound=_NoTranscriptFound,
            TranscriptsDisabled=_TranscriptsDisabled,
        ),
    }):
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 422
    data = resp.json()
    assert data['success'] is False


def test_ingest_youtube_chunking():
    """_chunk_transcript splits entries correctly into slides."""
    from routes.youtube import _chunk_transcript

    long_text = 'word ' * 300  # 1500 chars
    entries = [
        {'text': long_text, 'start': 0.0, 'duration': 10.0},
        {'text': long_text, 'start': 10.0, 'duration': 10.0},
    ]
    slides = _chunk_transcript(entries, chunk_size=1200)
    assert len(slides) >= 2
    for i, slide in enumerate(slides, 1):
        assert slide['slide_number'] == i
        assert isinstance(slide['title'], str)
        assert isinstance(slide['content'], list)


def test_ingest_youtube_extract_video_id():
    """_extract_video_id parses all common YouTube URL formats."""
    from routes.youtube import _extract_video_id

    cases = [
        ('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
        ('https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
        ('https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
        ('https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'),
        ('https://example.com/notayoutube', None),
    ]
    for url, expected in cases:
        assert _extract_video_id(url) == expected, f"Failed for {url}"


def test_ingest_youtube_ip_blocked(client, mock_extract_user):
    """POST /ingest-youtube returns 422 with a helpful message when YouTube blocks the IP."""
    class _IpBlocked(Exception):
        pass
    class _RequestBlocked(Exception):
        pass
    class _NoTranscriptFound(Exception):
        pass
    class _TranscriptsDisabled(Exception):
        pass

    mock_instance = MagicMock()
    mock_instance.list.side_effect = _IpBlocked("IP blocked by YouTube")
    mock_api_class = MagicMock(return_value=mock_instance)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=_IpBlocked,
            RequestBlocked=_RequestBlocked,
            NoTranscriptFound=_NoTranscriptFound,
            TranscriptsDisabled=_TranscriptsDisabled,
        ),
    }):
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 422
    data = resp.json()
    assert data['success'] is False
    assert 'blocking' in data['error'].lower()
    assert 'YOUTUBE_PROXY_URL' in data['error']


def test_ingest_youtube_request_blocked(client, mock_extract_user):
    """POST /ingest-youtube returns 422 with a helpful message when YouTube blocks the request."""
    class _IpBlocked(Exception):
        pass
    class _RequestBlocked(Exception):
        pass
    class _NoTranscriptFound(Exception):
        pass
    class _TranscriptsDisabled(Exception):
        pass

    mock_instance = MagicMock()
    mock_instance.list.side_effect = _RequestBlocked("Request blocked")
    mock_api_class = MagicMock(return_value=mock_instance)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=_IpBlocked,
            RequestBlocked=_RequestBlocked,
            NoTranscriptFound=_NoTranscriptFound,
            TranscriptsDisabled=_TranscriptsDisabled,
        ),
    }):
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 422
    data = resp.json()
    assert data['success'] is False
    assert 'YOUTUBE_PROXY_URL' in data['error']


def test_build_proxy_config_no_env(monkeypatch):
    """_build_proxy_config returns None when no proxy env vars are set."""
    from routes.youtube import _build_proxy_config
    monkeypatch.delenv('YOUTUBE_PROXY_URL', raising=False)
    monkeypatch.delenv('WEBSHARE_PROXY_USERNAME', raising=False)
    monkeypatch.delenv('WEBSHARE_PROXY_PASSWORD', raising=False)
    assert _build_proxy_config() is None


def test_build_proxy_config_generic_url(monkeypatch):
    """_build_proxy_config returns GenericProxyConfig when YOUTUBE_PROXY_URL is set."""
    from routes.youtube import _build_proxy_config
    monkeypatch.setenv('YOUTUBE_PROXY_URL', 'http://proxy.example.com:8080')
    monkeypatch.delenv('WEBSHARE_PROXY_USERNAME', raising=False)
    monkeypatch.delenv('WEBSHARE_PROXY_PASSWORD', raising=False)
    config = _build_proxy_config()
    assert config is not None
    from youtube_transcript_api.proxies import GenericProxyConfig
    assert isinstance(config, GenericProxyConfig)


def test_build_proxy_config_webshare(monkeypatch):
    """_build_proxy_config returns WebshareProxyConfig when Webshare creds are set."""
    from routes.youtube import _build_proxy_config
    monkeypatch.setenv('WEBSHARE_PROXY_USERNAME', 'myuser')
    monkeypatch.setenv('WEBSHARE_PROXY_PASSWORD', 'mypass')
    monkeypatch.delenv('YOUTUBE_PROXY_URL', raising=False)
    config = _build_proxy_config()
    assert config is not None
    from youtube_transcript_api.proxies import WebshareProxyConfig
    assert isinstance(config, WebshareProxyConfig)


def test_build_proxy_config_webshare_takes_priority(monkeypatch):
    """_build_proxy_config prefers Webshare over generic proxy URL when both are set."""
    from routes.youtube import _build_proxy_config
    monkeypatch.setenv('WEBSHARE_PROXY_USERNAME', 'myuser')
    monkeypatch.setenv('WEBSHARE_PROXY_PASSWORD', 'mypass')
    monkeypatch.setenv('YOUTUBE_PROXY_URL', 'http://proxy.example.com:8080')
    config = _build_proxy_config()
    from youtube_transcript_api.proxies import WebshareProxyConfig
    assert isinstance(config, WebshareProxyConfig)


def test_ingest_youtube_uses_proxy_config(client, mock_extract_user, monkeypatch):
    """POST /ingest-youtube passes proxy_config to YouTubeTranscriptApi when configured."""
    monkeypatch.setenv('YOUTUBE_PROXY_URL', 'http://proxy.example.com:8080')

    entries = [{'text': 'Proxy transcript.', 'start': 0.0, 'duration': 2.0}]
    mock_api_class = _make_mock_transcript_api(entries)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=Exception,
            RequestBlocked=Exception,
            NoTranscriptFound=Exception,
            TranscriptsDisabled=Exception,
        ),
    }), patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(ok=False)
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 200
    # Verify proxy_config was passed (not None) to the constructor
    call_kwargs = mock_api_class.call_args
    assert call_kwargs is not None
    proxy_arg = call_kwargs.kwargs.get('proxy_config')
    assert proxy_arg is not None


# ── _is_rate_limited helper ────────────────────────────────────────────────────

def test_is_rate_limited_detects_429():
    """_is_rate_limited returns True for messages containing '429'."""
    from routes.youtube import _is_rate_limited
    assert _is_rate_limited(Exception("Max retries exceeded (Caused by ResponseError('too many 429 error responses'))"))
    assert _is_rate_limited(Exception("HTTP Error 429"))
    assert _is_rate_limited(Exception("too many requests"))


def test_is_rate_limited_false_for_other_errors():
    """_is_rate_limited returns False for unrelated errors."""
    from routes.youtube import _is_rate_limited
    assert not _is_rate_limited(Exception("No transcript found"))
    assert not _is_rate_limited(Exception("Connection reset by peer"))
    assert not _is_rate_limited(Exception("IP blocked"))


# ── Retry logic ────────────────────────────────────────────────────────────────

def test_ingest_youtube_retries_on_429_then_succeeds(client, mock_extract_user, monkeypatch):
    """POST /ingest-youtube retries on 429 and succeeds on the second attempt."""
    entries = [{'text': 'Retry succeeded.', 'start': 0.0, 'duration': 2.0}]

    class _NoTranscriptFound(Exception):
        pass
    class _TranscriptsDisabled(Exception):
        pass
    class _IpBlocked(Exception):
        pass
    class _RequestBlocked(Exception):
        pass

    rate_limit_exc = Exception("Max retries exceeded (Caused by ResponseError('too many 429 error responses'))")

    call_count = {'n': 0}

    mock_fetched = MagicMock()
    mock_fetched.to_raw_data.return_value = entries
    mock_transcript = MagicMock()
    mock_transcript.fetch.return_value = mock_fetched
    mock_list = MagicMock()
    mock_list.find_manually_created_transcript.return_value = mock_transcript
    mock_list.__iter__ = MagicMock(return_value=iter([mock_transcript]))

    mock_instance = MagicMock()

    def list_side_effect(video_id):
        call_count['n'] += 1
        if call_count['n'] == 1:
            raise rate_limit_exc
        return mock_list

    mock_instance.list.side_effect = list_side_effect
    mock_api_class = MagicMock(return_value=mock_instance)

    # Patch time.sleep to avoid real waits during the backoff
    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=_IpBlocked,
            RequestBlocked=_RequestBlocked,
            NoTranscriptFound=_NoTranscriptFound,
            TranscriptsDisabled=_TranscriptsDisabled,
        ),
    }), patch('routes.youtube.time.sleep') as mock_sleep, \
       patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(ok=False)
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'Retry succeeded' in data['transcript']
    # Verify sleep was called once (between attempt 1 and 2)
    mock_sleep.assert_called_once_with(1)


def test_ingest_youtube_429_all_retries_exhausted_no_proxy(client, mock_extract_user, monkeypatch):
    """POST /ingest-youtube returns 429 with proxy-setup advice when no proxy is configured."""
    monkeypatch.delenv('YOUTUBE_PROXY_URL', raising=False)
    monkeypatch.delenv('WEBSHARE_PROXY_USERNAME', raising=False)
    monkeypatch.delenv('WEBSHARE_PROXY_PASSWORD', raising=False)

    class _NoTranscriptFound(Exception):
        pass
    class _TranscriptsDisabled(Exception):
        pass
    class _IpBlocked(Exception):
        pass
    class _RequestBlocked(Exception):
        pass

    rate_limit_exc = Exception("Max retries exceeded (Caused by ResponseError('too many 429 error responses'))")

    mock_instance = MagicMock()
    mock_instance.list.side_effect = rate_limit_exc
    mock_api_class = MagicMock(return_value=mock_instance)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=_IpBlocked,
            RequestBlocked=_RequestBlocked,
            NoTranscriptFound=_NoTranscriptFound,
            TranscriptsDisabled=_TranscriptsDisabled,
        ),
    }), patch('routes.youtube.time.sleep'):
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 429
    data = resp.json()
    assert data['success'] is False
    assert '429' in data['error']
    assert 'WEBSHARE_PROXY_USERNAME' in data['error']


def test_ingest_youtube_429_all_retries_exhausted_with_proxy(client, mock_extract_user, monkeypatch):
    """POST /ingest-youtube returns 429 with proxy-check advice when a proxy IS configured."""
    monkeypatch.setenv('WEBSHARE_PROXY_USERNAME', 'myuser')
    monkeypatch.setenv('WEBSHARE_PROXY_PASSWORD', 'mypass')
    monkeypatch.delenv('YOUTUBE_PROXY_URL', raising=False)

    class _NoTranscriptFound(Exception):
        pass
    class _TranscriptsDisabled(Exception):
        pass
    class _IpBlocked(Exception):
        pass
    class _RequestBlocked(Exception):
        pass

    rate_limit_exc = Exception("Max retries exceeded (Caused by ResponseError('too many 429 error responses'))")

    mock_instance = MagicMock()
    mock_instance.list.side_effect = rate_limit_exc
    mock_api_class = MagicMock(return_value=mock_instance)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=_IpBlocked,
            RequestBlocked=_RequestBlocked,
            NoTranscriptFound=_NoTranscriptFound,
            TranscriptsDisabled=_TranscriptsDisabled,
        ),
    }), patch('routes.youtube.time.sleep'):
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 429
    data = resp.json()
    assert data['success'] is False
    # Should mention proxy is configured but rate-limited, not tell user to set up proxy
    assert 'proxy' in data['error'].lower()
    assert 'WEBSHARE_PROXY_USERNAME' not in data['error']


# ── Non-dict transcript entries (_chunk_transcript else branch) ───────────────

def test_chunk_transcript_non_dict_entries():
    """_chunk_transcript handles non-dict FetchedTranscriptSnippet objects (lines 109-110, 112)."""
    from routes.youtube import _chunk_transcript

    class Snippet:
        def __init__(self, text, start):
            self.text = text
            self.start = start

    entries = [
        Snippet('Hello world from non-dict entry', 0.0),
        Snippet('', 1.0),          # empty text → skipped (line 112)
        Snippet('Second sentence', 2.0),
    ]
    slides = _chunk_transcript(entries, chunk_size=1200)
    assert len(slides) >= 1
    assert 'Hello world from non-dict entry' in slides[0]['content'][0]


# ── ImportError coverage (lines 166-168) ─────────────────────────────────────

def test_ingest_youtube_missing_dependency(client, mock_extract_user):
    """POST /ingest-youtube returns 500 when youtube-transcript-api is not installed."""
    with patch.dict('sys.modules', {'youtube_transcript_api': None}):
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})
    assert resp.status_code == 500
    data = resp.json()
    assert data['success'] is False
    assert 'not installed' in data['error']


# ── Fallback transcript selection (lines 181-186) ────────────────────────────

def test_ingest_youtube_fallback_to_generated_transcript(client, mock_extract_user):
    """Falls back to generated transcript when manually created one is unavailable (lines 181-183)."""
    entries = [{'text': 'Generated transcript text.', 'start': 0.0, 'duration': 2.0}]

    mock_fetched = MagicMock()
    mock_fetched.to_raw_data.return_value = entries

    mock_transcript = MagicMock()
    mock_transcript.fetch.return_value = mock_fetched

    mock_list = MagicMock()
    mock_list.find_manually_created_transcript.side_effect = Exception("No manual transcript")
    mock_list.find_generated_transcript.return_value = mock_transcript
    mock_list.__iter__ = MagicMock(return_value=iter([mock_transcript]))

    mock_instance = MagicMock()
    mock_instance.list.return_value = mock_list
    mock_api_class = MagicMock(return_value=mock_instance)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=Exception,
            RequestBlocked=Exception,
            NoTranscriptFound=Exception,
            TranscriptsDisabled=Exception,
        ),
    }), patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(ok=False)
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'Generated transcript text' in data['transcript']


def test_ingest_youtube_fallback_to_first_transcript(client, mock_extract_user):
    """Falls back to first available transcript when both preferred ones fail (lines 184-186)."""
    entries = [{'text': 'First available transcript.', 'start': 0.0, 'duration': 2.0}]

    mock_fetched = MagicMock()
    mock_fetched.to_raw_data.return_value = entries

    mock_transcript = MagicMock()
    mock_transcript.fetch.return_value = mock_fetched

    mock_list = MagicMock()
    mock_list.find_manually_created_transcript.side_effect = Exception("No manual transcript")
    mock_list.find_generated_transcript.side_effect = Exception("No generated transcript")
    mock_list.__iter__ = MagicMock(return_value=iter([mock_transcript]))

    mock_instance = MagicMock()
    mock_instance.list.return_value = mock_list
    mock_api_class = MagicMock(return_value=mock_instance)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=Exception,
            RequestBlocked=Exception,
            NoTranscriptFound=Exception,
            TranscriptsDisabled=Exception,
        ),
    }), patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(ok=False)
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'First available transcript' in data['transcript']


# ── Fetched transcript without to_raw_data (line 192) ─────────────────────────

def test_ingest_youtube_fetched_list_not_raw_data(client, mock_extract_user):
    """POST /ingest-youtube handles fetched transcript that is a plain list (line 192)."""
    # A plain list has no to_raw_data attribute → falls back to list(fetched)
    entries = [{'text': 'List-based transcript entry.', 'start': 0.0, 'duration': 2.0}]

    mock_transcript = MagicMock()
    mock_transcript.fetch.return_value = entries  # plain list, no to_raw_data

    mock_list = MagicMock()
    mock_list.find_manually_created_transcript.return_value = mock_transcript
    mock_list.__iter__ = MagicMock(return_value=iter([mock_transcript]))

    mock_instance = MagicMock()
    mock_instance.list.return_value = mock_list
    mock_api_class = MagicMock(return_value=mock_instance)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=Exception,
            RequestBlocked=Exception,
            NoTranscriptFound=Exception,
            TranscriptsDisabled=Exception,
        ),
    }), patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(ok=False)
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'List-based transcript entry' in data['transcript']


# ── Generic non-rate-limited fetch exception (lines 237-238) ─────────────────

def test_ingest_youtube_general_fetch_exception(client, mock_extract_user):
    """POST /ingest-youtube returns 422 for a generic (non-rate-limited) fetch error (lines 237-238)."""
    class _NoTranscriptFound(Exception):
        pass

    class _TranscriptsDisabled(Exception):
        pass

    class _IpBlocked(Exception):
        pass

    class _RequestBlocked(Exception):
        pass

    mock_instance = MagicMock()
    mock_instance.list.side_effect = Exception("weird connection error")
    mock_api_class = MagicMock(return_value=mock_instance)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=_IpBlocked,
            RequestBlocked=_RequestBlocked,
            NoTranscriptFound=_NoTranscriptFound,
            TranscriptsDisabled=_TranscriptsDisabled,
        ),
    }):
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 422
    data = resp.json()
    assert data['success'] is False
    assert 'Could not fetch transcript' in data['error']


# ── oEmbed request exception (lines 258-259) ─────────────────────────────────

def test_ingest_youtube_oembed_exception(client, mock_extract_user):
    """POST /ingest-youtube still succeeds with fallback title when oEmbed request raises (lines 258-259)."""
    entries = [{'text': 'Test transcript.', 'start': 0.0, 'duration': 2.0}]
    mock_api_class = _make_mock_transcript_api(entries)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_class,
            IpBlocked=Exception,
            RequestBlocked=Exception,
            NoTranscriptFound=Exception,
            TranscriptsDisabled=Exception,
        ),
    }), patch('requests.get', side_effect=Exception("connection refused")):
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    # Title falls back to the default "YouTube — <video_id>" format
    assert 'dQw4w9WgXcQ' in data['title']


# ── Outer exception handler (lines 270-272) ──────────────────────────────────

def test_ingest_youtube_outer_exception(client, monkeypatch):
    """POST /ingest-youtube catches unexpected exceptions at the top level and returns 500 (lines 270-272)."""
    import services.auth as auth_svc
    monkeypatch.setattr(
        auth_svc,
        '_extract_verified_user',
        MagicMock(side_effect=RuntimeError("unexpected error")),
    )
    resp = client.post('/ingest-youtube',
                       json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})
    assert resp.status_code == 500
    data = resp.json()
    assert data['success'] is False
    assert 'unexpected error' in data['error']


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/youtube/ingest  (v2)
# ══════════════════════════════════════════════════════════════════════════════

class TestYouTubeIngestV2:
    """Tests for the new v2 endpoint POST /api/youtube/ingest."""

    _URL = '/api/youtube/ingest'
    _VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    _VIDEO_ID = 'dQw4w9WgXcQ'

    def test_v2_route_registered(self, app):
        """POST /api/youtube/ingest is registered in the application router."""
        paths = [r.path for r in app.routes]
        assert '/api/youtube/ingest' in paths

    def test_v2_missing_url_returns_400(self, client, mock_extract_user):
        resp = client.post(self._URL, json={})
        assert resp.status_code == 400
        assert resp.json()['success'] is False
        assert 'url is required' in resp.json()['error']

    def test_v2_invalid_url_returns_400(self, client, mock_extract_user):
        resp = client.post(self._URL, json={'url': 'https://example.com/not-youtube'})
        assert resp.status_code == 400
        assert 'video ID' in resp.json()['error']

    def test_v2_success_response_shape(self, client, mock_extract_user, monkeypatch):
        """Happy path: returns all required fields including timestamp_seconds and duration_seconds."""
        entries = [
            {'text': 'Hello from v2 endpoint.', 'start': 0.0, 'duration': 5.0},
            {'text': 'Second sentence here.', 'start': 5.0, 'duration': 3.0},
        ]
        mock_api_class = _make_mock_transcript_api(entries)

        # Prevent real ctx.redis from raising
        import routes.shared as shared_mod
        mock_ctx = MagicMock()
        mock_ctx.redis = MagicMock()
        mock_ctx.redis.setex.return_value = True
        monkeypatch.setattr(shared_mod, 'ctx', mock_ctx)

        with patch.dict('sys.modules', {
            'youtube_transcript_api': MagicMock(
                YouTubeTranscriptApi=mock_api_class,
                IpBlocked=Exception,
                RequestBlocked=Exception,
                NoTranscriptFound=Exception,
                TranscriptsDisabled=Exception,
            ),
        }), patch('httpx.AsyncClient') as mock_httpx:
            # Mock oEmbed response
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.json.return_value = {'title': 'V2 Video Title'}
            mock_httpx.return_value.__aenter__ = MagicMock(return_value=MagicMock(
                get=MagicMock(return_value=mock_resp)
            ))
            mock_httpx.return_value.__aexit__ = MagicMock(return_value=False)
            resp = client.post(self._URL, json={'url': self._VIDEO_URL})

        assert resp.status_code == 200
        data = resp.json()
        assert data['success'] is True
        assert data['video_id'] == self._VIDEO_ID
        assert 'title' in data
        assert 'duration_seconds' in data
        assert isinstance(data['duration_seconds'], (int, float))
        assert 'transcript_full' in data
        assert 'slides' in data
        assert 'total_slides' in data
        # Every slide must carry timestamp_seconds
        for slide in data['slides']:
            assert 'timestamp_seconds' in slide, f"slide missing timestamp_seconds: {slide}"
            assert isinstance(slide['timestamp_seconds'], float)

    def test_v2_timestamp_seconds_values(self, client, mock_extract_user, monkeypatch):
        """timestamp_seconds in slides matches the start time of the first entry in each chunk."""
        # Use small chunk_size so we get multiple slides
        entries = [
            {'text': 'word ' * 300, 'start': 0.0, 'duration': 10.0},
            {'text': 'word ' * 300, 'start': 60.0, 'duration': 10.0},
        ]
        mock_api_class = _make_mock_transcript_api(entries)

        import routes.shared as shared_mod
        mock_ctx = MagicMock()
        mock_ctx.redis = None
        monkeypatch.setattr(shared_mod, 'ctx', mock_ctx)

        with patch.dict('sys.modules', {
            'youtube_transcript_api': MagicMock(
                YouTubeTranscriptApi=mock_api_class,
                IpBlocked=Exception,
                RequestBlocked=Exception,
                NoTranscriptFound=Exception,
                TranscriptsDisabled=Exception,
            ),
        }), patch('httpx.AsyncClient') as mock_httpx:
            mock_httpx.return_value.__aenter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=MagicMock(status_code=404)))
            )
            mock_httpx.return_value.__aexit__ = MagicMock(return_value=False)
            resp = client.post(self._URL, json={'url': self._VIDEO_URL})

        assert resp.status_code == 200
        slides = resp.json()['slides']
        assert len(slides) >= 2
        assert slides[0]['timestamp_seconds'] == 0.0
        # Second chunk starts at the beginning of the second entry (60.0)
        assert slides[-1]['timestamp_seconds'] == 60.0

    def test_v2_writes_to_redis(self, client, mock_extract_user, monkeypatch):
        """Successful ingestion writes slides to Redis with the correct key and TTL."""
        import json
        entries = [{'text': 'Redis test entry.', 'start': 0.0, 'duration': 3.0}]
        mock_api_class = _make_mock_transcript_api(entries)

        import routes.shared as shared_mod
        mock_ctx = MagicMock()
        mock_redis = MagicMock()
        mock_ctx.redis = mock_redis
        monkeypatch.setattr(shared_mod, 'ctx', mock_ctx)

        with patch.dict('sys.modules', {
            'youtube_transcript_api': MagicMock(
                YouTubeTranscriptApi=mock_api_class,
                IpBlocked=Exception,
                RequestBlocked=Exception,
                NoTranscriptFound=Exception,
                TranscriptsDisabled=Exception,
            ),
        }), patch('httpx.AsyncClient') as mock_httpx:
            mock_httpx.return_value.__aenter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=MagicMock(status_code=404)))
            )
            mock_httpx.return_value.__aexit__ = MagicMock(return_value=False)
            resp = client.post(self._URL, json={'url': self._VIDEO_URL})

        assert resp.status_code == 200
        mock_redis.setex.assert_called_once()
        key_arg, ttl_arg, value_arg = mock_redis.setex.call_args[0]
        assert key_arg == f'yt_transcript:{self._VIDEO_ID}'
        assert ttl_arg == 3600
        cached = json.loads(value_arg)
        assert isinstance(cached, list)
        assert len(cached) >= 1

    def test_v2_redis_error_does_not_fail_request(self, client, mock_extract_user, monkeypatch):
        """A Redis write error must not propagate — the response should still be 200."""
        entries = [{'text': 'Redis error test.', 'start': 0.0, 'duration': 2.0}]
        mock_api_class = _make_mock_transcript_api(entries)

        import routes.shared as shared_mod
        mock_ctx = MagicMock()
        mock_ctx.redis = MagicMock()
        mock_ctx.redis.setex.side_effect = Exception('Redis unavailable')
        monkeypatch.setattr(shared_mod, 'ctx', mock_ctx)

        with patch.dict('sys.modules', {
            'youtube_transcript_api': MagicMock(
                YouTubeTranscriptApi=mock_api_class,
                IpBlocked=Exception,
                RequestBlocked=Exception,
                NoTranscriptFound=Exception,
                TranscriptsDisabled=Exception,
            ),
        }), patch('httpx.AsyncClient') as mock_httpx:
            mock_httpx.return_value.__aenter__ = MagicMock(
                return_value=MagicMock(get=MagicMock(return_value=MagicMock(status_code=404)))
            )
            mock_httpx.return_value.__aexit__ = MagicMock(return_value=False)
            resp = client.post(self._URL, json={'url': self._VIDEO_URL})

        assert resp.status_code == 200
        assert resp.json()['success'] is True

    def test_v2_no_transcript_returns_422(self, client, mock_extract_user, monkeypatch):
        """POST /api/youtube/ingest returns 422 when no transcript is available."""
        class _NoTranscriptFound(Exception):
            pass
        class _TranscriptsDisabled(Exception):
            pass

        mock_instance = MagicMock()
        mock_instance.list.side_effect = _NoTranscriptFound("no transcript")
        mock_api_class = MagicMock(return_value=mock_instance)

        import routes.shared as shared_mod
        mock_ctx = MagicMock()
        mock_ctx.redis = None
        monkeypatch.setattr(shared_mod, 'ctx', mock_ctx)

        with patch.dict('sys.modules', {
            'youtube_transcript_api': MagicMock(
                YouTubeTranscriptApi=mock_api_class,
                IpBlocked=Exception,
                RequestBlocked=Exception,
                NoTranscriptFound=_NoTranscriptFound,
                TranscriptsDisabled=_TranscriptsDisabled,
            ),
        }):
            resp = client.post(self._URL, json={'url': self._VIDEO_URL})

        assert resp.status_code == 422
        assert resp.json()['success'] is False

    def test_v2_chunk_transcript_includes_timestamp_seconds(self):
        """_chunk_transcript always sets timestamp_seconds on every slide."""
        from routes.youtube import _chunk_transcript
        entries = [
            {'text': 'word ' * 300, 'start': 12.5, 'duration': 10.0},
        ]
        slides = _chunk_transcript(entries, chunk_size=100)
        assert len(slides) >= 1
        for slide in slides:
            assert 'timestamp_seconds' in slide
            assert isinstance(slide['timestamp_seconds'], float)

    def test_v2_duration_seconds_computed_correctly(self):
        """_compute_duration_seconds returns start + duration of the last entry."""
        from routes.youtube import _compute_duration_seconds
        entries = [
            {'text': 'a', 'start': 0.0, 'duration': 5.0},
            {'text': 'b', 'start': 100.0, 'duration': 30.0},
        ]
        assert _compute_duration_seconds(entries) == 130.0
        assert _compute_duration_seconds([]) == 0.0


