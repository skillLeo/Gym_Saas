/**
 * My EXtreme Trainer — service worker (§2.3)
 *
 * Scope is deliberately narrow:
 *   - Precache the offline fallback and the app icons.
 *   - Cache-first for immutable build assets (/_next/static/**), which are
 *     content-hashed and therefore safe to keep forever.
 *   - Network-first for navigations, falling back to the offline page.
 *   - API requests are NEVER cached. This app serves per-user health data
 *     behind a bearer token; writing those responses to the Cache API would
 *     leave one member's food logs, body stats and messages readable on a
 *     shared device after logout. Offline reads are not worth that.
 *
 * Bump CACHE_VERSION to invalidate everything on the next activation.
 */

const CACHE_VERSION = 'met-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const OFFLINE_URL = '/offline';

const PRECACHE = [
  OFFLINE_URL,
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // Individually so one 404 cannot fail the whole install
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Anything that must never be written to the Cache API. */
function isSensitive(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/auth/') ||
    url.search.includes('token')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GET is cacheable; never interfere with POST/PUT/DELETE.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin (including the API on :8000) is left entirely alone.
  if (url.origin !== self.location.origin) return;

  // Never touch authenticated or API traffic.
  if (isSensitive(url)) return;

  // Immutable, content-hashed build output → cache-first.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Navigations → network-first, fall back to cache, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          return (
            offline ||
            new Response('<h1>Offline</h1>', {
              status: 503,
              headers: { 'Content-Type': 'text/html' },
            })
          );
        })
    );
  }
});

/** Lets the app clear caches on logout so nothing survives a session. */
self.addEventListener('message', (event) => {
  if (event.data === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});
