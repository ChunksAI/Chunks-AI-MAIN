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

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, StreamingResponse

from routes.shared import ctx
from routes.schemas import LoadBookRequest
from guest_limits import GuestLimitExceeded, guest_gate

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get('/get-library')
def get_library(request: Request):
    from services.books import BOOK_LIBRARY
    books = [
        {'id': bid, 'name': info['name'], 'author': info['author'], 'available': True}
        for bid, info in BOOK_LIBRARY.items()
    ]
    return {'success': True, 'books': books}


@router.post('/load-book')
def load_book(request: Request, body: LoadBookRequest):
    try:
        try:
            guest_gate(request, 'library', ctx.redis)
        except GuestLimitExceeded as _gle:
            return _gle.response()

        from services.books import BOOK_LIBRARY, get_book_index
        data    = body.model_dump()
        book_id = data.get('bookId')
        logger.info(f"Load book request: {book_id}")

        if book_id not in BOOK_LIBRARY:
            return JSONResponse({'success': False, 'error': f'Book "{book_id}" not found'}, status_code=404)

        book     = BOOK_LIBRARY[book_id]
        searcher = get_book_index(book_id)

        if not searcher.chunks:
            return JSONResponse({'success': False, 'error': 'Failed to load chunks from R2'}, status_code=500)

        return {
            'success':      True,
            'book_id':      book_id,
            'book_name':    book['name'],
            'author':       book['author'],
            'chunks_count': len(searcher.chunks)
        }

    except Exception as e:
        logger.exception("Unhandled error")
        return JSONResponse({'success': False, 'error': str(e)}, status_code=500)


@router.get('/pdf/{book_id}')
def serve_pdf(request: Request, book_id: str):
    from services.books import BOOK_LIBRARY
    if book_id not in BOOK_LIBRARY:
        return JSONResponse({'error': 'Book not found'}, status_code=404)

    pdf_url = BOOK_LIBRARY[book_id]['pdf_url']
    logger.info(f"Proxying PDF for: {book_id}")
    try:
        r = ctx.session.get(pdf_url, timeout=60, stream=True)
        r.raise_for_status()
        return StreamingResponse(
            r.iter_content(chunk_size=8192),
            media_type='application/pdf',
            headers={'Content-Disposition': f'inline; filename="{book_id}.pdf"'}
        )
    except Exception as e:
        logger.error(f"PDF proxy error: {e}")
        return JSONResponse({'error': str(e)}, status_code=500)
