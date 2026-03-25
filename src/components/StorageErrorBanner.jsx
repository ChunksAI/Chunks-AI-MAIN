/**
 * src/components/StorageErrorBanner.jsx — Preact Storage-Error-Banner island
 *
 * Persistent dismissible banner rendered at the top of the app when a storage
 * quota / migration / out-of-space error occurs.
 *
 * Imperative methods `show(kind)` and `dismiss()` are exposed via
 * `useImperativeHandle` for backward-compatible vanilla-JS calls.
 */

import { h } from 'preact';
import {
  useState,
  useCallback,
  useImperativeHandle,
} from 'preact/hooks';
import { forwardRef } from 'preact/compat';

// ── Error kind definitions ──────────────────────────────────────────────────

const ERRORS = {
  quota: {
    icon: '⚠',
    title: 'Storage is full',
    body: 'Some data may not be saved. Try clearing old chat sessions or documents in Settings \u2192 Data.',
  },
  migration: {
    icon: '⚠',
    title: 'Data migration incomplete',
    body: 'Some data could not be moved to faster storage and may only be available temporarily. Your data is still safe.',
  },
  'out-of-space': {
    icon: '⚠',
    title: 'Device storage is low',
    body: 'There isn\u2019t enough space to save new data. Free up space on your device or clear old sessions in Settings.',
  },
};

const SS_DISMISSED_PREFIX = 'chunks_storage_err_dismissed_';

function _isDismissed(kind) {
  try {
    return sessionStorage.getItem(SS_DISMISSED_PREFIX + kind) === '1';
  } catch (_) {
    return false;
  }
}

function _setDismissed(kind) {
  try {
    sessionStorage.setItem(SS_DISMISSED_PREFIX + kind, '1');
  } catch (_) {
    /* ignore */
  }
}

// ── Component ───────────────────────────────────────────────────────────────

const StorageErrorBannerIsland = forwardRef((_props, ref) => {
  const [state, setState] = useState({ kind: null, visible: false });

  const dismiss = useCallback(() => {
    setState((prev) => {
      if (prev.kind) _setDismissed(prev.kind);
      return { kind: null, visible: false };
    });
  }, []);

  const show = useCallback((kind) => {
    const def = ERRORS[kind];
    if (!def) return;
    if (_isDismissed(kind)) return;

    setState((prev) => {
      // If a banner is already showing, suppress the new one
      if (prev.visible) {
        console.warn(
          '[StorageErrorBanner] "%s" suppressed \u2014 "%s" already visible',
          kind,
          prev.kind,
        );
        return prev;
      }
      return { kind, visible: true };
    });
  }, []);

  useImperativeHandle(ref, () => ({ show, dismiss }), [show, dismiss]);

  const def = state.kind ? ERRORS[state.kind] : null;
  if (!def || !state.visible) return null;

  return h(
    'div',
    {
      id: 'storage-error-banner',
      role: 'alert',
      class: 'seb-show',
    },
    h(
      'div',
      { class: 'seb-inner' },
      h('span', { class: 'seb-icon' }, def.icon),
      h(
        'div',
        { class: 'seb-text' },
        h('strong', null, def.title),
        ' ',
        h('span', null, def.body),
      ),
      h(
        'button',
        {
          class: 'seb-close',
          'aria-label': 'Dismiss',
          onClick: dismiss,
        },
        '\u2715',
      ),
    ),
  );
});

StorageErrorBannerIsland.displayName = 'StorageErrorBannerIsland';
export { StorageErrorBannerIsland };
