const CACHE_VERSION = "hxwl09-v1.0.1";
const PRECACHE = "hxwl09-precache-" + CACHE_VERSION;
const RUNTIME_STATIC = "hxwl09-runtime-static-" + CACHE_VERSION;
const RUNTIME_FONT = "hxwl09-runtime-font-" + CACHE_VERSION;
const RUNTIME_IMG = "hxwl09-runtime-img-" + CACHE_VERSION;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
  "/icons/shortcut-record.svg",
  "/icons/shortcut-ticket.svg",
  "/icons/shortcut-plan.svg",
];

const STATIC_EXT = /\.(?:js|css|mjs|wasm|woff2?|ttf|eot)$/i;
const IMG_EXT = /\.(?:png|jpe?g|gif|svg|ico|webp|avif)$/i;
const FONT_RE = /fonts\.(?:googleapis|gstatic)\.com|cdn/i;
const ASSET_RE = /(?:src|href)=["']([^"']*\/assets\/[^"']+\.(?:js|css|mjs))["']/g;

function normalizeSameOriginUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin) return null;
    return url.pathname + url.search;
  } catch (err) {
    return null;
  }
}

async function discoverAppShellAssets() {
  try {
    const response = await fetch("/index.html", { cache: "reload" });
    if (!response || !response.ok) return [];

    const html = await response.text();
    const assets = new Set();
    let match;
    while ((match = ASSET_RE.exec(html)) !== null) {
      const assetUrl = normalizeSameOriginUrl(match[1]);
      if (assetUrl) assets.add(assetUrl);
    }

    return [...assets];
  } catch (err) {
    return [];
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then(async (cache) => {
      const appShellAssets = await discoverAppShellAssets();
      const urls = [...new Set([...PRECACHE_URLS, ...appShellAssets])];
      await cache.addAll(
        urls.map((u) => new Request(u, { cache: "reload" }))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const keep = new Set([PRECACHE, RUNTIME_STATIC, RUNTIME_FONT, RUNTIME_IMG]);
      return Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== "opaque") {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch (err) {
    if (request.mode === "navigate") {
      return caches.match("/index.html") || caches.match("/");
    }
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const networkPromise = fetch(request).then((response) => {
    if (response && response.status === 200 && response.type !== "opaque") {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  }).catch(() => cached);
  return cached || networkPromise;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== "opaque") {
      const clone = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, clone));
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      return caches.match("/index.html") || caches.match("/");
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin && !FONT_RE.test(url.hostname)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PRECACHE));
    return;
  }

  if (FONT_RE.test(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_FONT));
    return;
  }

  if (IMG_EXT.test(url.pathname)) {
    event.respondWith(cacheFirst(request, RUNTIME_IMG));
    return;
  }

  if (STATIC_EXT.test(url.pathname) || url.pathname.startsWith("/src/")) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_STATIC));
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    event.respondWith(networkFirst(request, PRECACHE));
    return;
  }

  if (url.pathname.startsWith("/icons/") ||
      url.pathname.startsWith("/manifest")) {
    event.respondWith(cacheFirst(request, PRECACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_STATIC));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
