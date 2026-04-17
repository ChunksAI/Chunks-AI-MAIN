'use client';

/**
 * components/shared/ProfileDropdown.tsx
 *
 * A dropdown menu attached to the sidebar footer user area.
 * Actions: Settings, Upgrade, Help (sub-menu), Sign Out.
 * Admin users also see an Admin link.
 * Legal links (Terms, Privacy) are in the Help submenu.
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { AuthUser } from '@/contexts/AuthContext';

interface ProfileDropdownProps {
  user: AuthUser;
  /** Anchor element position for the dropdown — 'top' places it above the trigger */
  direction?: 'top';
}

export default function ProfileDropdown({ user }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut, exitGuestMode } = useAuth();
  const { openSettings } = useSettings();
  const router = useRouter();

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setHelpOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setHelpOpen(false); }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const initials = user.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : (user.email?.[0] ?? 'U').toUpperCase();

  const planLabel = user.isOwner
    ? 'Owner'
    : user.isAdmin
    ? 'Admin'
    : user.tier === 'ultra'
    ? 'Ultra Plan'
    : user.tier === 'pro'
    ? 'Pro Plan'
    : user.isGuest
    ? 'Guest'
    : 'Free Plan';

  return (
    <div className="pd-wrap" ref={ref}>
      {/* ── Trigger — the sidebar footer ── */}
      <div
        className="sidebar-footer"
        onClick={() => setOpen((v) => !v)}
        role="button"
        tabIndex={0}
        aria-haspopup="true"
        aria-expanded={open}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v); }}
      >
        <div className="avatar" style={user.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: 0 } : {}}>
          {!user.avatar && initials}
        </div>
        <div className="user-info">
          <div className="user-name">{user.name || (user.isGuest ? 'Guest' : user.email)}</div>
          <div className="user-role">{planLabel}</div>
        </div>
        <div className="more-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
          </svg>
        </div>
      </div>

      {/* ── Dropdown menu ── */}
      {open && (
        <div className="pd-menu" role="menu">
          {/* Profile header */}
          <div className="pd-header">
            <div
              className="pd-avatar"
              style={user.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: 0 } : {}}
            >
              {!user.avatar && initials}
            </div>
            <div className="pd-info">
              <div className="pd-name">{user.name || (user.isGuest ? 'Guest' : 'User')}</div>
              <div className="pd-email">{user.isGuest ? 'Not signed in' : user.email}</div>
            </div>
          </div>

          <div className="pd-divider" />

          {/* Guest mode: show sign-in prompt */}
          {user.isGuest ? (
            <button
              className="pd-item pd-item--highlight"
              role="menuitem"
              onClick={() => { setOpen(false); exitGuestMode(); router.push('/login'); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Sign in
            </button>
          ) : (
            <>
              {/* Upgrade */}
              <button
                className="pd-item pd-item--upgrade"
                role="menuitem"
                onClick={() => { setOpen(false); router.push('/study#upgrade'); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Upgrade plan
              </button>
            </>
          )}

          {/* Settings */}
          <button
            className="pd-item"
            role="menuitem"
            onClick={() => { setOpen(false); openSettings(); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>

          {/* Admin link — only for admins/owners */}
          {(user.isAdmin || user.isOwner) && (
            <button
              className="pd-item"
              role="menuitem"
              onClick={() => { setOpen(false); router.push('/admin'); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Admin
              <span className="pd-badge">
                {user.isOwner ? 'Owner' : 'Admin'}
              </span>
            </button>
          )}

          {/* Help submenu */}
          <div className="pd-submenu-wrap">
            <button
              className={`pd-item pd-item--has-sub${helpOpen ? ' active' : ''}`}
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen((v) => !v)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Help
              <svg
                width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ marginLeft: 'auto', transform: helpOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {helpOpen && (
              <div className="pd-submenu">
                <a href="https://chunks.online/help" target="_blank" rel="noopener noreferrer" className="pd-subitem">
                  Help center
                </a>
                <a href="mailto:support@chunks.online" className="pd-subitem">
                  Report a bug
                </a>
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="pd-subitem">
                  Terms of Service
                </a>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="pd-subitem">
                  Privacy Policy
                </a>
              </div>
            )}
          </div>

          {/* Sign out — only for authenticated users */}
          {!user.isGuest && (
            <>
              <div className="pd-divider" />
              <button
                className="pd-item pd-item--danger"
                role="menuitem"
                onClick={async () => { setOpen(false); await signOut(); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
