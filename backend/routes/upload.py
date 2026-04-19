"""
backend/routes/upload.py — Document upload endpoint.

Endpoints
---------
POST /upload-document
"""
from __future__ import annotations

import logging
import os
import sys
import threading
import uuid

import shutil
from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import JSONResponse
from werkzeug.utils import secure_filename

from routes.limiter import limiter
from routes.shared import ctx

# Ensure the backend root is importable for the PAEV background thread.
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

logger = logging.getLogger(__name__)

_KEY_NS_PREFIX: str = os.environ.get('REDIS_KEY_PREFIX', '')

router = APIRouter()


def _build_paev_index(book_id: str, slides: list) -> None:
    """
    Build a PAEV index for a user-uploaded document in the background.

    Converts the extracted slides into the chunks format expected by
    HierarchicalIndexer, runs the full PAEV pipeline, caches the result in
    Redis, and sets ``paev_ready:{book_id}`` so the chat route can detect
    that PAEV is available for this upload.
    """
    try:
        from services.hierarchical_indexer import HierarchicalIndexer
        from services.paev_fingerprint import EpistemicFingerprintBuilder
        from routes.paev import _paev_cache_set

        api_key = os.environ.get('OPENROUTER_API_KEY', '')
        model   = os.environ.get('MODEL', 'openai/gpt-4o-mini')

        # Convert slides → chunks format {page, text}
        chunks = [
            {
                'page': s.get('slide_number', i + 1),
                'text': ' '.join(
                    filter(None, [s.get('title', '')] + s.get('content', []))
                ),
            }
            for i, s in enumerate(slides)
        ]

        indexer    = HierarchicalIndexer(openrouter_api_key=api_key)
        fp_builder = EpistemicFingerprintBuilder(api_key=api_key, model=model)

        idx   = indexer.build_from_chunks(
            chunks, book_id=book_id, book_title=book_id, book_author='', embed=False
        )
        fps   = fp_builder.build_fingerprints_for_index(idx)
        fps   = fp_builder.detect_abstraction_supersessions(idx, fps)
        graph = fp_builder.build_prerequisite_graph(idx, fps)

        _paev_cache_set(book_id, idx, fps, graph)

        redis = getattr(ctx, 'redis', None)
        if redis is not None:
            redis.setex(f'{_KEY_NS_PREFIX}paev_ready:{book_id}', 86400, '1')

        logger.info('[%s] PAEV background build complete', book_id)
    except Exception:
        logger.exception('[%s] PAEV background build failed', book_id)


@router.post('/upload-document')
@limiter.limit("10/minute")
def upload_document(request: Request, file: UploadFile = File(default=None)):
    try:
        from services.auth import _extract_verified_user
        from services.books import ALLOWED_EXTENSIONS, allowed_file
        from services.documents import extract_slides_from_file

        # Verify JWT and enforce daily limit before doing any file I/O
        _extract_verified_user(request)

        if file is None:
            return JSONResponse({'success': False, 'error': 'No file uploaded'}, status_code=400)

        if not file.filename:
            return JSONResponse({'success': False, 'error': 'Empty filename'}, status_code=400)
        safe_name = secure_filename(file.filename)
        if not safe_name or not allowed_file(safe_name):
            return JSONResponse({
                'success': False,
                'error': 'Unsupported file type. Allowed: PDF, DOCX, PPTX'
            }, status_code=400)

        import tempfile
        temp_path = os.path.join(tempfile.gettempdir(), f"chunks_{uuid.uuid4().hex}_{safe_name}")
        with open(temp_path, 'wb') as f:
            shutil.copyfileobj(file.file, f)

        try:
            extracted_slides = extract_slides_from_file(temp_path, safe_name)
            os.remove(temp_path)
            book_id = f'upload_{uuid.uuid4().hex[:16]}'

            # Kick off PAEV indexing in the background — does not block the response.
            threading.Thread(
                target=_build_paev_index,
                args=(book_id, extracted_slides),
                daemon=True,
            ).start()

            return {
                'success':      True,
                'slides':       extracted_slides,
                'total_slides': len(extracted_slides),
                'filename':     safe_name,
                'bookId':       book_id,
            }
        except (ValueError, RuntimeError) as doc_err:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return JSONResponse({'success': False, 'error': str(doc_err)}, status_code=400)
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e

    except Exception as e:
        logger.exception("Unhandled error")
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)
