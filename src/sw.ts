/// <reference lib="webworker" />
// Service worker. The build injects the list of app files (with content hashes
// in their names) and a cache name unique to each build, so every release gets
// a fresh cache and old ones are removed on activation.
// Strategy: hashed files are cache-first (their names change whenever their
// content does); everything else is network-first with the cache as the
// offline fallback, so anyone online always gets the latest version.

declare const __PRECACHE__: string[];
declare const __CACHE__: string;

export {};
const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = __CACHE__;
const PRECACHE = __PRECACHE__;
const HASHED = /\/app\/[^/]+-[A-Z0-9]{8}\.(js|css)$/i;

sw.addEventListener("install", (e) => {
  sw.skipWaiting();
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => undefined),
  );
});

sw.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith("camra-graphics-")).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only handle our own files. Remote photos and logos are left to the network
  // so cross-origin canvas exports keep working.
  if (url.origin !== location.origin) return;
  // Share links vary only by query string, so navigations are cached once under
  // index.html rather than one entry per link.
  const isNav = req.mode === "navigate";
  if (HASHED.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(isNav ? "index.html" : req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: isNav }).then((cached) => {
          if (cached) return cached;
          if (isNav) return caches.match("index.html").then((r) => r || Response.error());
          return Response.error();
        }),
      ),
  );
});
