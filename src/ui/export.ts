// Getting graphics out: PNG downloads for every selected size (as separate
// files or one ZIP), the system share sheet, copying the image or its alt text
// to the clipboard, and share links.

import { createZip } from "../core/zip.ts";
import { isoDate, pngName, slug } from "../core/files.ts";
import { byId, copyText, downloadBlob, flashLabel } from "./dom.ts";
import { notify } from "./notices.ts";
import { store } from "./store.ts";
import * as E from "./editor.ts";
import type { Design } from "../core/designs.ts";

const CORS_MSG = "the photo or logo host blocks cross-origin use, so the browser refuses to save the image. Upload the file instead.";

function toBlob(c: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}

const status = () => byId("exportStatus");
const dlBtn = () => byId<HTMLButtonElement>("download");
const quickBtn = () => byId<HTMLButtonElement>("quickDownload");
let busy = false;

export function downloadFormat(): "png" | "zip" {
  const r = document.querySelector<HTMLInputElement>('input[name="dlFormat"]:checked');
  return r && r.value === "zip" ? "zip" : "png";
}

function setFormat(f: "png" | "zip"): void {
  document.querySelectorAll<HTMLInputElement>('input[name="dlFormat"]').forEach((r) => (r.checked = r.value === f));
  updateLabel();
}

function updateLabel(): void {
  const n = E.selectedPresets().length;
  const f = downloadFormat();
  dlBtn().textContent = n === 0 ? "Tick a size to download" : f === "zip" ? "Download " + n + (n === 1 ? " size" : " sizes") + " (ZIP)" : "Download " + n + (n === 1 ? " size" : " sizes") + " (PNG)";
}

// iOS Safari only honours the first of several programmatic downloads, so
// several sizes go out as one ZIP there.
function isIOS(): boolean {
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function setBusy(on: boolean, msg = ""): void {
  busy = on;
  dlBtn().disabled = on;
  quickBtn().disabled = on;
  status().textContent = msg;
}

/** Exports every selected size. zip: true for one ZIP, false for PNGs, null to follow the setting. */
export async function doDownload(zip: boolean | null = null): Promise<void> {
  if (busy) return;
  const sel = E.selectedPresets();
  if (!sel.length) {
    notify("warn", "Tick at least one platform and size under Platforms and sizes.");
    return;
  }
  let asZip = zip != null ? zip : downloadFormat() === "zip";
  if (!asZip && sel.length > 1 && isIOS()) {
    asZip = true;
    notify("info", "Your browser only allows one download at a time, so the sizes come as one ZIP file.");
  }
  // Snapshot once: each size renders to its own canvas from the same state,
  // so edits made while the export runs cannot leak into later files.
  const snap = E.renderOptions(E.buildLayout());
  const type = E.currentTemplate().id;
  const files: Array<{ name: string; data: Uint8Array }> = [];
  setBusy(true, "Preparing " + sel.length + (sel.length === 1 ? " image" : " images") + "\u2026");
  try {
    for (let i = 0; i < sel.length; i++) {
      const p = sel[i];
      const d = E.dims(p);
      status().textContent = "Exporting " + (i + 1) + " of " + sel.length + ": " + p.label;
      let blob: Blob | null;
      try {
        blob = await toBlob(E.renderCanvas(snap, d.w, d.h));
      } catch {
        notify("error", "Could not export " + p.label + ": " + CORS_MSG);
        continue;
      }
      if (!blob) {
        notify("error", "Could not export " + p.label + ".");
        continue;
      }
      const name = pngName(type, p.id, d.w, d.h);
      if (asZip) files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
      else {
        downloadBlob(blob, name);
        // A short gap between files stops browsers dropping downloads.
        if (i < sel.length - 1) await new Promise((r) => setTimeout(r, 350));
      }
    }
    if (asZip && files.length) {
      const title = E.buildLayout().title || type;
      downloadBlob(new Blob([createZip(files) as BlobPart], { type: "application/zip" }), "camra-" + slug(title) + "-" + isoDate() + ".zip");
    }
    const done = asZip ? files.length : sel.length;
    setBusy(false, done ? "Done: " + done + (done === 1 ? " image" : " images") + (asZip ? " in one ZIP." : ".") : "");
    window.setTimeout(() => {
      if (!busy) status().textContent = "";
    }, 6000);
  } catch (e) {
    setBusy(false, "");
    notify("error", "Export failed: " + (e instanceof Error ? e.message : String(e)));
  }
}

async function currentBlob(): Promise<{ blob: Blob; name: string } | null> {
  const p = E.activePreset();
  const d = E.dims(p);
  try {
    const blob = await toBlob(E.renderCanvas(E.renderOptions(E.buildLayout()), d.w, d.h));
    return blob ? { blob, name: pngName(E.currentTemplate().id, p.id, d.w, d.h) } : null;
  } catch {
    notify("error", "Could not prepare the image: " + CORS_MSG);
    return null;
  }
}

// Shares the current preview as a PNG through the device share sheet, so on a
// phone a graphic can go straight into another app without a download round
// trip. The button only appears where the Web Share API supports files.
async function doShare(): Promise<void> {
  const r = await currentBlob();
  if (!r) return;
  const file = new File([r.blob], r.name, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], text: E.currentAltText() }).catch(() => undefined);
  } else {
    notify("warn", "Sharing files is not supported in this browser. Use Download instead.");
  }
}

