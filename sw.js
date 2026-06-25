// ─── Next Flight · Service Worker ────────────────────────────────────
const CACHE   = 'next-flight-v1';
const ASSETS  = [
  './',
  './index.html',
  './manifest.json',
];

// Instalar: cachear assets estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activar: borrar caches antiguas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first para el Worker, cache-first para assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Llamadas al Cloudflare Worker → siempre network
  if (url.hostname.endsWith('workers.dev') || url.hostname.endsWith('worker.dev')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Assets estáticos → cache first, fallback network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
