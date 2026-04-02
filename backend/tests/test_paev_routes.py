"""Tests for paev_routes.py — PAEV (Prerequisite-Aware Epistemic Verification) endpoints."""
from __future__ import annotations

import json
import base64
import pickle

from unittest.mock import patch, MagicMock


# ── GET /paev/status ──────────────────────────────────────────────────────────

def test_paev_status(client):
    r = client.get('/paev/status')
    assert r.status_code == 200
    body = r.json()
    assert body['success'] is True
    assert 'books' in body
    assert 'r2_configured' in body
    # Every book in library should appear
    for book_id, info in body['books'].items():
        assert 'stage' in info


def test_paev_status_with_cached(client):
    """Status endpoint reports cached_on_disk when local files exist."""
    with patch('paev_routes._paev_status_get', return_value=None), \
         patch('paev_routes._r2_client', return_value=None), \
         patch('paev_routes.os.path.exists', return_value=True):
        r = client.get('/paev/status')
        assert r.status_code == 200
        body = r.json()
        for info in body['books'].values():
            assert info['stage'] == 'cached_on_disk'


def test_paev_status_with_redis(client):
    """Status from Redis cache."""
    status = {'stage': 'ready', 'pct': 100}
    with patch('paev_routes._paev_status_get', return_value=status):
        r = client.get('/paev/status')
        body = r.json()
        for info in body['books'].values():
            assert info['stage'] == 'ready'


# ── POST /paev/build-index ────────────────────────────────────────────────────

def test_build_index_options(client):
    r = client.options('/paev/build-index')
    assert r.status_code == 200


def test_build_index_unknown_book(client):
    r = client.post('/paev/build-index', json={'bookId': 'nonexistent_book'})
    assert r.status_code == 404
    body = r.json()
    assert body['success'] is False
    assert 'Unknown book' in body['error']


def test_build_index_starts(client):
    """Valid request for a known book starts a background build."""
    with patch('paev_routes._paev_status_get', return_value=None), \
         patch('paev_routes._paev_status_set'), \
         patch('paev_routes.threading') as mock_threading:
        mock_thread = MagicMock()
        mock_threading.Thread.return_value = mock_thread

        r = client.post('/paev/build-index', json={'bookId': 'zumdahl'})
        assert r.status_code == 200
        body = r.json()
        assert body['success'] is True
        assert 'Build started' in body['message']
        mock_thread.start.assert_called_once()


def test_build_index_already_built(client):
    """If already built, returns immediately."""
    with patch('paev_routes._paev_status_get', return_value={'stage': 'ready', 'pct': 100}):
        r = client.post('/paev/build-index', json={'bookId': 'zumdahl'})
        assert r.status_code == 200
        body = r.json()
        assert body['success'] is True
        assert 'Already built' in body['message']


def test_build_index_in_progress(client):
    with patch('paev_routes._paev_status_get', return_value={'stage': 'building_index', 'pct': 40}):
        r = client.post('/paev/build-index', json={'bookId': 'zumdahl'})
        assert r.status_code == 200
        body = r.json()
        assert 'Build in progress' in body['message']


def test_build_index_error_state(client):
    """After a previous error, re-build is allowed."""
    with patch('paev_routes._paev_status_get', return_value={'stage': 'error', 'error': 'timeout'}), \
         patch('paev_routes._paev_status_set'), \
         patch('paev_routes.threading') as mock_threading:
        mock_thread = MagicMock()
        mock_threading.Thread.return_value = mock_thread

        r = client.post('/paev/build-index', json={'bookId': 'zumdahl'})
        assert r.status_code == 200
        assert 'Build started' in r.json()['message']


# ── GET /paev/graph/<book_id> ─────────────────────────────────────────────────

def test_graph_not_built(client):
    with patch('paev_routes._get_book', return_value=(None, None, None)):
        r = client.get('/paev/graph/zumdahl')
        assert r.status_code == 404
        body = r.json()
        assert body['success'] is False


