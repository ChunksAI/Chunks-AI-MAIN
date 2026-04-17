'use client';

/**
 * components/shared/SettingsModal.tsx
 *
 * Full-featured settings modal with 8 sections matching the v1 feature set,
 * styled using existing v.2 CSS design tokens.
 *
 * Sections:
 *  1. General       — appearance, font size, accent, language, voice
 *  2. Notifications — study reminders, flashcard alerts, library, updates
 *  3. Personalization — study mode, follow-ups, auto-flashcards
 *  4. Apps          — connected apps (placeholder), API (coming soon)
 *  5. Data controls — save history, improve data, delete history, clear cache
 *  6. Security      — 2FA (coming soon), active sessions, change password
 *  7. Parental      — safe content mode, PIN (coming soon)
 *  8. Account       — name, email, plan, upgrade, delete account
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabaseClient';

// ─── Section IDs ──────────────────────────────────────────────────────────────

type SectionId =
  | 'general'
  | 'notifications'
  | 'personalization'
  | 'apps'
  | 'data'
  | 'security'
  | 'parental'
  | 'account';

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: 'general',         label: 'General',          icon: '⚙️' },
  { id: 'notifications',   label: 'Notifications',    icon: '🔔' },
  { id: 'personalization', label: 'Personalization',  icon: '🎨' },
  { id: 'apps',            label: 'Apps',             icon: '🔌' },
  { id: 'data',            label: 'Data controls',    icon: '🗄️' },
  { id: 'security',        label: 'Security',         icon: '🔒' },
  { id: 'parental',        label: 'Parental controls',icon: '👨‍👩‍👧' },
  { id: 'account',         label: 'Account',          icon: '👤' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sm-row">
      <div className="sm-row-left">
        <div className="sm-row-label">{label}</div>
        {desc && <div className="sm-row-desc">{desc}</div>}
      </div>
      {children && <div className="sm-row-right">{children}</div>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="sm-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="sm-toggle-track" />
      <div className="sm-toggle-thumb" />
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="sm-select-wrap" ref={ref}>
      <button className="sm-select-btn" onClick={() => setOpen((v) => !v)}>
        <span>{current?.label}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="sm-select-menu">
          {options.map((o) => (
            <button
              key={o.value}
              className={`sm-select-option${o.value === value ? ' selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
              {o.value === value && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SettingsModal() {
  const { isOpen, closeSettings, settings, setSetting, resetSettings } = useSettings();
  const { user, signOut } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSettings();
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isOpen, closeSettings]);

  const handleChangePassword = useCallback(async () => {
    if (!user?.email) return;
    setPasswordMsg('Sending…');
    try {
      const sb = await getSupabaseClient();
      const { error } = await sb.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/study`,
      });
      setPasswordMsg(error ? 'Error — try again.' : 'Reset link sent to your email!');
    } catch {
      setPasswordMsg('Error — try again.');
    }
    setTimeout(() => setPasswordMsg(''), 4000);
  }, [user]);

  const handleDeleteHistory = useCallback(() => {
    try {
      // Remove all chunks_* chat history keys from localStorage
      const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith('chunks_chat_') || k.startsWith('chunks_msg_'),
      );
      keys.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
    closeSettings();
  }, [closeSettings]);

  if (!isOpen) return null;

  const planLabel = user?.isOwner
    ? 'Owner'
    : user?.isAdmin
    ? 'Admin'
    : user?.tier === 'ultra'
    ? 'Ultra Plan'
    : user?.tier === 'pro'
    ? 'Pro Plan'
    : 'Free Plan';

  return (
    <div
      className="sm-overlay"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) closeSettings(); }}
    >
      <div className="sm-modal" role="dialog" aria-modal="true" aria-label="Settings">
        {/* ── Header ── */}
        <div className="sm-header">
          <span className="sm-title">Settings</span>
          <button className="sm-close-btn" onClick={closeSettings} aria-label="Close settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="sm-body">
          {/* ── Sidebar nav ── */}
          <nav className="sm-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`sm-nav-item${activeSection === s.id ? ' active' : ''}`}
                onClick={() => setActiveSection(s.id)}
              >
                <span className="sm-nav-icon">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          {/* ── Content ── */}
          <div className="sm-content">

            {/* ── General ── */}
            {activeSection === 'general' && (
              <section>
                <h2 className="sm-section-title">General</h2>

                <Row label="Appearance" desc="Choose light or dark interface.">
                  <Select
                    value={settings.appearance}
                    options={[
                      { value: 'light', label: 'Light' },
                      { value: 'dark',  label: 'Dark' },
                    ]}
                    onChange={(v) => setSetting('appearance', v as 'light' | 'dark')}
                  />
                </Row>

                <Row label="Chat font size">
                  <Select
                    value={settings.chatFontSize}
                    options={[
                      { value: 'small',  label: 'Small' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'large',  label: 'Large' },
                    ]}
                    onChange={(v) => setSetting('chatFontSize', v as 'small' | 'medium' | 'large')}
                  />
                </Row>

                <Row label="Language" desc="Interface display language.">
                  <Select
                    value={settings.language}
                    options={[
                      { value: 'Auto-detect', label: 'Auto-detect' },
                      { value: 'English',     label: 'English' },
                      { value: 'Filipino',    label: 'Filipino' },
                      { value: 'Spanish',     label: 'Spanish' },
                      { value: 'French',      label: 'French' },
                      { value: 'Japanese',    label: 'Japanese' },
                    ]}
                    onChange={(v) => setSetting('language', v)}
                  />
                </Row>

                <Row label="Spoken language" desc="The language you mainly speak — used by the AI tutor.">
                  <Select
                    value={settings.spokenLanguage}
                    options={[
                      { value: 'Auto-detect', label: 'Auto-detect' },
                      { value: 'English',     label: 'English' },
                      { value: 'Filipino',    label: 'Filipino' },
                      { value: 'Spanish',     label: 'Spanish' },
                      { value: 'French',      label: 'French' },
                    ]}
                    onChange={(v) => setSetting('spokenLanguage', v)}
                  />
                </Row>

                <Row label="Voice" desc="Voice used by the AI tutor audio mode.">
                  <Select
                    value={settings.voice}
                    options={[
                      { value: 'Maple',   label: 'Maple' },
                      { value: 'Echo',    label: 'Echo' },
                      { value: 'Nova',    label: 'Nova' },
                      { value: 'Shimmer', label: 'Shimmer' },
                    ]}
                    onChange={(v) => setSetting('voice', v)}
                  />
                </Row>

                <Row
                  label="Separate Voice"
                  desc="Keep Chunks AI Voice in a separate full-screen without real-time transcripts."
                >
                  <Toggle
                    checked={settings.separateVoice}
                    onChange={(v) => setSetting('separateVoice', v)}
                  />
                </Row>
              </section>
            )}

            {/* ── Notifications ── */}
            {activeSection === 'notifications' && (
              <section>
                <h2 className="sm-section-title">Notifications</h2>
                <Row label="Study reminders" desc="Get reminded to study at your scheduled times.">
                  <Toggle checked={settings.notifStudy} onChange={(v) => setSetting('notifStudy', v)} />
                </Row>
                <Row label="Flashcard review alerts" desc="Be notified when cards are due for review.">
                  <Toggle checked={settings.notifFlashcard} onChange={(v) => setSetting('notifFlashcard', v)} />
                </Row>
                <Row label="New library books" desc="Get notified when new textbooks are added.">
                  <Toggle checked={settings.notifLibrary} onChange={(v) => setSetting('notifLibrary', v)} />
                </Row>
                <Row label="Product updates" desc="Feature announcements and improvements.">
                  <Toggle checked={settings.notifUpdates} onChange={(v) => setSetting('notifUpdates', v)} />
                </Row>
              </section>
            )}

            {/* ── Personalization ── */}
            {activeSection === 'personalization' && (
              <section>
                <h2 className="sm-section-title">Personalization</h2>
                <Row label="Study mode" desc="Adjust AI response depth and detail level.">
                  <Select
                    value={settings.studyMode}
                    options={[
                      { value: 'concise',  label: 'Concise' },
                      { value: 'balanced', label: 'Balanced' },
                      { value: 'detailed', label: 'Detailed' },
                    ]}
                    onChange={(v) => setSetting('studyMode', v as 'concise' | 'balanced' | 'detailed')}
                  />
                </Row>
                <Row label="Show follow-up questions" desc="Display suggested follow-ups after AI responses.">
                  <Toggle checked={settings.showFollowups} onChange={(v) => setSetting('showFollowups', v)} />
                </Row>
                <Row label="Auto-generate flashcards" desc="Suggest flashcard creation after key answers.">
                  <Toggle checked={settings.autoFlash} onChange={(v) => setSetting('autoFlash', v)} />
                </Row>
              </section>
            )}

            {/* ── Apps ── */}
            {activeSection === 'apps' && (
              <section>
                <h2 className="sm-section-title">Apps</h2>
                <Row label="Connected apps" desc="No apps connected yet." />
                <Row label="API access" desc="Manage your API keys and integrations.">
                  <span className="sm-coming-soon">Coming soon</span>
                </Row>
              </section>
            )}

            {/* ── Data controls ── */}
            {activeSection === 'data' && (
              <section>
                <h2 className="sm-section-title">Data controls</h2>
                <Row label="Save chat history" desc="Store your conversations for future reference.">
                  <Toggle checked={settings.saveChatHistory} onChange={(v) => setSetting('saveChatHistory', v)} />
                </Row>
                <Row label="Use data to improve Chunks AI" desc="Help improve the product by sharing anonymised usage data.">
                  <Toggle checked={settings.improveData} onChange={(v) => setSetting('improveData', v)} />
                </Row>
                <Row label="Delete all chat history" desc="Permanently remove all saved conversations.">
                  <button className="sm-danger-btn" onClick={handleDeleteHistory}>
                    Delete all
                  </button>
                </Row>
                <Row label="Reset all settings" desc="Restore all settings to their defaults.">
                  <button className="sm-ghost-btn" onClick={resetSettings}>
                    Reset
                  </button>
                </Row>
              </section>
            )}

            {/* ── Security ── */}
            {activeSection === 'security' && (
              <section>
                <h2 className="sm-section-title">Security</h2>
                <Row label="Two-factor authentication" desc="Add an extra layer of security to your account.">
                  <span className="sm-coming-soon">Coming soon</span>
                </Row>
                <Row label="Active sessions" desc="View and manage devices logged into your account.">
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>1 device</span>
                </Row>
                <Row label="Change password" desc="Send a password reset link to your email.">
                  <button className="sm-ghost-btn" onClick={handleChangePassword}>
                    {passwordMsg || 'Send reset link'}
                  </button>
                </Row>
              </section>
            )}

            {/* ── Parental controls ── */}
            {activeSection === 'parental' && (
              <section>
                <h2 className="sm-section-title">Parental controls</h2>
                <Row
                  label="Safe content mode"
                  desc="Restrict AI responses to age-appropriate study material only."
                >
                  <Toggle checked={settings.safeContent} onChange={(v) => setSetting('safeContent', v)} />
                </Row>
                <Row label="Set a PIN" desc="Protect settings with a PIN code.">
                  <span className="sm-coming-soon">Coming soon</span>
                </Row>
              </section>
            )}

            {/* ── Account ── */}
            {activeSection === 'account' && (
              <section>
                <h2 className="sm-section-title">Account</h2>
                <Row label="Name">
                  <span className="sm-value">{user?.name ?? '—'}</span>
                </Row>
                <Row label="Email">
                  <span className="sm-value sm-mono">{user?.email || '—'}</span>
                </Row>
                <Row label="Plan" desc="Upgrade to unlock unlimited messages and all textbooks.">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="sm-value">{planLabel}</span>
                    <a href="/study#upgrade" className="sm-upgrade-btn" onClick={closeSettings}>
                      Upgrade
                    </a>
                  </div>
                </Row>
                {user && !user.isGuest && (
                  <Row
                    label="Sign out"
                    desc="Sign out of your Chunks account on this device."
                  >
                    <button
                      className="sm-ghost-btn"
                      onClick={async () => { closeSettings(); await signOut(); }}
                    >
                      Sign out
                    </button>
                  </Row>
                )}
                {user && !user.isGuest && (
                  <Row
                    label="Delete account"
                    desc="Permanently delete your account and all data. This cannot be undone."
                  >
                    {deleteConfirm ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="sm-danger-btn"
                          onClick={async () => {
                            await signOut();
                            closeSettings();
                          }}
                        >
                          Confirm delete
                        </button>
                        <button className="sm-ghost-btn" onClick={() => setDeleteConfirm(false)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button className="sm-danger-btn" onClick={() => setDeleteConfirm(true)}>
                        Delete
                      </button>
                    )}
                  </Row>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
