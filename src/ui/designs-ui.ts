// The Saved designs panel: save the current post, then search, sort, filter,
// open, rename, duplicate, export and delete saved designs. Deleting moves a
// design to Recently deleted, where it can be restored for TRASH_DAYS days.

import { TEMPLATES, templateById } from "../core/templates.ts";
import { defaultDesignName, duplicateDesign, kindOf, newId, purgeExpired, queryDesigns, TRASH_DAYS, type Design, type DesignSort, type Repeat } from "../core/designs.ts";
import { isHm, isYmd, planLabel, repeatLabel, retimeParams, todayYmd } from "../core/calendar.ts";
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
const changed: Array<() => void> = [];
/** Called whenever saved designs change from this panel, so the calendar can follow. */
export function onDesignsChanged(fn: () => void): void {
  changed.push(fn);
}
function emitChanged(): void {
  changed.forEach((f) => f());
}

function typeLabel(id: string): string {
  const t = templateById(id);
  return t ? t.label.replace(/\s*\(.*\)$/, "") : "Post";
}

/** Where a save starts: the calendar, designs, or whichever the open record is. */
export type SaveTarget = "post" | "design" | "auto";

interface SaveChoice {
  name: string;
  toPost: boolean;
  toDesign: boolean;
  postNew: boolean;
  designNew: boolean;
  postOn: string;
  postAt: string | null;
  repeat: Repeat | null;
  repeatUntil: string | null;
}

function liveRecord(id: string | null): Design | undefined {
  const d = id ? store.getDesign(id) : undefined;
  return d && !d.deletedAt ? d : undefined;
}

function readRepeatSel(sel: HTMLSelectElement): Repeat | null {
  const v = sel.value;
  return v === "week" || v === "month" || v === "year" ? v : null;
}

/**
 * The save dialog. Designs are templates to reuse; the calendar holds posts
 * meant for a day. Either or both can be ticked, and an open design or post
 * can be updated or kept with a copy saved as new.
 */
