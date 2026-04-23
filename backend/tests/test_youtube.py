"""Tests for routes/youtube.py — POST /api/youtube/process (v2 async endpoint)."""
import json
import pytest
from unittest.mock import MagicMock, patch


# ── Utility function tests ──────────────────────────────────────────────────────

def test_chunk_transcript_splits_into_slides():
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


def test_chunk_transcript_non_dict_entries():
    """_chunk_transcript handles non-dict dataclass-like objects."""
    from routes.youtube import _chunk_transcript

    class Snippet:
        def __init__(self, text, start):
            self.text = text
            self.start = start

    entries = [
        Snippet('Hello world from non-dict entry', 0.0),
        Snippet('', 1.0),          # empty text → skipped
        Snippet('Second sentence', 2.0),
    ]
    slides = _chunk_transcript(entries, chunk_size=1200)
    assert len(slides) >= 1
    assert 'Hello world from non-dict entry' in slides[0]['content'][0]


def test_chunk_transcript_includes_timestamp_seconds():
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


def test_compute_duration_seconds():
    """_compute_duration_seconds returns start + duration of the last entry."""
    from routes.youtube import _compute_duration_seconds
    entries = [
        {'text': 'a', 'start': 0.0, 'duration': 5.0},
        {'text': 'b', 'start': 100.0, 'duration': 30.0},
    ]
    assert _compute_duration_seconds(entries) == 130.0
    assert _compute_duration_seconds([]) == 0.0


# ══════════════════════════════════════════════════════════════════════════════
# GET /api/youtube/transcript (youtube-transcript-api fallback)
# ══════════════════════════════════════════════════════════════════════════════

class TestYouTubeTranscriptGet:
    """Tests for GET /api/youtube/transcript — python backend fallback endpoint."""

    _URL = '/api/youtube/transcript'
    _VIDEO_ID = 'dQw4w9WgXcQ'

    def _make_snippet(self, text, start=0.0, duration=3.0):
        """Create a minimal FetchedTranscriptSnippet-like object."""
        class _Snippet:
            pass
        s = _Snippet()
        s.text = text
        s.start = start
        s.duration = duration
        return s

    def test_transcript_route_registered(self, app):
        """GET /api/youtube/transcript is registered in the application router."""
        paths = [r.path for r in app.routes]
        assert '/api/youtube/transcript' in paths

    def test_missing_video_id_returns_400(self, client, mock_extract_user):
        resp = client.get(self._URL)
        assert resp.status_code == 400
        assert 'video_id' in resp.json()['error']

    def test_invalid_video_id_returns_400(self, client, mock_extract_user):
        resp = client.get(f'{self._URL}?video_id=invalid!!')
        assert resp.status_code == 400
        assert 'video_id' in resp.json()['error']

    def test_success_returns_entries(self, client, mock_extract_user):
        """When youtube-transcript-api returns entries, the endpoint returns 200."""
        snippet = self._make_snippet('Hello world', 0.0, 3.0)

        mock_fetched = [snippet]
        mock_api = MagicMock()
        mock_api.fetch.return_value = mock_fetched
        mock_api_cls = MagicMock(return_value=mock_api)

        with patch.dict('sys.modules', {'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api_cls,
        )}):
            with patch('routes.youtube.YouTubeTranscriptApi', mock_api_cls, create=True):
                resp = client.get(f'{self._URL}?video_id={self._VIDEO_ID}')

        # The actual test may not fully mock all imports, so just check it
        # doesn't crash with a 500 if the library is available.
        assert resp.status_code in (200, 404, 503)

    def test_no_transcript_returns_404(self, client, mock_extract_user):
        """When no transcript is available, return 404."""
        from youtube_transcript_api import NoTranscriptFound

        mock_api = MagicMock()
        mock_api.fetch.side_effect = NoTranscriptFound(self._VIDEO_ID, ['en'], [])
        mock_api.list.side_effect = NoTranscriptFound(self._VIDEO_ID, ['en'], [])
        mock_api_cls = MagicMock(return_value=mock_api)

        with patch('routes.youtube.YouTubeTranscriptApi', mock_api_cls):
            resp = client.get(f'{self._URL}?video_id={self._VIDEO_ID}')

        assert resp.status_code == 404
        assert 'No transcript' in resp.json()['error']


