"""Tests for the async job queue and /ask-async + /jobs/<id> endpoints."""
import time
import pytest
from unittest.mock import MagicMock, patch

from services.job_queue import JobQueue, STATUS_QUEUED, STATUS_COMPLETED, STATUS_FAILED


# ── Module-level helpers for RQ unit tests ────────────────────────────────────
# RQ requires picklable (importable) functions; local/lambda functions can't
# be used as job targets even in is_async=False mode.

def _test_job_fn():
    """Return a fixed dict — used by test_job_completes_successfully."""
    return {"answer": "42"}


def _test_fail_fn():
    """Always raise — used by test_job_failure_stored."""
    raise ValueError("boom")


# ── Unit tests for JobQueue ──────────────────────────────────────────────────

class TestJobQueueUnit:
    """Low-level tests for the JobQueue class itself."""

    @staticmethod
    def _make_mock_redis():
        """Create an isolated fake Redis client for testing."""
        import fakeredis
        return fakeredis.FakeRedis()

    def test_init_no_redis(self):
        q = JobQueue()
        q.init(redis=None)
        assert q._ready is True
        assert q._queue is None

    def test_init_with_redis(self):
        q = JobQueue()
        q.init(redis=self._make_mock_redis(), _is_async=False)
        assert q._ready is True
        assert q._queue is not None

    def test_enqueue_returns_job_id(self):
        q = JobQueue()
        q.init(redis=self._make_mock_redis(), _is_async=False)
        job_id = q.enqueue(_test_job_fn)
        assert isinstance(job_id, str)
        assert len(job_id) == 32  # uuid4 hex

    def test_job_completes_successfully(self):
        q = JobQueue()
        q.init(redis=self._make_mock_redis(), _is_async=False)
        job_id = q.enqueue(_test_job_fn)
        # With is_async=False, the job runs synchronously on enqueue
        for _ in range(50):
            info = q.get_status(job_id)
            if info and info["status"] == STATUS_COMPLETED:
                break
            time.sleep(0.05)
        info = q.get_status(job_id)
        assert info is not None
        assert info["status"] == STATUS_COMPLETED
        assert info["result"] == {"answer": "42"}

    def test_job_failure_stored(self):
        q = JobQueue()
        q.init(redis=self._make_mock_redis(), _is_async=False)

        job_id = q.enqueue(_test_fail_fn)
        for _ in range(50):
            info = q.get_status(job_id)
            if info and info["status"] == STATUS_FAILED:
                break
            time.sleep(0.05)
        info = q.get_status(job_id)
        assert info is not None
        assert info["status"] == STATUS_FAILED
        assert "boom" in info["error"]

    def test_unknown_job_returns_none(self):
        q = JobQueue()
        q.init(redis=self._make_mock_redis(), _is_async=False)
        assert q.get_status("nonexistent") is None

    def test_enqueue_before_init_raises(self):
        q = JobQueue()
        with pytest.raises(RuntimeError, match="not initialised"):
            q.enqueue(_test_job_fn)

    def test_enqueue_without_redis_raises(self):
        q = JobQueue()
        q.init(redis=None)
        with pytest.raises(RuntimeError, match="requires Redis"):
            q.enqueue(_test_job_fn)


# ── Integration tests for HTTP endpoints ─────────────────────────────────────

def test_ask_async_options(client):
    """OPTIONS /ask-async returns 200."""
    resp = client.options('/ask-async')
    assert resp.status_code == 200


def test_ask_async_no_body(client):
    """POST /ask-async with no JSON returns 400."""
    resp = client.post('/ask-async')
    assert resp.status_code in (400, 422)


def test_ask_async_empty_question(client):
    """POST /ask-async with empty question returns 400."""
    resp = client.post('/ask-async', json={'question': '', 'mode': 'study'})
    assert resp.status_code == 400
    data = resp.json()
    assert data['success'] is False


def test_ask_async_returns_job_id(client, monkeypatch, mock_guest_gate):
    """POST /ask-async returns 202 with a jobId."""
    import services.job_queue as jq_mod
    mock_enqueue = MagicMock(return_value='abc123def456')
    monkeypatch.setattr(jq_mod.job_queue, 'enqueue', mock_enqueue)

    resp = client.post('/ask-async', json={
        'question': 'What is water?',
        'mode': 'study',
        'complexity': 3,
    })
    assert resp.status_code == 202
    data = resp.json()
    assert data['success'] is True
    assert data['jobId'] == 'abc123def456'
    assert data['status'] == 'queued'
    mock_enqueue.assert_called_once()


def test_get_job_not_found(client):
    """GET /jobs/<bad_id> returns 404."""
    resp = client.get('/jobs/does-not-exist')
    assert resp.status_code == 404
    data = resp.json()
    assert data['success'] is False


def test_get_job_queued(client, monkeypatch):
    """GET /jobs/<id> returns queued status."""
    import services.job_queue as jq_mod
    monkeypatch.setattr(jq_mod.job_queue, 'get_status', MagicMock(return_value={
        'status': 'queued',
        'result': None,
        'error': None,
    }))

    resp = client.get('/jobs/someid')
    assert resp.status_code == 200
    data = resp.json()
    assert data['status'] == 'queued'
    assert data['jobId'] == 'someid'


def test_get_job_completed(client, monkeypatch):
    """GET /jobs/<id> returns result when completed."""
    import services.job_queue as jq_mod
    monkeypatch.setattr(jq_mod.job_queue, 'get_status', MagicMock(return_value={
        'status': 'completed',
        'result': {'success': True, 'answer': 'H2O'},
        'error': None,
    }))

    resp = client.get('/jobs/someid')
    assert resp.status_code == 200
    data = resp.json()
    assert data['status'] == 'completed'
    assert data['result']['answer'] == 'H2O'