function saveDialog(o: { target: "post" | "design"; post?: Design; design?: Design; name: string }): Promise<SaveChoice | null> {
  const d = byId<HTMLDialogElement>("saveDialog");
  const form = byId<HTMLFormElement>("saveForm");
  const name = byId<HTMLInputElement>("saveName");
  const toCal = byId<HTMLInputElement>("saveToCal");
  const toDes = byId<HTMLInputElement>("saveToDesigns");
  const on = byId<HTMLInputElement>("saveOn");
  const at = byId<HTMLInputElement>("saveAt");
  const rep = byId<HTMLSelectElement>("saveRepeat");
  const until = byId<HTMLInputElement>("saveUntil");
  const ok = byId<HTMLButtonElement>("saveOk");
  const nameErr = byId("saveNameError");
  const targetErr = byId("saveTargetError");
  const postMode = byId("savePostMode");
  const designMode = byId("saveDesignMode");
  const radio = (group: string, v: string) => form.querySelector<HTMLInputElement>('input[name="' + group + '"][value="' + v + '"]') as HTMLInputElement;

  name.value = o.name;
  toCal.checked = o.target === "post";
  toDes.checked = o.target === "design";
  on.value = isYmd(E.el.postOn.value) ? E.el.postOn.value : todayYmd();
  at.value = isHm(E.el.postAt.value) ? E.el.postAt.value : "";
  rep.value = E.el.postRepeat.value;
  until.value = E.el.postUntil.value;
  postMode.hidden = !o.post;
  designMode.hidden = !o.design;
  radio("savePostMode", "update").checked = true;
  radio("saveDesignMode", "update").checked = true;
  if (o.post) byId("savePostUpdateLabel").textContent = "Update " + o.post.name;
  if (o.design) byId("saveDesignUpdateLabel").textContent = "Update " + o.design.name;
  [nameErr, targetErr].forEach((e) => (e.textContent = ""));
  name.removeAttribute("aria-invalid");

  const sync = () => {
    byId("saveCalOpts").hidden = !toCal.checked;
    byId("saveDesignOpts").hidden = !toDes.checked || !o.design;
    byId("saveUntilWrap").hidden = !readRepeatSel(rep);
    const postUpd = !!o.post && radio("savePostMode", "update").checked;
    const desUpd = !!o.design && radio("saveDesignMode", "update").checked;
    const t = toCal.checked && toDes.checked ? "Save to the calendar and designs" : toCal.checked ? "Save to the calendar" : toDes.checked ? "Save as a design" : "Save";
    byId("saveTitle").textContent = t;
    ok.textContent = toCal.checked && toDes.checked ? "Save to both" : toCal.checked ? (postUpd ? "Update the post" : "Save to calendar") : toDes.checked ? (desUpd ? "Update the design" : "Save design") : "Save";
    if (toCal.checked || toDes.checked) targetErr.textContent = "";
  };
  sync();

  return new Promise((resolve) => {
    let result: SaveChoice | null = null;
    const onSubmit = (e: Event) => {
      e.preventDefault();
      const v = name.value.trim();
      if (!v) {
        nameErr.textContent = "Give it a name, for example the pub or event.";
        name.setAttribute("aria-invalid", "true");
        name.focus();
        return;
      }
      if (!toCal.checked && !toDes.checked) {
        targetErr.textContent = "Tick the calendar, designs or both.";
        toCal.focus();
        return;
      }
      const day = isYmd(on.value) ? on.value : todayYmd();
      const r = readRepeatSel(rep);
      if (toCal.checked && r && isYmd(until.value) && until.value < day) {
        targetErr.textContent = "The repeat ends before the first day. Pick a later end date, or clear it.";
        until.focus();
        return;
      }
      result = {
        name: v.slice(0, 200),
        toPost: toCal.checked,
        toDesign: toDes.checked,
        postNew: !o.post || radio("savePostMode", "new").checked,
        designNew: !o.design || radio("saveDesignMode", "new").checked,
        postOn: day,
        postAt: isHm(at.value) ? at.value : null,
        repeat: r,
        repeatUntil: r && isYmd(until.value) ? until.value : null,
      };
      closeDialog(d);
    };
    const onClose = () => {
      form.removeEventListener("submit", onSubmit);
      form.removeEventListener("change", sync);
      d.removeEventListener("close", onClose);
      resolve(result);
    };
    form.addEventListener("submit", onSubmit);
    form.addEventListener("change", sync);
    d.addEventListener("close", onClose);
    openDialog(d, name);
    name.select();
  });
}

/** Writes the chosen day back to the editor, so campaign countdowns follow it. */
function applyPlan(c: SaveChoice): void {
  if (E.el.postOn.value !== c.postOn) {
    E.el.postOn.value = c.postOn;
    E.el.postOn.dispatchEvent(new Event("change"));
  }
  E.el.postAt.value = c.postAt || "";
  E.el.postRepeat.value = c.repeat || "";
  E.el.postUntil.value = c.repeatUntil || "";
  E.syncRepeat();
}

/**
 * Saves the current form: to the calendar as a post, to designs as a
 * template, or both. "auto" follows what is open: a post, else a design,
 * else the calendar.
 */
