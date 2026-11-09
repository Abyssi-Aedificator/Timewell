// Keep each installation's caches inside its own scope, even on a shared Pages origin.
const PREFIX = 'timewell-' + encodeURIComponent(new URL(self.registration.scope).pathname) + '-';
const CACHE = PREFIX + 'v28';
const ASSETS = ['./', './index.html', './app.js', './themes.js', './themes.css', './time-picker.js', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './manifest.webmanifest'];
const assetURLs = new Set(ASSETS.map(asset => new URL(asset, self.registration.scope).href));
self.addEventListener('install', event => {
  // Commit a complete app version before activating. Don't interrupt open timers.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(asset => new Request(new URL(asset, self.registration.scope), { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const canonical = new URL(url); canonical.search = ''; canonical.hash = '';
  const isAppPage = event.request.mode === 'navigate' && [self.registration.scope, new URL('./index.html', self.registration.scope).href].includes(canonical.href);
  if (!assetURLs.has(canonical.href) && !isAppPage) return;
  event.respondWith((async () => {
    // Serve one installed version consistently; the next worker installs updates atomically.
    const cache = await caches.open(CACHE);
    const key = isAppPage ? new URL('./index.html', self.registration.scope).href : canonical.href;
    const cached = await cache.match(key);
    if (cached) return cached;
    try { return await fetch(event.request); } catch { return Response.error(); }
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url.startsWith(self.registration.scope));
    if (existing) return existing.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});
