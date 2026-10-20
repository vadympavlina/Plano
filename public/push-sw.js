// Plano push notifications (loaded into the Workbox service worker).
self.addEventListener('push', (event) => {
  const d = event.data ? event.data.json() : {};
  const tag = d.tag || '';
  // Tasks and habits can be ticked off from the notification, the evening summary moves the rest
  // to tomorrow; anything with a token can be snoozed.
  const canDo = /^(task|habit|evening):/.test(tag);
  const canSnooze = !!d.snooze && /^(task|habit|ev):/.test(tag);
  event.waitUntil(
    self.registration.showNotification(d.title || 'Plano', {
      body: d.body || '',
      tag: d.tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      actions: [
        ...(canDo ? [{ action: 'done', title: tag.startsWith('evening:') ? '➡️ Перенести на завтра' : tag.startsWith('habit:') ? '✓ Відмітити' : '✓ Виконано' }] : []),
        ...(canSnooze ? [{ action: 'snooze', title: '⏰ Через 10 хв' }] : []),
      ],
      data: { url: d.url || './', tag, title: d.title, body: d.body, snooze: d.snooze },
    }),
  );
});

const openApp = (url) =>
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    const win = wins[0];
    if (!win) return self.clients.openWindow(url);
    return win.focus().then((w) => w.navigate(url).catch(() => w));
  });

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  if (event.action === 'snooze' && d.snooze) {
    const item = { title: d.title || 'Plano', body: d.body, url: d.url, tag: d.tag };
    event.waitUntil(
      fetch(`${d.snooze.api}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: d.snooze.uid, token: d.snooze.token, item }),
      }).catch(() => undefined),
    );
    return;
  }
  if (event.action === 'done') {
    // An open Plano window does it quietly; otherwise the app opens and does it on start.
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
        if (wins.length) return wins[0].postMessage({ type: 'plano:done', tag: d.tag });
        return self.clients.openWindow(new URL(`./#/?done=${encodeURIComponent(d.tag)}`, self.registration.scope).href);
      }),
    );
    return;
  }
  event.waitUntil(openApp(new URL(d.url || './', self.registration.scope).href));
});
