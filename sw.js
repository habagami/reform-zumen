// オフライン用のキャッシュ(アプリ本体のみ)
const CACHE = 'naiso-zumen-v5-beta';
const FILES = ['./', 'index.html', 'css/style.css', 'js/store.js', 'js/catalog.js', 'js/render.js', 'js/solve.js', 'js/detect.js', 'js/check.js', 'js/app.js', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // ネット優先、オフライン時はキャッシュ
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(CACHE).then((ca) => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
