'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { NavItem, RecentItem } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import Toast from '@/components/shared/Toast';
import { SIDEBAR_COMPACT_KEY } from '@/lib/constants';

interface SidebarProps {
  activeNav: string;
  onNavChange: (id: string) => void;
  onNewSession: () => void;
  /** Recent sessions derived from StudyContext state. */
  recents?: RecentItem[];
  /** Called when the user clicks a recent session item. */
  onRecentClick?: (item: RecentItem) => void;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'study',       label: 'Study',        icon: 'home' },
  { id: 'library',     label: 'Library',      icon: 'book' },
  { id: 'flashcards',  label: 'Flashcards',   icon: 'layers' },
  { id: 'study-plan',  label: 'Study Plan',   icon: 'calendar' },
  { id: 'research',    label: 'Research',     icon: 'search' },
  { id: 'exam',        label: 'Exam Mode',    icon: 'check',    badge: { text: 'Pro', variant: 'pro' } },
];

// ── icon registry ──────────────────────────────────────────────────────────────
function NavIcon({ id }: { id: string }) {
  switch (id) {
    case 'home':     return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12L12 2l10 10"/><path d="M5 9v11h14V9"/></svg>;
    case 'book':     return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
    case 'layers':   return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>;
    case 'calendar': return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'search':   return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>;
    case 'video':    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
    case 'check':    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
    default:         return null;
  }
}

