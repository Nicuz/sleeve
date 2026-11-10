const VERSION = 'v2';
const SHELL_CACHE = `sleeve-shell-${VERSION}`;
const RUNTIME_CACHE = `sleeve-runtime-${VERSION}`;
const API_CACHE = `sleeve-api-${VERSION}`;
const COVER_CACHE = `sleeve-covers-${VERSION}`;
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];
const PRECACHE_API = [
  '/api/releases',
  '/api/stats',
  '/api/meta',
  '/api/wishlist',
  '/api/stats/spending',
];

async function precache() {
  const shell = await caches.open(SHELL_CACHE);
  await shell.addAll(SHELL_ASSETS);

  try {
    const response = await fetch('/index.html');
    const html = await response.text();
    const assets = [
      ...new Set(
        [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(
          (match) => match[1],
        ),
      ),
    ];
    if (assets.length) {
      const runtime = await caches.open(RUNTIME_CACHE);
      await runtime.addAll(assets);
    }
  } catch {
    // The app still works online if asset precaching fails.
  }

  const api = await caches.open(API_CACHE);
  await Promise.all(
    PRECACHE_API.map((url) => api.add(url).catch(() => undefined)),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([
    SHELL_CACHE,
    RUNTIME_CACHE,
    API_CACHE,
    COVER_CACHE,
  ]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName, fallbackRequest) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackRequest) {
      const fallback = await cache.match(fallbackRequest);
      if (fallback) return fallback;
    }
    throw new Error('Offline and no cached response.');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

function isCacheableApi(pathname) {
  return (
    pathname === '/api/releases' ||
    pathname.startsWith('/api/releases/') ||
    pathname === '/api/stats' ||
    pathname === '/api/stats/spending' ||
    pathname === '/api/meta' ||
    pathname === '/api/wishlist' ||
    pathname === '/api/discover'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, SHELL_CACHE, '/index.html').catch(
        () => caches.match('/index.html'),
      ),
    );
    return;
  }

  if (url.pathname.startsWith('/api/cover')) {
    event.respondWith(
      cacheFirst(request, COVER_CACHE).catch(
        () => new Response('', { status: 504 }),
      ),
    );
    return;
  }

  if (isCacheableApi(url.pathname)) {
    event.respondWith(
      networkFirst(request, API_CACHE).catch(
        () =>
          new Response(
            JSON.stringify({ message: 'Offline and no cached data available.' }),
            {
              status: 503,
              headers: { 'content-type': 'application/json' },
            },
          ),
      ),
    );
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      cacheFirst(request, RUNTIME_CACHE).catch(
        () => new Response('', { status: 504 }),
      ),
    );
  }
});
