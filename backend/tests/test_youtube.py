"""Tests for the youtube blueprint (/ingest-youtube)."""
import pytest
from unittest.mock import MagicMock, patch


def test_ingest_youtube_options(client):
    """OPTIONS /ingest-youtube returns 200 (CORS preflight)."""
    resp = client.options('/ingest-youtube')
    assert resp.status_code == 200


def test_ingest_youtube_missing_url(client, mock_extract_user):
    """POST /ingest-youtube with no url returns 400."""
    resp = client.post('/ingest-youtube', json={})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False
    assert 'url is required' in data['error']


def test_ingest_youtube_invalid_url(client, mock_extract_user):
    """POST /ingest-youtube with an unrecognised URL returns 400."""
    resp = client.post('/ingest-youtube', json={'url': 'https://example.com/not-youtube'})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False
    assert 'video ID' in data['error']


def test_ingest_youtube_blueprint_registered(app):
    """The youtube blueprint is registered with the correct route."""
    rules = [r.rule for r in app.url_map.iter_rules()]
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
    data = resp.get_json()
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
    data = resp.get_json()
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
    data = resp.get_json()
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



def test_ingest_youtube_options(client):
    """OPTIONS /ingest-youtube returns 200 (CORS preflight)."""
    resp = client.options('/ingest-youtube')
    assert resp.status_code == 200


def test_ingest_youtube_missing_url(client, mock_extract_user):
    """POST /ingest-youtube with no url returns 400."""
    resp = client.post('/ingest-youtube', json={})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False
    assert 'url is required' in data['error']


def test_ingest_youtube_invalid_url(client, mock_extract_user):
    """POST /ingest-youtube with an unrecognised URL returns 400."""
    resp = client.post('/ingest-youtube', json={'url': 'https://example.com/not-youtube'})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False
    assert 'video ID' in data['error']


def test_ingest_youtube_blueprint_registered(app):
    """The youtube blueprint is registered with the correct route."""
    rules = [r.rule for r in app.url_map.iter_rules()]
    assert '/ingest-youtube' in rules


def _make_mock_transcript_api(entries, title='Test Video'):
    """Build a mock YouTubeTranscriptApi object that returns ``entries``."""
    mock_transcript = MagicMock()
    mock_transcript.fetch.return_value = entries

    mock_list = MagicMock()
    mock_list._manually_created_transcripts = {'en': mock_transcript}
    mock_list._generated_transcripts = {}
    mock_list.find_manually_created_transcript.return_value = mock_transcript

    mock_api = MagicMock()
    mock_api.list_transcripts.return_value = mock_list
    return mock_api


def test_ingest_youtube_success(client, mock_extract_user):
    """POST /ingest-youtube with a valid URL returns slides and transcript."""
    entries = [
        {'text': 'Hello world this is a test transcript.', 'start': 0.0, 'duration': 3.0},
        {'text': 'Second sentence here.', 'start': 3.0, 'duration': 2.0},
    ]

    mock_api = _make_mock_transcript_api(entries)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api,
            NoTranscriptFound=Exception,
            TranscriptsDisabled=Exception,
        ),
    }), patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(ok=True, json=lambda: {'title': 'My Video'})

        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 200
    data = resp.get_json()
    assert data['success'] is True
    assert data['video_id'] == 'dQw4w9WgXcQ'
    assert data['title'] == 'My Video'
    assert isinstance(data['slides'], list)
    assert data['total_slides'] >= 1
    assert 'Hello world' in data['transcript']


def test_ingest_youtube_youtu_be_url(client, mock_extract_user):
    """POST /ingest-youtube accepts youtu.be short URLs."""
    entries = [{'text': 'Short URL transcript.', 'start': 0.0, 'duration': 2.0}]
    mock_api = _make_mock_transcript_api(entries)

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api,
            NoTranscriptFound=Exception,
            TranscriptsDisabled=Exception,
        ),
    }), patch('requests.get') as mock_get:
        mock_get.return_value = MagicMock(ok=False)

        resp = client.post('/ingest-youtube',
                           json={'url': 'https://youtu.be/dQw4w9WgXcQ'})

    assert resp.status_code == 200
    data = resp.get_json()
    assert data['video_id'] == 'dQw4w9WgXcQ'


def test_ingest_youtube_no_transcript(client, mock_extract_user):
    """POST /ingest-youtube returns 422 when no transcript is available."""
    class _NoTranscriptFound(Exception):
        pass
    class _TranscriptsDisabled(Exception):
        pass

    mock_api = MagicMock()
    mock_api.list_transcripts.side_effect = _NoTranscriptFound("no transcript")

    with patch.dict('sys.modules', {
        'youtube_transcript_api': MagicMock(
            YouTubeTranscriptApi=mock_api,
            NoTranscriptFound=_NoTranscriptFound,
            TranscriptsDisabled=_TranscriptsDisabled,
        ),
    }):
        resp = client.post('/ingest-youtube',
                           json={'url': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'})

    assert resp.status_code == 422
    data = resp.get_json()
    assert data['success'] is False
    assert 'transcript' in data['error'].lower() or 'fetch' in data['error'].lower()


def test_ingest_youtube_chunking():
    """_chunk_transcript splits entries correctly into slides."""
    from routes.youtube import _chunk_transcript

    # Build 3 entries that together exceed the default chunk size
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