def test_graph_success(client):
    """When book is built, returns concept graph summary."""
    mock_node = MagicMock()
    mock_node.dependent_concepts = ['c1', 'c2']
    mock_graph = MagicMock()
    mock_graph.nodes = {'mole': mock_node, 'bond': mock_node}
    mock_graph.edges = {'mole': ['bond'], 'bond': []}

    with patch('paev_routes._get_book', return_value=(MagicMock(), MagicMock(), mock_graph)):
        r = client.get('/paev/graph/zumdahl')
        assert r.status_code == 200
        body = r.json()
        assert body['success'] is True
        assert body['book_id'] == 'zumdahl'
        assert body['total_concepts'] == 2
        assert body['total_edges'] == 1


# ── GET /paev/learning-path ──────────────────────────────────────────────────

def test_learning_path_no_concept(client):
    r = client.get('/paev/learning-path?bookId=zumdahl')
    assert r.status_code == 400
    assert r.json()['error'] == 'concept param required'


def test_learning_path_not_built(client):
    with patch('paev_routes._get_book', return_value=(None, None, None)):
        r = client.get('/paev/learning-path?bookId=zumdahl&concept=entropy')
        assert r.status_code == 404


def test_learning_path_success(client):
    mock_node = MagicMock()
    mock_node.name = 'energy'
    mock_node.chapter_num = 1
    mock_node.section_num = '1.2'
    mock_node.page = 10
    mock_node.bloom_level_introduced = 'understand'

    mock_graph = MagicMock()
    mock_graph.get_learning_path.return_value = ['energy']
    mock_graph.nodes = {'energy': mock_node}

    with patch('paev_routes._get_book', return_value=(MagicMock(), MagicMock(), mock_graph)):
        r = client.get('/paev/learning-path?bookId=zumdahl&concept=entropy')
        assert r.status_code == 200
        body = r.json()
        assert body['success'] is True
        assert body['concept'] == 'entropy'
        assert len(body['learning_path']) == 1
        assert body['learning_path'][0]['concept'] == 'energy'


def test_learning_path_empty(client):
    """Concept has no prerequisites → empty path."""
    mock_graph = MagicMock()
    mock_graph.get_learning_path.return_value = []
    mock_graph.nodes = {}

    with patch('paev_routes._get_book', return_value=(MagicMock(), MagicMock(), mock_graph)):
        r = client.get('/paev/learning-path?bookId=zumdahl&concept=atom')
        assert r.status_code == 200
        body = r.json()
        assert body['success'] is True
        assert body['learning_path'] == []


# ── POST /paev/ask ────────────────────────────────────────────────────────────

def test_paev_ask_options(client):
    r = client.options('/paev/ask')
    assert r.status_code == 200


def test_paev_ask_no_question(client):
    r = client.post('/paev/ask', json={'question': '', 'bookId': 'zumdahl'})
    assert r.status_code == 400
    assert r.json()['error'] == 'question is required'


def test_paev_ask_unknown_book(client):
    r = client.post('/paev/ask', json={'question': 'What is pH?', 'bookId': 'fake_book'})
    assert r.status_code == 404
    assert 'Unknown book' in r.json()['error']


def test_paev_ask_not_indexed(client):
    with patch('paev_routes._get_book', return_value=(None, None, None)):
        r = client.post('/paev/ask', json={
            'question': 'What is pH?',
            'bookId': 'zumdahl',
        })
        assert r.status_code == 404
        assert 'not indexed yet' in r.json()['error']


def test_paev_ask_success(client):
    mock_result = MagicMock()
    with patch('paev_routes._get_book', return_value=(MagicMock(), MagicMock(), MagicMock())), \
         patch('paev_routes._verifier') as mock_verifier, \
         patch('paev_routes.EpistemicVerifier') as mock_cls:
        mock_verifier.run.return_value = mock_result
        mock_cls.result_to_dict.return_value = {'answer': 'pH is ...', 'confidence': 0.9}

        r = client.post('/paev/ask', json={
            'question': 'What is pH?',
            'bookId': 'zumdahl',
            'complexity': 5,
        })
        assert r.status_code == 200
        body = r.json()
        assert body['success'] is True


