"""
PAEV — Prerequisite-Aware Epistemic Verification
Flask Routes with R2 persistent storage

Index files are saved to / loaded from Cloudflare R2 so they survive
container restarts and redeploys.

Required env vars (add to Railway):
  R2_ACCOUNT_ID        — Cloudflare Account ID
  R2_ACCESS_KEY_ID     — R2 API token Access Key
  R2_SECRET_ACCESS_KEY — R2 API token Secret Key
  R2_BUCKET_NAME       — e.g. "chunks-ai" (just the bucket name, no URL)

These are already in your environment (unchanged):
  OPENROUTER_API_KEY, MODEL, R2_BUCKET_URL
"""

import os
import json
import logging
import base64
import pickle
import requests as _requests

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routes.schemas import PaevBuildIndexRequest, PaevAskRequest

logger = logging.getLogger(__name__)

import sys
sys.path.insert(0, os.path.dirname(__file__))

from hierarchical_indexer import HierarchicalIndexer
from paev_fingerprint      import EpistemicFingerprintBuilder, PrerequisiteGraph
from paev_engine           import EpistemicVerifier

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY       = os.environ.get('OPENROUTER_API_KEY', '')
MODEL         = os.environ.get('MODEL', 'openai/gpt-4o-mini')
R2_BUCKET_URL = os.environ.get('R2_BUCKET_URL', 'https://pub-xxxxx.r2.dev')
INDEX_DIR     = os.environ.get('PAEV_INDEX_DIR', '/tmp/paev_indexes')
os.makedirs(INDEX_DIR, exist_ok=True)

# ── R2 config ─────────────────────────────────────────────────────────────────
R2_ACCOUNT_ID        = os.environ.get('R2_ACCOUNT_ID', '')
R2_ACCESS_KEY_ID     = os.environ.get('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET_NAME       = os.environ.get('R2_BUCKET_NAME', '')
R2_PAEV_PREFIX       = 'paev_indexes'


# FIX: Cache boto3 client as a module-level singleton — creating it fresh on every
# request is wasteful (involves DNS lookups and credential loading).
_r2_client_instance = None

def _r2_client():
    """Return a cached boto3 S3 client pointed at Cloudflare R2, or None if not configured."""
    global _r2_client_instance
    if _r2_client_instance is not None:
        return _r2_client_instance
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]):
        return None
    try:
        import boto3
        _r2_client_instance = boto3.client(
            's3',
            endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            region_name='auto',
        )
        return _r2_client_instance
    except Exception as e:
        logger.warning(f'R2 client init failed: {e}')
        return None


def _r2_key(book_id, filetype):
    return f'{R2_PAEV_PREFIX}/{book_id}_{filetype}.json'


def _r2_upload(book_id, filetype, data: dict):
    client = _r2_client()
    if not client:
        logger.warning(f'R2 not configured — skipping upload of {book_id}_{filetype}')
        return False
    try:
        body = json.dumps(data).encode('utf-8')
        client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=_r2_key(book_id, filetype),
            Body=body,
            ContentType='application/json',
        )
        logger.info(f'[{book_id}] Uploaded {filetype} to R2')
        return True
    except Exception as e:
        logger.error(f'[{book_id}] R2 upload error ({filetype}): {e}')
        return False


def _r2_download(book_id, filetype):
    client = _r2_client()
    if not client:
        return None
    try:
        resp = client.get_object(Bucket=R2_BUCKET_NAME, Key=_r2_key(book_id, filetype))
        return json.loads(resp['Body'].read().decode('utf-8'))
    except Exception as e:
        logger.warning(f'[{book_id}] R2 download error ({filetype}): {e}')
        return None


def _r2_exists(book_id) -> bool:
    client = _r2_client()
    if not client:
        return False
    try:
        for ft in ('index', 'fingerprints', 'graph'):
            client.head_object(Bucket=R2_BUCKET_NAME, Key=_r2_key(book_id, ft))
        return True
    except Exception:
        return False


