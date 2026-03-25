// @ts-nocheck
/**
 * src/components/ConfirmModal.jsx — Preact Confirm-Modal island
 *
 * Declarative confirm dialog + simple notification pill rendered by Preact.
 * Imperative methods `show(opts)`, `close()`, and `notify(text)` are exposed
 * via `useImperativeHandle` so vanilla-JS callers work unchanged.
 *
 * The component creates its own DOM (no static HTML in app.html required)
 * and manages keyboard navigation (Escape, arrow keys) internally.
 */

import { h, Fragment } from 'preact';
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
} from 'preact/hooks';
import { forwardRef } from 'preact/compat';

const NOTIF_DISMISS_MS = 3000;

const ConfirmModalIsland = forwardRef((_props, ref) => {
  // ── Confirm modal state ───────────────────────────────────────────────
  const [modal, setModal] = useState({
    active: false,
    title: 'Are you sure?',
    desc: '',
    confirmLabel: 'Confirm',
  });
  const onConfirmRef = useRef(null);
  const cancelRef = useRef(null);
  const okRef = useRef(null);

  // ── Simple-notif state ────────────────────────────────────────────────
  const [notif, setNotif] = useState({ text: '', visible: false });
  const notifTimerRef = useRef(null);

  // ── Confirm actions ───────────────────────────────────────────────────
  const close = useCallback(() => {
    setModal((prev) => ({ ...prev, active: false }));
    onConfirmRef.current = null;
  }, []);

  const handleOk = useCallback(() => {
    const cb = onConfirmRef.current;
    close();
    if (typeof cb === 'function') cb();
  }, [close]);

  const show = useCallback((opts = {}) => {
    onConfirmRef.current =
      typeof opts.onConfirm === 'function' ? opts.onConfirm : null;
    setModal({
      active: true,
      title: opts.title || 'Are you sure?',
      desc: opts.desc || '',
      confirmLabel: opts.confirmLabel || 'Confirm',
    });
  }, []);

  // Focus Cancel by default when modal opens
  useEffect(() => {
    if (modal.active && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [modal.active]);

  // ── Keyboard handling ─────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if (!modal.active) return;

      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        okRef.current?.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        cancelRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modal.active, close]);

  // ── Simple notification ───────────────────────────────────────────────
  const notify = useCallback((text) => {
    setNotif({ text, visible: true });
    clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(
      () => setNotif((prev) => ({ ...prev, visible: false })),
      NOTIF_DISMISS_MS,
    );
  }, []);

  // ── Expose imperative handle ──────────────────────────────────────────
  useImperativeHandle(ref, () => ({ show, close, notify }), [
    show,
    close,
    notify,
  ]);

  // ── Render ────────────────────────────────────────────────────────────
  return h(
    Fragment,
    null,

    // Confirm modal overlay
    h(
      'div',
      {
        id: 'confirm-modal',
        role: 'dialog',
        'aria-modal': 'true',
        class: modal.active ? 'active' : '',
        onClick: (e) => {
          if (e.target.id === 'confirm-modal') close();
        },
      },
      h(
        'div',
        { class: 'confirm-box' },
        h('p', { class: 'confirm-title', id: 'confirm-title' }, modal.title),
        h('p', { class: 'confirm-desc', id: 'confirm-desc' }, modal.desc),
        h(
          'div',
          { class: 'confirm-actions' },
          h(
            'button',
            {
              class: 'confirm-cancel-btn',
              id: 'confirm-cancel-btn',
              ref: cancelRef,
              onClick: close,
            },
            'Cancel',
          ),
          h(
            'button',
            {
              class: 'confirm-ok-btn',
              id: 'confirm-ok-btn',
              ref: okRef,
              onClick: handleOk,
            },
            modal.confirmLabel,
          ),
        ),
      ),
    ),

    // Simple notification pill
    h(
      'div',
      {
        id: 'simple-notif',
        class: notif.visible ? 'show' : '',
      },
      notif.text,
    ),
  );
});

ConfirmModalIsland.displayName = 'ConfirmModalIsland';
export { ConfirmModalIsland };
