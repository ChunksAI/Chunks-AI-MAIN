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
// The page schedules reminders via localStorage; SW fires them.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SCHEDULE_CHECK') {
    checkAndFireReminders();
  }
});

function checkAndFireReminders() {
  try {
    const raw = self.localStorage ? self.localStorage.getItem('chunks_reminder_schedule') : null;
    if (!raw) return;
    const schedule = JSON.parse(raw);
    const now = Date.now();
    let changed = false;

    (schedule || []).forEach(reminder => {
      if (reminder.fireAt <= now && !reminder.fired) {
        self.registration.showNotification(reminder.title || 'Chunks AI – Study Reminder', {
          body:    reminder.body  || "Time to study! Don't forget your critical path.",
          icon:    '/favicon-192x192.png',
          badge:   '/favicon-32x32.png',
          tag:     'chunks-daily-reminder',
          renotify: true,
          data:    { url: '/studyplan' },
          actions: [
            { action: 'open',    title: '📚 Open Study Plan' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        });
        reminder.fired = true;
        changed = true;
      }
    });

    if (changed) {
      self.localStorage.setItem('chunks_reminder_schedule', JSON.stringify(schedule));
    }
  } catch (_) {}
}
