/* ==========================================================
   SpendWise – service-worker.js
   Saves the app's files on the phone so it opens offline.

   How it works:
   1. On the first visit, "install" downloads every file in FILES.
   2. After that, every request is answered from the saved copy
      (instant, works without internet). In the background it
      quietly fetches a fresh copy, so updates appear on the
      NEXT time you open the app.

   Your transactions are NOT stored here. They live in IndexedDB,
   which this file never touches, so updating is always safe.

   To force a full refresh after you change index.html,
   change the number in CACHE_NAME (v1 -> v2).
   ========================================================== */
const CACHE_NAME = 'spendwise-v1';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(request, { ignoreSearch: true }).then(function (saved) {
        const fresh = fetch(request).then(function (response) {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        }).catch(function () { return null; });

        if (saved) {
          event.waitUntil(fresh);   // refresh the saved copy in the background
          return saved;
        }
        return fresh.then(function (response) {
          if (response) return response;
          // Offline and not saved: show the app itself for page loads
          return request.mode === 'navigate' ? cache.match('./index.html') : Response.error();
        });
      });
    })
  );
});
