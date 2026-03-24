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

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from routes.shared import ctx

logger = logging.getLogger(__name__)

upload_bp = Blueprint('upload', __name__)


@upload_bp.route('/upload-document', methods=['POST', 'OPTIONS'])
def upload_document():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True})
    try:
        from services.auth import _extract_verified_user
        from services.books import ALLOWED_EXTENSIONS, allowed_file
        from services.documents import extract_slides_from_file

        # Verify JWT and enforce daily limit before doing any file I/O
        _extract_verified_user()

        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file uploaded'}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({'success': False, 'error': 'Empty filename'}), 400
        safe_name = secure_filename(file.filename)
        if not safe_name or not allowed_file(safe_name):
            return jsonify({
                'success': False,
                'error': 'Unsupported file type. Allowed: PDF, DOCX, PPTX'
            }), 400

        temp_path = f"/tmp/chunks_{uuid.uuid4().hex}_{safe_name}"
        file.save(temp_path)

        try:
            extracted_slides = extract_slides_from_file(temp_path, safe_name)
            os.remove(temp_path)
            return jsonify({
                'success':      True,
                'slides':       extracted_slides,
                'total_slides': len(extracted_slides),
                'filename':     safe_name
            })
        except (ValueError, RuntimeError) as doc_err:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({'success': False, 'error': str(doc_err)}), 400
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e

    except Exception as e:
        logger.exception("Unhandled error")
        return jsonify({'success': False, 'error': str(e)}), 500
