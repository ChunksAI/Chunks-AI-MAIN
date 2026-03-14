/**
 * vite.config.js — Chunks AI build configuration
 *
 * Task 37 — Rollup manual chunks + vite build
 *
 * Chunk strategy (all third-party libs are CDN — no npm vendor bundle needed):
 *   lib        — src/lib/*         infrastructure (api, supabase, chunksDb, auth …)
 *   utils      — src/utils/*       shared utilities (render, storage, focusTrap)
 *   state      — src/state/*       app-wide state machines
 *   components — src/components/*  UI components (Sidebar, Modals …)
 *   screens    — src/screens/*     per-screen mount logic (largest group ~230 KB)
 *
 * CSS: single bundle (cssCodeSplit: false) — ~180 KB, no async FOUC.
 * Hashed filenames on all chunks + assets for long-term caching.
 * Source maps in production for easier debugging.
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // ── Dev server ──────────────────────────────────────────────────────────
  server: {
    port: 5173,
    open: true,
  },

  // ── Build ────────────────────────────────────────────────────────────────
  build: {
    outDir: 'dist',

    // Source maps for production debugging
    sourcemap: true,

    // Target modern browsers — drops legacy polyfills, keeps bundle lean
    target: 'es2020',

    // Single CSS bundle — avoids async FOUC; ~180 KB is well within budget
    cssCodeSplit: false,

    rollupOptions: {
      // ── Multi-page entries ──────────────────────────────────────────────
      // Each HTML file becomes its own entry point in the dist/ output.
      input: {
        main:    resolve(__dirname, 'index.html'),
        login:   resolve(__dirname, 'login.html'),
        admin:   resolve(__dirname, 'admin.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms:   resolve(__dirname, 'terms.html'),
      },

      output: {
        // Content-hashed filenames for aggressive long-term caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',

        manualChunks(id) {
          // ── Infrastructure (lib/) ─────────────────────────────────────
          // Loaded first; rarely changes — maximises cache hit rate.
          if (
            id.includes('/src/lib/api') ||
            id.includes('/src/lib/supabase') ||
            id.includes('/src/lib/chunksDb') ||
            id.includes('/src/lib/flashcardDb') ||
            id.includes('/src/lib/auth')
          ) return 'lib';

          // ── Shared utilities (utils/) ──────────────────────────────────
          if (id.includes('/src/utils/')) return 'utils';

          // ── App-wide state machines (state/) ──────────────────────────
          if (id.includes('/src/state/')) return 'state';

          // ── UI components (components/) ───────────────────────────────
          if (id.includes('/src/components/')) return 'components';

          // ── Per-screen mount logic (screens/) ─────────────────────────
          // Isolated so a screen change busts only this chunk.
          if (id.includes('/src/screens/')) return 'screens';
        },
      },
    },
  },

  // ── CSS ──────────────────────────────────────────────────────────────────
  css: {
    // All CSS imported from src/main.js in declaration order.
    // No preprocessor — plain CSS with custom properties (tokens.css).
    devSourcemap: true,
  },
});