def test_paev_ask_exception(client):
    """Verifier raises → 500 with error message."""
    with patch('paev_routes._get_book', return_value=(MagicMock(), MagicMock(), MagicMock())), \
         patch('paev_routes._verifier') as mock_verifier:
        mock_verifier.run.side_effect = RuntimeError('model timeout')

        r = client.post('/paev/ask', json={
            'question': 'What is pH?',
            'bookId': 'zumdahl',
        })
        assert r.status_code == 500
        body = r.json()
        assert body['success'] is False
        assert 'model timeout' in body['error']


# ── Unit tests: Redis cache helpers ──────────────────────────────────────────

def test_paev_pickle_set_no_redis():
    """pickle set with no redis → no-op."""
    import paev_routes as pr
    original = pr._redis
    try:
        pr._redis = None
        pr._paev_pickle_set('key', {'data': 1})  # should not raise
    finally:
        pr._redis = original


def test_paev_pickle_roundtrip():
    """pickle set + get returns the original object."""
    import paev_routes as pr
    original = pr._redis
    try:
        mock_redis = MagicMock()
        store = {}

        def mock_setex(key, ttl, value):
            store[key] = value

        def mock_get(key):
            return store.get(key)

        mock_redis.setex = mock_setex
        mock_redis.get = mock_get
        pr._redis = mock_redis

        obj = {'hello': [1, 2, 3]}
        pr._paev_pickle_set('test_key', obj)
        result = pr._paev_pickle_get('test_key')
        assert result == obj
    finally:
        pr._redis = original


def test_paev_pickle_get_no_redis():
    """pickle get with no redis → None."""
    import paev_routes as pr
    original = pr._redis
    try:
        pr._redis = None
        assert pr._paev_pickle_get('key') is None
    finally:
        pr._redis = original


def test_paev_status_set_no_redis():
    """status set with no redis → no-op."""
    import paev_routes as pr
    original = pr._redis
    try:
        pr._redis = None
        pr._paev_status_set('zumdahl', {'stage': 'ready'})  # should not raise
    finally:
        pr._redis = original


def test_paev_status_get_no_redis():
    """status get with no redis → None."""
    import paev_routes as pr
    original = pr._redis
    try:
        pr._redis = None
        assert pr._paev_status_get('zumdahl') is None
    finally:
        pr._redis = original


def test_paev_status_roundtrip():
    """status set + get returns stored data."""
    import paev_routes as pr
    original = pr._redis
    try:
        mock_redis = MagicMock()
        store = {}

        def mock_setex(key, ttl, value):
            store[key] = value

        def mock_get(key):
            return store.get(key)

        mock_redis.setex = mock_setex
        mock_redis.get = mock_get
        pr._redis = mock_redis

        pr._paev_status_set('zumdahl', {'stage': 'building', 'pct': 50})
        result = pr._paev_status_get('zumdahl')
        assert result == {'stage': 'building', 'pct': 50}
    finally:
        pr._redis = original


def test_paev_cache_set_and_get():
    """cache set + get returns all three objects."""
    import paev_routes as pr
    original = pr._redis
    try:
        mock_redis = MagicMock()
        store = {}

        def mock_setex(key, ttl, value):
            store[key] = value

        def mock_get(key):
            return store.get(key)

        mock_redis.setex = mock_setex
        mock_redis.get = mock_get
        pr._redis = mock_redis

        idx, fps, graph = 'idx_obj', 'fps_obj', 'graph_obj'
        pr._paev_cache_set('test_book', idx, fps, graph)
        r_idx, r_fps, r_graph = pr._paev_cache_get('test_book')
        assert r_idx == idx
        assert r_fps == fps
        assert r_graph == graph
    finally:
        pr._redis = original


