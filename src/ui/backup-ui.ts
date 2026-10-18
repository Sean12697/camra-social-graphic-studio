// Backup and restore between browsers or devices: export everything or a
// selection to one ZIP, and import a backup with a dry-run preview of what will
// be created, overwritten or skipped before anything is written.

import { applyImport, exportBundle, planImport, readBundle, type BackupData, type ImportMode, type ReadResult } from "../core/bundle.ts";
import { isoDate } from "../core/files.ts";
import type { Design } from "../core/designs.ts";
import { byId, downloadBlob, h, readFileBytes } from "./dom.ts";
import { closeDialog, openDialog } from "./dialog.ts";
import { notify } from "./notices.ts";
import { store, type Prefs } from "./store.ts";
import * as E from "./editor.ts";
import { applyTheme } from "./theme.ts";

declare const __APP_VERSION__: string;

const hooks: Array<() => void> = [];
/** Called after an import changes stored data. */
export function onDataChanged(fn: () => void): void {
  hooks.push(fn);
}
function changed(): void {
  hooks.forEach((fn) => fn());
}

function plural(n: number, one: string, many = one + "s"): string {
  return n + " " + (n === 1 ? one : many);
}

async function save(data: BackupData, selection: string, filename: string): Promise<void> {
  try {
    const zip = await exportBundle(data, { appVersion: __APP_VERSION__, selection });
    downloadBlob(new Blob([zip as BlobPart], { type: "application/zip" }), filename);
    notify("success", "Backup saved: " + [plural(data.designs.length, "design"), plural(data.library.length, "library item")].join(", ") + (data.prefs ? " and your settings" : "") + ".");
  } catch (e) {
    notify("error", "Could not create the backup: " + (e instanceof Error ? e.message : String(e)));
  }
}

export interface ExportChoice {
  designs: boolean;
  trash: boolean;
  library: boolean;
  prefs: boolean;
}

export async function exportAll(c: ExportChoice): Promise<void> {
  const designs = c.designs ? store.getDesigns().filter((d) => c.trash || !d.deletedAt) : [];
  const library = c.library ? store.getLibrary() : [];
  const prefs = c.prefs ? ({ ...store.getPrefs(), customLogo: store.getCustomLogo() || undefined } as Prefs) : null;
  if (!designs.length && !library.length && !prefs) {
    notify("warn", "There is nothing to back up yet. Save a design or a library item first.");
    return;
  }
  const parts = [c.designs && "designs", c.library && "library", c.prefs && "settings"].filter(Boolean).join("+");
  await save({ designs, library, prefs }, parts, "camra-studio-backup-" + isoDate() + ".zip");
}

export async function exportSelection(designs: Design[]): Promise<void> {
  await save({ designs, library: [], prefs: null }, "selected designs (" + designs.length + ")", "camra-studio-designs-" + isoDate() + ".zip");
}

let fileInput: HTMLInputElement | null = null;
export function pickImportFile(): void {
  if (!fileInput) {
    fileInput = h("input", { type: "file", accept: ".zip,.json,application/zip,application/json", class: "sr-only", "aria-hidden": "true", tabindex: "-1" });
    document.body.appendChild(fileInput);
    fileInput.addEventListener("change", async () => {
      const f = fileInput && fileInput.files && fileInput.files[0];
      if (fileInput) fileInput.value = "";
      if (f) await previewImport(f);
    });
  }
  fileInput.click();
}

function existing(): BackupData {
  return { designs: store.getDesigns(), library: store.getLibrary(), prefs: store.getPrefs() };
}

export async function previewImport(file: File): Promise<void> {
  let read: ReadResult;
  try {
    read = await readBundle(await readFileBytes(file));
  } catch (e) {
    notify("error", "Could not import " + file.name + ": " + (e instanceof Error ? e.message : String(e)));
    return;
  }
  showPreview(file.name, read);
}

