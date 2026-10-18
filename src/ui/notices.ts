// Feedback without alert(). Toasts appear in one persistent live region at the
// bottom of the screen, so they are visible wherever the user is in the form.
// Info and success fade after a few seconds; warnings stay a little longer;
// errors stay until dismissed and are announced assertively. A toast can carry
// one action, such as Undo.

import { h } from "./dom.ts";

export type NoticeKind = "info" | "success" | "warn" | "error";

export interface NoticeOptions {
  action?: { label: string; run: () => void };
  timeout?: number;
}

const DEFAULT_TIMEOUT: Record<NoticeKind, number> = { info: 5000, success: 4000, warn: 8000, error: 0 };

let politeRegion: HTMLElement | null = null;
let alertRegion: HTMLElement | null = null;

export function initNotices(polite: HTMLElement, alert: HTMLElement): void {
  politeRegion = polite;
  alertRegion = alert;
}

export function notify(kind: NoticeKind, msg: string, opts: NoticeOptions = {}): () => void {
  const region = kind === "error" ? alertRegion : politeRegion;
  if (!region) return () => undefined;
  const n = h("div", { class: "notice " + kind });
  const close = () => n.remove();
  n.append(h("span", { class: "notice-text" }, msg));
  if (opts.action) {
    const act = opts.action;
    n.append(
      h("button", { type: "button", class: "notice-action", onclick: () => { close(); act.run(); } }, act.label),
    );
  }
  n.append(h("button", { type: "button", class: "notice-close", "aria-label": "Dismiss", onclick: close }, "\u00d7"));
  region.append(n);
  const timeout = opts.timeout != null ? opts.timeout : opts.action ? 10000 : DEFAULT_TIMEOUT[kind];
  if (timeout > 0) {
    let timer = window.setTimeout(close, timeout);
    // Pause while the pointer or focus is on the toast so it never vanishes mid-read.
    n.addEventListener("mouseenter", () => window.clearTimeout(timer));
    n.addEventListener("focusin", () => window.clearTimeout(timer));
    n.addEventListener("mouseleave", () => { timer = window.setTimeout(close, timeout / 2); });
  }
  return close;
}
