# Preact Migration Guide

> Incremental migration from vanilla DOM manipulation to **Preact** components.

## Architecture

The app uses an **island architecture** — each Preact component is an isolated
"island" mounted into an existing DOM container.  Vanilla JS code communicates
with islands through **imperative handles** (plain functions), not by reaching
into Preact internals.

```
┌──────────────────────────────────────────────────────────┐
│  Vanilla JS (globals.js, state/, screens/)               │
│                                                          │
│  showToast('✓', 'Copied!')                               │
│       │                                                  │
│       ▼                                                  │
│  ┌─────────────────────────────┐                         │
│  │  Toast.js  (bridge wrapper) │                         │
│  │  └── mountIsland(...)       │                         │
│  │      └── Toast.jsx (Preact) │ ◄── the "island"       │
│  └─────────────────────────────┘                         │
│       ▲                                                  │
│       │  imperative handle: { show }                     │
│       │                                                  │
│  DOM: <div id="ws-toast"> ← Preact owns children        │
└──────────────────────────────────────────────────────────┘
```

### Key directories

| Path                    | Purpose                                      |
|-------------------------|----------------------------------------------|
| `src/preact/bridge.js`  | `mountIsland()` — mounts a Preact component   |
| `src/components/*.jsx`  | Preact island components                      |
| `src/components/*.js`   | Backward-compatible wrappers (public API)     |

## How to convert a component

### 1. Create `ComponentName.jsx`

Write a standard Preact component using hooks.  Expose an imperative handle
via `useImperativeHandle` + `forwardRef` for any functions that vanilla JS
callers need:

```jsx
// src/components/MyWidget.jsx
import { h } from 'preact';
import { useState, useImperativeHandle } from 'preact/hooks';
import { forwardRef } from 'preact/compat';

const MyWidgetIsland = forwardRef((props, ref) => {
  const [count, setCount] = useState(0);

  useImperativeHandle(ref, () => ({
    increment() { setCount(c => c + 1); },
    reset()     { setCount(0); },
  }), []);

  return <div class="my-widget">Count: {count}</div>;
});

MyWidgetIsland.displayName = 'MyWidgetIsland';
export { MyWidgetIsland };
```

### 2. Rewrite `ComponentName.js` as a thin wrapper

Keep the **exact same exports** so no other file needs to change:

```js
// src/components/MyWidget.js
import { mountIsland } from '../preact/bridge.js';
import { MyWidgetIsland } from './MyWidget.jsx';

let _handle = null;

function _mount() {
  if (_handle) return;
  const el = document.getElementById('my-widget');
  if (!el) return;
  _handle = mountIsland(MyWidgetIsland, el);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _mount, { once: true });
} else {
  _mount();
}

// Public API — same signature as before
export function increment() {
  if (!_handle) _mount();
  _handle?.increment?.();
}
```

### 3. Verify

```bash
npm run build          # check bundle compiles
npm run dev            # smoke-test in browser
```

## Boundaries & conventions

1. **One island, one `.jsx` file.**  Each Preact island is self-contained.
2. **No Preact imports in `.js` files** except for the bridge wrapper.
3. **Imperative handles are the only API** between vanilla JS and Preact.
4. **CSS stays in plain CSS files** — no CSS-in-JS.
5. **globals.js stays as-is** — it imports from `.js` wrappers, not `.jsx`.
6. **Preact is isolated** in its own `vendor-preact` chunk (~7.7 KB gzipped).

## Migrated components

| Component             | `.jsx`                      | Status     |
|-----------------------|-----------------------------|------------|
| Toast                 | `Toast.jsx`                 | ✅ Done    |
| ConfirmModal          | `ConfirmModal.jsx`          | ✅ Done    |
| StorageErrorBanner    | `StorageErrorBanner.jsx`    | ✅ Done    |
| Sidebar               | —                           | 🔲 Planned |
| ProfileDropdown       | —                           | 🔲 Planned |
| SettingsModal         | —                           | 🔲 Planned |
| LibraryModal          | —                           | 🔲 Planned |

## FAQ

**Why Preact over Svelte?**
Preact's API is nearly identical to React (hooks, JSX, virtual DOM), which
makes it easier for contributors already familiar with React.  At ~3 KB
gzipped it adds negligible weight.

**Why not rewrite everything at once?**
The app is ~7500 lines of HTML + ~2000 lines of JS components.  An
incremental island-based migration lets us ship improvements continuously
without a risky big-bang rewrite.

**Can I use JSX syntax?**
Yes — `@preact/preset-vite` transforms JSX in `.jsx` files automatically.
The `h()` calls in the initial components are explicit for clarity, but JSX
sugar works identically.