def test_paev_cache_get_miss():
    """cache get returns (None, None, None) on miss."""
    import paev_routes as pr
    original = pr._redis
    try:
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        pr._redis = mock_redis

        r_idx, r_fps, r_graph = pr._paev_cache_get('missing')
        assert r_idx is None
        assert r_fps is None
        assert r_graph is None
    finally:
        pr._redis = original


# ── Unit tests: R2 helpers ───────────────────────────────────────────────────

def test_r2_client_not_configured():
    """R2 client returns None when env vars not set."""
    import paev_routes as pr
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = None
        with patch.dict('os.environ', {
            'R2_ACCOUNT_ID': '',
            'R2_ACCESS_KEY_ID': '',
            'R2_SECRET_ACCESS_KEY': '',
            'R2_BUCKET_NAME': '',
        }):
            result = pr._r2_client()
            assert result is None
    finally:
        pr._r2_client_instance = old


def test_r2_key():
    """R2 key generation."""
    import paev_routes as pr
    assert pr._r2_key('zumdahl', 'index') == 'paev_indexes/zumdahl_index.json'


def test_r2_upload_not_configured():
    """Upload when R2 not configured returns False."""
    import paev_routes as pr
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = None
        with patch.dict('os.environ', {
            'R2_ACCOUNT_ID': '',
            'R2_ACCESS_KEY_ID': '',
            'R2_SECRET_ACCESS_KEY': '',
            'R2_BUCKET_NAME': '',
        }):
            assert pr._r2_upload('zumdahl', 'index', {'data': 1}) is False
    finally:
        pr._r2_client_instance = old


def test_r2_download_not_configured():
    """Download when R2 not configured returns None."""
    import paev_routes as pr
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = None
        with patch.dict('os.environ', {
            'R2_ACCOUNT_ID': '',
            'R2_ACCESS_KEY_ID': '',
            'R2_SECRET_ACCESS_KEY': '',
            'R2_BUCKET_NAME': '',
        }):
            assert pr._r2_download('zumdahl', 'index') is None
    finally:
        pr._r2_client_instance = old


def test_r2_exists_not_configured():
    """exists check when R2 not configured returns False."""
    import paev_routes as pr
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = None
        with patch.dict('os.environ', {
            'R2_ACCOUNT_ID': '',
            'R2_ACCESS_KEY_ID': '',
            'R2_SECRET_ACCESS_KEY': '',
            'R2_BUCKET_NAME': '',
        }):
            assert pr._r2_exists('zumdahl') is False
    finally:
        pr._r2_client_instance = old


def test_r2_upload_success():
    """Upload succeeds with mock client."""
    import paev_routes as pr
    mock_client = MagicMock()
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = mock_client
        result = pr._r2_upload('zumdahl', 'index', {'data': 1})
        assert result is True
        mock_client.put_object.assert_called_once()
    finally:
        pr._r2_client_instance = old


def test_r2_download_success():
    """Download succeeds with mock client."""
    import paev_routes as pr
    mock_client = MagicMock()
    mock_body = MagicMock()
    mock_body.read.return_value = json.dumps({'chapters': []}).encode()
    mock_client.get_object.return_value = {'Body': mock_body}
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = mock_client
        result = pr._r2_download('zumdahl', 'index')
        assert result == {'chapters': []}
    finally:
        pr._r2_client_instance = old


def test_r2_exists_success():
    """exists returns True when all three files exist."""
    import paev_routes as pr
    mock_client = MagicMock()
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = mock_client
        assert pr._r2_exists('zumdahl') is True
        assert mock_client.head_object.call_count == 3
    finally:
        pr._r2_client_instance = old


# ── Unit tests: _get_book multi-tier loading ─────────────────────────────────