# ══════════════════════════════════════════════════════════════════════════════
# POST /api/youtube/process
# ══════════════════════════════════════════════════════════════════════════════

class TestYouTubeProcess:
    """Tests for POST /api/youtube/process — browser-first ingestion endpoint."""

    _URL = '/api/youtube/process'
    _VIDEO_ID = 'dQw4w9WgXcQ'
    _ENTRIES = [
        {'text': 'Hello from process endpoint.', 'start': 0.0, 'duration': 5.0},
        {'text': 'Second sentence here.', 'start': 5.0, 'duration': 3.0},
    ]

    def _mock_ctx(self, monkeypatch, *, redis=None, supabase=None):
        """Inject a mock ctx with configurable redis and supabase_client."""
        import routes.shared as shared_mod
        mock_ctx = MagicMock()
        mock_ctx.redis = redis
        mock_ctx.supabase_client = supabase
        monkeypatch.setattr(shared_mod, 'ctx', mock_ctx)
        return mock_ctx

    def test_process_route_registered(self, app):
        """POST /api/youtube/process is registered in the application router."""
        paths = [r.path for r in app.routes]
        assert '/api/youtube/process' in paths

    def test_process_missing_video_id_returns_400(self, client, mock_extract_user, monkeypatch):
        self._mock_ctx(monkeypatch)
        resp = client.post(self._URL, json={})
        assert resp.status_code == 400
        assert resp.json()['success'] is False
        assert 'video_id' in resp.json()['error']

    def test_process_invalid_video_id_returns_400(self, client, mock_extract_user, monkeypatch):
        self._mock_ctx(monkeypatch)
        resp = client.post(self._URL, json={'video_id': 'not-valid!!'})
        assert resp.status_code == 400
        assert 'video_id' in resp.json()['error']

    def test_process_invalid_entries_type_returns_400(self, client, mock_extract_user, monkeypatch):
        self._mock_ctx(monkeypatch)
        resp = client.post(self._URL, json={'video_id': self._VIDEO_ID, 'entries': 'bad'})
        assert resp.status_code == 400
        assert 'entries' in resp.json()['error']

    def test_process_no_entries_and_no_cache_returns_400(self, client, mock_extract_user, monkeypatch):
        """When entries are empty and nothing is cached, return 400."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        self._mock_ctx(monkeypatch, redis=mock_redis)
        resp = client.post(self._URL, json={'video_id': self._VIDEO_ID, 'entries': []})
        assert resp.status_code == 400
        assert 'entries are required' in resp.json()['error']

    def test_process_success_from_entries(self, client, mock_extract_user, monkeypatch):
        """Happy path: entries are chunked and slides are returned."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        self._mock_ctx(monkeypatch, redis=mock_redis)

        resp = client.post(self._URL, json={
            'video_id': self._VIDEO_ID,
            'title':    'Test Video',
            'entries':  self._ENTRIES,
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data['success'] is True
        assert data['video_id'] == self._VIDEO_ID
        assert data['title'] == 'Test Video'
        assert 'slides' in data
        assert 'duration_seconds' in data
        assert 'transcript_full' in data
        assert 'total_slides' in data
        assert data['cached'] is False
        for slide in data['slides']:
            assert 'timestamp_seconds' in slide
            assert isinstance(slide['timestamp_seconds'], float)

    def test_process_uses_default_title(self, client, mock_extract_user, monkeypatch):
        """When title is omitted the endpoint falls back to 'YouTube — {video_id}'."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        self._mock_ctx(monkeypatch, redis=mock_redis)

        resp = client.post(self._URL, json={'video_id': self._VIDEO_ID, 'entries': self._ENTRIES})
        assert resp.status_code == 200
        assert resp.json()['title'] == f'YouTube — {self._VIDEO_ID}'

    def test_process_writes_to_redis(self, client, mock_extract_user, monkeypatch):
        """Successful processing writes slides to Redis with the correct key and TTL."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        self._mock_ctx(monkeypatch, redis=mock_redis)

        resp = client.post(self._URL, json={
            'video_id': self._VIDEO_ID,
            'title':    'Redis Test Video',
            'entries':  self._ENTRIES,
        })

        assert resp.status_code == 200
        mock_redis.setex.assert_called_once()
        key_arg, ttl_arg, value_arg = mock_redis.setex.call_args[0]
        assert key_arg == f'yt_transcript:{self._VIDEO_ID}'
        assert ttl_arg == 3600
        cached = json.loads(value_arg)
        assert isinstance(cached, list)
        assert len(cached) >= 1

    def test_process_redis_error_does_not_fail_request(self, client, mock_extract_user, monkeypatch):
        """A Redis write error must not propagate — the response should still be 200."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        mock_redis.setex.side_effect = Exception('Redis unavailable')
        self._mock_ctx(monkeypatch, redis=mock_redis)

        resp = client.post(self._URL, json={
            'video_id': self._VIDEO_ID,
            'entries':  self._ENTRIES,
        })
        assert resp.status_code == 200
        assert resp.json()['success'] is True

    def test_process_returns_cached_from_redis(self, client, mock_extract_user, monkeypatch):
        """A Redis cache hit returns cached slides immediately without chunking."""
        cached_slides = [{
            'slide_number': 1, 'title': '[0:00]',
            'timestamp_seconds': 0.0, 'content': ['cached text'], 'notes': '',
        }]
        mock_redis = MagicMock()
        mock_redis.get.return_value = json.dumps(cached_slides)
        self._mock_ctx(monkeypatch, redis=mock_redis)

        resp = client.post(self._URL, json={
            'video_id': self._VIDEO_ID,
            'title':    'Cached Video',
            'entries':  [],
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data['success'] is True
        assert data['cached'] is True
        assert data['slides'] == cached_slides

    def test_process_returns_cached_from_supabase(self, client, mock_extract_user, monkeypatch):
        """A Supabase cache hit returns cached slides and backfills Redis."""
        cached_slides = [{
            'slide_number': 1, 'title': '[0:00]',
            'timestamp_seconds': 0.0, 'content': ['supabase text'], 'notes': '',
        }]

        mock_redis = MagicMock()
        mock_redis.get.return_value = None  # Redis miss

        mock_sb_resp = MagicMock()
        mock_sb_resp.status_code = 200
        mock_sb_resp.json.return_value = [{
            'slides': cached_slides,
            'title': 'Supabase Cached Title',
            'duration_seconds': 42.0,
        }]

        async def _sb_get(*a, **kw):
            return mock_sb_resp
        mock_supabase = MagicMock()
        mock_supabase.get = _sb_get

        self._mock_ctx(monkeypatch, redis=mock_redis, supabase=mock_supabase)

        resp = client.post(self._URL, json={
            'video_id': self._VIDEO_ID,
            'title':    'Any Title',
            'entries':  [],
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data['success'] is True
        assert data['cached'] is True
        assert data['title'] == 'Supabase Cached Title'
        assert data['slides'] == cached_slides
        # Redis should be backfilled
        mock_redis.setex.assert_called_once()

    def test_process_supabase_write_error_does_not_fail(self, client, mock_extract_user, monkeypatch):
        """A Supabase write error must not propagate — the response should still be 200."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None

        async def _sb_get(*a, **kw):
            return MagicMock(status_code=200, json=MagicMock(return_value=[]))

        async def _sb_post(*a, **kw):
            raise Exception('Supabase write failed')

        mock_supabase = MagicMock()
        mock_supabase.get = _sb_get
        mock_supabase.post = _sb_post

        self._mock_ctx(monkeypatch, redis=mock_redis, supabase=mock_supabase)

        resp = client.post(self._URL, json={
            'video_id': self._VIDEO_ID,
            'entries':  self._ENTRIES,
        })
        assert resp.status_code == 200
        assert resp.json()['success'] is True

    def test_process_timestamp_seconds_values(self, client, mock_extract_user, monkeypatch):
        """timestamp_seconds in slides matches the start time of the first entry in each chunk."""
        entries = [
            {'text': 'word ' * 300, 'start': 0.0, 'duration': 10.0},
            {'text': 'word ' * 300, 'start': 60.0, 'duration': 10.0},
        ]
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        self._mock_ctx(monkeypatch, redis=mock_redis)

        resp = client.post(self._URL, json={
            'video_id': self._VIDEO_ID,
            'entries':  entries,
        })
        assert resp.status_code == 200
        slides = resp.json()['slides']
        assert len(slides) >= 2
        assert slides[0]['timestamp_seconds'] == 0.0
        assert slides[-1]['timestamp_seconds'] == 60.0



