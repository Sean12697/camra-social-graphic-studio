// The Saved designs panel: save the current post, then search, sort, filter,
// open, rename, duplicate, export and delete saved designs. Deleting moves a
// design to Recently deleted, where it can be restored for TRASH_DAYS days.

import { TEMPLATES, templateById } from "../core/templates.ts";
import { defaultDesignName, duplicateDesign, newId, purgeExpired, queryDesigns, TRASH_DAYS, type Design, type DesignSort } from "../core/designs.ts";
import { cleanDesign } from "../core/bundle.ts";
import { byId, h, option, relativeTime } from "./dom.ts";
import { closeDialog, confirmDialog, openDialog, promptDialog } from "./dialog.ts";
import { notify } from "./notices.ts";
import { store } from "./store.ts";
import * as E from "./editor.ts";
import { exportSelection, pickImportFile } from "./backup-ui.ts";
import demoSeed from "../../seeds/demo.json";

const dlg = () => byId<HTMLDialogElement>("designsDialog");
const view = { q: "", type: "", sort: "updated" as DesignSort, trash: false, selected: new Set<string>() };

function typeLabel(id: string): string {
  const t = templateById(id);
  return t ? t.label.replace(/\s*\(.*\)$/, "") : "Post";
}

/** Saves the current form, as a new design or over the one it was opened from. */
export async function saveCurrent(): Promise<void> {
  const layout = E.buildLayout();
  const current = E.state.currentDesignId ? store.getDesign(E.state.currentDesignId) : undefined;
  const suggested = current && !current.deletedAt ? current.name : defaultDesignName(layout.title, E.currentTemplate().label);
  const res = await promptDialog(
    current && !current.deletedAt
      ? { title: "Save design", label: "Design name", value: suggested, confirmLabel: "Update this design", secondaryLabel: "Save as a new design" }
      : { title: "Save design", label: "Design name", value: suggested, confirmLabel: "Save design" },
  );
  if (!res) return;
  const snap = E.captureForm();
  const now = new Date().toISOString();
  const update = !!(current && !current.deletedAt && !res.secondary);
  const d: Design = {
    id: update && current ? current.id : newId("dsn"),
    name: res.value,
    typeId: E.currentTemplate().id,
    params: snap.params,
    photo: snap.photo,
    logo: snap.logo,
    thumb: E.thumbnail(),
    createdAt: update && current ? current.createdAt : now,
    updatedAt: now,
    deletedAt: null,
  };
  if (!(await store.putDesigns([d]))) {
    notify("error", "Could not save: this browser's storage is full. Delete some saved designs or library items (Settings shows how much is used), then try again.");
    return;
  }
  E.state.currentDesignId = d.id;
  E.state.dirty = false;
  notify("success", (update ? "Updated " : "Saved ") + d.name + ".", { action: { label: "View designs", run: openDesigns } });
  if (dlg().open) render();
}

export async function confirmReplace(): Promise<boolean> {
  if (!E.state.dirty) return true;
  return confirmDialog({
    title: "Replace the current post?",
    body: "You have changes that are not saved as a design. Opening another design replaces them.",
    confirmLabel: "Replace it",
    danger: true,
  });
}

async function openDesign(d: Design): Promise<void> {
  if (!(await confirmReplace())) return;
  await E.restoreForm({ params: d.params, photo: d.photo || null, logo: d.logo || null });
  E.state.currentDesignId = d.sample ? null : d.id;
  E.state.dirty = false;
  closeDialog(dlg());
  notify("info", "Opened " + d.name + ".");
}

export async function newPost(): Promise<void> {
  if (!(await confirmReplace())) return;
  E.resetForm({ personal: true });
  await E.loadAssets();
  E.redrawNow();
  closeDialog(dlg());
  notify("info", "Started a new post with your default look.");
}

