'use client';

/**
 * components/shared/LoginModal.tsx — Sign-in modal overlay.
 *
 * Displayed as a popup over the current page so users can sign in without
 * leaving the study interface.  Opened via AuthContext.openLoginModal().
 *
 * Supports:
 *  - Google OAuth (one-click sign-in)
 *  - Magic Link email sign-in
 *
 * On successful authentication the modal closes automatically because
 * AuthContext.onAuthStateChange fires and sets a real user, at which point
 * isLoginModalOpen is reset to false via the sign-in listener below.
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabaseClient';
import ChunksLogo from '@/components/shared/ChunksLogo';

export default function LoginModal() {
  const { isLoginModalOpen, closeLoginModal, exitGuestMode } = useAuth();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isLoginModalOpen) return;
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLoginModal();
    }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [isLoginModalOpen, closeLoginModal]);

  // Reset form state when modal opens
  useEffect(() => {
    if (isLoginModalOpen) {
      setEmail('');
      setSent(false);
      setError(null);
      setSubmitting(false);
      setGoogleLoading(false);
    }
  }, [isLoginModalOpen]);

  // Close the modal when the user successfully authenticates
  useEffect(() => {
    if (!isLoginModalOpen) return;
    let cancelled = false;
    async function listenForAuth() {
      try {
        const sb = await getSupabaseClient();
        const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
          if (cancelled) return;
          if (session) {
            // User signed in — exit guest mode and close modal
            exitGuestMode();
            closeLoginModal();
          }
        });
        return () => subscription.unsubscribe();
      } catch { /* ignore */ }
    }
    const cleanup = listenForAuth();
    return () => {
      cancelled = true;
      cleanup.then((fn) => fn?.());
    };
  }, [isLoginModalOpen, closeLoginModal, exitGuestMode]);

  if (!isLoginModalOpen) return null;

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const sb = await getSupabaseClient();
      const { error: sbError } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`,
        },
      });
      if (sbError) throw sbError;
      // Browser will redirect — keep loading state
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
      setGoogleLoading(false);
    }
  };

  // ── Magic Link ────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const sb = await getSupabaseClient();
      const { error: sbError } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`,
        },
      });
      if (sbError) throw sbError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send login link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="login-modal-overlay"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) closeLoginModal(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div className="login-card login-modal-card">
        {/* ── Close button ── */}
        <button
          className="login-modal-close"
          onClick={closeLoginModal}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* ── Logo ── */}
        <div className="login-logo">
          <div className="logo-mark" style={{ width: 36, height: 36 }}>
            <ChunksLogo size={36} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: -0.3,
            }}
          >
            Chunks
          </span>
        </div>

        <h1 className="login-heading">Sign in to your study OS</h1>
        <p className="login-sub">
          One click with Google, or use a magic link — no password needed.
        </p>

        {sent ? (
          <div className="login-sent">
            <div style={{ fontSize: 32, marginBottom: 12 }}>📬</div>
            <strong>Check your inbox!</strong>
            <p style={{ color: 'var(--text2)', marginTop: 8 }}>
              We sent a login link to <strong>{email}</strong>. Click it to sign in.
            </p>
            <button
              className="panel-btn"
              style={{ marginTop: 16 }}
              onClick={() => setSent(false)}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            {/* ── Google button ── */}
            <button
              className="login-google-btn"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || submitting}
            >
              {googleLoading ? (
                <span className="login-spinner" />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            {/* ── Divider ── */}
            <div className="login-divider">
              <span className="login-divider-line" />
              <span className="login-divider-text">or</span>
              <span className="login-divider-line" />
            </div>

            {/* ── Magic link form ── */}
            <form onSubmit={handleSubmit} className="login-form">
              <input
                type="email"
                className="login-input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              {error && <div className="login-error">{error}</div>}
              <button type="submit" className="ws-add-btn login-submit" disabled={submitting || googleLoading}>
                {submitting ? 'Sending…' : '✉️ Send Magic Link'}
              </button>
            </form>

            {/* ── Footer links ── */}
            <p className="login-footer-links">
              By continuing you agree to our{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">Terms</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
