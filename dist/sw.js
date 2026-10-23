/* Service worker do Serra Safe: deixa o app e os dados abrirem sem internet.
   Os blocos de mapa ficam em outro cache (serrasafe-tiles-v1), gerenciado pelo app. */
const SHELL = 'serrasafe-shell-v3';
const FILES = ['./', './index.html', './app.js', './manifest.webmanifest', './icon.svg', './data/dados.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('serrasafe-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.endsWith('/data/dados.json')) { e.respondWith(netFirst(r)); return; }
  e.respondWith(cacheFirst(r));
});
async function netFirst(r) {
  try {
    const res = await fetch(r);
    if (res.ok) { const c = await caches.open(SHELL); c.put(r, res.clone()); }
    return res;
  } catch (err) {
    const m = await caches.match(r, { ignoreSearch: true });
    if (m) return m;
    throw err;
  }
}
async function cacheFirst(r) {
  const m = await caches.match(r, { ignoreSearch: true });
  if (m) { refresh(r); return m; }
  try { return await fetch(r); }
  catch (err) {
    if (r.mode === 'navigate') { const i = await caches.match('./index.html'); if (i) return i; }
    throw err;
  }
}
function refresh(r) {
  const u = new URL(r.url);
  if (!FILES.some(f => new URL(f, location.href).pathname === u.pathname)) return;
  fetch(r).then(async res => { if (res.ok) { const c = await caches.open(SHELL); c.put(r, res); } }).catch(() => { });
}
