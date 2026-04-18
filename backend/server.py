"""
Chunks - Production Server
Cloud-ready with R2 storage integration

server.py — App factory: configuration, middleware, error handlers,
             cache helpers, router registration.

Business logic has been moved to:
  services/auth.py          — Tier enum, JWT verification, tier lookup
  services/ai.py            — call_ai(), web search, sanitisation
  services/books.py         — BOOK_LIBRARY, TextbookSearch, book cache
  services/documents.py     — PDF/DOCX/PPTX extraction
  services/ask_cache.py     — Redis + Supabase cache for /ask queries
  services/material_cache.py — Redis cache for study materials
  services/mcq_parser.py    — MCQ text parser

Route handlers have been moved to:
  routes/health.py     — /, /ping, /health, /api/config
  routes/chat.py       — /ask
  routes/library.py    — /get-library, /load-book, /books/<book_id>/pdf
  routes/flashcards.py — /generate-flashcards
  routes/upload.py     — /upload-document
  routes/study.py      — /generate-study-materials, /generate-quiz
  routes/image.py      — /ask-image
  routes/admin.py      — /api/admin/*
"""

import logging
import os
import hashlib
import re
import time
import traceback
import uuid
from collections import deque
from contextvars import ContextVar
from datetime import datetime

import requests
import httpx
from concurrent.futures import ThreadPoolExecutor
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from slowapi.errors import RateLimitExceeded

import redis as redis_lib

from services.ai_router import route, route_for_mode  # noqa: F401 — re-exported for route files
from services.guest_limits import (  # noqa: F401
    guest_gate, enforce_exam_constraints_for_guest, GuestLimitExceeded,
)


# ── Request-ID context var (one value per async task / coroutine) ─────────────
_request_id_var: ContextVar[str] = ContextVar('request_id', default='-')

# ── In-memory circular buffer for the last 20 unhandled errors ────────────────
_recent_errors: deque = deque(maxlen=20)


class _RequestIdFilter(logging.Filter):
    """Inject the current request-ID into every log record for this task."""
    def filter(self, record: logging.LogRecord) -> bool:
        record.req_id = _request_id_var.get('-')
        return True


# ── Logging ───────────────────────────────────────────────────────────────────
# Field names whose values must never appear in logs (matched case-insensitively).
_SENSITIVE_LOG_FIELDS = frozenset({
    # snake_case
    'authorization', 'token', 'access_token', 'refresh_token',
    'api_key', 'password', 'secret', 'jwt', 'supabase_service_key',
    # camelCase (lowercased)
    'accesstoken', 'refreshtoken', 'apikey',
    # kebab-case
    'x-api-key', 'access-token', 'refresh-token',
    # misc PII
    'email',
})

_is_prod_logging = os.environ.get('PRODUCTION', 'false').lower() == 'true'

if _is_prod_logging:
    try:
        from pythonjsonlogger import jsonlogger as _jsonlogger  # type: ignore[import]

        class _SafeJsonFormatter(_jsonlogger.JsonFormatter):
            """JSON formatter that redacts known-sensitive field names."""
            def add_fields(self, log_record, record, message_dict):
                super().add_fields(log_record, record, message_dict)
                for field in list(log_record.keys()):
                    if field.lower() in _SENSITIVE_LOG_FIELDS:
                        log_record[field] = '[REDACTED]'

        _handler = logging.StreamHandler()
        _handler.setFormatter(_SafeJsonFormatter(
            fmt='%(asctime)s %(levelname)s %(name)s %(message)s',
            datefmt='%Y-%m-%dT%H:%M:%SZ',
        ))
        logging.root.handlers = [_handler]
        logging.root.setLevel(logging.INFO)
    except ImportError:
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] [req:%(req_id)s] %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S',
        )
else:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s [%(levelname)s] [req:%(req_id)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

logger = logging.getLogger(__name__)
# Attach the filter to the root logger so every logger in the app benefits.
logging.getLogger().addFilter(_RequestIdFilter())

# ── Sentry error monitoring ───────────────────────────────────────────────────
_SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi   import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    from sentry_sdk.integrations.logging   import LoggingIntegration

    if _SENTRY_DSN:
        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            integrations=[
                StarletteIntegration(transaction_style='url'),
                FastApiIntegration(transaction_style='url'),
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

# ── Async HTTP client — shared across all LLM calls ───────────────────────────
_async_http_client = httpx.AsyncClient(
    limits=httpx.Limits(
        max_connections=100,
        max_keepalive_connections=20,
        keepalive_expiry=30,
    ),
    timeout=httpx.Timeout(connect=5.0, read=60.0, write=10.0, pool=5.0),
)

# ── Thread pool for Supabase cache writes (bounded, no per-request threads) ───
_sb_write_executor = ThreadPoolExecutor(
    max_workers=4, thread_name_prefix='sb-write',
)

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
MODEL              = os.environ.get('MODEL', 'openai/gpt-oss-20b:nitro')

SUPABASE_URL         = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
SUPABASE_ANON_KEY    = os.environ.get('SUPABASE_ANON_KEY', '')

FREE_TIER_DAILY_LIMIT = 20
MAX_HISTORY_TURNS     = 10

# ── Redis client ──────────────────────────────────────────────────────────────
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
        logger.info("Redis connected: %s", _REDIS_URL.split("@")[-1])
    except Exception as _redis_err:
        logger.warning("⚠️  Redis connection failed (%s) — falling back to in-memory.", _redis_err)
        _redis = None
else:
    logger.warning(
        "⚠️  REDIS_URL not set — rate limiter using in-memory storage. "
        "Limits reset on restart and are NOT shared across workers. "
        "Add a Redis instance and set REDIS_URL for production."
    )

# ── Initialise service modules ────────────────────────────────────────────────
import services.auth as _auth_svc
import services.ai   as _ai_svc
import services.books as _books_svc
import services.embedding_cache as _embed_cache_svc
import services.vector_store as _vector_store_svc
import services.prompt_guard as _prompt_guard_svc
import services.circuit_breaker as _circuit_breaker_svc

_auth_svc.init(
    session              = _session,
    supabase_url         = SUPABASE_URL,
    supabase_service_key = SUPABASE_SERVICE_KEY,
    redis                = _redis,
)
_circuit_breaker_svc.init(redis_client=_redis)
_ai_svc.init(
    session            = _session,
    openrouter_api_key = OPENROUTER_API_KEY,
    model              = MODEL,
    max_history_turns  = MAX_HISTORY_TURNS,
    async_client       = _async_http_client,
    circuit_breaker    = _circuit_breaker_svc._breaker,
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
_prompt_guard_svc.init(
    session            = _session,
    openrouter_api_key = OPENROUTER_API_KEY,
    async_client       = _async_http_client,
)

import services.token_budget as _token_budget_svc  # noqa: E402
_token_budget_svc.init(redis=_redis)

import services.plan_limits as _plan_limits_svc  # noqa: E402
_plan_limits_svc.init(redis=_redis)

import services.device_abuse as _device_abuse_svc  # noqa: E402
_device_abuse_svc.init(redis=_redis)

# ── Unified cache service (replaces material_cache + ask_cache + answer_cache) ─
import services.cache as _cache_svc_mod  # noqa: E402
_cache_svc_mod.init(
    redis                = _redis,
    session              = _session,
    supabase_url         = SUPABASE_URL,
    supabase_service_key = SUPABASE_SERVICE_KEY,
    executor             = _sb_write_executor,
)

# ── Re-export BOOK_LIBRARY for backward compatibility ─────────────────────────
from services.books import BOOK_LIBRARY  # noqa: F401, E402 — re-export

from services.mcq_parser import _parse_mcq  # noqa: F401, E402

# ── CORS ──────────────────────────────────────────────────────────────────────
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

_is_production = PRODUCTION

_PRODUCTION_ORIGINS = [
    "https://chunks.online",
    "https://www.chunks.online",
    "https://chunks-ai.vercel.app",    # canonical staging deployment
]
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

_raw_origins = os.environ.get('ALLOWED_ORIGINS', '')
if _raw_origins and _raw_origins != '*':
    _allowed.extend(o.strip() for o in _raw_origins.split(',') if o.strip())
elif _raw_origins == '*':
    logger.warning(
        "⚠️  ALLOWED_ORIGINS='*' is ignored — CORS is restricted to "
        "explicit domains. Set specific origins or leave unset."
    )

CORS_ORIGINS = list(dict.fromkeys(_allowed))
# Vercel preview URLs are scoped to the "chunks-ai" project; the regex
# matches the base domain and any valid preview suffix (no trailing/double hyphens).
_VERCEL_ORIGIN_REGEX = (
    r'^https://chunks-ai(-[a-z0-9]([a-z0-9-]*[a-z0-9])*)?\.vercel\.app$'
)

logger.info("CORS mode: %s", 'PRODUCTION' if _is_production else 'DEVELOPMENT')
logger.info("CORS allowed origins: %s", CORS_ORIGINS)

if _is_production and not _raw_origins:
    logger.warning(
        "⚠️  ALLOWED_ORIGINS env var is not set. "
        "CORS is restricted to the hard-coded production allowlist: %s. "
        "Set ALLOWED_ORIGINS to add extra origins without a redeploy.",
        _PRODUCTION_ORIGINS,
    )


def _origin_is_allowed(origin: str) -> bool:
    """Return True if *origin* matches the explicit list or the Vercel regex."""
    if origin in CORS_ORIGINS:
        return True
    return bool(re.match(_VERCEL_ORIGIN_REGEX, origin))


def _extract_origin_from_referer(referer: str) -> str:
    """Extract the scheme+host+port portion from a Referer URL."""
    try:
        from urllib.parse import urlparse
        p = urlparse(referer)
        if p.scheme and p.netloc:
            return f"{p.scheme}://{p.netloc}"
    except Exception:
        pass
    return ''


# ── CSP policy ────────────────────────────────────────────────────────────────
_CSP = '; '.join([
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
    "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://api.chunks.online https://*.r2.dev",
    "connect-src 'self' https://api.chunks.online https://*.supabase.co https://api.semanticscholar.org",
    "worker-src blob: https://cdnjs.cloudflare.com",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
])

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="Chunks API", version="2.0")

# ── Rate limiter ──────────────────────────────────────────────────────────────
from routes.limiter import limiter  # noqa: E402
app.state.limiter = limiter


async def _json_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Return a machine-readable JSON 429 instead of slowapi's default HTML."""
    return JSONResponse(
        {'error': 'Rate limit exceeded', 'retry_after': 60},
        status_code=429,
    )


app.add_exception_handler(RateLimitExceeded, _json_rate_limit_handler)

# ── CSRF origin check middleware ──────────────────────────────────────────────
_CSRF_SAFE_METHODS = frozenset(('GET', 'HEAD', 'OPTIONS'))


def _is_csrf_disabled() -> bool:
    """CSRF is disabled only when pytest is actively running. Never in production."""
    return 'PYTEST_CURRENT_TEST' in os.environ


# Belt-and-suspenders: abort startup if CSRF would be suppressed in production.
if PRODUCTION and 'PYTEST_CURRENT_TEST' not in os.environ and _is_csrf_disabled():
    logger.critical(
        "CSRF protection is disabled in a production environment — refusing to start."
    )
    raise RuntimeError(
        "CSRF must not be disabled in production. "
        "Unset PYTEST_CURRENT_TEST or fix the CSRF configuration."
    )


@app.middleware("http")
async def csrf_origin_check(request: Request, call_next):
    """Block state-changing requests whose Origin/Referer is untrusted."""
    if _is_csrf_disabled():
        return await call_next(request)

    if request.method in _CSRF_SAFE_METHODS:
        return await call_next(request)

    origin = request.headers.get('origin', '').strip()
    if origin:
        if _origin_is_allowed(origin):
            return await call_next(request)
        logger.warning("CSRF block: untrusted Origin %r on %s %s",
                       origin, request.method, request.url.path)
        return JSONResponse(
            {'success': False, 'error': 'Forbidden — origin not allowed'},
            status_code=403,
        )

    referer = request.headers.get('referer', '').strip()
    if referer:
        ref_origin = _extract_origin_from_referer(referer)
        if ref_origin and _origin_is_allowed(ref_origin):
            return await call_next(request)
        logger.warning("CSRF block: untrusted Referer %r on %s %s",
                       referer, request.method, request.url.path)
        return JSONResponse(
            {'success': False, 'error': 'Forbidden — origin not allowed'},
            status_code=403,
        )

    # Neither header present → non-browser client; allow
    return await call_next(request)


# ── Request-ID middleware ─────────────────────────────────────────────────────
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    """Propagate or generate an X-Request-Id for end-to-end traceability.

    Reads ``X-Request-Id`` from the incoming request headers.  If absent,
    generates an 8-character hex ID.  The ID is:
    - Stored on ``request.state.request_id`` for use in route handlers.
    - Stored in the async-task-local ``_request_id_var`` so every log line
      emitted during this request automatically includes ``[req:<id>]``.
    - Echoed back in the ``X-Request-Id`` response header.
    """
    req_id = request.headers.get('x-request-id') or uuid.uuid4().hex[:8]
    # Sanitise to prevent log injection: allow only hex chars and hyphens, max 64 chars.
    if not re.fullmatch(r'[0-9a-fA-F\-]{1,64}', req_id):
        req_id = uuid.uuid4().hex[:8]
    request.state.request_id = req_id
    token = _request_id_var.set(req_id)
    start_time = time.time()
    try:
        response = await call_next(request)
    finally:
        _request_id_var.reset(token)
    response.headers['X-Request-Id'] = req_id
    user_id = getattr(request.state, 'user_id', None)
    logger.info(
        "request",
        extra={
            "request_id": req_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "latency_ms": round((time.time() - start_time) * 1000),
            "user_id_hash": hashlib.sha256(user_id.encode()).hexdigest()[:12] if user_id else None,
        },
    )
    return response



@app.middleware("http")
async def security_headers(request: Request, call_next):
    # HTTP → HTTPS redirect in production
    forwarded_proto = request.headers.get('x-forwarded-proto', 'https')
    if PRODUCTION and forwarded_proto == 'http':
        https_url = str(request.url).replace('http://', 'https://', 1)
        return RedirectResponse(url=https_url, status_code=301)

    response = await call_next(request)

    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    response.headers['Content-Security-Policy'] = _CSP
    if 'server' in response.headers:
        del response.headers['server']
    if 'x-powered-by' in response.headers:
        del response.headers['x-powered-by']

    return response


# ── CORS middleware (outermost — must be last add_middleware call) ─────────────
# Placed after all @app.middleware blocks so it wraps every request first,
# ensuring CORS headers are present even on error responses (500/401/429).
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=_VERCEL_ORIGIN_REGEX,
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "X-Device-Id", "Cache-Control", "X-Request-Id"],
    allow_methods=["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
    allow_credentials=False,
    max_age=86400,
)


# ── Exception handlers ────────────────────────────────────────────────────────
from fastapi.exceptions import RequestValidationError  # noqa: E402


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    """Return a consistent error envelope for Pydantic validation failures."""
    errors = []
    for e in exc.errors():
        err = {k: v for k, v in e.items() if k != 'ctx'}
        if 'ctx' in e:
            err['ctx'] = {k: str(v) if not isinstance(v, (str, int, float, bool, type(None))) else v
                          for k, v in e['ctx'].items()}
        errors.append(err)
    return JSONResponse(
        {'success': False, 'error': 'Validation error', 'details': errors},
        status_code=422,
    )


@app.exception_handler(413)
async def too_large(request: Request, exc):
    return JSONResponse({'success': False, 'error': 'File too large. Maximum is 25 MB.'}, status_code=413)


@app.exception_handler(404)
async def not_found(request: Request, exc):
    return JSONResponse({'success': False, 'error': 'Endpoint not found.'}, status_code=404)


@app.exception_handler(405)
async def method_not_allowed(request: Request, exc):
    return JSONResponse({'success': False, 'error': 'Method not allowed.'}, status_code=405)


@app.exception_handler(500)
async def internal_error(request: Request, exc):
    logger.exception("Unhandled 500 error")
    _recent_errors.append({
        'time':       datetime.utcnow().isoformat(),
        'path':       request.url.path,
        'error_type': type(exc).__name__,
        'error':      str(exc)[:500],
        'traceback':  traceback.format_exc()[-2000:],
    })
    return JSONResponse({'success': False, 'error': 'Internal server error.'}, status_code=500)


# ── Startup: validate required secrets ───────────────────────────────────────
# Names of environment variables that must be set (non-empty and not a
# placeholder) before the server can safely serve traffic.  In production,
# any missing/placeholder value is fatal (raises RuntimeError → prevents the
# worker from starting).  In development it emits a warning so local testing
# still works without all keys.
_REQUIRED_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENROUTER_API_KEY']
_ENV_PLACEHOLDER_VALUES = frozenset({'your-key-here', 'placeholder', ''})


@app.on_event("startup")
async def validate_secrets():
    is_prod = os.environ.get('PRODUCTION', '').lower() == 'true'
    for env_var in _REQUIRED_ENV_VARS:
        val = os.environ.get(env_var, '')
        if not val or val in _ENV_PLACEHOLDER_VALUES:
            msg = f"MISSING or PLACEHOLDER secret: {env_var}"
            if is_prod:
                logger.critical(msg)
                raise RuntimeError(msg)
            else:
                logger.warning(msg)


@app.on_event("startup")
async def validate_services():
    try:
        from services.cache import cache_svc
        from services.usage import enforce
        logger.info("Core services loaded OK")
    except Exception as e:
        logger.critical("Service import failed at startup: %s", e)
        raise


@app.on_event("shutdown")
async def close_async_http_client():
    """Drain keep-alive connections and close the shared httpx.AsyncClient."""
    await _async_http_client.aclose()
    logger.info("Async HTTP client closed.")


@app.on_event("shutdown")
async def shutdown_sb_write_executor():
    """Drain pending Supabase cache writes and shut down the thread pool."""
    _sb_write_executor.shutdown(wait=True, cancel_futures=False)
    logger.info("Supabase write executor shut down.")


# ── Shared context — populate before registering routers ─────────────────────
from routes.shared import ctx as _ctx  # noqa: E402
_ctx._init(
    session              = _session,
    async_client         = _async_http_client,
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

# ── Router registration ───────────────────────────────────────────────────────
from routes.admin         import router as admin_router      # noqa: E402
from routes.health        import router as health_router     # noqa: E402
from routes.library       import router as library_router    # noqa: E402
from routes.flashcards    import router as flashcards_router  # noqa: E402
from routes.upload        import router as upload_router     # noqa: E402
from routes.study         import router as study_router      # noqa: E402
from routes.youtube       import router as youtube_router    # noqa: E402
from routes.image         import router as image_router      # noqa: E402
from routes.chat          import router as chat_router       # noqa: E402
from routes.jobs          import router as jobs_router       # noqa: E402
from routes.share_content import router as share_router      # noqa: E402
from routes.tutor_brain   import router as tutor_router      # noqa: E402

app.include_router(admin_router)
app.include_router(health_router)
app.include_router(library_router)
app.include_router(flashcards_router)
app.include_router(upload_router)
app.include_router(study_router)
app.include_router(image_router)
app.include_router(chat_router)
app.include_router(jobs_router)
app.include_router(share_router)
app.include_router(youtube_router)
app.include_router(tutor_router)

# ── PAEV and progress routes ──────────────────────────────────────────────────
from routes.paev    import register_paev      # noqa: E402
from routes.progress import register_progress  # noqa: E402
register_paev(app, redis=_redis)
register_progress(app)

# ── Initialise async job queue ────────────────────────────────────────────────
from services.job_queue import job_queue as _job_queue  # noqa: E402
_job_queue.init(redis=_redis)

# ── Initialise share store ────────────────────────────────────────────────────
import services.share_store as _share_store_svc  # noqa: E402
_share_store_svc.init(redis=_redis)


# ============================================
# START SERVER
# ============================================

if __name__ == '__main__':
    import uvicorn
    logger.info("=" * 60)
    logger.info("🧠 CHUNKS API - PRODUCTION SERVER (FastAPI/ASGI)")
    logger.info("=" * 60)
    logger.info(f"Mode: {'PRODUCTION' if PRODUCTION else 'DEVELOPMENT'}")
    logger.info(f"Books: {len(BOOK_LIBRARY)}")
    logger.info(f"R2: {'Configured' if R2_BUCKET_URL != 'https://pub-xxxxx.r2.dev' else 'NOT CONFIGURED'}")
    logger.info(f"API: {'Configured' if OPENROUTER_API_KEY != 'your-key-here' else 'NOT CONFIGURED'}")
    logger.info(f"Port: {PORT}")
    uvicorn.run(app, host='0.0.0.0', port=PORT, log_level='info')