// --- a saved post, without opening it ---

/**
 * Renders a saved post through the form, runs fn, then puts the user's own
 * form back exactly as it was. Used by the calendar's Download and Share.
 */
async function withRecord<T>(d: Design, fn: () => Promise<T>): Promise<T> {
  const saved = E.captureForm();
  const keep = { design: E.state.currentDesignId, post: E.state.currentPostId, dirty: E.state.dirty, local: E.state.localCopies };
  try {
    await E.restoreForm({ params: d.params, photo: d.photo || null, logo: d.logo || null });
    return await fn();
  } finally {
    await E.restoreForm(saved);
    E.state.currentDesignId = keep.design;
    E.state.currentPostId = keep.post;
    E.state.dirty = keep.dirty;
    E.state.localCopies = keep.local;
  }
}

/** Downloads every size of a saved post, as the Download button would for it. */
export async function downloadRecord(d: Design): Promise<void> {
  await withRecord(d, () => doDownload());
}

/**
 * Shares a saved post through the device's share sheet: the image with its
 * post text. Where files cannot be shared, the image downloads and the text
 * is copied instead.
 */
export async function shareRecord(d: Design): Promise<void> {
  const copy = new URLSearchParams(d.params).get("copy") || "";
  const r = await withRecord(d, async () => {
    const b = await currentBlob();
    return b ? { ...b, alt: E.currentAltText() } : null;
  });
  if (!r) return;
  const file = new File([r.blob], r.name, { type: "image/png" });
  const data: ShareData = { files: [file], title: d.name, text: copy || r.alt };
  let canFiles = false;
  try {
    canFiles = !!(navigator.canShare && navigator.canShare(data));
  } catch {
    canFiles = false;
  }
  if (canFiles) {
    try {
      await navigator.share(data);
    } catch (e) {
      // Preparing the image can outlast the tap that asked for it; offer a fresh one.
      if (e instanceof DOMException && e.name === "NotAllowedError") {
        notify("info", d.name + " is ready to share.", { action: { label: "Share now", run: () => void navigator.share(data).catch(() => undefined) } });
      }
    }
    return;
  }
  downloadBlob(r.blob, r.name);
  const copied = copy ? await copyText(copy) : false;
  notify("info", "This browser cannot share images, so " + d.name + " downloaded instead" + (copied ? " and its post text is copied, ready to paste." : "."));
}

async function doCopyImage(btn: HTMLElement): Promise<void> {
  try {
    // Passing a promise keeps Safari's user-gesture requirement satisfied.
    const item = new ClipboardItem({ "image/png": currentBlob().then((r) => (r ? r.blob : Promise.reject(new Error("no image")))) });
    await navigator.clipboard.write([item]);
    flashLabel(btn, "Copied");
  } catch {
    notify("warn", "This browser would not copy the image. Use Download instead.");
  }
}

export function initExport(): void {
  const prefs = store.getPrefs();
  setFormat(prefs.downloadFormat === "zip" ? "zip" : "png");
  document.querySelectorAll<HTMLInputElement>('input[name="dlFormat"]').forEach((r) =>
    r.addEventListener("change", () => {
      store.setPref("downloadFormat", downloadFormat());
      updateLabel();
    }),
  );
  E.onRedraw(updateLabel);
  dlBtn().addEventListener("click", () => doDownload());
  quickBtn().addEventListener("click", () => doDownload());

  const share = byId<HTMLButtonElement>("shareImage");
  let canShareFiles = false;
  try {
    canShareFiles = !!(navigator.canShare && window.File && navigator.canShare({ files: [new File(["x"], "t.png", { type: "image/png" })] }));
  } catch {
    canShareFiles = false;
  }
  if (canShareFiles) {
    share.classList.remove("hidden");
    share.addEventListener("click", doShare);
  }
  const copyImg = byId<HTMLButtonElement>("copyImage");
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard && "write" in navigator.clipboard) {
    copyImg.classList.remove("hidden");
    copyImg.addEventListener("click", () => doCopyImage(copyImg));
  }
  const copyAlt = byId<HTMLButtonElement>("copyAlt");
  copyAlt.addEventListener("click", async () => {
    if (await copyText(E.currentAltText())) flashLabel(copyAlt, "Copied");
  });
  const link = byId<HTMLButtonElement>("copyLink");
  link.addEventListener("click", async () => {
    if (await copyText(E.shareLink({ download: false }))) flashLabel(link, "Copied");
  });
  const dl = byId<HTMLButtonElement>("copyDownloadLink");
  dl.addEventListener("click", async () => {
    if (await copyText(E.shareLink({ download: true }))) flashLabel(dl, "Copied");
  });
}