export async function saveCurrent(target: SaveTarget = "auto"): Promise<Design | null> {
  const post = liveRecord(E.state.currentPostId);
  const design = liveRecord(E.state.currentDesignId);
  const t: "post" | "design" = target === "auto" ? (post ? "post" : design ? "design" : "post") : target;
  const fallback = defaultDesignName(E.buildLayout().title, E.currentTemplate().label);
  const choice = await saveDialog({ target: t, post, design, name: (t === "post" ? post && post.name : design && design.name) || fallback });
  if (!choice) return null;
  if (choice.toPost) applyPlan(choice);
  const snap = E.captureForm();
  const thumb = E.thumbnail();
  const now = new Date().toISOString();
  const out: Design[] = [];
  let savedPost: Design | null = null;
  let savedDesign: Design | null = null;
  if (choice.toPost) {
    const was = choice.postNew ? undefined : post;
    const sameDay = !!(was && was.postOn === choice.postOn && !choice.repeat);
    savedPost = {
      id: was ? was.id : newId("pst"),
      kind: "post",
      name: choice.name,
      typeId: E.currentTemplate().id,
      params: snap.params,
      photo: snap.photo,
      logo: snap.logo,
      thumb,
      createdAt: was ? was.createdAt : now,
      updatedAt: now,
      deletedAt: null,
      postOn: choice.postOn,
      postAt: choice.postAt,
      repeat: choice.repeat,
      repeatUntil: choice.repeatUntil,
      // Moving a one-off post to another day means it has not been posted yet.
      postedAt: sameDay && was ? was.postedAt || null : null,
      postedDays: choice.repeat && was && was.repeat ? was.postedDays || null : null,
      campaign: snap.campaign || null,
    };
    out.push(savedPost);
  }
  if (choice.toDesign) {
    const was = choice.designNew ? undefined : design;
    savedDesign = {
      id: was ? was.id : newId("dsn"),
      kind: "design",
      name: choice.name,
      typeId: E.currentTemplate().id,
      params: snap.params,
      photo: snap.photo,
      logo: snap.logo,
      thumb,
      createdAt: was ? was.createdAt : now,
      updatedAt: now,
      deletedAt: null,
      postOn: null,
      postAt: null,
      postedAt: null,
      campaign: null,
    };
    out.push(savedDesign);
  }
  if (!(await store.putDesigns(out))) {
    notify("error", "Could not save: this browser's storage is full. Delete some saved designs, posts or library items (Settings shows how much is used), then try again.");
    return null;
  }
  if (savedPost) E.state.currentPostId = savedPost.id;
  if (savedDesign) E.state.currentDesignId = savedDesign.id;
  E.state.dirty = false;
  const verb = (rec: Design | null, was: Design | undefined, isNew: boolean) => (rec && was && !isNew ? "Updated" : "Saved");
  let msg: string;
  if (savedPost && savedDesign) msg = "Saved " + choice.name + " to the calendar for " + planLabel(savedPost) + " and to your designs.";
  else if (savedPost) msg = verb(savedPost, post, choice.postNew) + " " + choice.name + " in the calendar for " + planLabel(savedPost) + (savedPost.repeat ? ", " + repeatLabel(savedPost).toLowerCase() : "") + ".";
  else msg = verb(savedDesign, design, choice.designNew) + " the design " + choice.name + ".";
  const day = savedPost ? savedPost.postOn : null;
  notify("success", msg, { action: day ? { label: "Open calendar", run: () => openCalendarHook(day) } : { label: "View designs", run: openDesigns } });
  if (dlg().open) render();
  emitChanged();
  return savedPost || savedDesign;
}

let openCalendarHook: (day: string) => void = () => undefined;
export function setCalendarOpener(fn: (day: string) => void): void {
  openCalendarHook = fn;
}

/** Saves changes to designs made outside the editor (the calendar). */
export async function updateDesigns(items: Design[]): Promise<boolean> {
  const ok = await store.putDesigns(items);
  if (ok) {
    if (dlg().open) render();
    emitChanged();
  }
  return ok;
}

/** Moves a planned post to another day (or off the calendar), keeping a campaign countdown right. */
export function replan(d: Design, postOn: string | null, postAt: string | null = d.postAt || null): Design {
  const params = postOn && d.campaign ? retimeParams(d.params, d.campaign, d.postOn, postOn) : d.params;
  return { ...d, params, postOn, postAt: postOn ? postAt : null, postedAt: postOn === d.postOn ? d.postedAt || null : null, updatedAt: new Date().toISOString() };
}

export async function confirmReplace(): Promise<boolean> {
  if (!E.state.dirty) return true;
  return confirmDialog({
    title: "Replace the current post?",
    body: "You have changes that are not saved. Opening something else replaces them.",
    confirmLabel: "Replace it",
    danger: true,
  });
}

