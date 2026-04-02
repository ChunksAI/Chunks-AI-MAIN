"""Tests for the image blueprint (/ask-image)."""
import pytest
from unittest.mock import MagicMock


def test_image_options(client):
    """OPTIONS /ask-image returns 200."""
    resp = client.options('/ask-image')
    assert resp.status_code == 200


def test_image_no_body(client, mock_extract_user):
    """POST /ask-image with no JSON returns 400."""
    resp = client.post('/ask-image')
    assert resp.status_code in (400, 422)


def test_image_no_image_data(client, mock_extract_user):
    """POST /ask-image with empty image_b64 returns 400."""
    resp = client.post('/ask-image', json={'image_b64': '', 'question': 'Describe this.'})
    assert resp.status_code == 400
    data = resp.json()
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
    data = resp.json()
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
    data = resp.json()
    assert data['success'] is False


def test_image_blueprint_registered(app):
    """The image blueprint is registered."""
    rules = [r.path for r in app.routes]
    assert '/ask-image' in rules


# ── Successful image analysis ────────────────────────────────────────────────

def test_image_success(client, monkeypatch, mock_extract_user):
    """POST /ask-image with valid image returns analysis."""
    import services.token_budget as tb
    import services.device_abuse as device_mod
    import services.ai as ai_svc
    import services.plan_limits as plan_mod
    from routes.shared import ctx

    monkeypatch.setattr(device_mod, 'check_device_rate_limit', MagicMock(return_value=None))
    monkeypatch.setattr(plan_mod, 'check_plan_limit', MagicMock(return_value=None))
    monkeypatch.setattr(tb, 'check_daily_budget', MagicMock(return_value=True))
    monkeypatch.setattr(tb, 'max_tokens_for_endpoint', MagicMock(return_value=2000))
    monkeypatch.setattr(ai_svc, '_record_usage_from_response', MagicMock())

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        'choices': [{'message': {'content': 'This is a molecule diagram.'}}],
        'usage': {'prompt_tokens': 100, 'completion_tokens': 50},
    }

    mock_session = MagicMock()
    mock_session.post.return_value = mock_resp
    monkeypatch.setattr(ctx, 'session', mock_session)
    monkeypatch.setattr(ctx, 'OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')

    resp = client.post('/ask-image', json={
        'image_b64': 'dGVzdA==',
        'image_type': 'image/jpeg',
        'question': 'Describe this molecule',
        'complexity': 5,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['success'] is True
    assert 'molecule diagram' in data['answer']


def test_image_api_error(client, monkeypatch, mock_extract_user):
    """POST /ask-image returns 500 when vision API returns non-200."""
    import services.token_budget as tb
    import services.device_abuse as device_mod
    import services.plan_limits as plan_mod
    from routes.shared import ctx

    monkeypatch.setattr(device_mod, 'check_device_rate_limit', MagicMock(return_value=None))
    monkeypatch.setattr(plan_mod, 'check_plan_limit', MagicMock(return_value=None))
    monkeypatch.setattr(tb, 'check_daily_budget', MagicMock(return_value=True))
    monkeypatch.setattr(tb, 'max_tokens_for_endpoint', MagicMock(return_value=2000))

    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_resp.text = 'Rate limited'

    mock_session = MagicMock()
    mock_session.post.return_value = mock_resp
    monkeypatch.setattr(ctx, 'session', mock_session)
    monkeypatch.setattr(ctx, 'OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
    monkeypatch.setattr(ctx, 'OPENROUTER_API_KEY', 'test-key')

    resp = client.post('/ask-image', json={
        'image_b64': 'dGVzdA==',
        'image_type': 'image/jpeg',
        'question': 'Describe',
    })
    assert resp.status_code == 500
    data = resp.json()
    assert data['success'] is False
    assert 'Vision API error' in data['error']


def test_image_budget_exceeded(client, monkeypatch, mock_extract_user):
    """POST /ask-image returns 503 when daily budget is exceeded."""
    import services.token_budget as tb
    import services.device_abuse as device_mod
    import services.plan_limits as plan_mod

    monkeypatch.setattr(device_mod, 'check_device_rate_limit', MagicMock(return_value=None))
    monkeypatch.setattr(plan_mod, 'check_plan_limit', MagicMock(return_value=None))
    monkeypatch.setattr(tb, 'check_daily_budget', MagicMock(return_value=False))

    resp = client.post('/ask-image', json={
        'image_b64': 'dGVzdA==',
        'image_type': 'image/jpeg',
        'question': 'Describe',
    })
    assert resp.status_code == 503
    data = resp.json()
    assert data['success'] is False
    assert 'budget exceeded' in data['error']
