// Plano push notifications (loaded into the Workbox service worker).
self.addEventListener('push', (event) => {
  const d = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(d.title || 'Plano', {
      body: d.body || '',
      tag: d.tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: d.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins[0];
      if (!win) return self.clients.openWindow(url);
      return win.focus().then((w) => w.navigate(url).catch(() => w));
    }),
  );
});