def test_get_book_from_cache():
    """_get_book returns from Redis cache (tier 1)."""
    import paev_routes as pr
    idx, fps, graph = 'idx', 'fps', 'graph'
    with patch.object(pr, '_paev_cache_get', return_value=(idx, fps, graph)):
        r_idx, r_fps, r_graph = pr._get_book('zumdahl')
        assert r_idx == idx
        assert r_fps == fps
        assert r_graph == graph


def test_get_book_from_disk():
    """_get_book loads from local disk (tier 2) when cache misses."""
    import paev_routes as pr
    mock_idx = MagicMock()
    mock_fps = {'p1': MagicMock()}
    mock_graph = MagicMock()

    with patch.object(pr, '_paev_cache_get', return_value=(None, None, None)), \
         patch('paev_routes.os.path.exists', return_value=True), \
         patch.object(pr, '_indexer') as mock_indexer, \
         patch.object(pr, '_fps_from_dict', return_value=mock_fps), \
         patch('paev_routes.PrerequisiteGraph') as mock_pg_cls, \
         patch.object(pr, '_paev_cache_set'), \
         patch.object(pr, '_paev_status_set'), \
         patch('builtins.open', MagicMock()), \
         patch('json.load', return_value={}):
        mock_indexer.load_index.return_value = mock_idx
        mock_pg_cls.from_dict.return_value = mock_graph

        r_idx, r_fps, r_graph = pr._get_book('zumdahl')
        assert r_idx == mock_idx
        assert r_graph == mock_graph


def test_get_book_disk_error_falls_to_r2():
    """Disk load fails → falls through to R2 tier."""
    import paev_routes as pr
    with patch.object(pr, '_paev_cache_get', return_value=(None, None, None)), \
         patch('paev_routes.os.path.exists', return_value=True), \
         patch.object(pr, '_indexer') as mock_indexer, \
         patch.object(pr, '_r2_download', return_value=None), \
         patch.object(pr, '_paev_status_set'):
        mock_indexer.load_index.side_effect = Exception('corrupt file')

        r_idx, r_fps, r_graph = pr._get_book('zumdahl')
        # All tiers failed → None
        assert r_idx is None


def test_get_book_r2_not_found():
    """R2 doesn't have the book → returns None."""
    import paev_routes as pr
    with patch.object(pr, '_paev_cache_get', return_value=(None, None, None)), \
         patch('paev_routes.os.path.exists', return_value=False), \
         patch.object(pr, '_r2_download', return_value=None), \
         patch.object(pr, '_paev_status_set'):
        r_idx, r_fps, r_graph = pr._get_book('zumdahl')
        assert r_idx is None


def test_get_book_r2_success():
    """_get_book loads from R2 (tier 3) when disk and cache miss."""
    import paev_routes as pr
    mock_idx = MagicMock()
    mock_fps = {'p1': MagicMock()}
    mock_graph = MagicMock()

    with patch.object(pr, '_paev_cache_get', return_value=(None, None, None)), \
         patch('paev_routes.os.path.exists', return_value=False), \
         patch.object(pr, '_r2_download', side_effect=[{'idx': 1}, {'fps': 1}, {'graph': 1}]), \
         patch.object(pr, '_indexer') as mock_indexer, \
         patch.object(pr, '_fps_from_dict', return_value=mock_fps), \
         patch('paev_routes.PrerequisiteGraph') as mock_pg_cls, \
         patch.object(pr, '_paev_cache_set'), \
         patch.object(pr, '_paev_status_set'), \
         patch('builtins.open', MagicMock()), \
         patch('json.dump'), \
         patch('json.load', return_value={}), \
         patch('tempfile.mktemp', return_value='/tmp/test.json'), \
         patch('os.remove'):
        mock_indexer.load_index.return_value = mock_idx
        mock_indexer.save_index = MagicMock()
        mock_pg_cls.from_dict.return_value = mock_graph

        r_idx, r_fps, r_graph = pr._get_book('zumdahl')
        assert r_idx == mock_idx
        assert r_graph == mock_graph


