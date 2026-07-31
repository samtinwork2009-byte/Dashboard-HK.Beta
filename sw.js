/* ============================================================
   sw.js — Service Worker for Hong Kong City Dashboard
   PWA: offline cache + background sync
   ============================================================ */

const CACHE_NAME = "hk-dashboard-v6";
const STATIC_URLS = [
  "/",
  "/index.html",
  "/css/tokens.css",
  "/css/base.css",
  "/js/core.js",
  "/js/weather.js",
  "/js/transport.js",
  "/js/health.js",
  "/js/environment.js",
  "/js/cctv.js",
  "/js/bus.js",
  "/js/tides.js",
  "/js/parking.js",
  "/js/ferry.js",
  "/js/holidays.js",
  "/js/climate.js",
  "/js/beach.js",
  "/js/map.js",
  "/js/app.js",
  "/manifest.json",
  "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
];

function createCacheRequest(url) {
  try {
    const requestUrl = new URL(url, self.location.origin);
    if (requestUrl.origin !== self.location.origin) {
      return new Request(url, { mode: "cors" });
    }
  } catch (e) {
    // fallback to default string request
  }
  return url;
}

/* ── Install: cache all static assets ───────────────────────── */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return Promise.allSettled(
          STATIC_URLS.map((url) => cache.add(createCacheRequest(url)).catch(() => {})),
        );
      })
      .then(() => self.skipWaiting()),
  );
});

/* ── Activate: clean old caches ─────────────────────────────── */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* ── Fetch: cache-first for static, network-first for API ───── */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and unsupported scheme requests
  if (event.request.method !== "GET") return;
  if (!/^https?:$/.test(url.protocol)) return;

  // API calls: network-first with cache fallback
  const isAPI = [
    "data.weather.gov.hk",
    "rt.data.gov.hk",
    "data.etabus.gov.hk",
    "data.etagmb.gov.hk",
    "api.data.gov.hk",
    "datagovhk.blob.core.windows.net",
    "www.ha.org.hk",
    "api.allorigins.win",
    "tdcctv.data.one.gov.hk",
  ].some((host) => url.hostname.includes(host));

  if (isAPI) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
        .then((cached) =>
          cached ||
          new Response(JSON.stringify({ error: "offline" }), {
            headers: { "Content-Type": "application/json" },
            status: 503,
            statusText: "Service Unavailable",
          }),
        ),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (event.request.destination === "document") {
            return caches.match("/index.html");
          }
          return new Response("Service Unavailable", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    }),
  );
});
