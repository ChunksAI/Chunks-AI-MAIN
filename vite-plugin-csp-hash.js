/**
 * vite-plugin-csp-hash.js
 *
 * Task 35 — Vite plugin to keep CSP hashes up-to-date automatically.
 *
 * On every build (and optionally on dev-server HTML transform), this plugin:
 *  1. Scans the final HTML for all inline <script> and <style> blocks
 *  2. Computes SHA-256 hashes for each
 *  3. Rewrites the <meta http-equiv="Content-Security-Policy"> tag with
 *     the fresh hash list — no 'unsafe-inline' needed
 *
 * DEV MODE behaviour (added Task 35 fix):
 *  In dev mode Vite injects CSS via runtime JS that creates <style> elements.
 *  These cannot be pre-hashed, so this plugin ensures 'unsafe-inline' is
 *  present in style-src during development and removed on production builds.
 *
 * Usage in vite.config.js:
 *   import { cspHashPlugin } from './vite-plugin-csp-hash.js';
 *   export default defineConfig({ plugins: [cspHashPlugin()] });
 */

import crypto from 'node:crypto';

/**
 * Compute the CSP sha256-<base64> hash for a string.
 * @param {string} content
 * @returns {string}  e.g. "'sha256-abc123='"
 */
function cspHash(content) {
  const digest = crypto.createHash('sha256').update(content, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

/**
 * Extract all inline script/style contents and build hash lists.
 * @param {string} html
 * @returns {{ scriptHashes: string[], styleHashes: string[] }}
 */
function extractHashes(html) {
  const scriptHashes = new Set();
  const styleHashes  = new Set();

  // Inline <script> blocks (no src attribute)
  for (const [, content] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    scriptHashes.add(cspHash(content));
  }

  // Inline <style> blocks
  for (const [, content] of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    styleHashes.add(cspHash(content));
  }

  return {
    scriptHashes: [...scriptHashes].sort(),
    styleHashes:  [...styleHashes].sort(),
  };
}

/**
 * Rewrite the CSP meta tag in an HTML string.
 * @param {string} html
 * @param {string[]} scriptHashes
 * @param {string[]} styleHashes
 * @returns {string}
 */
function rewriteCsp(html, scriptHashes, styleHashes) {
  const scriptSrc = [
    "'self'",
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com',
    'https://fonts.googleapis.com',
    ...scriptHashes,
  ].join(' ');

  const styleSrc = [
    "'self'",
    'https://fonts.googleapis.com',
    'https://cdn.jsdelivr.net',
    ...styleHashes,
  ].join(' ');

  const newCsp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://chunks-ai-main-production.up.railway.app https://chemistry-app-production.up.railway.app https://*.supabase.co wss://*.supabase.co https://cdnjs.cloudflare.com https://cdn.jsdelivr.net",
    "worker-src blob: https://cdnjs.cloudflare.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');

  return html.replace(
    /<meta http-equiv="Content-Security-Policy"[^>]*>/,
    `<meta http-equiv="Content-Security-Policy" content="${newCsp}">`,
  );
}

/**
 * The Vite plugin.
 */
export function cspHashPlugin() {
  return {
    name: 'csp-hash',

    transformIndexHtml: {
      order: 'post',
      /**
       * @param {string} html
       * @param {{ server?: import('vite').ViteDevServer }} ctx
       */
      handler(html, ctx) {
        // ── DEV SERVER ──────────────────────────────────────────────────
        // Vite injects CSS in dev mode via JavaScript that creates <style>
        // elements at runtime. These dynamic injections are NOT hashable in
        // advance, so the strict sha256-only CSP would block ALL styles.
        //
        // Solution: ensure 'unsafe-inline' is present in style-src during
        // development. The build path below replaces it with real hashes.
        if (ctx.server) {
          if (!html.includes("'unsafe-inline'")) {
            html = html.replace(
              /(style-src\s+'self')/,
              "$1 'unsafe-inline'",
            );
          }
          console.log("[csp-hash] Dev mode: style-src patched with 'unsafe-inline'");
          return html;
        }

        // ── PRODUCTION BUILD ────────────────────────────────────────────
        // Strip any 'unsafe-inline' and replace with real SHA-256 hashes.
        html = html.replace(/\s*'unsafe-inline'/g, '');
        const { scriptHashes, styleHashes } = extractHashes(html);
        const updated = rewriteCsp(html, scriptHashes, styleHashes);
        console.log(
          `[csp-hash] Build: CSP updated — ${scriptHashes.length} script hashes, ${styleHashes.length} style hashes`,
        );
        return updated;
      },
    },
  };
}