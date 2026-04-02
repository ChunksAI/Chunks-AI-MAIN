"""
backend/routes/upload.py — Document upload endpoint.

Endpoints
---------
POST /upload-document
"""
from __future__ import annotations

import logging
import os
import uuid

import shutil
from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import JSONResponse
from werkzeug.utils import secure_filename

from routes.shared import ctx

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post('/upload-document')
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
            return {
                'success':      True,
                'slides':       extracted_slides,
                'total_slides': len(extracted_slides),
                'filename':     safe_name
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
