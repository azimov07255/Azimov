const CACHE = 'azimov-v4';
const SHELL = ['./', './index.html', './css/styles.css', './manifest.webmanifest', './assets/icon.svg', './assets/logo.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
// Network-first with cache fallback: always fresh when online, still works offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    // 'no-cache' = always revalidate with the server, so a fresh deploy is never hidden by the HTTP cache
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});

// ---- Web Push: reminders delivered by the server while the app is closed ----
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data && e.data.text() };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Azimov', {
      body: d.body || '',
      tag: d.tag, // same id as the in-app notification -> no duplicates
      icon: 'assets/icon-192.png',
      badge: 'assets/icon-192.png',
      data: { href: d.href || '#/reminders' },
    })
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const href = (e.notification.data && e.notification.data.href) || '#/reminders';
  const url = new URL('./index.html' + href, self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope)) {
          return c.focus().then(() => c.navigate(url));
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