# ── Import shared BOOK_LIBRARY ────────────────────────────────────────────────
try:
    from services.books import BOOK_LIBRARY
except ImportError:
    BOOK_LIBRARY = {
        'zumdahl':  {'name': 'General Chemistry',              'author': 'Zumdahl & Zumdahl',      'chunks_url': f'{R2_BUCKET_URL}/data/zumdhal_chunks_with_embeddings.json'},
        'atkins':   {'name': 'Physical Chemistry',             'author': 'Atkins & de Paula',       'chunks_url': f'{R2_BUCKET_URL}/data/atkins_chunks_with_embeddings.json'},
        'klein':    {'name': 'Organic Chemistry',              'author': 'David Klein',             'chunks_url': f'{R2_BUCKET_URL}/data/klein_chunks_with_embeddings.json'},
        'harris':   {'name': 'Quantitative Chemical Analysis', 'author': 'Daniel C. Harris',        'chunks_url': f'{R2_BUCKET_URL}/data/harris_chunks_with_embeddings.json'},
        'berg':     {'name': 'Biochemistry',                   'author': 'Berg, Tymoczko & Stryer', 'chunks_url': f'{R2_BUCKET_URL}/data/berg_chunks_with_embeddings.json'},
        'netter':   {'name': 'Atlas of Human Anatomy',         'author': 'Frank H. Netter',         'chunks_url': f'{R2_BUCKET_URL}/data/atlas_chunks_with_embeddings.json'},
        'anaphy2e': {'name': 'Anatomy & Physiology',           'author': 'Patton & Thibodeau',      'chunks_url': f'{R2_BUCKET_URL}/anaphy2e_chunks_with_embeddings.json'},
    }

# ── Redis client (injected by register_paev) ──────────────────────────────────
_redis = None


# ── Redis-backed PAEV cache helpers ───────────────────────────────────────────

_PAEV_CACHE_TTL  = 86400              # 24 hours
_PAEV_STATUS_TTL = 3600               # 1 hour


def _paev_pickle_set(key, obj):
    if _redis is None:
        return
    try:
        payload = base64.b64encode(
            pickle.dumps(obj, protocol=pickle.HIGHEST_PROTOCOL)
        ).decode()
        _redis.setex(key, _PAEV_CACHE_TTL, payload)
    except Exception as exc:
        logger.warning("PAEV pickle SET error (%s): %s", key, exc)


def _paev_pickle_get(key):
    if _redis is None:
        return None
    try:
        raw = _redis.get(key)
        if raw is not None:
            return pickle.loads(base64.b64decode(raw))
    except Exception as exc:
        logger.warning("PAEV pickle GET error (%s): %s", key, exc)
    return None


def _paev_status_set(book_id, status_dict):
    if _redis is None:
        return
    try:
        _redis.setex(f"paev_status:{book_id}", _PAEV_STATUS_TTL, json.dumps(status_dict))
    except Exception:
        pass


def _paev_status_get(book_id):
    if _redis is None:
        return None
    try:
        raw = _redis.get(f"paev_status:{book_id}")
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return None


def _paev_cache_set(book_id, idx, fps, graph):
    """Store all three PAEV objects in Redis."""
    _paev_pickle_set(f"paev_idx:{book_id}", idx)
    _paev_pickle_set(f"paev_fp:{book_id}", fps)
    _paev_pickle_set(f"paev_graph:{book_id}", graph)


def _paev_cache_get(book_id):
    """Load all three PAEV objects from Redis.  Returns (idx, fps, graph) or (None, None, None)."""
    idx = _paev_pickle_get(f"paev_idx:{book_id}")
    fps = _paev_pickle_get(f"paev_fp:{book_id}")
    graph = _paev_pickle_get(f"paev_graph:{book_id}")
    if all([idx, fps, graph]):
        return idx, fps, graph
    return None, None, None

