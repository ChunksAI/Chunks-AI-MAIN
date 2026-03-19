/**
 * public/sw.js — Chunks AI Service Worker
 * Handles push notifications and notification click events.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

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
