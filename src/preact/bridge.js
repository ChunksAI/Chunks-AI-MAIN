// @ts-nocheck
/**
 * src/preact/bridge.js — Preact ↔ vanilla-JS bridge utilities
 *
 * Provides helpers for incrementally mounting Preact components into an
 * existing vanilla-JS application.  Every Preact component lives inside a
 * clearly-defined "island" — a single DOM container that Preact owns.
 * Code *outside* the island talks to the component through an imperative
 * handle (plain functions) returned by the component via `useImperativeHandle`.
 *
 * Usage:
 *   import { mountIsland } from '../preact/bridge.js';
 *   import { MyComponent }  from './MyComponent.jsx';
 *
 *   const handle = mountIsland(MyComponent, '#my-container');
 *   // or: mountIsland(MyComponent, document.getElementById('my-container'));
 *   handle.doSomething();        // call imperative methods
 *   handle.unmount();            // tear down the island
 */

import { h, render as preactRender } from 'preact';
import { createRef } from 'preact';

/**
 * Mount a Preact "island" into an existing DOM container.
 *
 * The component MUST expose an imperative handle via a forwarded `ref`.
 * That handle is returned to the caller so vanilla JS can drive the
 * component without reaching into Preact internals.
 *
 * @param {import('preact').ComponentType} Component  — Preact component (must accept ref)
 * @param {string|HTMLElement} container              — CSS selector or DOM element
 * @param {object} [props]                            — optional initial props
 * @returns {object}  imperative handle exposed by the component + `unmount()`
 */
export function mountIsland(Component, container, props = {}) {
  const el =
    typeof container === 'string'
      ? document.querySelector(container)
      : container;

  if (!el) {
    console.warn('[preact/bridge] container not found:', container);
    return {};
  }

  const ref = createRef();

  preactRender(h(Component, { ...props, ref }), el);

  // Build the public handle — everything the ref exposes + unmount.
  //
  // NOTE: ref.current is populated synchronously for simple components
  // that call useImperativeHandle during the first render.  For async or
  // lazily-initialized components the handle may initially be incomplete.
  // In practice every island in this codebase is synchronous, so this is
  // always safe.  If you add an async island, either:
  //   (a) ensure the wrapper does a lazy _mount() before calling methods, or
  //   (b) return a Proxy that defers to ref.current at call time.
  const handle = {
    /** Remove the Preact tree from the DOM. */
    unmount() {
      preactRender(null, el);
    },
  };

  if (ref.current) {
    Object.assign(handle, ref.current);
  }

  return handle;
}
