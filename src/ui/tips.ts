// First-run tips: a short guided walkthrough of the sections marked with
// data-tip. It can be skipped at any point (Escape closes it) and does not show
// again once seen; the Tips button replays it. While it runs, the rest of the
// page is inert and Tab stays inside the tip card.

import { byId } from "./dom.ts";
import { store } from "./store.ts";

let targets: HTMLElement[] = [];
let idx = 0;
let returnFocus: HTMLElement | null = null;

const layer = () => byId("tipLayer");
const background = () => [document.querySelector("header"), document.querySelector("main"), document.querySelector("footer")].filter(Boolean) as HTMLElement[];

function clearActive(): void {
  targets.forEach((e) => e.classList.remove("tip-active"));
}

function visibleTarget(e: HTMLElement): boolean {
  // Skip sections hidden by the current state (for example the campaign toggle),
  // but include ones inside collapsed groups: those are opened when shown.
  for (let n: HTMLElement | null = e; n; n = n.parentElement) {
    if (n.classList.contains("hidden")) return false;
  }
  return true;
}

function show(): void {
  if (idx >= targets.length) return end();
  const target = targets[idx];
  for (let n: HTMLElement | null = target; n; n = n.parentElement) {
    if (n instanceof HTMLDetailsElement && !n.open) n.open = true;
  }
  byId("tipText").textContent = target.getAttribute("data-tip");
  byId("tipCount").textContent = idx + 1 + " of " + targets.length;
  byId("tipNext").textContent = idx === targets.length - 1 ? "Done" : "Next";
  clearActive();
  target.classList.add("tip-active");
  target.scrollIntoView({ block: "center", behavior: "auto" });
  // Keep the card clear of the highlighted section.
  const r = target.getBoundingClientRect();
  byId("tipCard").classList.toggle("top", r.top + r.height / 2 > window.innerHeight * 0.55);
  layer().classList.remove("hidden");
  byId("tipNext").focus();
}

function end(): void {
  clearActive();
  layer().classList.add("hidden");
  background().forEach((b) => b.removeAttribute("inert"));
  store.setTipsSeen(true);
  if (returnFocus) {
    returnFocus.focus();
    returnFocus = null;
  }
}

export function startTips(force: boolean, from?: HTMLElement): void {
  if (!force && store.tipsSeen()) return;
  returnFocus = from || null;
  targets = Array.from(document.querySelectorAll<HTMLElement>("[data-tip]")).filter(visibleTarget);
  idx = 0;
  if (!targets.length) return;
  background().forEach((b) => b.setAttribute("inert", ""));
  show();
}

export function initTips(): void {
  byId("tipNext").addEventListener("click", () => {
    idx++;
    show();
  });
  byId("tipSkip").addEventListener("click", end);
  document.addEventListener("keydown", (e) => {
    if (layer().classList.contains("hidden")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      end();
    } else if (e.key === "Tab") {
      // Keep focus inside the card.
      const skip = byId("tipSkip");
      const next = byId("tipNext");
      if (e.shiftKey && document.activeElement === skip) {
        e.preventDefault();
        next.focus();
      } else if (!e.shiftKey && document.activeElement === next) {
        e.preventDefault();
        skip.focus();
      }
    }
  });
  const help = byId("helpBtn");
  help.addEventListener("click", () => startTips(true, help));
}