async function rename(d: Design): Promise<void> {
  const res = await promptDialog({ title: "Rename design", label: "Design name", value: d.name, confirmLabel: "Rename" });
  if (!res || res.value === d.name) return;
  await store.putDesigns([{ ...d, name: res.value, updatedAt: new Date().toISOString() }]);
  render();
}

async function duplicate(d: Design): Promise<void> {
  const copy = duplicateDesign(d, store.getDesigns());
  if (!(await store.putDesigns([copy]))) return void notify("error", "Could not duplicate: this browser's storage is full.");
  notify("success", "Duplicated as " + copy.name + ".");
  render();
}

async function moveToTrash(items: Design[]): Promise<void> {
  if (!items.length) return;
  const now = new Date().toISOString();
  const before = items.map((d) => ({ ...d }));
  await store.putDesigns(items.map((d) => ({ ...d, deletedAt: now })));
  items.forEach((d) => view.selected.delete(d.id));
  if (items.some((d) => d.id === E.state.currentDesignId)) E.state.currentDesignId = null;
  render();
  const what = items.length === 1 ? items[0].name : items.length + " designs";
  notify("info", "Moved " + what + " to Recently deleted.", {
    action: {
      label: "Undo",
      run: async () => {
        await store.putDesigns(before);
        render();
      },
    },
  });
}

async function restore(items: Design[]): Promise<void> {
  await store.putDesigns(items.map((d) => ({ ...d, deletedAt: null })));
  items.forEach((d) => view.selected.delete(d.id));
  notify("success", items.length === 1 ? "Restored " + items[0].name + "." : "Restored " + items.length + " designs.");
  render();
}

async function purge(items: Design[]): Promise<void> {
  if (!items.length) return;
  const what = items.length === 1 ? '"' + items[0].name + '"' : items.length + " designs";
  const ok = await confirmDialog({
    title: "Delete permanently?",
    body: "This permanently deletes " + what + " from this browser, including any photos saved with them. It cannot be undone.",
    confirmLabel: "Delete permanently",
    danger: true,
  });
  if (!ok) return;
  await store.removeDesigns(items.map((d) => d.id));
  items.forEach((d) => view.selected.delete(d.id));
  notify("info", "Deleted " + what + " permanently.");
  render();
}

/** Adds the bundled sample designs, rendering a thumbnail for each. */
export async function loadSamples(): Promise<void> {
  const existing = new Set(store.getDesigns().map((d) => d.id));
  const samples: Design[] = [];
  ((demoSeed as { designs: unknown[] }).designs || []).forEach((raw) => {
    const d = cleanDesign(raw);
    if (typeof d !== "string" && !existing.has(d.id)) samples.push({ ...d, sample: true });
  });
  if (!samples.length) {
    notify("info", "The sample designs are already in your list.");
    return;
  }
  // Render each sample through the real form to get an accurate thumbnail,
  // then put the user's own form back exactly as it was.
  const saved = E.captureForm();
  const savedId = E.state.currentDesignId;
  const savedDirty = E.state.dirty;
  for (const d of samples) {
    await E.restoreForm({ params: d.params, photo: null, logo: null });
    d.thumb = E.thumbnail();
  }
  await E.restoreForm(saved);
  E.state.currentDesignId = savedId;
  E.state.dirty = savedDirty;
  await store.putDesigns(samples);
  notify("success", "Added " + samples.length + " sample designs. They are marked Sample; open one to see how it is built.");
  render();
}

