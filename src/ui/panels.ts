// The page frame: a header pinned to the top (compact once the page scrolls,
// so the options stay in reach without eating the screen) and, on desktop,
// side panels whose widths can be dragged or set from the keyboard. Widths
// are remembered on this device.

import { byId } from "./dom.ts";
import { store } from "./store.ts";

interface PanelSpec {
  /** CSS variable holding the width. */
  cssVar: string;
  /** Key in the panels preference. */
  key: "controls" | "reframe";
  min: number;
  max: number;
  def: number;
  /** +1 when dragging right widens the panel (it sits on the left), -1 otherwise. */
  dir: 1 | -1;
}

export const PANELS: Record<string, PanelSpec> = {
  splitControls: { cssVar: "--controls-w", key: "controls", min: 320, max: 720, def: 440, dir: 1 },
  splitReframe: { cssVar: "--reframe-w", key: "reframe", min: 280, max: 560, def: 380, dir: -1 },
};

type Widths = Partial<Record<PanelSpec["key"], number>>;

function saved(): Widths {
  const p = store.getPrefs().panels;
  return p && typeof p === "object" ? (p as Widths) : {};
}

function clamp(spec: PanelSpec, w: number): number {
  // Leave the preview at least 320px between the panels.
  const room = Math.max(spec.min, window.innerWidth - 320 - 120 - (spec.key === "controls" ? currentWidth(PANELS.splitReframe) : currentWidth(PANELS.splitControls)));
  return Math.round(Math.min(Math.max(w, spec.min), Math.min(spec.max, room)));
}

function currentWidth(spec: PanelSpec): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(spec.cssVar));
  return Number.isFinite(v) ? v : spec.def;
}

function apply(spec: PanelSpec, w: number, sep: HTMLElement | null): void {
  document.documentElement.style.setProperty(spec.cssVar, w + "px");
  if (sep) {
    sep.setAttribute("aria-valuenow", String(w));
    sep.setAttribute("aria-valuetext", w + " pixels wide");
  }
}

function persist(spec: PanelSpec, w: number | null): void {
  const next = { ...saved() };
  if (w == null || w === spec.def) delete next[spec.key];
  else next[spec.key] = w;
  store.setPref("panels", Object.keys(next).length ? next : undefined);
}

/** Puts both panels back to their default widths. */
export function resetPanels(): void {
  Object.entries(PANELS).forEach(([id, spec]) => apply(spec, spec.def, document.getElementById(id)));
  store.setPref("panels", undefined);
}

export function panelsCustomised(): boolean {
  return Object.keys(saved()).length > 0;
}

function wireSplitter(id: string, spec: PanelSpec): void {
  const sep = byId(id);
  sep.setAttribute("aria-valuemin", String(spec.min));
  sep.setAttribute("aria-valuemax", String(spec.max));
  const w0 = saved()[spec.key];
  apply(spec, typeof w0 === "number" ? Math.min(Math.max(w0, spec.min), spec.max) : spec.def, sep);

  let startX = 0;
  let startW = 0;
  const move = (e: PointerEvent) => apply(spec, clamp(spec, startW + spec.dir * (e.clientX - startX)), sep);
  const up = (e: PointerEvent) => {
    sep.releasePointerCapture(e.pointerId);
    sep.removeEventListener("pointermove", move);
    sep.removeEventListener("pointerup", up);
    sep.removeEventListener("pointercancel", up);
    document.documentElement.classList.remove("resizing");
    persist(spec, currentWidth(spec));
  };
  sep.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startX = e.clientX;
    startW = currentWidth(spec);
    sep.setPointerCapture(e.pointerId);
    document.documentElement.classList.add("resizing");
    sep.addEventListener("pointermove", move);
    sep.addEventListener("pointerup", up);
    sep.addEventListener("pointercancel", up);
  });
  sep.addEventListener("dblclick", () => {
    apply(spec, spec.def, sep);
    persist(spec, null);
  });
  sep.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 64 : 16;
    // Arrow keys move the divider, so for the right-hand panel left widens it.
    const by: Record<string, number> = { ArrowLeft: -step * spec.dir, ArrowRight: step * spec.dir };
    let w: number | null = null;
    if (e.key in by) w = currentWidth(spec) + by[e.key];
    else if (e.key === "Home") w = spec.min;
    else if (e.key === "End") w = spec.max;
    else if (e.key === "Enter") w = spec.def;
    if (w == null) return;
    e.preventDefault();
    w = clamp(spec, w);
    apply(spec, w, sep);
    persist(spec, w);
  });
}

/** Keeps --hdr equal to the header's height, and compacts it once the page scrolls. */
function wireHeader(): void {
  const bar = byId("topbar");
  const root = document.documentElement;
  const set = () => root.style.setProperty("--hdr", Math.ceil(bar.getBoundingClientRect().height) + "px");
  set();
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(set).observe(bar);
  else window.addEventListener("resize", set);
  // Two thresholds, so the header shrinking cannot flip it straight back.
  let compact = false;
  const onScroll = () => {
    const y = window.scrollY;
    const next = compact ? y > 4 : y > 64;
    if (next !== compact) {
      compact = next;
      root.classList.toggle("scrolled", compact);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

export function initPanels(): void {
  wireHeader();
  Object.entries(PANELS).forEach(([id, spec]) => wireSplitter(id, spec));
}
