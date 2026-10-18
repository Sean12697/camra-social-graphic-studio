// Small DOM helpers.

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error("Missing element #" + id);
  return e as T;
}

export function option(value: string, label: string): HTMLOptionElement {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  return o;
}

type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

/** Creates an element. Attributes starting with "on" become listeners; text is never parsed as HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Array<Node | string | null | undefined | false>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") e.className = String(v);
    else if (k === "text") e.textContent = String(v);
    else if (v === true) e.setAttribute(k, "");
    else e.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    e.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}

export function prefersReducedMotion(): boolean {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

/** Scrolls an element into view, instantly when the user prefers reduced motion. */
export function reveal(e: Element, block: ScrollLogicalPosition = "nearest"): void {
  e.scrollIntoView({ block, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export function formatBytes(n: number): string {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
  return (n / 1024 / 1024 / 1024).toFixed(1) + " GB";
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const s = Math.round((now.getTime() - t) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return m + (m === 1 ? " minute ago" : " minutes ago");
  const hr = Math.round(m / 60);
  if (hr < 24) return hr + (hr === 1 ? " hour ago" : " hours ago");
  const d = Math.round(hr / 24);
  if (d < 7) return d + (d === 1 ? " day ago" : " days ago");
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the prompt */
  }
  window.prompt("Copy this text", text);
  return false;
}

/** Briefly swaps a button's label, for "Copied" style feedback. */
export function flashLabel(btn: HTMLElement, msg: string): void {
  const original = btn.dataset.label || btn.textContent || "";
  btn.dataset.label = original;
  btn.textContent = msg;
  window.setTimeout(() => {
    btn.textContent = original;
  }, 1500);
}

export function downloadBlob(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.download = name;
  a.href = URL.createObjectURL(blob);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export function readFileBytes(file: File): Promise<Uint8Array> {
  return file.arrayBuffer().then((b) => new Uint8Array(b));
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}
