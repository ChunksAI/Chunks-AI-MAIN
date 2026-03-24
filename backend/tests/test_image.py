"""Tests for the image blueprint (/ask-image)."""
import pytest
from unittest.mock import MagicMock


def test_image_options(client):
    """OPTIONS /ask-image returns 200."""
    resp = client.options('/ask-image')
    assert resp.status_code == 200


def test_image_no_body(client, mock_extract_user):
    """POST /ask-image with no JSON returns 400."""
    resp = client.post('/ask-image', content_type='application/json', data='')
    assert resp.status_code == 400


def test_image_no_image_data(client, mock_extract_user):
    """POST /ask-image with empty image_b64 returns 400."""
    resp = client.post('/ask-image', json={'image_b64': '', 'question': 'Describe this.'})
    assert resp.status_code == 400
    data = resp.get_json()
    assert data['success'] is False
    assert 'No image data' in data['error']


def test_image_unsupported_type(client, mock_extract_user):
    """POST /ask-image with unsupported MIME type returns 415."""
    resp = client.post('/ask-image', json={
        'image_b64': 'dGVzdA==',  # base64 for "test"
        'image_type': 'image/svg+xml',
        'question': 'Describe'
    })
    assert resp.status_code == 415
    data = resp.get_json()
    assert data['success'] is False


def test_image_too_large(client, mock_extract_user):
    """POST /ask-image with an oversized image returns 413."""
    # Create a fake base64 string that exceeds the 13.4 MB limit
    big_b64 = 'A' * 14_000_000
    resp = client.post('/ask-image', json={
        'image_b64': big_b64,
        'image_type': 'image/jpeg',
        'question': 'Describe'
    })
    assert resp.status_code == 413
    data = resp.get_json()
    assert data['success'] is False


def test_image_blueprint_registered(app):
    """The image blueprint is registered."""
    rules = [r.rule for r in app.url_map.iter_rules()]
    assert '/ask-image' in rules