export async function openDesign(d: Design): Promise<boolean> {
  if (!(await confirmReplace())) return false;
  const post = kindOf(d) === "post";
  await E.restoreForm(post ? { params: d.params, photo: d.photo || null, logo: d.logo || null, postOn: d.postOn, postAt: d.postAt, repeat: d.repeat, repeatUntil: d.repeatUntil, campaign: d.campaign } : { params: d.params, photo: d.photo || null, logo: d.logo || null });
  E.state.currentDesignId = post || d.sample ? null : d.id;
  E.state.currentPostId = post ? d.id : null;
  E.state.dirty = false;
  closeDialog(dlg());
  notify("info", post ? "Opened the post " + d.name + ". Save keeps your changes in the calendar." : "Opened the design " + d.name + ". Change it for today's post and save it to the calendar, or save it back as a design.");
  return true;
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
  const res = await promptDialog({ title: kindOf(d) === "post" ? "Rename post" : "Rename design", label: "Name", value: d.name, confirmLabel: "Rename" });
  if (!res || res.value === d.name) return;
  await store.putDesigns([{ ...d, name: res.value, updatedAt: new Date().toISOString() }]);
  emitChanged();
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
  emitChanged();
  items.forEach((d) => view.selected.delete(d.id));
  if (items.some((d) => d.id === E.state.currentDesignId)) E.state.currentDesignId = null;
  if (items.some((d) => d.id === E.state.currentPostId)) E.state.currentPostId = null;
  render();
  const what = items.length === 1 ? items[0].name : items.length + (items.every((d) => kindOf(d) === "post") ? " posts" : " designs");
  notify("info", "Moved " + what + " to Recently deleted.", {
    action: {
      label: "Undo",
      run: async () => {
        await store.putDesigns(before);
        render();
        emitChanged();
      },
    },
  });
}

async function restore(items: Design[]): Promise<void> {
  await store.putDesigns(items.map((d) => ({ ...d, deletedAt: null })));
  emitChanged();
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
  emitChanged();
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
  const isPost = kindOf(d) === "post";
  const planBadge = isPost ? h("span", { class: "badge plan" }, "Calendar post") : null;
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
      h("p", { class: "design-name", title: d.name }, d.name, d.sample ? h("span", { class: "badge" }, "Sample") : null, d.id === E.state.currentDesignId ? h("span", { class: "badge" }, "Open") : null, planBadge),
      h("p", { class: "design-meta" }, typeLabel(d.typeId) + " \u00b7 " + (isPost && d.postOn ? planLabel(d) + (d.repeat ? " (" + repeatLabel(d).toLowerCase() + ")" : "") + " \u00b7 " : "") + when),
      h("div", { class: "design-actions" }, ...actions),
    ),
  );
}

function render(): void {
  const body = byId("designsBody");
  const all = store.getDesigns();
  const list = queryDesigns(all, { ...view, kind: "design" });
  const trashCount = all.filter((d) => d.deletedAt).length;
  const liveIds = new Set(list.map((d) => d.id));
  view.selected.forEach((id) => {
    if (!liveIds.has(id)) view.selected.delete(id);
  });
  const focusId = document.activeElement && document.activeElement.id;
  body.innerHTML = "";

  const top = h(
    "div",
    { class: "row-actions" },
    h("button", { type: "button", class: "btn primary", onclick: () => saveCurrent("design") }, liveRecord(E.state.currentDesignId) ? "Save changes to the open design" : "Save the current post as a design"),
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
    body.append(h("p", { class: "note" }, "Deleted designs and calendar posts stay here for " + TRASH_DAYS + " days, then they are removed for good."));
  } else {
    body.append(h("p", { class: "note" }, "Designs are your templates: a post tuned the way you like it, ready to reuse. Posts for a particular day live in the ", h("button", { type: "button", class: "linkish", onclick: () => { closeDialog(dlg()); openCalendarHook(todayYmd()); } }, "content calendar"), "."));
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
        h("p", {}, "No saved designs yet. Tune a post the way you like it, then choose Save design to reuse it as a template. Or load the sample designs to see what the studio can do."),
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
  byId("saveDesign").addEventListener("click", () => saveCurrent("design"));
  byId("quickSave").addEventListener("click", () => saveCurrent("auto"));
}