function designCard(d: Design): HTMLElement {
  const cb = h("input", { type: "checkbox", id: "sel-" + d.id, "aria-label": "Select " + d.name });
  cb.checked = view.selected.has(d.id);
  cb.addEventListener("change", () => {
    if (cb.checked) view.selected.add(d.id);
    else view.selected.delete(d.id);
    render();
  });
  const thumb = d.thumb ? h("img", { src: d.thumb, alt: "", width: 72, height: 72, loading: "lazy" }) : h("span", { class: "thumb-ph", "aria-hidden": "true" });
  const when = view.trash && d.deletedAt ? "Deleted " + relativeTime(d.deletedAt) : "Updated " + relativeTime(d.updatedAt);
  const actions = view.trash
    ? [
        h("button", { type: "button", class: "btn", onclick: () => restore([d]) }, "Restore"),
        h("button", { type: "button", class: "ghost", onclick: () => purge([d]) }, "Delete permanently"),
      ]
    : [
        h("button", { type: "button", class: "btn primary", onclick: () => openDesign(d), "aria-label": "Open " + d.name }, "Open"),
        h("button", { type: "button", class: "ghost", onclick: () => rename(d), "aria-label": "Rename " + d.name }, "Rename"),
        h("button", { type: "button", class: "ghost", onclick: () => duplicate(d), "aria-label": "Duplicate " + d.name }, "Duplicate"),
        h("button", { type: "button", class: "ghost", onclick: () => moveToTrash([d]), "aria-label": "Delete " + d.name }, "Delete"),
      ];
  return h(
    "li",
    { class: "design" + (d.id === E.state.currentDesignId ? " current" : "") },
    h("label", { class: "check" }, cb),
    thumb,
    h(
      "div",
      { class: "design-main" },
      h("p", { class: "design-name", title: d.name }, d.name, d.sample ? h("span", { class: "badge" }, "Sample") : null, d.id === E.state.currentDesignId ? h("span", { class: "badge" }, "Open") : null),
      h("p", { class: "design-meta" }, typeLabel(d.typeId) + " \u00b7 " + when),
      h("div", { class: "design-actions" }, ...actions),
    ),
  );
}

