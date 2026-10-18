// Registers the service worker for offline use and install, and offers a
// reload when a newer version has taken over.

import { notify } from "./notices.ts";

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => undefined);
  let shown = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || shown) return;
    shown = true;
    notify("info", "A new version of the studio is ready.", { action: { label: "Reload", run: () => location.reload() }, timeout: 0 });
  });
}