_indexer    = HierarchicalIndexer(openrouter_api_key=API_KEY)
_fp_builder = EpistemicFingerprintBuilder(api_key=API_KEY, model=MODEL)
_verifier   = EpistemicVerifier(api_key=API_KEY, model=MODEL)

# ── Local path helpers ────────────────────────────────────────────────────────
import re as _re

def _safe_book_id(book_id: str) -> str:
    """Sanitize book_id so it can never escape the index directory."""
    return _re.sub(r'[^A-Za-z0-9_\-]', '', book_id)[:128]

def _idx_path(book_id):   return os.path.join(INDEX_DIR, f'{_safe_book_id(book_id)}_index.json')
def _fp_path(book_id):    return os.path.join(INDEX_DIR, f'{_safe_book_id(book_id)}_fingerprints.json')
def _graph_path(book_id): return os.path.join(INDEX_DIR, f'{_safe_book_id(book_id)}_graph.json')

def _fps_to_dict(fps):
    return {k: v.to_dict() for k, v in fps.items()}

def _fps_from_dict(raw):
    from paev_fingerprint import EpistemicFingerprint
    return {k: EpistemicFingerprint.from_dict(v) for k, v in raw.items()}


# ── Build pipeline ────────────────────────────────────────────────────────────
def _build_book(book_id: str, fp_sample_rate: float = 0.3):
    """Full build. Saves results to R2 + Redis."""
    book_id = _safe_book_id(book_id)
    # When running in an RQ worker the module-level _redis may not be
    # initialised yet.  Bootstrap a connection from the environment variable
    # so status updates and caching work correctly in the worker process.
    global _redis
    if _redis is None:
        import os
        import redis as redis_lib
        _url = os.environ.get('REDIS_URL', '')
        if _url:
            try:
                _redis = redis_lib.from_url(
                    _url, decode_responses=True,
                    socket_connect_timeout=3, socket_timeout=3,
                )
                _redis.ping()
            except Exception:
                _redis = None
    try:
        _paev_status_set(book_id, {'stage': 'loading_chunks', 'pct': 5})
        book_info = BOOK_LIBRARY[book_id]

        # 1. Load chunks from R2 public URL
        resp = _requests.get(book_info['chunks_url'], timeout=90)
        resp.raise_for_status()
        chunks = resp.json()
        logger.info(f'[{book_id}] Loaded {len(chunks)} chunks')

        # 2. Build hierarchical index
        _paev_status_set(book_id, {'stage': 'building_index', 'pct': 20})
        idx = _indexer.build_from_chunks(
            chunks, book_id=book_id,
            book_title=book_info['name'], book_author=book_info['author'],
            embed=False
        )
        _indexer.save_index(idx, _idx_path(book_id))
        with open(_idx_path(book_id)) as f:
            _r2_upload(book_id, 'index', json.load(f))

        # 3. Build epistemic fingerprints
        _paev_status_set(book_id, {'stage': 'fingerprinting', 'pct': 45})
        fps = _fp_builder.build_fingerprints_for_index(idx, sample_rate=fp_sample_rate)
        fps = _fp_builder.detect_abstraction_supersessions(idx, fps)
        fps_dict = _fps_to_dict(fps)
        with open(_fp_path(book_id), 'w') as f:
            json.dump(fps_dict, f)
        _r2_upload(book_id, 'fingerprints', fps_dict)

        # 4. Build prerequisite graph
        _paev_status_set(book_id, {'stage': 'building_graph', 'pct': 75})
        graph = _fp_builder.build_prerequisite_graph(idx, fps)
        graph_dict = graph.to_dict()
        with open(_graph_path(book_id), 'w') as f:
            json.dump(graph_dict, f)
        _r2_upload(book_id, 'graph', graph_dict)

        # 5. Cache in Redis
        _paev_cache_set(book_id, idx, fps, graph)
        _paev_status_set(book_id, {
            'stage': 'ready', 'pct': 100,
            'paragraphs':   idx.total_paragraphs,
            'chapters':     len(idx.chapters),
            'concepts':     len(graph.nodes),
            'fingerprints': len(fps),
            'storage':      'r2' if _r2_client() else 'local',
        })
        logger.info(f'[{book_id}] PAEV build complete')

    except Exception as e:
        logger.exception(f'[{book_id}] Build error')
        _paev_status_set(book_id, {'stage': 'error', 'error': str(e)})


