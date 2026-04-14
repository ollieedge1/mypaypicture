// MyPayPicture Service Worker
const CACHE_NAME = 'mypaypicture-v1';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/index.html',
  '/pay-optimiser.html',
  '/pension-reclaim.html',
  '/pension-topup.html',
  '/family-benefits.html',
  '/retirement-helper.html',
  '/pay-director.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install — cache all static assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS.map(function(url) {
        return new Request(url, { cache: 'reload' });
      })).catch(function(err) {
        console.log('Cache install error (non-fatal):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first for static assets, network-first for API calls
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Always go to network for API calls (Cloudflare Worker, Tally, Stripe)
  if (
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('tally.so') ||
    url.hostname.includes('stripe.com') ||
    url.hostname.includes('api.anthropic.com')
  ) {
    return; // Let browser handle normally
  }

  // Cache-first for Google Fonts
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          return caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // Network-first for HTML pages (always get latest)
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(function() {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache-first for everything else (icons, scripts etc.)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request);
    })
  );
});
