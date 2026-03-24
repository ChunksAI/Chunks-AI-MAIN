"""Tests for the upload blueprint (/upload-document)."""
import pytest
import io
from unittest.mock import MagicMock, patch


def test_upload_options(client):
    """OPTIONS /upload-document returns 200 (CORS preflight)."""
    resp = client.options('/upload-document')
    assert resp.status_code == 200


def test_upload_no_file(client, mock_extract_user):
    """POST /upload-document with no file returns 400."""
    resp = client.post('/upload-document', data={})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False
    assert 'No file uploaded' in data['error']


def test_upload_unsupported_extension(client, mock_extract_user):
    """POST /upload-document with a .txt file returns 400."""
    data = {
        'file': (io.BytesIO(b'hello world'), 'test.txt')
    }
    resp = client.post('/upload-document', data=data,
                       content_type='multipart/form-data')
    assert resp.status_code == 400
    body = resp.get_json()
    assert body['success'] is False
    assert 'Unsupported file type' in body['error']


def test_upload_blueprint_registered(app):
    """The upload blueprint is registered with correct route."""
    rules = [r.rule for r in app.url_map.iter_rules()]
    assert '/upload-document' in rules
