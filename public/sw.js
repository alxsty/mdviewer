const APP_VERSION = '3.1.0-alpha.3';
const CACHE_VERSION = `md-viewer-v${APP_VERSION}`;
const APP_SHELL = [
  './index.html',
  './manifest.webmanifest',
  './icons/favicon.ico',
  './icons/favicon-dev.ico',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/icon-dev-192.png',
  './icons/icon-dev-256.png',
  './icons/icon-dev-384.png',
  './icons/icon-dev-512.png',
  './icons/icon-dev-maskable-192.png',
  './icons/icon-dev-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ type: 'VERSION', version: APP_VERSION });
    return;
  }

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function shouldBypassNestedDevScope(requestUrl) {
  const scopeUrl = new URL(self.registration.scope);
  const stableScopePath = scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;
  const devScopePath = `${stableScopePath}dev/`;
  const isStableRootScope = stableScopePath.endsWith('/mdviewer/');

  return isStableRootScope && requestUrl.pathname.startsWith(devScopePath);
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      await cache.put('./index.html', response.clone());
    }
    return response;
  } catch (error) {
    const cachedIndex = await cache.match('./index.html');
    if (cachedIndex) {
      return cachedIndex;
    }
    throw error;
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (!isSameOrigin) {
    return;
  }

  if (shouldBypassNestedDevScope(requestUrl)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(cacheFirstAsset(request));
});