def test_get_job_failed(client, monkeypatch):
    """GET /jobs/<id> returns error when failed."""
    import services.job_queue as jq_mod
    monkeypatch.setattr(jq_mod.job_queue, 'get_status', MagicMock(return_value={
        'status': 'failed',
        'result': None,
        'error': 'Something went wrong',
    }))

    resp = client.get('/jobs/someid')
    assert resp.status_code == 200
    data = resp.json()
    assert data['status'] == 'failed'
    assert data['error'] == 'Something went wrong'


def test_jobs_blueprint_registered(app):
    """The /ask-async and /jobs/<job_id> routes are registered."""
    rules = [r.path for r in app.routes]
    assert '/ask-async' in rules
    assert '/jobs/{job_id}' in rules


def test_ask_async_validation(client):
    """POST /ask-async with invalid complexity returns 422."""
    resp = client.post('/ask-async', json={
        'question': 'What is water?',
        'complexity': 'not-an-int',
    })
    assert resp.status_code == 422


# ── _run_ask_job unit tests ──────────────────────────────────────────────────

def test_run_ask_job_basic(app, monkeypatch):
    """_run_ask_job executes study mode and returns response dict."""
    import services.ai as ai_svc
    import services.books as books_svc
    import services.device_abuse as device_mod
    from routes.jobs import _run_ask_job

    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value="Job answer"))
    monkeypatch.setattr(ai_svc, 'should_search_textbook', MagicMock(return_value=False))
    monkeypatch.setattr(ai_svc, 'sanitize_user_memory', MagicMock(return_value=''))

    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    mock_searcher.has_embeddings = False
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    result = _run_ask_job({
        'question': 'What is pH?',
        'mode': 'study',
        'complexity': 3,
        'bookId': 'zumdahl',
        '_verified_user_id': 'test-user',
    })
    assert result['success'] is True
    assert result['mode'] == 'study'
    assert result['answer'] == 'Job answer'


def test_run_ask_job_with_doc_context(app, monkeypatch):
    """_run_ask_job with doc_context uses uploaded document."""
    import services.ai as ai_svc
    import services.books as books_svc
    from routes.jobs import _run_ask_job

    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value="Document-based answer"))
    monkeypatch.setattr(ai_svc, 'should_search_textbook', MagicMock(return_value=False))
    monkeypatch.setattr(ai_svc, 'sanitize_user_memory', MagicMock(return_value=''))

    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    mock_searcher.has_embeddings = False
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    result = _run_ask_job({
        'question': 'Summarize this',
        'mode': 'study',
        'complexity': 5,
        'doc_context': 'This is a user-uploaded document about organic chemistry.',
        '_verified_user_id': 'test-user',
    })
    assert result['success'] is True
    assert result['is_relevant'] is True


def test_run_ask_job_with_token_flags(app, monkeypatch):
    """_run_ask_job parses token flags like [THINKING_MODE]."""
    import services.ai as ai_svc
    import services.books as books_svc
    from routes.jobs import _run_ask_job

    mock_ai = MagicMock(return_value="Thinking answer")
    monkeypatch.setattr(ai_svc, 'call_ai', mock_ai)
    monkeypatch.setattr(ai_svc, 'should_search_textbook', MagicMock(return_value=False))
    monkeypatch.setattr(ai_svc, 'sanitize_user_memory', MagicMock(return_value=''))

    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    mock_searcher.has_embeddings = False
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    result = _run_ask_job({
        'question': '[THINKING_MODE] Explain entropy',
        'mode': 'study',
        'complexity': 5,
        '_verified_user_id': 'test-user',
    })
    assert result['success'] is True


def test_run_ask_job_with_selected_text(app, monkeypatch):
    """_run_ask_job with selected_text builds a highlight-based prompt."""
    import services.ai as ai_svc
    import services.books as books_svc
    from routes.jobs import _run_ask_job

    monkeypatch.setattr(ai_svc, 'call_ai', MagicMock(return_value="Highlight explanation"))
    monkeypatch.setattr(ai_svc, 'should_search_textbook', MagicMock(return_value=False))
    monkeypatch.setattr(ai_svc, 'sanitize_user_memory', MagicMock(return_value=''))

    mock_searcher = MagicMock()
    mock_searcher.chunks = []
    mock_searcher.has_embeddings = False
    monkeypatch.setattr(books_svc, 'get_book_index', MagicMock(return_value=mock_searcher))

    result = _run_ask_job({
        'question': 'What does this mean?',
        'mode': 'study',
        'complexity': 5,
        'selected_text': 'The equilibrium constant is...',
        '_verified_user_id': 'test-user',
    })
    assert result['success'] is True


# ── Endpoint exception paths ─────────────────────────────────────────────────

def test_ask_async_exception(client, monkeypatch, mock_guest_gate):
    """POST /ask-async returns 500 when enqueue raises."""
    import services.job_queue as jq_mod
    monkeypatch.setattr(jq_mod.job_queue, 'enqueue', MagicMock(side_effect=RuntimeError("boom")))

    resp = client.post('/ask-async', json={
        'question': 'What is water?',
        'mode': 'study',
        'complexity': 3,
    })
    assert resp.status_code == 500
    data = resp.json()
    assert data['success'] is False


def test_get_job_status_exception(client, monkeypatch):
    """GET /jobs/<id> returns 500 when get_status raises."""
    import services.job_queue as jq_mod
    monkeypatch.setattr(jq_mod.job_queue, 'get_status', MagicMock(side_effect=RuntimeError("redis down")))

    resp = client.get('/jobs/someid')
    assert resp.status_code == 500
    data = resp.json()
    assert data['success'] is False
