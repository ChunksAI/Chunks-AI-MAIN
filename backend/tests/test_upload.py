"""Tests for the upload blueprint (/upload-document)."""
import pytest
import io
from unittest.mock import MagicMock, patch


def test_upload_options(client):
    """OPTIONS /upload-document returns 200 (CORS preflight)."""
    resp = client.options('/upload-document')
    assert resp.status_code == 200


def test_upload_no_file(client, mock_extract_user):
    """POST /upload-document with no file returns 400 or 422."""
    resp = client.post('/upload-document', data={})
    assert resp.status_code in (400, 422)
    data = resp.json()
    assert data['success'] is False


def test_upload_unsupported_extension(client, mock_extract_user):
    """POST /upload-document with a .txt file returns 400."""
    resp = client.post(
        '/upload-document',
        files={'file': ('test.txt', io.BytesIO(b'hello world'), 'text/plain')},
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body['success'] is False
    assert 'Unsupported file type' in body['error']


def test_upload_blueprint_registered(app):
    """The upload router is registered with correct route."""
    rules = [r.path for r in app.routes]
    assert '/upload-document' in rules


# ── Successful upload ────────────────────────────────────────────────────────

def test_upload_success(client, monkeypatch, mock_extract_user):
    """POST /upload-document with a valid PDF succeeds."""
    import services.documents as docs_mod

    extracted_slides = [
        {'slide_number': 1, 'title': 'Page 1', 'content': ['Hello world'], 'notes': ''},
    ]
    monkeypatch.setattr(docs_mod, 'extract_slides_from_file',
                        MagicMock(return_value=extracted_slides))

    resp = client.post(
        '/upload-document',
        files={'file': ('test.pdf', io.BytesIO(b'%PDF-1.4 fake pdf content'), 'application/pdf')},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body['success'] is True
    assert body['total_slides'] == 1
    assert body['filename'] == 'test.pdf'
    assert body['bookId'].startswith('upload_')


def test_upload_extraction_error(client, monkeypatch, mock_extract_user):
    """POST /upload-document returns 400 when extraction raises ValueError."""
    import services.documents as docs_mod

    monkeypatch.setattr(docs_mod, 'extract_slides_from_file',
                        MagicMock(side_effect=ValueError("Cannot parse this file")))

    resp = client.post(
        '/upload-document',
        files={'file': ('bad.pdf', io.BytesIO(b'%PDF-1.4 corrupt content'), 'application/pdf')},
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body['success'] is False
    assert 'Cannot parse' in body['error']


def test_upload_empty_filename(client, mock_extract_user):
    """POST /upload-document with empty filename returns 400 or 422."""
    resp = client.post(
        '/upload-document',
        files={'file': ('', io.BytesIO(b'data'), 'application/octet-stream')},
    )
    assert resp.status_code in (400, 422)
    body = resp.json()
    assert body['success'] is False
