// Service worker de Impostor 3D: arranque rápido y app instalable.
// - Página, scripts y ajustes: primero la red (siempre la última versión) y, sin conexión, la copia guardada.
// - three.js, Socket.IO, caras e iconos: la copia guardada al instante y se refresca en segundo plano.
// Nunca toca el tráfico del juego (Socket.IO) ni otros dominios.
const VERSION = '__BUILD__';
const CACHE = 'i3d-' + VERSION;
const SHELL = ['./', 'index.html', 'config.js', 'shared.js', 'sfx.js', 'friends.js', 'tasks.js', 'three.min.js', 'vendor/socket.io.min.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'fonts/chakra-petch-latin-700-normal.woff2', 'fonts/chakra-petch-latin-700-italic.woff2', 'fonts/chakra-petch-latin-600-normal.woff2', 'fonts/inter-latin-wght-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('i3d-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const STATIC = /\/(three\.min\.js|vendor\/[^/]+|faces\/[^/]+|fonts\/[^/]+|icon-\d+\.png|og-image\.png)$/;
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/socket.io') || url.pathname === '/health') return;
  if (STATIC.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    }));
    return;
  }
  e.respondWith(fetch(req).then(r => {
    if (r.ok && (req.mode === 'navigate' || /\.(js|webmanifest)$/.test(url.pathname))) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? 'index.html' : req, cp)); }
    return r;
  }).catch(async () => (await caches.match(req.mode === 'navigate' ? 'index.html' : req)) || (await caches.match(req, { ignoreSearch: true })) || Response.error()));
});
