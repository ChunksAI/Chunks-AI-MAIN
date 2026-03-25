"""
backend/routes/library.py — Book library endpoints.

Endpoints
---------
GET  /get-library       List available books
POST /load-book         Load a book's chunks into memory
GET  /pdf/<book_id>     Proxy PDF from R2
"""
from __future__ import annotations

import logging

from flask import Blueprint, Response, jsonify, request, stream_with_context

from routes.shared import ctx
from routes.validation import validate_request
from routes.schemas import LoadBookRequest
from guest_limits import GuestLimitExceeded, guest_gate

logger = logging.getLogger(__name__)

library_bp = Blueprint('library', __name__)


@library_bp.route('/get-library', methods=['GET'])
def get_library():
    from services.books import BOOK_LIBRARY
    books = [
        {'id': bid, 'name': info['name'], 'author': info['author'], 'available': True}
        for bid, info in BOOK_LIBRARY.items()
    ]
    return jsonify({'success': True, 'books': books})


@library_bp.route('/load-book', methods=['POST', 'OPTIONS'])
@validate_request(LoadBookRequest)
def load_book():
    if request.method == 'OPTIONS':
        return jsonify({'ok': True})
    try:
        try:
            guest_gate(request, 'library', ctx.redis)
        except GuestLimitExceeded as _gle:
            return _gle.response()

        from services.books import BOOK_LIBRARY, get_book_index
        data    = request.json
        book_id = data.get('bookId')
        logger.info(f"Load book request: {book_id}")

        if book_id not in BOOK_LIBRARY:
            return jsonify({'success': False, 'error': f'Book "{book_id}" not found'}), 404

        book     = BOOK_LIBRARY[book_id]
        searcher = get_book_index(book_id)

        if not searcher.chunks:
            return jsonify({'success': False, 'error': 'Failed to load chunks from R2'}), 500

        return jsonify({
            'success':      True,
            'book_id':      book_id,
            'book_name':    book['name'],
            'author':       book['author'],
            'chunks_count': len(searcher.chunks)
        })

    except Exception as e:
        logger.exception("Unhandled error")
        return jsonify({'success': False, 'error': str(e)}), 500


@library_bp.route('/pdf/<book_id>', methods=['GET'])
def serve_pdf(book_id):
    from services.books import BOOK_LIBRARY
    if book_id not in BOOK_LIBRARY:
        return jsonify({'error': 'Book not found'}), 404

    pdf_url = BOOK_LIBRARY[book_id]['pdf_url']
    logger.info(f"Proxying PDF for: {book_id}")
    try:
        r = ctx.session.get(pdf_url, timeout=60, stream=True)
        r.raise_for_status()
        return Response(
            stream_with_context(r.iter_content(chunk_size=8192)),
            content_type='application/pdf',
            headers={
                'Content-Disposition': f'inline; filename="{book_id}.pdf"',
            }
        )
    except Exception as e:
        logger.error(f"PDF proxy error: {e}")
        return jsonify({'error': str(e)}), 500