function showPreview(name: string, read: ReadResult): void {
  const d = byId<HTMLDialogElement>("importDialog");
  const body = byId("importBody");
  const inc = read.data;
  let mode: ImportMode = "merge";
  let withPrefs = false;
  body.innerHTML = "";
  const m = read.manifest;
  body.append(
    h("p", {}, name + (m ? ": made with version " + m.appVersion + " on " + new Date(m.createdAt).toLocaleString() + "." : ".")),
    h("dl", { class: "kv" }, h("dt", {}, "Designs"), h("dd", {}, String(inc.designs.length)), h("dt", {}, "Library items"), h("dd", {}, String(inc.library.length)), h("dt", {}, "Settings"), h("dd", {}, inc.prefs ? "Included" : "Not included")),
  );
  const fs = h("fieldset", { class: "field" }, h("legend", {}, "When an item already exists here"));
  const modes: Array<[ImportMode, string]> = [
    ["merge", "Keep what is here and add only new items (recommended)"],
    ["overwrite", "Replace existing items with the ones in the backup"],
    ["copies", "Import everything as copies, alongside what is here"],
  ];
  modes.forEach(([v, label]) => {
    const r = h("input", { type: "radio", name: "importMode", value: v });
    r.checked = v === mode;
    r.addEventListener("change", () => {
      mode = v;
      updatePlan();
    });
    fs.append(h("label", { class: "check" }, r, " " + label));
  });
  body.append(fs);
  if (inc.prefs) {
    const cb = h("input", { type: "checkbox" });
    cb.addEventListener("change", () => {
      withPrefs = cb.checked;
      updatePlan();
    });
    body.append(h("label", { class: "check" }, cb, " Also replace my settings (theme, default look, last choices) with the backup's"));
  }
  const planEl = h("p", { class: "note", role: "status", "aria-live": "polite" });
  body.append(planEl);
  if (read.warnings.length) {
    body.append(h("div", { class: "brand-note warn" }, h("strong", {}, "Some entries could not be read"), h("span", {}, read.warnings.slice(0, 6).join(" ") + (read.warnings.length > 6 ? " And " + (read.warnings.length - 6) + " more." : ""))));
  }
  const go = h("button", { type: "button", class: "btn primary" }, "Import");
  body.append(h("div", { class: "row-actions" }, h("button", { type: "button", class: "ghost", onclick: () => closeDialog(d) }, "Cancel"), go));
  function updatePlan(): void {
    const p = planImport(existing(), inc, mode, withPrefs);
    const parts = [
      p.designs.create + p.library.create ? "adds " + plural(p.designs.create, "design") + " and " + plural(p.library.create, "library item") : "",
      p.designs.overwrite + p.library.overwrite ? "replaces " + plural(p.designs.overwrite + p.library.overwrite, "existing item") : "",
      p.designs.skip + p.library.skip ? "skips " + plural(p.designs.skip + p.library.skip, "item") + " you already have" : "",
      p.prefs ? "replaces your settings" : "",
    ].filter(Boolean);
    planEl.textContent = parts.length ? "This import " + parts.join(", ") + "." : "Nothing new to import: you already have everything in this backup.";
    go.disabled = !parts.length;
  }
  updatePlan();
  go.addEventListener("click", async () => {
    const before = existing();
    const next = applyImport(before, inc, mode, withPrefs);
    const okD = await store.putDesigns(next.designs.filter((x) => !before.designs.includes(x)));
    const okL = await store.putLibrary(next.library.filter((x) => !before.library.includes(x)));
    if (withPrefs && next.prefs) {
      const { customLogo, ...rest } = next.prefs as Prefs & { customLogo?: string };
      store.replacePrefs(rest);
      if (typeof customLogo === "string") await store.setCustomLogo(customLogo);
      applyTheme((rest as Prefs).theme);
    }
    closeDialog(d);
    if (!okD || !okL) notify("error", "Part of the import could not be saved because this browser's storage is full.");
    else notify("success", "Import complete.");
    E.renderLibrary();
    E.redraw();
    changed();
  });
  openDialog(d, go);
}
