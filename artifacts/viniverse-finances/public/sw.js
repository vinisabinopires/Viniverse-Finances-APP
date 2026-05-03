// Viniverse – Finances Service Worker
// Simple cache-shell strategy for offline support.

const CACHE_NAME = 'viniverse-v1.9.0';
const SHELL_URLS = ['/'];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  // Skip waiting so the new SW activates immediately
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache or network ───────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Skip Vite HMR, dev server, and websocket paths
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules')) return;

  // Navigation requests: network-first, fallback to cached shell
  // This ensures users always get updated HTML when online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Update the cache with the fresh response
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r ?? fetch(event.request)))
    );
    return;
  }

  // Static assets (JS/CSS/fonts with content-hash): cache-first
  // Vite generates hashed filenames so stale cache is safe.
  const isHashedAsset = /\.[0-9a-f]{8,}\.(js|css|woff2?)$/i.test(url.pathname);
  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(event.request, res.clone()));
          }
          return res;
        });
      })
    );
    return;
  }

  // All other requests: network-first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.status === 200) {
          caches.open(CACHE_NAME).then((c) => c.put(event.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
