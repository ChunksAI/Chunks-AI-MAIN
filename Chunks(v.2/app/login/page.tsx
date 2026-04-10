'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabaseClient';

/**
 * app/login/page.tsx — authentication page
 *
 * Supports Magic Link email sign-in. After the user enters their email,
 * Supabase sends a one-time link. Clicking it redirects back to /study.
 *
 * If the user is already signed in, they are immediately redirected to /study.
 */
export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect already-authenticated users
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/study');
    }
  }, [user, isLoading, router]);

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
          // After clicking the magic link the user lands on /study
          emailRedirectTo: `${window.location.origin}/study`,
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

  if (isLoading) {
    return (
      <div className="login-page">
        <div className="login-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* ── Logo ── */}
        <div className="login-logo">
          <div className="logo-mark" style={{ width: 36, height: 36 }}>
            <svg viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1.5" fill="white" />
              <rect x="8" y="1" width="5" height="5" rx="1.5" fill="white" opacity="0.6" />
              <rect x="1" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.6" />
              <rect x="8" y="8" width="5" height="5" rx="1.5" fill="white" opacity="0.3" />
            </svg>
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
        <p className="login-sub">We&apos;ll send you a magic link — no password needed.</p>

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
            <button type="submit" className="ws-add-btn login-submit" disabled={submitting}>
              {submitting ? 'Sending…' : '✉️ Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
