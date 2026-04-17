"""
backend/scripts/seed_admin_roles.py
────────────────────────────────────
One-time script to promote env-var admins to DB roles.

Run this ONCE in each environment (staging, production) after deploying
migration 021_admin_roles.sql.  Once complete, the env-var fallback in
services/auth.py can be removed on the next deploy.

Usage
─────
    SUPABASE_URL=https://xxx.supabase.co \\
    SUPABASE_SERVICE_KEY=<service_role_key> \\
    ADMIN_EMAIL_OWNER=owner@example.com \\
    ADMIN_EMAIL_ADMIN=admin@example.com \\
    python backend/scripts/seed_admin_roles.py

Environment variables
─────────────────────
SUPABASE_URL          Required. Your project's REST URL.
SUPABASE_SERVICE_KEY  Required. Service-role key (bypasses RLS).
ADMIN_EMAIL_OWNER     Optional. Email to promote to role='owner'.
ADMIN_EMAIL_ADMIN     Optional. Comma-separated emails for role='admin'.

After running
─────────────
1. Verify in Supabase:
       SELECT email, role FROM users WHERE role IN ('owner', 'admin');
2. Remove or clear ADMIN_EMAIL_OWNER / ADMIN_EMAIL_ADMIN env vars on next deploy.
3. Delete the deprecation comment in services/auth.py is_admin_exempt().
"""
from __future__ import annotations

import os
import sys

import requests


def _upsert_role(session: requests.Session, supabase_url: str,
                  service_key: str, email: str, role: str) -> None:
    """Set ``role`` for the user identified by *email*."""
    headers = {
        'Authorization': f'Bearer {service_key}',
        'apikey': service_key,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }
    resp = session.patch(
        f'{supabase_url}/rest/v1/users',
        params={'email': f'eq.{email}'},
        json={'role': role},
        headers=headers,
        timeout=10,
    )
    if resp.status_code in (200, 204):
        rows = resp.json() if resp.status_code == 200 else []
        updated = len(rows) if isinstance(rows, list) else '?'
        print(f'  ✓  {email} → role={role!r}  ({updated} row(s) updated)')
    else:
        print(
            f'  ✗  {email} → FAILED  '
            f'status={resp.status_code}  body={resp.text[:200]}',
            file=sys.stderr,
        )
        sys.exit(1)


def main() -> None:
    supabase_url = os.environ.get('SUPABASE_URL', '').strip()
    service_key  = os.environ.get('SUPABASE_SERVICE_KEY', '').strip()

    if not supabase_url or not service_key:
        print(
            'Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.',
            file=sys.stderr,
        )
        sys.exit(1)

    owner_email  = os.environ.get('ADMIN_EMAIL_OWNER', '').strip().lower()
    admin_emails = [
        e.strip().lower()
        for e in os.environ.get('ADMIN_EMAIL_ADMIN', '').split(',')
        if e.strip()
    ]

    if not owner_email and not admin_emails:
        print(
            'Warning: neither ADMIN_EMAIL_OWNER nor ADMIN_EMAIL_ADMIN is set. '
            'Nothing to do.',
            file=sys.stderr,
        )
        sys.exit(0)

    session = requests.Session()
    print('Seeding admin roles into Supabase users table …')

    if owner_email:
        _upsert_role(session, supabase_url, service_key, owner_email, 'owner')

    for email in admin_emails:
        _upsert_role(session, supabase_url, service_key, email, 'admin')

    print()
    print('Done. Next steps:')
    print('  1. Verify: SELECT email, role FROM users WHERE role IN (\'owner\', \'admin\');')
    print('  2. Clear ADMIN_EMAIL_OWNER / ADMIN_EMAIL_ADMIN from env vars on next deploy.')
    print('  3. Remove the env-var fallback in services/auth.py is_admin_exempt().')


if __name__ == '__main__':
    main()
