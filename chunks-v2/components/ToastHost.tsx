'use client';

/**
 * components/ToastHost.tsx — renders the global toast stack.
 *
 * Mount this once inside <ToastProvider> (see app/Providers.tsx).
 * It reads the current toast list from ToastContext and renders up to
 * MAX_TOASTS items in a fixed-position container above all other content.
 * Clicking a toast dismisses it immediately.
 */

import { useToastContext, type ToastItem } from '@/contexts/ToastContext';

// ─── Variant styling ──────────────────────────────────────────────────────────

const VARIANT_ICON: Record<ToastItem['variant'], string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const VARIANT_COLOR: Record<ToastItem['variant'], string> = {
  success: 'var(--accent)',
  error: 'var(--danger)',
  info: 'var(--text2)',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ToastHost() {
  const { toasts, removeToast } = useToastContext();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        zIndex: 9999,
        pointerEvents: 'none',
        alignItems: 'center',
        minWidth: 280,
        maxWidth: 440,
        width: 'max-content',
      }}
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-host-item"
          role="status"
          title="Click to dismiss"
          style={{ pointerEvents: 'auto', width: '100%' }}
          onClick={() => removeToast(t.id)}
        >
          <span className="toast-host-icon" style={{ color: VARIANT_COLOR[t.variant] }}>
            {VARIANT_ICON[t.variant]}
          </span>
          <span className="toast-host-message">{t.message}</span>
          <span className="toast-host-close" aria-hidden="true">×</span>
        </div>
      ))}
    </div>
  );
}
