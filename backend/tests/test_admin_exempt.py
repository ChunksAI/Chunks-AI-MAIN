"""Tests for the admin/owner usage-limit bypass in services/auth.py."""
from __future__ import annotations

import os
import pytest


# ── is_admin_exempt ────────────────────────────────────────────────────────────

def test_exempt_by_owner_role():
    from services.auth import is_admin_exempt
    assert is_admin_exempt(email='anyone@example.com', role='owner') is True


def test_exempt_by_admin_role():
    from services.auth import is_admin_exempt
    assert is_admin_exempt(email='anyone@example.com', role='admin') is True


def test_exempt_by_superadmin_role():
    from services.auth import is_admin_exempt
    assert is_admin_exempt(email='anyone@example.com', role='superadmin') is True


def test_not_exempt_for_regular_user_role():
    from services.auth import is_admin_exempt
    assert is_admin_exempt(email='user@example.com', role='user') is False


def test_not_exempt_with_no_args():
    from services.auth import is_admin_exempt
    assert is_admin_exempt() is False


def test_exempt_by_owner_email_env_var(monkeypatch):
    monkeypatch.setenv('ADMIN_EMAIL_OWNER', 'charlescontridas91@gmail.com')
    monkeypatch.setenv('ADMIN_EMAIL_ADMIN', 'deffmichaeldawang@gmail.com')
    from services.auth import is_admin_exempt
    assert is_admin_exempt(email='charlescontridas91@gmail.com', role='') is True


def test_exempt_by_admin_email_env_var(monkeypatch):
    monkeypatch.setenv('ADMIN_EMAIL_OWNER', 'charlescontridas91@gmail.com')
    monkeypatch.setenv('ADMIN_EMAIL_ADMIN', 'deffmichaeldawang@gmail.com')
    from services.auth import is_admin_exempt
    assert is_admin_exempt(email='deffmichaeldawang@gmail.com', role='') is True


def test_not_exempt_for_unknown_email_env_var(monkeypatch):
    monkeypatch.setenv('ADMIN_EMAIL_OWNER', 'charlescontridas91@gmail.com')
    monkeypatch.setenv('ADMIN_EMAIL_ADMIN', 'deffmichaeldawang@gmail.com')
    from services.auth import is_admin_exempt
    assert is_admin_exempt(email='random@example.com', role='') is False


def test_exempt_email_case_insensitive(monkeypatch):
    monkeypatch.setenv('ADMIN_EMAIL_OWNER', 'Owner@Example.COM')
    from services.auth import is_admin_exempt
    assert is_admin_exempt(email='OWNER@EXAMPLE.COM', role='') is True


def test_exempt_role_case_insensitive():
    from services.auth import is_admin_exempt
    assert is_admin_exempt(email='', role='OWNER') is True
    assert is_admin_exempt(email='', role='Admin') is True


# ── _extract_verified_user returns 3-tuple ─────────────────────────────────────

def test_extract_verified_user_returns_three_tuple():
    """_extract_verified_user must return a 3-tuple (user_id, tier, is_exempt)."""
    from services.auth import _extract_verified_user, Tier
    result = _extract_verified_user(request=None)
    assert len(result) == 3
    user_id, tier, is_exempt = result
    assert isinstance(user_id, str)
    assert isinstance(is_exempt, bool)


def test_extract_verified_user_guest_not_exempt():
    """Guest (no JWT) requests are never exempt."""
    from services.auth import _extract_verified_user
    _, _, is_exempt = _extract_verified_user(request=None)
    assert is_exempt is False
