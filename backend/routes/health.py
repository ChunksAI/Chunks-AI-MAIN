"""
backend/routes/health.py — Health and config endpoints.

Endpoints
---------
GET  /             Home / index
GET  /ping         Liveness check (no AI call)
GET  /health       Full status report
GET  /api/config   Public Supabase config for the frontend
"""
from __future__ import annotations

from flask import Blueprint, jsonify

from routes.shared import ctx

health_bp = Blueprint('health', __name__)


@health_bp.route('/')
def home():
    return jsonify({
        'name': 'Chunks Chemistry API',
        'version': '2.0',
        'status': 'running',
        'endpoints': {
            'health': '/health',
            'ask': '/ask',
            'load_book': '/load-book',
            'pdf': '/pdf/<book_id>',
            'library': '/get-library',
            'flashcards': '/generate-flashcards',
            'upload_document': '/upload-document',
            'study_materials': '/generate-study-materials',
            'quiz': '/generate-quiz',
            'ask_image': '/ask-image'
        }
    })


@health_bp.route('/ping', methods=['GET'])
def ping():
    # Static liveness check — does NOT call the AI API.
    limiter = getattr(ctx, 'limiter', None)
    if limiter:
        limiter.limit('60 per minute')(lambda: None)()
    return jsonify({
        'status':      'ok',
        'model':       ctx.MODEL,
        'api_key_set': ctx.OPENROUTER_API_KEY != 'your-key-here',
        'r2_set':      ctx.R2_BUCKET_URL != 'https://pub-xxxxx.r2.dev',
    })


@health_bp.route('/health', methods=['GET'])
def health():
    from services.books import _book_cache, BOOK_LIBRARY
    book_status = {}
    for bid, searcher in _book_cache.items():
        book_status[bid] = {
            'chunks': len(searcher.chunks),
            'search_mode': 'hybrid' if searcher.has_embeddings else 'tfidf'
        }
    return jsonify({
        'status': 'healthy',
        'mode': 'production' if ctx.PRODUCTION else 'development',
        'books_cached': book_status,
        'books_available': list(BOOK_LIBRARY.keys()),
        'r2_configured': ctx.R2_BUCKET_URL != 'https://pub-xxxxx.r2.dev',
        'api_configured': ctx.OPENROUTER_API_KEY != 'your-key-here'
    })


@health_bp.route('/api/config', methods=['GET', 'OPTIONS'])
def get_client_config():
    """Return public config values the frontend needs (no secrets here)."""
    return jsonify({
        'supabaseUrl':     ctx.SUPABASE_URL,
        'supabaseAnonKey': ctx.SUPABASE_ANON_KEY,
    })
