"""
Chunks Chemistry - Production Server
Cloud-ready with R2 storage integration

server.py — App factory: configuration, middleware, error handlers,
             cache helpers, blueprint registration.

Business logic has been moved to:
  services/auth.py     — Tier enum, JWT verification, tier lookup
  services/ai.py       — call_ai(), web search, sanitisation
  services/books.py    — BOOK_LIBRARY, TextbookSearch, book cache
  services/documents.py — PDF/DOCX/PPTX extraction

Route handlers have been moved to:
  routes/health.py     — /, /ping, /health, /api/config
  routes/chat.py       — /ask
  routes/library.py    — /get-library, /load-book, /pdf/<book_id>
  routes/flashcards.py — /generate-flashcards
  routes/upload.py     — /upload-document
  routes/study.py      — /generate-study-materials, /generate-quiz
  routes/image.py      — /ask-image
  routes/admin.py      — /api/admin/* (unchanged)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import json
import os
import re
import hashlib
import logging
import time
from datetime import datetime, timedelta
import redis as redis_lib
from ai_router import route, route_for_mode
from guest_limits import guest_gate, enforce_exam_constraints_for_guest, GuestLimitExceeded


# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ── Sentry error monitoring ───────────────────────────────────────────────────
_SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
try:
    import sentry_sdk
    from sentry_sdk.integrations.flask   import FlaskIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    if _SENTRY_DSN:
        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            integrations=[
                FlaskIntegration(transaction_style='url'),
                LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
            ],
            traces_sample_rate=0.10,
            send_default_pii=False,
            environment='production' if os.environ.get('PRODUCTION', '').lower() == 'true' else 'development',
            release=os.environ.get('RAILWAY_DEPLOYMENT_ID', 'unknown'),
        )
        logger.info("Sentry initialised (DSN configured, environment=%s)",
                    'production' if os.environ.get('PRODUCTION', '').lower() == 'true' else 'development')
    else:
        logger.info("Sentry disabled — set SENTRY_DSN env var to enable error monitoring")
except ImportError:
    logger.warning(
        "sentry-sdk not installed — error monitoring unavailable. "
        "Add sentry-sdk to requirements.txt to enable."
    )

# ── HTTP Session — connection pooling + retry ─────────────────────────────────
def _build_session():
    session = requests.Session()
    retry = Retry(total=3, backoff_factor=0.5,
                  status_forcelist=[502, 503, 504],
                  allowed_methods=["GET", "POST"], raise_on_status=False)
    adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=20)
    session.mount("https://", adapter)
    session.mount("http://",  adapter)
    return session

_session = _build_session()

app = Flask(__name__)

# ── ProxyFix ──────────────────────────────────────────────────────────────────
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

# ── CORS ──────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
BACKEND_URL  = os.environ.get('BACKEND_URL',  'http://localhost:5000')

_is_production = os.environ.get('PRODUCTION', 'false').lower() == 'true'

# Production domains — always allowed
_PRODUCTION_ORIGINS = [
    "https://chunks.online",
    "https://www.chunks.online",
    "https://chunks-ai.vercel.app",
]

# Development-only origins — never allowed in production
_DEV_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

_allowed = list(_PRODUCTION_ORIGINS)
if not _is_production:
    _allowed.extend(_DEV_ORIGINS)
    if FRONTEND_URL and FRONTEND_URL not in _allowed:
        _allowed.append(FRONTEND_URL)

# Extra origins from env (comma-separated). Wildcard '*' is never accepted.
_raw_origins = os.environ.get('ALLOWED_ORIGINS', '')
if _raw_origins and _raw_origins != '*':
    _allowed.extend(o.strip() for o in _raw_origins.split(',') if o.strip())
elif _raw_origins == '*':
    logger.warning(
        "⚠️  ALLOWED_ORIGINS='*' is ignored — CORS is restricted to "
        "explicit domains. Set specific origins or leave unset."
    )

# Deduplicate while preserving order
CORS_ORIGINS = list(dict.fromkeys(_allowed))
# Allow Vercel preview deployments scoped to this project only
CORS_ORIGINS.append(re.compile(r'^https://chunks-ai(?:-[a-z0-9]+)*\.vercel\.app$'))

logger.info("CORS mode: %s", 'PRODUCTION' if _is_production else 'DEVELOPMENT')
logger.info("CORS allowed origins: %s",
            [o if isinstance(o, str) else o.pattern for o in CORS_ORIGINS])

CORS(app,
     origins=CORS_ORIGINS,
     allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Device-Id"],
     methods=["GET", "POST", "OPTIONS"],
     supports_credentials=False,
     max_age=86400)


@app.after_request
def after_request(response):
    origin = request.headers.get('Origin', '')
    if origin:
        _origin_ok = any(
            (o.match(origin) if hasattr(o, 'match') else o == origin)
            for o in CORS_ORIGINS
        )
        if _origin_ok:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    if request.headers.get('X-Forwarded-Proto', 'https') == 'http':
        https_url = request.url.replace('http://', 'https://', 1)
        from flask import redirect as _redir
        return _redir(https_url, code=301)

    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    response.headers.pop('Server', None)
    response.headers.pop('X-Powered-By', None)

    _csp_parts = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
        "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
        (
            "img-src 'self' data: blob: "
            "https://api.chunks.online "
            "https://api.chunks.online "
            "https://*.r2.dev"
        ),
        (
            "connect-src 'self' "
            "https://api.chunks.online "
            "https://api.chunks.online "
            "https://*.supabase.co "
            "https://api.semanticscholar.org"
        ),
        "worker-src blob: https://cdnjs.cloudflare.com",
        "frame-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
    ]
    response.headers['Content-Security-Policy'] = '; '.join(_csp_parts)

    return response


# ── Redis client + Rate Limiting ──────────────────────────────────────────────
_REDIS_URL = os.environ.get('REDIS_URL', '')

_redis: redis_lib.Redis | None = None
if _REDIS_URL:
    try:
        _redis = redis_lib.from_url(
            _REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
        _redis.ping()
        _limiter_storage = _REDIS_URL
        logger.info("Redis connected: %s", _REDIS_URL.split("@")[-1])
    except Exception as _redis_err:
        logger.warning("⚠️  Redis connection failed (%s) — falling back to in-memory.", _redis_err)
        _redis = None
        _limiter_storage = "memory://"
else:
    _limiter_storage = "memory://"
    logger.warning(
        "⚠️  REDIS_URL not set — rate limiter using in-memory storage. "
        "Limits reset on restart and are NOT shared across workers. "
        "Add a Redis instance and set REDIS_URL for production."
    )

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["500 per hour", "120 per minute"],
    storage_uri=_limiter_storage,
    strategy="fixed-window"
)

# ── Upload size limit 25MB ────────────────────────────────────────────────────
app.config['MAX_CONTENT_LENGTH'] = 25 * 1024 * 1024

# ── App config ────────────────────────────────────────────────────────────────
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', 'your-key-here')
R2_BUCKET_URL      = os.environ.get('R2_BUCKET_URL', 'https://pub-xxxxx.r2.dev')
if R2_BUCKET_URL == 'https://pub-xxxxx.r2.dev':
    logger.warning("⚠️  R2_BUCKET_URL is still the placeholder value — all book URLs will 404! Set R2_BUCKET_URL in your environment.")
if OPENROUTER_API_KEY == 'your-key-here':
    logger.warning("⚠️  OPENROUTER_API_KEY is not set — all AI calls will fail! Set OPENROUTER_API_KEY in your environment.")
PORT               = int(os.environ.get('PORT', 5000))
PRODUCTION         = os.environ.get('PRODUCTION', 'false').lower() == 'true'
OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions"
MODEL              = os.environ.get('MODEL', 'openai/gpt-oss-20b:nitroe')

SUPABASE_URL         = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
SUPABASE_ANON_KEY    = os.environ.get('SUPABASE_ANON_KEY', '')

FREE_TIER_DAILY_LIMIT = 20
MAX_HISTORY_TURNS     = 10

# ── Initialise service modules ────────────────────────────────────────────────
import services.auth as _auth_svc
import services.ai   as _ai_svc
import services.books as _books_svc
import services.embedding_cache as _embed_cache_svc
import services.vector_store as _vector_store_svc
import services.answer_cache as _answer_cache_svc
import services.prompt_guard as _prompt_guard_svc

_auth_svc.init(
    session              = _session,
    supabase_url         = SUPABASE_URL,
    supabase_service_key = SUPABASE_SERVICE_KEY,
    redis                = _redis,
)
_ai_svc.init(
    session            = _session,
    openrouter_api_key = OPENROUTER_API_KEY,
    model              = MODEL,
    max_history_turns  = MAX_HISTORY_TURNS,
)
_vector_store_svc.init(
    session              = _session,
    supabase_url         = SUPABASE_URL,
    supabase_service_key = SUPABASE_SERVICE_KEY,
)
_books_svc.init(
    session            = _session,
    openrouter_api_key = OPENROUTER_API_KEY,
    r2_bucket_url      = R2_BUCKET_URL,
    redis              = _redis,
)
_embed_cache_svc.init(redis=_redis)
_answer_cache_svc.init(redis=_redis)
_prompt_guard_svc.init(
    session            = _session,
    openrouter_api_key = OPENROUTER_API_KEY,
)

import services.token_budget as _token_budget_svc  # noqa: E402
_token_budget_svc.init(redis=_redis)

import services.device_abuse as _device_abuse_svc  # noqa: E402
_device_abuse_svc.init(redis=_redis)

# ── Re-export BOOK_LIBRARY for backward compatibility ─────────────────────────
# paev_routes.py and other existing modules do: from server import BOOK_LIBRARY
from services.books import BOOK_LIBRARY  # noqa: E402 — re-export

# ── Material cache (Redis-backed) ──────────────────────────────────────────────
_MATERIAL_CACHE_TTL = 86400          # 24 hours

def _cache_key(book_id: str, topic: str, mtype: str, count: int) -> str:
    norm = re.sub(r'[^a-z0-9]', '_', topic.lower().strip())[:60]
    return f"{mtype}:{book_id}:{norm}:{count}"

def _cache_get(key: str):
    if _redis is None:
        return None
    try:
        raw = _redis.get(key)
        if raw is not None:
            return json.loads(raw)
    except Exception as exc:
        logger.warning("material_cache GET error: %s", exc)
    return None

def _cache_set(key: str, value) -> None:
    if _redis is None:
        return
    try:
        _redis.setex(key, _MATERIAL_CACHE_TTL, json.dumps(value, default=str))
    except Exception as exc:
        logger.warning("material_cache SET error: %s", exc)


# ── Redis query cache for /ask ─────────────────────────────────────────────────
_ASK_CACHE_TTL       = 3600
_ASK_CACHEABLE_MODES = frozenset(['study', 'summary', 'general', 'concise', 'detailed', 'generate'])

def _ask_cache_key(book_id: str, task_type: str | None, mode: str,
                   complexity: int, question: str) -> str:
    canonical = f"{book_id}|{task_type or mode}|{complexity}|{question.strip().lower()}"
    digest    = hashlib.sha256(canonical.encode()).hexdigest()[:16]
    return f"ask:v1:{digest}"

def _ask_cache_get(key: str) -> dict | None:
    if _redis:
        try:
            raw = _redis.get(key)
            if raw:
                logger.debug("ask_cache HIT (redis) key=%s", key)
                return json.loads(raw)
        except Exception as e:
            logger.warning("ask_cache redis GET error: %s", e)
    sb_hit = _sb_cache_get(key)
    if sb_hit:
        if _redis:
            try:
                _redis.setex(key, _ASK_CACHE_TTL, json.dumps(sb_hit, default=str))
            except Exception:
                pass
        return sb_hit
    return None

def _ask_cache_set(key: str, payload: dict, *,
                   task_type: str | None = None, mode: str = '',
                   book_id: str = '', model_used: str = '') -> None:
    if _redis:
        try:
            _redis.setex(key, _ASK_CACHE_TTL, json.dumps(payload, default=str))
        except Exception as e:
            logger.warning("ask_cache redis SET error: %s", e)
    _sb_cache_set(key, payload, task_type=task_type, mode=mode,
                  book_id=book_id, model_used=model_used)

def _ask_is_cacheable(mode: str, history: list, web_search: bool,
                      thinking_mode: str | None) -> bool:
    return (
        mode in _ASK_CACHEABLE_MODES
        and not history
        and not web_search
        and not thinking_mode
    )


# ── Supabase persistent cache tier ────────────────────────────────────────────
_SB_CACHE_TTL_DAYS = 7

def _sb_headers() -> dict:
    return {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "apikey":        SUPABASE_SERVICE_KEY,
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }

def _sb_cache_get(key: str) -> dict | None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None
    try:
        resp = _session.get(
            f"{SUPABASE_URL}/rest/v1/query_cache",
            params={
                "cache_key": f"eq.{key}",
                "expires_at": f"gt.{__import__('datetime').datetime.utcnow().isoformat()}",
                "select":    "answer",
                "limit":     "1",
            },
            headers=_sb_headers(),
            timeout=3,
        )
        if resp.status_code == 200:
            rows = resp.json()
            if rows:
                try:
                    _session.post(
                        f"{SUPABASE_URL}/rest/v1/rpc/increment_cache_hit",
                        json={"p_cache_key": key},
                        headers=_sb_headers(),
                        timeout=2,
                    )
                except Exception:
                    pass
                logger.debug("ask_cache HIT (supabase) key=%s", key)
                return rows[0]["answer"]
    except Exception as e:
        logger.warning("sb_cache GET error: %s", e)
    return None

def _sb_cache_set(key: str, payload: dict, task_type: str | None,
                  mode: str, book_id: str, model_used: str) -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return
    try:
        import datetime
        expires = (datetime.datetime.utcnow() +
                   datetime.timedelta(days=_SB_CACHE_TTL_DAYS)).isoformat()
        _session.post(
            f"{SUPABASE_URL}/rest/v1/query_cache",
            json={
                "cache_key":  key,
                "answer":     payload,
                "task_type":  task_type,
                "mode":       mode,
                "book_id":    book_id,
                "model_used": model_used,
                "expires_at": expires,
            },
            headers={**_sb_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
            timeout=4,
        )
    except Exception as e:
        logger.warning("sb_cache SET error: %s", e)


# ── MCQ parser (used by routes/chat.py and routes/study.py) ──────────────────

def _parse_mcq(raw_text):
    """Parse AI-generated MCQ text into a list of question dicts."""
    questions = []
    blocks = re.split(r'\n(?=Q\d+\.)', raw_text.strip())

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        lines = block.splitlines()
        q_obj = {'number': None, 'question': '', 'options': {}, 'answer': '', 'explanation': ''}
        active_field = None
        explanation_lines = []

        for line in lines:
            stripped = line.strip()
            if not stripped:
                if active_field == 'explanation':
                    explanation_lines.append('')
                continue

            m = re.match(r'^Q(\d+)\.\s*(.*)', stripped)
            if m:
                q_obj['number'] = int(m.group(1))
                q_obj['question'] = m.group(2)
                active_field = 'question'
                continue

            m = re.match(r'^([A-D])[).]\s*(.*)', stripped)
            if m:
                q_obj['options'][m.group(1)] = m.group(2)
                active_field = 'option'
                continue

            m = re.match(r'^Answer:\s*(.*)', stripped, re.IGNORECASE)
            if m:
                q_obj['answer'] = m.group(1).strip()
                active_field = 'answer'
                continue

            m = re.match(r'^Explanation:\s*(.*)', stripped, re.IGNORECASE)
            if m:
                first_line = m.group(1).strip()
                if first_line:
                    explanation_lines.append(first_line)
                active_field = 'explanation'
                continue

            if active_field == 'explanation':
                explanation_lines.append(stripped)
            elif active_field == 'question':
                q_obj['question'] = q_obj['question'] + ' ' + stripped

        if explanation_lines:
            q_obj['explanation'] = '\n'.join(explanation_lines).strip()

        if q_obj['number'] is not None:
            questions.append(q_obj)

    return questions


# ── Error handlers ────────────────────────────────────────────────────────────

@app.errorhandler(413)
def too_large(e):
    return jsonify({'success': False, 'error': 'File too large. Maximum is 25 MB.'}), 413

@app.errorhandler(429)
def rate_limited(e):
    return jsonify({'success': False, 'error': 'Too many requests. Please slow down.'}), 429

@app.errorhandler(404)
def not_found(e):
    return jsonify({'success': False, 'error': 'Endpoint not found.'}), 404

@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({'success': False, 'error': 'Method not allowed.'}), 405

@app.errorhandler(500)
def internal_error(e):
    logger.exception("Unhandled 500 error")
    return jsonify({'success': False, 'error': 'Internal server error.'}), 500


# ── PAEV and progress routes ──────────────────────────────────────────────────
from paev_routes import register_paev
register_paev(app, redis=_redis)

from progress_routes import register_progress
register_progress(app)

# ── Shared context — populate before registering blueprints ──────────────────
from routes.shared import ctx as _ctx
_ctx._init(
    session              = _session,
    SUPABASE_URL         = SUPABASE_URL,
    SUPABASE_SERVICE_KEY = SUPABASE_SERVICE_KEY,
    SUPABASE_ANON_KEY    = SUPABASE_ANON_KEY,
    OPENROUTER_API_KEY   = OPENROUTER_API_KEY,
    OPENROUTER_URL       = OPENROUTER_URL,
    R2_BUCKET_URL        = R2_BUCKET_URL,
    MODEL                = MODEL,
    PRODUCTION           = PRODUCTION,
    verify_supabase_jwt  = _auth_svc._verify_supabase_jwt,
    call_ai              = _ai_svc.call_ai,
    redis                = _redis,
    logger               = logger,
    limiter              = limiter,
)

# ── Blueprint registration ────────────────────────────────────────────────────
from routes.admin     import admin_bp
from routes.health    import health_bp
from routes.library   import library_bp
from routes.flashcards import flashcards_bp
from routes.upload    import upload_bp
from routes.study     import study_bp
from routes.image     import image_bp
from routes.chat      import chat_bp
from routes.jobs      import jobs_bp

app.register_blueprint(admin_bp)
app.register_blueprint(health_bp)
app.register_blueprint(library_bp)
app.register_blueprint(flashcards_bp)
app.register_blueprint(upload_bp)
app.register_blueprint(study_bp)
app.register_blueprint(image_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(jobs_bp)

# ── Initialise async job queue ────────────────────────────────────────────────
from services.job_queue import job_queue as _job_queue
_job_queue.init(redis=_redis)

# ── Rate-limit decorators for blueprints that use ctx.limiter ─────────────────
# Apply per-endpoint limits directly here so limiter is available at startup.
limiter.limit('10 per minute; 30 per hour',
              exempt_when=lambda: request.method == 'OPTIONS')(
    app.view_functions['library.load_book']
)
limiter.limit('20 per minute; 100 per hour')(
    app.view_functions['library.serve_pdf']
)
limiter.limit('10 per minute; 60 per hour',
              exempt_when=lambda: request.method == 'OPTIONS')(
    app.view_functions['flashcards.generate_flashcards']
)
limiter.limit('10 per minute; 50 per hour',
              exempt_when=lambda: request.method == 'OPTIONS')(
    app.view_functions['upload.upload_document']
)
limiter.limit('5 per minute; 20 per hour',
              exempt_when=lambda: request.method == 'OPTIONS')(
    app.view_functions['study.generate_study_materials']
)
limiter.limit('10 per minute; 60 per hour',
              exempt_when=lambda: request.method == 'OPTIONS')(
    app.view_functions['study.generate_quiz']
)
limiter.limit('10 per minute; 40 per hour',
              exempt_when=lambda: request.method == 'OPTIONS')(
    app.view_functions['image.ask_image']
)
limiter.limit(
    '20 per minute; 100 per hour',
    exempt_when=lambda: (
        request.method == 'OPTIONS' or
        request.headers.get('Authorization', '').strip().startswith('Bearer ')
    )
)(app.view_functions['chat.ask'])
limiter.limit('120 per minute; 500 per hour')(
    app.view_functions['health.get_client_config']
)
limiter.limit('60 per minute')(
    app.view_functions['health.ping']
)
limiter.limit(
    '20 per minute; 100 per hour',
    exempt_when=lambda: (
        request.method == 'OPTIONS' or
        request.headers.get('Authorization', '').strip().startswith('Bearer ')
    )
)(app.view_functions['jobs.ask_async'])
limiter.limit('120 per minute; 500 per hour')(
    app.view_functions['jobs.get_job_status']
)


# ============================================
# START SERVER
# ============================================

if __name__ == '__main__':
    logger.info("=" * 60)
    logger.info("🧪 CHUNKS CHEMISTRY - PRODUCTION SERVER")
    logger.info("=" * 60)
    logger.info(f"Mode: {'PRODUCTION' if PRODUCTION else 'DEVELOPMENT'}")
    logger.info(f"Books: {len(BOOK_LIBRARY)}")
    logger.info(f"R2: {'Configured' if R2_BUCKET_URL != 'https://pub-xxxxx.r2.dev' else 'NOT CONFIGURED'}")
    logger.info(f"API: {'Configured' if OPENROUTER_API_KEY != 'your-key-here' else 'NOT CONFIGURED'}")
    logger.info(f"Port: {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)