def _get_book(book_id: str):
    book_id = _safe_book_id(book_id)
    """
    Load order:
      1. Redis cache
      2. Local /tmp disk
      3. R2 download (survives restarts)
    """
    # 1. Redis
    idx, fps, graph = _paev_cache_get(book_id)
    if idx is not None:
        return idx, fps, graph

    # 2. Local disk
    if all(os.path.exists(p) for p in [_idx_path(book_id), _fp_path(book_id), _graph_path(book_id)]):
        try:
            idx   = _indexer.load_index(_idx_path(book_id))
            fps   = _fps_from_dict(json.load(open(_fp_path(book_id))))
            graph = PrerequisiteGraph.from_dict(json.load(open(_graph_path(book_id))))
            _paev_cache_set(book_id, idx, fps, graph)
            _paev_status_set(book_id, {'stage': 'ready', 'pct': 100})
            logger.info(f'[{book_id}] Loaded from local disk cache')
            return idx, fps, graph
        except Exception as e:
            logger.warning(f'[{book_id}] Local disk load failed: {e}')

    # 3. R2 download
    logger.info(f'[{book_id}] Downloading from R2...')
    _paev_status_set(book_id, {'stage': 'loading_from_r2', 'pct': 10})
    try:
        idx_dict   = _r2_download(book_id, 'index')
        fps_dict   = _r2_download(book_id, 'fingerprints')
        graph_dict = _r2_download(book_id, 'graph')

        if not all([idx_dict, fps_dict, graph_dict]):
            logger.info(f'[{book_id}] Not found in R2')
            _paev_status_set(book_id, {'stage': 'not_built'})
            return None, None, None

        import tempfile, os as _os
        _tmp = tempfile.mktemp(suffix='.json')
        with open(_tmp, 'w') as f: json.dump(idx_dict, f)
        idx = _indexer.load_index(_tmp)
        _os.remove(_tmp)
        fps   = _fps_from_dict(fps_dict)
        graph = PrerequisiteGraph.from_dict(graph_dict)

        # Cache locally so next call is instant
        _indexer.save_index(idx, _idx_path(book_id))
        with open(_fp_path(book_id), 'w') as f: json.dump(fps_dict, f)
        with open(_graph_path(book_id), 'w') as f: json.dump(graph_dict, f)

        _paev_cache_set(book_id, idx, fps, graph)
        _paev_status_set(book_id, {'stage': 'ready', 'pct': 100, 'storage': 'r2'})
        logger.info(f'[{book_id}] Loaded from R2 and cached locally')
        return idx, fps, graph

    except Exception as e:
        logger.error(f'[{book_id}] R2 load error: {e}')
        _paev_status_set(book_id, {'stage': 'not_built'})
        return None, None, None


# ── Router ────────────────────────────────────────────────────────────────────
paev_router = APIRouter(prefix='/paev')


@paev_router.get('/status')
def get_status(request: Request):
    statuses = {}
    r2_ok = bool(_r2_client())
    for book_id in BOOK_LIBRARY:
        st = _paev_status_get(book_id)
        if st:
            statuses[book_id] = st
        elif r2_ok and _r2_exists(book_id):
            statuses[book_id] = {'stage': 'cached_on_r2'}
        elif os.path.exists(_idx_path(book_id)):
            statuses[book_id] = {'stage': 'cached_on_disk'}
        else:
            statuses[book_id] = {'stage': 'not_built'}
    return {'success': True, 'books': statuses, 'r2_configured': r2_ok}