def test_get_book_r2_exception():
    """R2 download raises → returns None."""
    import paev_routes as pr
    with patch.object(pr, '_paev_cache_get', return_value=(None, None, None)), \
         patch('paev_routes.os.path.exists', return_value=False), \
         patch.object(pr, '_r2_download', side_effect=Exception('network error')), \
         patch.object(pr, '_paev_status_set'):
        r_idx, r_fps, r_graph = pr._get_book('zumdahl')
        assert r_idx is None


# ── Unit tests: R2 error paths ───────────────────────────────────────────────

def test_r2_upload_error():
    """Upload raises → returns False."""
    import paev_routes as pr
    mock_client = MagicMock()
    mock_client.put_object.side_effect = Exception('upload failed')
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = mock_client
        assert pr._r2_upload('zumdahl', 'index', {'data': 1}) is False
    finally:
        pr._r2_client_instance = old


def test_r2_download_error():
    """Download raises → returns None."""
    import paev_routes as pr
    mock_client = MagicMock()
    mock_client.get_object.side_effect = Exception('not found')
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = mock_client
        assert pr._r2_download('zumdahl', 'index') is None
    finally:
        pr._r2_client_instance = old


def test_r2_exists_error():
    """exists raises → returns False."""
    import paev_routes as pr
    mock_client = MagicMock()
    mock_client.head_object.side_effect = Exception('not found')
    old = pr._r2_client_instance
    try:
        pr._r2_client_instance = mock_client
        assert pr._r2_exists('zumdahl') is False
    finally:
        pr._r2_client_instance = old


# ── Unit tests: pickle error handling ────────────────────────────────────────

def test_paev_pickle_set_error():
    """pickle set with Redis error → no-op (logs warning)."""
    import paev_routes as pr
    original = pr._redis
    try:
        mock_redis = MagicMock()
        mock_redis.setex.side_effect = Exception('redis down')
        pr._redis = mock_redis
        pr._paev_pickle_set('key', {'data': 1})  # should not raise
    finally:
        pr._redis = original


def test_paev_pickle_get_error():
    """pickle get with corrupt data → returns None."""
    import paev_routes as pr
    original = pr._redis
    try:
        mock_redis = MagicMock()
        mock_redis.get.return_value = 'not-valid-base64!'
        pr._redis = mock_redis
        result = pr._paev_pickle_get('key')
        assert result is None
    finally:
        pr._redis = original


def test_paev_status_set_error():
    """status set with Redis error → no-op."""
    import paev_routes as pr
    original = pr._redis
    try:
        mock_redis = MagicMock()
        mock_redis.setex.side_effect = Exception('redis down')
        pr._redis = mock_redis
        pr._paev_status_set('zumdahl', {'stage': 'ready'})  # should not raise
    finally:
        pr._redis = original


def test_paev_status_get_error():
    """status get with Redis error → returns None."""
    import paev_routes as pr
    original = pr._redis
    try:
        mock_redis = MagicMock()
        mock_redis.get.side_effect = Exception('redis down')
        pr._redis = mock_redis
        result = pr._paev_status_get('zumdahl')
        assert result is None
    finally:
        pr._redis = original


# ── Unit tests: path helpers ─────────────────────────────────────────────────

def test_path_helpers():
    import paev_routes as pr
    assert 'zumdahl_index.json' in pr._idx_path('zumdahl')
    assert 'zumdahl_fingerprints.json' in pr._fp_path('zumdahl')
    assert 'zumdahl_graph.json' in pr._graph_path('zumdahl')


# ── Blueprint registration ───────────────────────────────────────────────────

def test_paev_blueprints_registered(app):
    rules = [r.path for r in app.routes]
    assert '/paev/status' in rules
    assert '/paev/build-index' in rules
    assert '/paev/ask' in rules
    assert '/paev/graph/{book_id}' in rules
    assert '/paev/learning-path' in rules
