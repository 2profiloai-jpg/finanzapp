self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Clean up old caches if any
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// A fetch handler is REQUIRED for PWA installability in Chrome.
// We keep it simple: fetch from network directly.
self.addEventListener('fetch', (event) => {
  // No caching logic here to avoid the "white screen" issue on Vercel.
  // This just passes the PWA installability check.
  event.respondWith(fetch(event.request));
});
