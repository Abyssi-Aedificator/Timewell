// Keep each installation's caches inside its own scope, even on a shared Pages origin.
const PREFIX = 'timewell-' + encodeURIComponent(new URL(self.registration.scope).pathname) + '-';
const SW_VERSION = '1.0.4';
const CACHE = PREFIX + 'v36';
const UPDATE_CACHE = PREFIX + 'update-control';
const APPROVED_KEY = new URL('./__approved-version__', self.registration.scope).href;
const ASSETS = ['./', './index.html', './app.js', './updates.js', './themes.js', './themes.css', './responsive.css', './time-picker.js', './icon.svg', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './manifest.webmanifest'];
const assetURLs = new Set(ASSETS.map(asset => new URL(asset, self.registration.scope).href));
async function approvedCache() {
  const saved = await (await caches.open(UPDATE_CACHE)).match(APPROVED_KEY);
  return saved ? saved.text() : CACHE;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(asset => new Request(new URL(asset, self.registration.scope), { cache: 'reload' })));
    const control = await caches.open(UPDATE_CACHE);
    // Bootstrap older versions once: they do not yet contain the update prompt.
    // Future workers keep the approved version until the user chooses Update now.
    if (!await control.match(APPROVED_KEY)) await control.put(APPROVED_KEY, new Response(CACHE));
    // Wait for approval, or for every old tab to close; never interrupt an open timer.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const approved = await approvedCache();
    await Promise.all((await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE && key !== approved && key !== UPDATE_CACHE).map(key => caches.delete(key)));
    // Do not claim clients or change any sibling app's caches.
  })());
});
self.addEventListener('message', event => {
  const port = event.ports?.[0];
  if (!event.data || !port) return;
  event.waitUntil((async () => {
    try {
      if (event.data.type === 'TIMEWELL_UPDATE_INFO') {
        port.postMessage({ version: SW_VERSION, cache: CACHE, pending: (await approvedCache()) !== CACHE });
      } else if (event.data.type === 'TIMEWELL_APPROVE_UPDATE' && event.data.cache === CACHE) {
        const cache = await caches.open(CACHE);
        for (const asset of ASSETS) {
          if (!await cache.match(new URL(asset, self.registration.scope).href)) throw new Error('The update download is incomplete. Please try again online.');
        }
        await (await caches.open(UPDATE_CACHE)).put(APPROVED_KEY, new Response(CACHE));
        await self.skipWaiting();
        port.postMessage({ ok: true });
      } else {
        throw new Error('This update is no longer available. Please check again.');
      }
    } catch (error) { port.postMessage({ error: error.message }); }
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  const canonical = new URL(url); canonical.search = ''; canonical.hash = '';
  const isAppPage = event.request.mode === 'navigate' && [self.registration.scope, new URL('./index.html', self.registration.scope).href].includes(canonical.href);
  if (!assetURLs.has(canonical.href) && !isAppPage) return;
  event.respondWith((async () => {
    // A newer worker can activate after tabs close; keep serving the user-approved version.
    const cache = await caches.open(await approvedCache());
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
