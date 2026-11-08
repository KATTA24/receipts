// Lets the app open with no internet. Only page files and fonts are touched:
// saving to the Sheet is a POST to Google and never passes through here.
const CACHE = 'receipts-v1';
const FILES = ['./', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const WAIT_MS = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (e.request.mode === 'navigate') e.respondWith(openPage(e));
  else if (url.origin === location.origin || /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(savedFirst(e));
});

// Newest page if the network answers quickly; otherwise the saved one, so a bad connection can't hold up the counter.
async function openPage(e) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match('./');
  const fresh = fetch(e.request).then(async res => {
    if (res.ok) await cache.put('./', res.clone());
    return res.ok || !saved ? res : saved;
  });
  if (!saved) return fresh;
  e.waitUntil(fresh.catch(() => {}));
  const late = new Promise(done => setTimeout(() => done(saved), WAIT_MS));
  return Promise.race([fresh.catch(() => saved), late]);
}

async function savedFirst(e) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(e.request);
  const fresh = fetch(e.request).then(async res => {
    if (res.ok || res.type === 'opaque') await cache.put(e.request, res.clone());
    return res;
  });
  if (!saved) return fresh;
  e.waitUntil(fresh.catch(() => {}));
  return saved;
}
