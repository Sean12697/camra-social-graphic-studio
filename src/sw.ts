/// <reference lib="webworker" />
// Service worker. The build injects the list of app files (with content hashes
// in their names) and a cache name unique to each build, so every release gets
// a fresh cache and old ones are removed on activation.
// Strategy: hashed files are cache-first (their names change whenever their
// content does); everything else is network-first with the cache as the
// offline fallback, so anyone online always gets the latest version.

declare const __PRECACHE__: string[];
declare const __CACHE__: string;

import { CAMPAIGNS, dueAlerts, localYmd, normalisePrefs, normaliseState, pruneState } from "./core/campaigns.ts";
import { kvGet, kvPut, openIdb } from "./ui/idb.ts";

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

// Background campaign reminders. Installed Chrome and Edge apps wake the
// worker now and then (periodic background sync); it works out which
// reminders are due from the bundled campaign list and the settings the page
// saved, and shows each one once. Nothing is fetched.
async function campaignCheck(): Promise<void> {
  const db = await openIdb();
  const rec = await kvGet<{ state?: unknown; prefs?: unknown }>(db, "campaignState");
  const prefs = normalisePrefs(rec && rec.prefs);
  if (!prefs.enabled || !prefs.system || Notification.permission !== "granted") return;
  const today = localYmd(new Date());
  const state = normaliseState(rec && rec.state);
  const fresh = dueAlerts(CAMPAIGNS, today, prefs, state).filter((a) => !state.notified[a.key]);
  if (!fresh.length) return;
  for (const a of fresh) {
    await sw.registration.showNotification(a.title, { body: a.body, tag: a.key, icon: "assets/icons/icon-192.png", data: { url: "./?campaign=" + a.entry.occ.campaign.id } });
    state.notified[a.key] = true;
  }
  await kvPut(db, "campaignState", { state: pruneState(state, today), prefs });
}

sw.addEventListener("periodicsync", (e: Event) => {
  const ev = e as ExtendableEvent & { tag?: string };
  if (ev.tag === "campaign-reminders") ev.waitUntil(campaignCheck().catch(() => undefined));
});

// Tapping a reminder opens (or focuses) the studio at that campaign.
sw.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const data = e.notification.data as { url?: string } | null;
  const target = new URL((data && data.url) || "./", sw.registration.scope).href;
  e.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.split(/[?#]/)[0] === target.split(/[?#]/)[0] && "navigate" in c) {
          return (c as WindowClient).navigate(target).then((w) => (w ? w.focus() : undefined));
        }
      }
      return sw.clients.openWindow(target);
    }),
  );
});
