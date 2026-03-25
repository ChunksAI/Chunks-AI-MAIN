"""Tests for the async job queue and /ask-async + /jobs/<id> endpoints."""
import time
import pytest
from unittest.mock import MagicMock, patch

from services.job_queue import JobQueue, STATUS_QUEUED, STATUS_COMPLETED, STATUS_FAILED


# ── Unit tests for JobQueue ──────────────────────────────────────────────────

class TestJobQueueUnit:
    """Low-level tests for the JobQueue class itself."""

    @staticmethod
    def _make_mock_redis():
        """Create a mock Redis client with a working dict-backed store."""
        store = {}
        r = MagicMock()
        r.ping.return_value = True
        r.setex.side_effect = lambda k, ttl, v: store.__setitem__(k, v)
        r.get.side_effect = lambda k: store.get(k)
        return r

    def test_init_no_redis(self):
        q = JobQueue()
        q.init(redis=None)
        assert q._ready is True
        assert q._store is None

    def test_init_with_redis(self):
        q = JobQueue()
        q.init(redis=self._make_mock_redis())
        assert q._ready is True
        assert q._store is not None

    def test_enqueue_returns_job_id(self):
        q = JobQueue()
        q.init(redis=self._make_mock_redis())
        job_id = q.enqueue(lambda: {"ok": True})
        assert isinstance(job_id, str)
        assert len(job_id) == 32  # uuid4 hex

    def test_job_completes_successfully(self):
        q = JobQueue()
        q.init(redis=self._make_mock_redis())
        result_data = {"answer": "42"}
        job_id = q.enqueue(lambda: result_data)
        # Wait for the thread to finish
        for _ in range(50):
            info = q.get_status(job_id)
            if info and info["status"] == STATUS_COMPLETED:
                break
            time.sleep(0.05)
        info = q.get_status(job_id)
        assert info is not None
        assert info["status"] == STATUS_COMPLETED
        assert info["result"] == result_data

    def test_job_failure_stored(self):
        q = JobQueue()
        q.init(redis=self._make_mock_redis())

        def _fail():
            raise ValueError("boom")

        job_id = q.enqueue(_fail)
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
        q.init(redis=self._make_mock_redis())
        assert q.get_status("nonexistent") is None

    def test_enqueue_before_init_raises(self):
        q = JobQueue()
        with pytest.raises(RuntimeError, match="not initialised"):
            q.enqueue(lambda: {})

    def test_enqueue_without_redis_raises(self):
        q = JobQueue()
        q.init(redis=None)
        with pytest.raises(RuntimeError, match="requires Redis"):
            q.enqueue(lambda: {})


# ── Integration tests for HTTP endpoints ─────────────────────────────────────

def test_ask_async_options(client):
    """OPTIONS /ask-async returns 200."""
    resp = client.options('/ask-async')
    assert resp.status_code == 200


def test_ask_async_no_body(client):
    """POST /ask-async with no JSON returns 400."""
    resp = client.post('/ask-async', content_type='application/json', data='')
    assert resp.status_code == 400


def test_ask_async_empty_question(client):
    """POST /ask-async with empty question returns 400."""
    resp = client.post('/ask-async', json={'question': '', 'mode': 'study'})
    assert resp.status_code == 400
    data = resp.get_json()
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
    data = resp.get_json()
    assert data['success'] is True
    assert data['jobId'] == 'abc123def456'
    assert data['status'] == 'queued'
    mock_enqueue.assert_called_once()


def test_get_job_not_found(client):
    """GET /jobs/<bad_id> returns 404."""
    resp = client.get('/jobs/does-not-exist')
    assert resp.status_code == 404
    data = resp.get_json()
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
    data = resp.get_json()
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
    data = resp.get_json()
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
    data = resp.get_json()
    assert data['status'] == 'failed'
    assert data['error'] == 'Something went wrong'


def test_jobs_blueprint_registered(app):
    """The /ask-async and /jobs/<job_id> routes are registered."""
    rules = [r.rule for r in app.url_map.iter_rules()]
    assert '/ask-async' in rules
    assert '/jobs/<job_id>' in rules


def test_ask_async_validation(client):
    """POST /ask-async with invalid complexity returns 422."""
    resp = client.post('/ask-async', json={
        'question': 'What is water?',
        'complexity': 'not-an-int',
    })
    assert resp.status_code == 422
