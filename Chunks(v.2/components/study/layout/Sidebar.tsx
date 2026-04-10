'use client';

import type { NavItem, RecentItem } from '@/types';
import type { AuthUser } from '@/contexts/AuthContext';

interface SidebarProps {
  activeNav: string;
  onNavChange: (id: string) => void;
  onNewSession: () => void;
  /** Optional — when provided, replaces the hardcoded user footer. */
  user?: AuthUser | null;
  /** Recent sessions derived from StudyContext state. */
  recents?: RecentItem[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'study',       label: 'Study',        icon: 'home' },
  { id: 'library',     label: 'Library',      icon: 'book' },
  { id: 'flashcards',  label: 'Flashcards',   icon: 'layers' },
  { id: 'study-plan',  label: 'Study Plan',   icon: 'calendar' },
  { id: 'research',    label: 'Research',     icon: 'search' },
  { id: 'visual',      label: 'Visual Tutor', icon: 'video',    badge: { text: 'AI',  variant: 'ai' } },
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

export default function Sidebar({ activeNav, onNavChange, onNewSession, user, recents = [] }: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* ── Header ── */}
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-mark">
            <svg viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white"/>
              <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" opacity="0.6"/>
              <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.6"/>
              <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.3"/>
            </svg>
          </div>
          <span className="logo-name">Chunks</span>
        </div>
        <button className="sidebar-toggle" aria-label="Toggle sidebar">
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
        New Session
      </button>

      {/* ── Navigation ── */}
      <div className="sidebar-section">
        <div className="sidebar-label">Navigation</div>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.id}
            className={`nav-item${activeNav === item.id ? ' active' : ''}`}
            onClick={() => onNavChange(item.id)}
          >
            <NavIcon id={item.icon} />
            {item.label}
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
            <div key={r.id} className="recent-item">
              <div className="recent-dot" style={{ background: r.color }} />
              <span className="recent-title">{r.title}</span>
            </div>
          ))
        )}
      </div>

      {/* ── Footer / user ── */}
      <div className="sidebar-footer">
        <div className="avatar">{(user?.name?.[0] ?? 'U').toUpperCase()}</div>
        <div className="user-info">
          <div className="user-name">{user?.name ?? 'Guest'}</div>
          <div className="user-role">{user?.tier ?? 'free'}</div>
        </div>
        <div className="more-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        </div>
      </div>
    </aside>
  );
}
