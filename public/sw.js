/**
 * public/sw.js — Chunks AI Service Worker
 *
 * Responsibilities:
 *   1. Push notifications + local alarm scheduling (original)
 *   2. Static-asset & lazy-chunk caching for offline use
 *   3. PDF cache fallback (works with the chunks-pdf-v1 cache
 *      populated by the main thread in books.js)
 *
 * Caching strategies:
 *   • Hashed assets (/assets/*-<hash>.js|css) → cache-first (immutable)
 *   • Navigation requests (HTML)              → network-first, cache fallback
 *   • Static files (images, manifest, etc.)   → stale-while-revalidate
 *   • PDF responses (cross-origin /pdf/*)     → cache-first via chunks-pdf-v1
 *   • API data requests                       → network-only (never cached)
 */

// ── Cache names ───────────────────────────────────────────────────────────
const STATIC_CACHE  = 'chunks-static-v1';
const PDF_CACHE     = 'chunks-pdf-v1';         // shared with books.js
const KNOWN_CACHES  = new Set([STATIC_CACHE, PDF_CACHE]);

// Resources to pre-cache on install (app shell).
// Hashed assets are NOT listed here — they are cached on first fetch.
const APP_SHELL = [
  '/app.html',
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/site.webmanifest',
];

// ── Install: pre-cache app shell ──────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean obsolete caches, claim clients ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !KNOWN_CACHES.has(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategies ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. PDF endpoint — cache-first from chunks-pdf-v1.
  //    Matches both cross-origin (api.chunks.online/pdf/<id>) and
  //    same-origin proxy paths (/api/pdf/<id>).
  if (/\/pdf\/[^/]+$/.test(url.pathname)) {
    event.respondWith(_cacheFirst(request, PDF_CACHE));
    return;
  }

  // 2. Never cache other API data requests
  if (url.pathname.startsWith('/api/')) return;

  // 3. Vite build assets (/assets/*) — cache-first.
  //    All files in /assets/ have content-hashed filenames, so they are
  //    immutable and safe to serve from cache indefinitely.  This covers
  //    both eagerly-loaded bundles and lazily-loaded dynamic-import chunks.
  if (/\/assets\/.+\.(js|css)$/i.test(url.pathname)) {
    event.respondWith(_cacheFirst(request, STATIC_CACHE));
    return;
  }

  // 4. Navigation requests (HTML pages) — network-first
  if (request.mode === 'navigate') {
    event.respondWith(_networkFirst(request, STATIC_CACHE));
    return;
  }

  // 5. Other same-origin static files (images, webmanifest, etc.)
  if (url.origin === self.location.origin &&
      /\.(png|jpg|jpeg|gif|svg|ico|webp|webmanifest|woff2?)$/i.test(url.pathname)) {
    event.respondWith(_staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }
});

// ── Strategy: cache-first (immutable hashed assets & PDFs) ────────────────
async function _cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // Offline and not cached — return a basic offline response
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ── Strategy: network-first (navigation / HTML) ──────────────────────────
async function _networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Last resort: try app.html as a fallback for SPA-style routing
    const fallback = await caches.match('/app.html');
    return fallback || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ── Strategy: stale-while-revalidate (images, manifest, etc.) ────────────
async function _staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);   // swallow network error when we have a cached copy
  return cached || fetchPromise;
}

// ── Push event ─────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'Chunks AI', body: "Time to study! Open your study plan.", icon: '/favicon-192x192.png', badge: '/favicon-32x32.png' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    data.icon || '/favicon-192x192.png',
      badge:   data.badge || '/favicon-32x32.png',
      tag:     'chunks-daily-reminder',
      renotify: true,
      data:    { url: data.url || '/studyplan' },
      actions: [
        { action: 'open',   title: '📚 Open Study Plan' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

// ── Notification click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/studyplan';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing tab if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return;
        }
      }
      // Open new tab
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ── Local alarm: check every minute if a scheduled reminder is due ──────────
// This is a lightweight local-only approach — no push server needed.
// The page passes the schedule via postMessage (SW has no localStorage access).
// Schedule format: [{ fireAt: <timestamp ms>, fired: bool, title, body }, ...]

let _cachedSchedule = [];

// SW-side self-check every 30s while the SW is alive.
// This fires reminders even when the page is closed (SW can stay alive
// in the background on Android Chrome and some desktop browsers).
setInterval(() => {
  if (_cachedSchedule.length) {
    checkAndFireReminders(_cachedSchedule).then(fired => {
      // No page to message — just update the in-memory cache
      if (fired.length) {
        _cachedSchedule.forEach(r => { if (fired.includes(r.fireAt)) r.fired = true; });
      }
    });
  }
}, 30_000);

self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SCHEDULE_CHECK') {
    // Page sends the current schedule so SW can check it without localStorage
    if (Array.isArray(event.data.schedule)) {
      _cachedSchedule = event.data.schedule;
    }
    const source = event.source;
    // Use waitUntil so SW stays alive until all notifications are shown
    event.waitUntil(
      checkAndFireReminders(_cachedSchedule).then(fired => {
        if (fired.length && source) {
          source.postMessage({ type: 'REMINDER_FIRED', firedAt: fired });
        }
      })
    );
  }
});

/**
 * @param {Array} schedule
 * @returns {Promise<number[]>} resolves with fireAt values that were just fired
 */
async function checkAndFireReminders(schedule) {
  const now   = Date.now();
  const fired = [];
  const notifPromises = [];

  (schedule || []).forEach(reminder => {
    if (reminder.fireAt <= now && !reminder.fired) {
      notifPromises.push(
        self.registration.showNotification(reminder.title || 'Chunks AI – Study Reminder', {
          body:     reminder.body  || "Time to study! Don't forget your critical path.",
          icon:     '/favicon-192x192.png',
          badge:    '/favicon-32x32.png',
          tag:      'chunks-daily-reminder',
          renotify: true,
          data:     { url: '/studyplan' },
          actions:  [
            { action: 'open',    title: '📚 Open Study Plan' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        })
      );
      reminder.fired = true;
      fired.push(reminder.fireAt);
    }
  });

  await Promise.all(notifPromises);
  return fired;
}