@paev_router.post('/build-index')
def build_index(request: Request, body: PaevBuildIndexRequest):
    data    = body.model_dump()
    book_id = data.get('bookId', 'zumdahl')
    sample  = float(data.get('fingerprintSampleRate', 0.3))

    if book_id not in BOOK_LIBRARY:
        return JSONResponse({'success': False, 'error': f'Unknown book: {book_id}'}, status_code=404)

    current = _paev_status_get(book_id) or {}
    stage   = current.get('stage') if isinstance(current, dict) else None

    if stage == 'ready':
        return {'success': True, 'message': 'Already built', 'status': current}

    if stage not in (None, '', 'not_built', 'error'):
        return {'success': True, 'message': 'Build in progress', 'status': current}

    _paev_status_set(book_id, {'stage': 'queued', 'pct': 0})
    from services.job_queue import job_queue
    job_queue.enqueue(_build_book, book_id, sample)

    return {
        'success': True,
        'message': f'Build started for {book_id}',
        'book': BOOK_LIBRARY[book_id]['name'],
        'r2_configured': bool(_r2_client()),
    }


@paev_router.get('/graph/{book_id}')
def get_graph(request: Request, book_id: str):
    book_id = _safe_book_id(book_id)
    _, _, graph = _get_book(book_id)
    if not graph:
        return JSONResponse({'success': False, 'error': 'Not built yet.'}, status_code=404)
    top_concepts = sorted(
        [(name, len(node.dependent_concepts)) for name, node in graph.nodes.items()],
        key=lambda x: x[1], reverse=True
    )[:20]
    return {
        'success': True, 'book_id': book_id,
        'total_concepts': len(graph.nodes),
        'total_edges': sum(len(v) for v in graph.edges.values()),
        'top_concepts': [{'concept': c, 'dependents': d} for c, d in top_concepts],
    }


@paev_router.get('/learning-path')
def get_learning_path(request: Request):
    book_id = request.query_params.get('bookId', 'zumdahl')
    concept = request.query_params.get('concept', '')
    if not concept:
        return JSONResponse({'success': False, 'error': 'concept param required'}, status_code=400)
    _, _, graph = _get_book(book_id)
    if not graph:
        return JSONResponse({'success': False, 'error': 'Book not built yet'}, status_code=404)
    path = graph.get_learning_path(concept.lower())
    locations = []
    for prereq in path:
        node = graph.nodes.get(prereq)
        if node:
            locations.append({
                'concept': node.name, 'chapter': node.chapter_num,
                'section': node.section_num, 'page': node.page,
                'bloom_level': node.bloom_level_introduced
            })
    return {'success': True, 'concept': concept, 'learning_path': locations}


@paev_router.post('/ask')
def paev_ask(request: Request, body: PaevAskRequest):
    try:
        data       = body.model_dump()
        question   = data.get('question', '').strip()
        book_id    = data.get('bookId', 'zumdahl')
        complexity = max(1, min(10, int(data.get('complexity', 5))))
        history    = data.get('history', [])

        if not question:
            return JSONResponse({'success': False, 'error': 'question is required'}, status_code=400)
        if book_id not in BOOK_LIBRARY:
            return JSONResponse({'success': False, 'error': f'Unknown book: {book_id}'}, status_code=404)

        idx, fps, graph = _get_book(book_id)
        if not idx:
            return JSONResponse({
                'success': False,
                'error': f'Book "{book_id}" not indexed yet. Call POST /paev/build-index first.',
                'hint': {'bookId': book_id}
            }, status_code=404)

        result = _verifier.run(
            question=question, index=idx, fingerprints=fps,
            graph=graph, student_complexity=complexity, history=history
        )
        out = EpistemicVerifier.result_to_dict(result)
        return {'success': True, **out}

    except Exception as e:
        logger.exception('PAEV ask error')
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


def register_paev(app, *, redis=None):
    global _redis
    _redis = redis
    app.include_router(paev_router)
    r2_ok = bool(_r2_client())
    logger.info(f'PAEV routes registered | R2: {"configured" if r2_ok else "NOT configured — add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"}')