export default function Sidebar({ activeNav, onNavChange, onNewSession, recents = [], onRecentClick }: SidebarProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { openSettings } = useSettings();

  const [collapsed, setCollapsed] = useState<boolean>(false);

  // Load collapsed state from localStorage after mount to avoid SSR/hydration mismatch
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COMPACT_KEY) === 'true');
    } catch { /* localStorage may be unavailable in private browsing or restricted environments */ }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COMPACT_KEY, String(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Study Plan "coming soon" modal state
  const [showStudyPlanModal, setShowStudyPlanModal] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2800);
  };

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleNavClick = (id: string) => {
    switch (id) {
      case 'exam':
        router.push('/exam');
        break;
      case 'library':
        router.push('/library');
        break;
      case 'flashcards':
        router.push('/flashcards');
        break;
      case 'research':
        router.push('/research');
        break;
      case 'study-plan':
        setShowStudyPlanModal(true);
        break;
      default:
        onNavChange(id);
    }
  };

  // Derive display values from auth user
  const initials = user && !user.isGuest
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user?.isGuest
    ? 'G'
    : '?';

  const planLabel = !user
    ? 'Not signed in'
    : user.isOwner
    ? 'Owner'
    : user.isAdmin
    ? 'Admin'
    : user.tier === 'ultra'
    ? 'Ultra Plan'
    : user.tier === 'pro'
    ? 'Pro Plan'
    : user.tier === 'team'
    ? 'Team Plan'
    : user.isGuest
    ? 'Guest'
    : 'Free Plan';

  const displayName = user
    ? (user.isGuest ? 'Guest' : user.name || user.email)
    : 'Guest';

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}${menuOpen ? ' menu-open' : ''}`}>
      {/* ── Study Plan "coming soon" modal ── */}
      {showStudyPlanModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowStudyPlanModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '28px 32px',
              maxWidth: 380,
              width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>📅</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Study Plan
            </div>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.6 }}>
              The full Study Plan page is coming soon. For now, use the{' '}
              <strong>📋 Study plan</strong> quick action in the Chat tab to generate a
              personalised study schedule.
            </p>
            <button
              className="ws-add-btn"
              style={{ width: '100%' }}
              onClick={() => setShowStudyPlanModal(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {/* ── Header ── */}
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-mark">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="50" cy="50" rx="36" ry="12" stroke="currentColor" strokeWidth="6" opacity="0.95"/>
              <ellipse cx="50" cy="50" rx="36" ry="12" stroke="currentColor" strokeWidth="6" transform="rotate(60 50 50)" opacity="0.88"/>
              <ellipse cx="50" cy="50" rx="36" ry="12" stroke="currentColor" strokeWidth="6" transform="rotate(120 50 50)" opacity="0.80"/>
              <circle cx="50" cy="50" r="6" fill="currentColor"/>
            </svg>
          </div>
          <span className="logo-name">Chunks</span>
        </div>
        <button className="sidebar-toggle" aria-label="Toggle sidebar" onClick={toggleCollapsed}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
          </svg>
        </button>
      </div>

      {/* ── New session ── */}
      <button className="new-chat-btn" onClick={onNewSession}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>New Session</span>
      </button>

      {/* ── Navigation ── */}
      <div className="sidebar-section">
        <div className="sidebar-label">Navigation</div>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.id}
            className={`nav-item${activeNav === item.id ? ' active' : ''}`}
            onClick={() => handleNavClick(item.id)}
            data-label={item.id}
          >
            <NavIcon id={item.icon} />
            <span>{item.label}</span>
            {item.badge && (
              <span className={`nav-badge badge-${item.badge.variant}`}>{item.badge.text}</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Recents ── */}
      <div className="recents-section">
        <div className="sidebar-label" style={{ padding: '10px 8px 6px' }}>Recents</div>
        {recents.length === 0 ? (
          <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text3)' }}>
            No recent sessions yet
          </div>
        ) : (
          recents.map((r) => (
            <div
              key={r.id}
              className="recent-item"
              onClick={() => onRecentClick?.(r)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRecentClick?.(r); }}
            >
              <div className="recent-dot" style={{ background: r.color }} />
              <span className="recent-title">{r.title}</span>
            </div>
          ))
        )}
      </div>

      {/* ── Footer ── */}
      <div className="pd-wrap" ref={menuRef}>
        {/* Popup menu — above footer */}
        {menuOpen && (
          <div className="pd-menu" role="menu">
            {/* User header */}
            <div className="pd-header">
              <div
                className="pd-avatar"
                style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: 0 } : {}}
              >
                {!user?.avatar && initials}
              </div>
              <div className="pd-info">
                <div className="pd-name">{displayName}</div>
                <div className="pd-email">{user?.isGuest ? 'Guest / Free' : `${user?.email ?? ''} / ${planLabel}`}</div>
              </div>
            </div>

            <div className="pd-divider" />

            {/* Add another account */}
            <button
              className="pd-item"
              role="menuitem"
              onClick={() => { setMenuOpen(false); showToast('Coming soon'); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              Add another account
            </button>

            <div className="pd-divider" />

            {/* Upgrade plan */}
            <button
              className="pd-item pd-item--upgrade"
              role="menuitem"
              onClick={() => { setMenuOpen(false); showToast('Coming soon'); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Upgrade plan
            </button>

            {/* Personalization */}
            <button
              className="pd-item"
              role="menuitem"
              onClick={() => { setMenuOpen(false); showToast('Coming soon'); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
              </svg>
              Personalization
            </button>

            {/* Profile */}
            <button
              className="pd-item"
              role="menuitem"
              onClick={() => { setMenuOpen(false); showToast('Coming soon'); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              Profile
            </button>

            {/* Settings */}
            <button
              className="pd-item"
              role="menuitem"
              onClick={() => { setMenuOpen(false); openSettings(); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>

            <div className="pd-divider" />

            {/* Help */}
            <button
              className="pd-item"
              role="menuitem"
              onClick={() => { setMenuOpen(false); showToast('Coming soon'); }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Help
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>

            {/* Log out */}
            {user && !user.isGuest && (
              <>
                <div className="pd-divider" />
                <button
                  className="pd-item pd-item--danger"
                  role="menuitem"
                  onClick={async () => {
                    setMenuOpen(false);
                    await signOut();
                    router.push('/login');
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Log out
                </button>
              </>
            )}
            {user?.isGuest && (
              <>
                <div className="pd-divider" />
                <button
                  className="pd-item pd-item--highlight"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); router.push('/login'); }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Sign in
                </button>
              </>
            )}
          </div>
        )}

        {/* Footer trigger */}
        <div
          className="sidebar-footer"
          onClick={() => setMenuOpen((v) => !v)}
          role="button"
          tabIndex={0}
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setMenuOpen((v) => !v); }}
        >
          <div
            className="avatar"
            style={user?.avatar ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', fontSize: 0 } : {}}
          >
            {!user?.avatar && initials}
          </div>
          <div className="user-info">
            <div className="user-name">{displayName}</div>
            <div className="user-role">{planLabel}</div>
          </div>
          <div className="more-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </div>
        </div>
      </div>

      <Toast message={toastMsg} />
    </aside>
  );
}
