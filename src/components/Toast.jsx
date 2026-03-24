/**
 * src/components/Toast.jsx — Preact Toast island
 *
 * A purely declarative toast notification rendered by Preact.
 * The imperative `show(icon, text, color?)` method is exposed through
 * `useImperativeHandle` so vanilla-JS callers work unchanged.
 *
 * Renders INTO the existing `#ws-toast` container in app.html — Preact
 * manages the children while the component toggles `.show` on the
 * container for CSS animation compatibility.
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

const DISMISS_MS = 2500;

const ToastIsland = forwardRef((_props, ref) => {
  const [state, setState] = useState({
    icon: '',
    text: '',
    color: '',
    visible: false,
  });
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  // Grab a reference to the container element (the mount point)
  useEffect(() => {
    containerRef.current = document.getElementById('ws-toast');
  }, []);

  const show = useCallback((icon, text, color) => {
    setState({ icon, text, color: color || '', visible: true });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false, color: '' }));
    }, DISMISS_MS);
  }, []);

  // Expose imperative handle for vanilla-JS callers
  useImperativeHandle(ref, () => ({ show }), [show]);

  // Sync container classList + borderColor with Preact state
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.classList.toggle('show', state.visible);
    el.style.borderColor = state.color;
  }, [state.visible, state.color]);

  // Render nothing until the first show() call
  if (!state.text) return null;

  return h(
    Fragment,
    null,
    h('span', { style: 'font-size:14px;' }, state.icon),
    h('span', null, state.text),
  );
});

ToastIsland.displayName = 'ToastIsland';
export { ToastIsland };