function render(): void {
  const body = byId("designsBody");
  const all = store.getDesigns();
  const trashCount = all.filter((d) => d.deletedAt).length;
  const list = queryDesigns(all, view);
  const liveIds = new Set(list.map((d) => d.id));
  view.selected.forEach((id) => {
    if (!liveIds.has(id)) view.selected.delete(id);
  });
  const focusId = document.activeElement && document.activeElement.id;
  body.innerHTML = "";

  const top = h(
    "div",
    { class: "row-actions" },
    h("button", { type: "button", class: "btn primary", onclick: () => saveCurrent() }, E.state.currentDesignId ? "Save changes" : "Save current design"),
    h("button", { type: "button", class: "ghost", onclick: () => newPost() }, "Start a new post"),
    h("button", { type: "button", class: "ghost", onclick: () => pickImportFile() }, "Import a backup"),
  );
  body.append(top);

  const search = h("input", { type: "search", id: "designSearch", class: "grow", placeholder: "Search by name, pub or event", "aria-label": "Search saved designs", value: view.q });
  search.addEventListener("input", () => {
    view.q = search.value;
    render();
  });
  const type = h("select", { id: "designType", "aria-label": "Filter by post type" }, option("", "All post types"), ...TEMPLATES.map((t) => option(t.id, typeLabel(t.id))));
  type.value = view.type;
  type.addEventListener("change", () => {
    view.type = type.value;
    render();
  });
  const sort = h("select", { id: "designSort", "aria-label": "Sort designs" }, option("updated", "Recently updated"), option("created", "Recently created"), option("name", "Name A to Z"));
  sort.value = view.sort;
  sort.addEventListener("change", () => {
    view.sort = sort.value as DesignSort;
    render();
  });
  body.append(h("div", { class: "toolbar", role: "search" }, search, type, sort));
  body.append(h("h3", { class: "sr-only" }, view.trash ? "Recently deleted" : "Your designs"));

  if (view.trash) {
    body.append(h("p", { class: "note" }, "Deleted designs stay here for " + TRASH_DAYS + " days, then they are removed for good."));
  }

  if (view.selected.size) {
    const sel = list.filter((d) => view.selected.has(d.id));
    const bulk = h("div", { class: "bulkbar", role: "region", "aria-label": "Bulk actions" }, h("span", { class: "count", "aria-live": "polite" }, sel.length + " selected"));
    bulk.append(h("button", { type: "button", class: "ghost", onclick: () => { view.selected.clear(); render(); } }, "Clear selection"));
    if (view.trash) {
      bulk.append(h("button", { type: "button", class: "btn", onclick: () => restore(sel) }, "Restore"));
      bulk.append(h("button", { type: "button", class: "btn danger", onclick: () => purge(sel) }, "Delete permanently"));
    } else {
      bulk.append(h("button", { type: "button", class: "btn", onclick: () => exportSelection(sel) }, "Export selected"));
      bulk.append(
        h("button", {
          type: "button",
          class: "btn danger",
          onclick: async () => {
            const ok = await confirmDialog({ title: "Delete " + sel.length + " designs?", body: "They move to Recently deleted, where you can restore them for " + TRASH_DAYS + " days.", confirmLabel: "Delete " + sel.length, danger: true });
            if (ok) moveToTrash(sel);
          },
        }, "Delete selected"),
      );
    }
    body.append(bulk);
  } else if (list.length > 1) {
    body.append(h("div", { class: "row-actions" }, h("button", { type: "button", class: "ghost", onclick: () => { list.forEach((d) => view.selected.add(d.id)); render(); } }, "Select all " + list.length)));
  }

  if (list.length) {
    body.append(h("ul", { class: "design-list" }, ...list.map(designCard)));
  } else if (view.q || view.type) {
    body.append(h("div", { class: "empty" }, h("p", {}, "No designs match that search."), h("button", { type: "button", class: "ghost", onclick: () => { view.q = ""; view.type = ""; render(); } }, "Clear search")));
  } else if (view.trash) {
    body.append(h("div", { class: "empty" }, h("p", {}, "Nothing in Recently deleted.")));
  } else {
    body.append(
      h(
        "div",
        { class: "empty" },
        h("p", {}, "No saved designs yet. Fill in a post, then choose Save design to keep it for next time. Or load the sample designs to see what the studio can do."),
        h("div", { class: "row-actions" }, h("button", { type: "button", class: "btn", onclick: () => loadSamples() }, "Load sample designs"), h("button", { type: "button", class: "ghost", onclick: () => pickImportFile() }, "Import a backup")),
      ),
    );
  }

  const footer = h("div", { class: "row-actions trash-toggle" });
  if (view.trash) {
    footer.append(h("button", { type: "button", class: "ghost", onclick: () => { view.trash = false; view.selected.clear(); render(); } }, "Back to your designs"));
    if (trashCount) footer.append(h("button", { type: "button", class: "ghost", onclick: () => purge(all.filter((d) => d.deletedAt)) }, "Empty Recently deleted"));
  } else {
    footer.append(h("button", { type: "button", class: "ghost", onclick: () => { view.trash = true; view.selected.clear(); render(); } }, "Recently deleted (" + trashCount + ")"));
    if (list.length && !all.some((d) => d.sample)) footer.append(h("button", { type: "button", class: "ghost", onclick: () => loadSamples() }, "Load sample designs"));
  }
  body.append(footer);

  if (focusId) {
    const back = document.getElementById(focusId);
    if (back instanceof HTMLInputElement) {
      back.focus();
      back.setSelectionRange(back.value.length, back.value.length);
    } else if (back) back.focus();
  }
}

export function refreshDesigns(): void {
  if (dlg().open) render();
}

export function openDesigns(): void {
  render();
  openDialog(dlg(), byId("designSearch"));
}

export async function initDesigns(): Promise<void> {
  // Purge designs that have sat in Recently deleted for too long.
  const { kept, purged } = purgeExpired(store.getDesigns());
  if (purged) {
    const keep = new Set(kept.map((d) => d.id));
    await store.removeDesigns(store.getDesigns().filter((d) => !keep.has(d.id)).map((d) => d.id));
  }
  const btn = byId("designsBtn");
  btn.addEventListener("click", openDesigns);
  byId("saveDesign").addEventListener("click", () => saveCurrent());
  byId("quickSave").addEventListener("click", () => saveCurrent());
}
