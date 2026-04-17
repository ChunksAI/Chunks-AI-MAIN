'use client';

/**
 * contexts/ToastContext.tsx — global toast notification system.
 *
 * ToastProvider manages a capped queue of ToastItems.  Each toast
 * auto-dismisses after DISMISS_MS and can also be manually dismissed.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong.');
 *   toast.info('Tip: try the dark theme.');
 */

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToastItem {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, variant: ToastItem['variant']) => void;
  removeToast: (id: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;
const DISMISS_MS = 4000;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timerRefs.current[id]);
    delete timerRefs.current[id];
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastItem['variant']) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => {
        const next = [...prev, { id, message, variant }];
        // Drop oldest toasts when the cap is exceeded
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
      timerRefs.current[id] = setTimeout(() => removeToast(id), DISMISS_MS);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Low-level hook — gives direct access to the full context value. */
export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastContext must be used inside <ToastProvider>');
  return ctx;
}

/**
 * Convenience hook for components — exposes success / error / info helpers.
 *
 * @example
 *   const { toast } = useToast();
 *   toast.success('Saved!');
 */
export function useToast() {
  const { addToast } = useToastContext();
  return {
    toast: {
      success: (message: string) => addToast(message, 'success'),
      error:   (message: string) => addToast(message, 'error'),
      info:    (message: string) => addToast(message, 'info'),
    },
  };
}
