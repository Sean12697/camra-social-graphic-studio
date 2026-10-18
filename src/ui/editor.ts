// The editor: wires the form to the renderer. Owns the form state, the dynamic
// post fields, platform presets, the content library, share links and the
// boot sequence. Redraws are coalesced into animation frames so sliders stay
// smooth on phones.

import { CONFIG, TAGLINES, paletteHex, type Branch } from "../core/config.ts";
import { PRESETS, orientDims, type Preset } from "../core/presets.ts";
import { ALL_ICONS, ICON_GROUPS, ICON_NAMES, iconLabel } from "../core/icons.ts";
import { REGION_LOGOS, SUB_BRAND_LOGOS, findLogo } from "../core/logos.ts";
import { TEMPLATES, TEMPLATE_GROUPS, templateById, type Field, type Layout, type Template, type Values, type ListRow } from "../core/templates.ts";
import { draw, resolveLogos, type DrawInfo, type Img, type RenderOptions, type TextAligns, type TextColours } from "../core/renderer.ts";
import { PARAM_DEFS, docsHtml } from "../core/params.ts";
import { contextNotes, panelHtml } from "../core/brand.ts";
import { altText as buildAltText } from "../core/alttext.ts";
import { escapeHtml as esc } from "../core/html.ts";
import { newId, type LibraryItem } from "../core/designs.ts";
import { byId, fileToDataUrl, h, option, reveal } from "./dom.ts";
import { notify } from "./notices.ts";
import { store } from "./store.ts";

type Sel = HTMLSelectElement;
type Inp = HTMLInputElement;

export const el = {
  controls: byId<HTMLFormElement>("controls"),
  postType: byId<Sel>("postType"),
  branch: byId<Sel>("branch"),
  customWrap: byId("customBranchWrap"),
  customName: byId<Inp>("customBranchName"),
  customLogo: byId<Inp>("customBranchLogo"),
  saveCustomLogo: byId<Inp>("saveCustomLogo"),
  presetList: byId("presetList"),
  dynamic: byId("dynamicFields"),
  photo: byId<Inp>("photo"),
  clearPhoto: byId<HTMLButtonElement>("clearPhoto"),
  iconWrap: byId("iconWrap"),
  presetIcon: byId<Sel>("presetIcon"),
  reframeWrap: byId<HTMLDetailsElement>("reframeWrap"),
  fitMode: byId<Sel>("fitMode"),
  frameMode: byId<Sel>("frameMode"),
  showLabel: byId<Inp>("showLabel"),
  showText: byId<Inp>("showText"),
  showCaption: byId<Inp>("showCaption"),
  captionText: byId<Inp>("captionText"),
  frameX: byId<Inp>("frameX"),
  frameY: byId<Inp>("frameY"),
  frameZoom: byId<Inp>("frameZoom"),
  photoOpacity: byId<Inp>("photoOpacity"),
  resetFrame: byId<HTMLButtonElement>("resetFrame"),
  library: byId("library"),
  saveLogoLib: byId<HTMLButtonElement>("saveLogoLib"),
  savePhotoLib: byId<HTMLButtonElement>("savePhotoLib"),
  previewPreset: byId<Sel>("previewPreset"),
  docsBtn: byId<HTMLButtonElement>("docsBtn"),
  docsPanel: byId("docsPanel"),
  docsBody: byId("docsBody"),
  brandBtn: byId<HTMLButtonElement>("brandBtn"),
  brandPanel: byId("brandPanel"),
  brandBody: byId("brandBody"),
  campaignWrap: byId("campaignWrap"),
  campaignBranch: byId<Inp>("campaignBranch"),
  brandNotes: byId("brandNotes"),
  tagline: byId<Sel>("tagline"),
  orient: byId<Sel>("orient"),
  pad: byId<Sel>("pad"),
  bgColor: byId<Sel>("bgColor"),
  bgCustom: byId<Inp>("bgCustom"),
  bgStyle: byId<Sel>("bgStyle"),
  titleColor: byId<Sel>("titleColor"),
  titleCustom: byId<Inp>("titleCustom"),
  subColor: byId<Sel>("subColor"),
  subCustom: byId<Inp>("subCustom"),
  bodyColor: byId<Sel>("bodyColor"),
  bodyCustom: byId<Inp>("bodyCustom"),
  capColor: byId<Sel>("capColor"),
  capCustom: byId<Inp>("capCustom"),
  logoScale: byId<Inp>("logoScale"),
  logoPreset: byId<Sel>("logoPreset"),
  logos: byId<Sel>("logos"),
  logoAlign: byId<Sel>("logoAlign"),
  fbStyle: byId<Sel>("fbStyle"),
  titleAlign: byId<Sel>("titleAlign"),
  subAlign: byId<Sel>("subAlign"),
  bodyAlign: byId<Sel>("bodyAlign"),
  capAlign: byId<Sel>("capAlign"),
  taglineAlign: byId<Sel>("taglineAlign"),
  region: byId<Sel>("region"),
  regionWrap: byId("regionWrap"),
  subBrand: byId<Sel>("subBrand"),
  subBrandWrap: byId("subBrandWrap"),
  iconGrid: byId("iconGrid"),
  iconFilter: byId<Inp>("iconFilter"),
  iconPos: byId<Sel>("iconPos"),
  iconSize: byId<Sel>("iconSize"),
  iconOpacity: byId<Inp>("iconOpacity"),
  iconColor: byId<Sel>("iconColor"),
  iconCustom: byId<Inp>("iconCustom"),
  altText: byId<HTMLTextAreaElement>("altText"),
  previewSizeLabel: byId("previewSizeLabel"),
  lookHint: byId("lookHint"),
  postHint: byId("postHint"),
  mediaHint: byId("mediaHint"),
  sizesHint: byId("sizesHint"),
  libraryHint: byId("libraryHint"),
  exportHint: byId("exportHint"),
};

const canvas = byId<HTMLCanvasElement>("frame");
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

// photoUrl / customLogoUrl remember where a remote image came from, so share
// links can carry it and "save to library" can explain CORS failures.
export const state = {
  photoImg: null as Img | null,
  photoData: null as string | null,
  photoUrl: null as string | null,
  branchLogoImg: null as Img | null,
  customLogoImg: null as Img | null,
  customLogoData: null as string | null,
  customLogoUrl: null as string | null,
  camraLogoImg: null as Img | null,
  regionImg: null as Img | null,
  subBrandImg: null as Img | null,
  /** The saved design the form was loaded from, if any. */
  currentDesignId: null as string | null,
  /** True once the user has changed the form since it was loaded or saved. */
  dirty: false,
};

const listeners: Array<() => void> = [];
/** Called after every redraw, for panels that mirror the form. */
export function onRedraw(fn: () => void): void {
  listeners.push(fn);
}

// --- images ---

export function loadImg(src: string | null | undefined): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

// Loads an image allowing cross-origin use so the canvas stays exportable
// when the host serves permissive CORS headers. Falls back to a plain load so
// the preview still works, but warns that exports may be blocked.
function loadImgCors(src: string | null | undefined): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => {
      loadImg(src).then((im2) => {
        if (im2) notify("warn", "That image's host does not allow cross-origin use. It will preview, but the browser may block downloads. If export fails, save the image and upload it as a file instead.");
        resolve(im2);
      });
    };
    im.src = src;
  });
}

// Draws an image to an offscreen canvas and returns a data URL, downscaled so
// the longest side is at most maxSide. Keeps library items small and captures
// URL-loaded images. Throws on tainted (cross-origin) images; callers handle it.
export function imageToDataUrl(img: Img, maxSide: number, type?: string, quality?: number): string {
  const w = img.width || 1;
  const hh = img.height || 1;
  const s = Math.min(1, (maxSide || 1600) / Math.max(w, hh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(hh * s));
  (c.getContext("2d") as CanvasRenderingContext2D).drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL(type || "image/png", quality);
}

// --- reading the form ---

export function currentTemplate(): Template {
  return templateById(el.postType.value) || TEMPLATES[0];
}

export function currentBranch(): Branch {
  if (el.branch.value === "custom") {
    const n = el.customName.value || "Your CAMRA branch";
    return { name: n, short: n, custom: true };
  }
  return CONFIG.branches[el.branch.value] || CONFIG.branches[CONFIG.defaultBranch];
}

function branchLogo(): Img | null {
  return el.branch.value === "custom" ? state.customLogoImg : state.branchLogoImg;
}

export function selectedPresets(): Preset[] {
  const ids: string[] = [];
  el.presetList.querySelectorAll<Inp>("input:checked").forEach((c) => ids.push(c.value));
  return PRESETS.filter((p) => ids.indexOf(p.id) !== -1);
}

export function activePreset(): Preset {
  const sel = selectedPresets();
  const byPrev = PRESETS.find((p) => p.id === el.previewPreset.value);
  if (byPrev && sel.indexOf(byPrev) !== -1) return byPrev;
  return sel[0] || PRESETS[0];
}

export function dims(p: Preset): { w: number; h: number } {
  return orientDims(p, el.orient.value);
}

function readFrame() {
  // Opacity is range-checked rather than defaulted with ||, because 0 (fully
  // transparent) is a legitimate value that || would swallow.
  let op = parseFloat(el.photoOpacity.value);
  if (isNaN(op) || op < 0 || op > 1) op = 1;
  return {
    fit: el.fitMode.value,
    offsetX: parseFloat(el.frameX.value) || 0,
    offsetY: parseFloat(el.frameY.value) || 0,
    zoom: parseFloat(el.frameZoom.value) || 1,
    opacity: op,
  };
}

function syncFrameDisabled(): void {
  const off = el.fitMode.value === "fill";
  el.frameX.disabled = off;
  el.frameY.disabled = off;
  el.frameZoom.disabled = off;
}

function resetFrame(): void {
  el.fitMode.value = "cover";
  el.frameX.value = "0";
  el.frameY.value = "0";
  el.frameZoom.value = "1";
  el.photoOpacity.value = "1";
  syncFrameDisabled();
}

// Builds the layout model once per draw and reuses it everywhere (renderer,
// caption placeholder, brand notes, canvas description), so a throwing
// template build is handled in exactly one place.
export function buildLayout(): Layout {
  try {
    return currentTemplate().build(readValues()) || {};
  } catch (e) {
    console.error("Template build failed:", e);
    return {};
  }
}

// Shows the active post type's default caption as the placeholder and disables
// the caption box when the caption is turned off.
function syncCaption(layout: Layout): void {
  el.captionText.placeholder = (layout && layout.footer) || "No default caption for this post type";
  el.captionText.disabled = !el.showCaption.checked;
}

export function hasPhoto(): boolean {
  return !!(currentTemplate().allowPhoto && state.photoImg);
}

function updatePhotoControls(): void {
  const on = hasPhoto();
  el.iconWrap.style.display = on ? "none" : "flex";
  el.reframeWrap.classList.toggle("hidden", !on);
}

// Resolves a colour control (a dropdown plus its custom colour picker) to a
// palette hex value, a custom hex value, or null when set to Auto.
function pickColor(sel: Sel, custom: Inp): string | null {
  const v = sel.value;
  if (v === "auto" || !v) return null;
  if (v === "custom") return custom.value || null;
  return paletteHex(v) || null;
}
function bgColorValue(): string {
  const v = el.bgColor.value;
  if (v === "custom") return el.bgCustom.value || "slate";
  return v || "slate";
}
function collectTextColors(): TextColours {
  return {
    title: pickColor(el.titleColor, el.titleCustom),
    subtitle: pickColor(el.subColor, el.subCustom),
    body: pickColor(el.bodyColor, el.bodyCustom),
    caption: pickColor(el.capColor, el.capCustom),
  };
}
function alignVal(sel: Sel): string {
  return sel.value === "center" ? "center" : "left";
}
function collectTextAligns(): TextAligns {
  return { title: alignVal(el.titleAlign), subtitle: alignVal(el.subAlign), body: alignVal(el.bodyAlign), caption: alignVal(el.capAlign) };
}
// Shows each custom colour picker only when its dropdown is set to Custom.
function syncColorPickers(): void {
  const t = (sel: Sel, inp: Inp) => inp.classList.toggle("hidden", sel.value !== "custom");
  t(el.bgColor, el.bgCustom);
  t(el.titleColor, el.titleCustom);
  t(el.subColor, el.subCustom);
  t(el.bodyColor, el.bodyCustom);
  t(el.capColor, el.capCustom);
  t(el.iconColor, el.iconCustom);
}

/**
 * What fills the branch slot: the branch logo, or a region or sub-brand logo
 * chosen under Logo shown (or suggested by the post type when Automatic).
 */
export interface Slot {
  kind: "branch" | "region" | "subBrand";
  logos: string;
  name?: string;
  img?: Img | null;
}

export function logoSlot(layout: Layout): Slot {
  const choice = el.logos.value || "auto";
  if (choice === "region") {
    const r = findLogo(REGION_LOGOS, el.region.value);
    return r ? { kind: "region", logos: "branch", name: "CAMRA " + r.name, img: state.regionImg } : { kind: "region", logos: "camra" };
  }
  const t = currentTemplate();
  const subId = choice === "subbrand" ? el.subBrand.value : choice === "auto" && !layout.campaign ? t.subBrand : "";
  const sb = findLogo(SUB_BRAND_LOGOS, subId);
  if (sb && (choice === "subbrand" || choice === "auto")) return { kind: "subBrand", logos: "branch", name: sb.name, img: state.subBrandImg };
  return { kind: "branch", logos: choice === "subbrand" ? "auto" : choice };
}

function iconColorValue(): string | null {
  return pickColor(el.iconColor, el.iconCustom);
}

export type Snapshot = Omit<RenderOptions, "ctx" | "width" | "height">;

// A snapshot of everything the renderer needs, taken once per draw or export
// so staggered downloads cannot pick up edits made while they run.
export function renderOptions(layout: Layout): Snapshot {
  const slot = logoSlot(layout);
  return {
    template: currentTemplate(),
    layout,
    branch: currentBranch(),
    photoImg: state.photoImg,
    branchLogoImg: branchLogo(),
    camraLogoImg: state.camraLogoImg,
    iconName: el.presetIcon.value,
    iconStyle: { position: el.iconPos.value, size: parseFloat(el.iconSize.value) || 1, opacity: parseFloat(el.iconOpacity.value), color: iconColorValue() },
    altLogo: slot.kind !== "branch" && slot.name ? { img: slot.img, text: slot.name } : null,
    frame: readFrame(),
    showBranchOnCampaign: el.campaignBranch.checked,
    tagline: el.tagline.value,
    frameMode: el.frameMode.value || "labelOut",
    showLabel: el.showLabel.checked,
    showText: el.showText.checked,
    showCaption: el.showCaption.checked,
    captionText: el.captionText.value,
    pad: parseFloat(el.pad.value) || 1,
    bgColor: bgColorValue(),
    bgStyle: el.bgStyle.value || "solid",
    textColors: collectTextColors(),
    logoScale: parseFloat(el.logoScale.value) || 1.25,
    logos: slot.logos,
    logoAlign: el.logoAlign.value || "center",
    textAligns: collectTextAligns(),
    taglineAlign: el.taglineAlign.value || "center",
    fbStyle: el.fbStyle.value || "gradient",
  };
}

export function drawTo(target: CanvasRenderingContext2D, w: number, hh: number, snap: Snapshot): DrawInfo {
  target.canvas.width = w;
  target.canvas.height = hh;
  return draw({ ...snap, ctx: target, width: w, height: hh }) || { clamped: false };
}

/** Renders the snapshot at the given size to a fresh offscreen canvas. */
export function renderCanvas(snap: Snapshot, w: number, hh: number): HTMLCanvasElement {
  const off = document.createElement("canvas");
  drawTo(off.getContext("2d") as CanvasRenderingContext2D, w, hh, snap);
  return off;
}

function canvasLabel(layout: Layout, p: Preset): string {
  const bits = ["Preview of a", currentTemplate().label, "graphic for", currentBranch().name];
  if (layout.title) bits.push('titled "' + layout.title + '"');
  bits.push("at " + p.label);
  return bits.join(" ") + ".";
}

/** Plain-language alt text for the current graphic. */
export function currentAltText(layout: Layout = buildLayout()): string {
  const slot = logoSlot(layout);
  const who = resolveLogos(slot.logos, layout.campaign, el.campaignBranch.checked);
  const photo = hasPhoto();
  const showCap = photo ? el.showCaption.checked : true;
  const cap = photo && showCap && el.captionText.value.trim() ? el.captionText.value : undefined;
  return buildAltText({
    layout: photo && !el.showText.checked ? { ...layout, title: "", subtitle: "" } : layout,
    branch: currentBranch(),
    templateLabel: currentTemplate().label,
    hasPhoto: photo,
    caption: showCap ? cap : "",
    tagline: el.tagline.value || undefined,
    logo: who.branch ? "branch" : "camra",
    logoName: who.branch && slot.kind !== "branch" ? slot.name : undefined,
  });
}

let drawQueued = false;
export function redraw(): void {
  if (drawQueued) return;
  drawQueued = true;
  window.requestAnimationFrame(() => {
    drawQueued = false;
    redrawNow();
  });
}

export function redrawNow(): void {
  const p = activePreset();
  const d = dims(p);
  const layout = buildLayout();
  const info = drawTo(ctx, d.w, d.h, renderOptions(layout));
  canvas.style.setProperty("--cmax", d.w >= d.h ? "560px" : "420px");
  canvas.style.aspectRatio = d.w + " / " + d.h;
  canvas.setAttribute("aria-label", canvasLabel(layout, p));
  el.previewSizeLabel.textContent = p.label + " \u00b7 " + d.w + "\u00d7" + d.h;
  syncCaption(layout);
  updateBrand(layout, !!info.clamped);
  el.altText.value = currentAltText(layout);
  updateHints(layout);
  listeners.forEach((fn) => fn());
}

// Short summaries beside each group heading, so a collapsed group still says
// what it holds.
function updateHints(layout: Layout): void {
  el.postHint.textContent = currentTemplate().label.replace(/\s*\(.*\)$/, "") + (layout.title ? ": " + layout.title : "");
  el.mediaHint.textContent = state.photoImg ? "Photo added" : el.presetIcon.value === "none" ? "No icon" : "Icon: " + el.presetIcon.value;
  const n = selectedPresets().length;
  el.sizesHint.textContent = n === 1 ? "1 size" : n + " sizes";
  const custom = !isLookDefault();
  el.lookHint.textContent = custom ? "Customised" : "Brand defaults";
  el.lookHint.classList.toggle("custom", custom);
  const lib = store.getLibrary().length;
  el.libraryHint.textContent = lib === 1 ? "1 item" : lib + " items";
}

// Reflects brand rules in the UI: shows or hides the campaign branch-logo
// toggle and lists plain-language notes explaining the current choices. All
// note text goes through esc() before being injected as HTML.
function updateBrand(layout: Layout, clamped: boolean): void {
  el.campaignWrap.classList.toggle("hidden", !layout.campaign);
  const t = currentTemplate();
  const photoFull = !!(state.photoImg && t.allowPhoto && t.layout === "photoTop" && el.frameMode.value === "fullBleed");
  const slot = logoSlot(layout);
  const who = resolveLogos(slot.logos, layout.campaign, el.campaignBranch.checked);
  const notes = contextNotes(layout, {
    slotKind: who.branch ? slot.kind : "branch",
    slotName: slot.kind === "subBrand" ? slot.name : el.region.value ? slot.name : "",
    showBranchOnCampaign: el.campaignBranch.checked,
    bgColor: el.bgColor.value || "slate",
    logos: el.logos.value,
    who,
    bg: bgColorValue(),
    textColors: collectTextColors(),
    solidBg: !photoFull,
  });
  if (clamped) {
    notes.push({ tone: "warn", title: "Some text is cut off", body: "Not everything fits " + activePreset().label + ". Shorten the title, subtitle or body text, remove some list items, or preview a taller size." });
  }
  el.brandNotes.innerHTML = notes
    .map((n) => '<div class="brand-note ' + esc(n.tone || "info") + '"><strong>' + esc(n.title) + "</strong><span>" + esc(n.body) + "</span></div>")
    .join("");
}

// --- dynamic fields ---
// Every generated control gets an id wired to its label's for attribute, so
// screen readers announce the right name for each field.
let fieldSeq = 0;
function nextFieldId(key: string): string {
  fieldSeq++;
  return "fld-" + key + "-" + fieldSeq;
}

function makeInput(f: Field): HTMLElement {
  const wrap = h("div", { class: "field" });
  const lab = h("label", {}, f.label);
  wrap.appendChild(lab);
  let input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if (f.type === "textarea") {
    input = document.createElement("textarea");
  } else if (f.type === "select") {
    input = document.createElement("select");
    const s = input;
    (f.options || []).forEach((o) => {
      const val = Array.isArray(o) ? o[0] : o;
      const txt = Array.isArray(o) ? o[1] : o;
      s.appendChild(option(val, txt));
    });
  } else {
    input = document.createElement("input");
    input.type = "text";
    if (f.type === "suggest") {
      const dlid = "dl_" + f.key;
      const dl = document.createElement("datalist");
      dl.id = dlid;
      (f.options || []).forEach((o) => dl.appendChild(option(Array.isArray(o) ? o[0] : o, Array.isArray(o) ? o[1] : o)));
      wrap.appendChild(dl);
      input.setAttribute("list", dlid);
    }
  }
  const id = nextFieldId(f.key);
  lab.htmlFor = id;
  input.id = id;
  input.setAttribute("data-key", f.key);
  if (f.optional && !(input instanceof HTMLSelectElement)) input.placeholder = "Optional";
  wrap.appendChild(input);
  return wrap;
}

function rowSummary(row: HTMLElement): string {
  const vals: string[] = [];
  row.querySelectorAll<Inp>("input").forEach((i) => {
    if (i.value) vals.push(i.value);
  });
  return vals.join(", ");
}

function makeRow(f: Field): HTMLElement {
  const row = h("div", { class: "list-row" });
  const cells = h("div", { class: "row-fields" });
  row.appendChild(cells);
  (f.itemFields || []).forEach((it) => {
    const cell = h("div", { class: "field" });
    const l = h("label", {}, it.label);
    cell.appendChild(l);
    const inp = h("input", { type: "text", "data-itemkey": it.key });
    const id = nextFieldId(it.key);
    l.htmlFor = id;
    inp.id = id;
    if (it.optional) inp.placeholder = "Optional";
    cell.appendChild(inp);
    cells.appendChild(cell);
  });
  const rm = h("button", { type: "button", class: "remove-btn", "aria-label": "Remove this " + f.label.toLowerCase().replace(/s$/, "") + " row" }, "\u00d7");
  rm.addEventListener("click", () => {
    const summary = rowSummary(row);
    const parent = row.parentElement;
    const next = row.nextSibling;
    row.remove();
    state.dirty = true;
    redraw();
    if (summary && parent) {
      notify("info", "Removed " + summary + ".", {
        action: {
          label: "Undo",
          run: () => {
            parent.insertBefore(row, next && next.parentNode === parent ? next : null);
            redraw();
          },
        },
      });
    }
  });
  row.appendChild(rm);
  return row;
}

function makeList(f: Field): HTMLElement {
  const wrap = h("div", { class: "field" });
  wrap.appendChild(h("span", { class: "field-label" }, f.label));
  const rows = h("div", { "data-list": f.key });
  wrap.appendChild(rows);
  const add = h("button", { type: "button", class: "btn" }, "+ Add " + f.label.toLowerCase().replace(/s$/, ""));
  add.addEventListener("click", () => {
    const r = makeRow(f);
    rows.appendChild(r);
    const first = r.querySelector("input");
    if (first) first.focus();
    redraw();
  });
  wrap.appendChild(add);
  rows.appendChild(makeRow(f));
  return wrap;
}

export function renderFields(): void {
  el.dynamic.innerHTML = "";
  const t = currentTemplate();
  t.fields.forEach((f) => el.dynamic.appendChild(f.type === "list" ? makeList(f) : makeInput(f)));
  updatePhotoControls();
  if (t.defaultIcon && ALL_ICONS[t.defaultIcon]) el.presetIcon.value = t.defaultIcon;
  syncIconGrid();
}

export function readValues(): Values {
  const t = currentTemplate();
  const vals: Values = {};
  t.fields.forEach((f) => {
    if (f.type === "list") {
      const rows: ListRow[] = [];
      el.dynamic.querySelectorAll('[data-list="' + f.key + '"] .list-row').forEach((r) => {
        const item: ListRow = {};
        let any = false;
        (f.itemFields || []).forEach((it) => {
          const e = r.querySelector<Inp>('[data-itemkey="' + it.key + '"]');
          item[it.key] = e ? e.value : "";
          if (item[it.key]) any = true;
        });
        if (any) rows.push(item);
      });
      vals[f.key] = rows;
    } else {
      const e = el.dynamic.querySelector<Inp>('[data-key="' + f.key + '"]');
      vals[f.key] = e ? e.value : "";
    }
  });
  return vals;
}

function setListValues(f: Field, items: unknown[]): void {
  const container = el.dynamic.querySelector('[data-list="' + f.key + '"]');
  if (!container) return;
  container.innerHTML = "";
  const rows = items.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  if (!rows.length) {
    container.appendChild(makeRow(f));
    return;
  }
  rows.forEach((item) => {
    const r = makeRow(f);
    (f.itemFields || []).forEach((it) => {
      const e = r.querySelector<Inp>('[data-itemkey="' + it.key + '"]');
      if (e && item[it.key] != null) e.value = String(item[it.key]);
    });
    container.appendChild(r);
  });
}

// --- presets ---

function buildPresets(): void {
  const prefs = store.getPrefs();
  const groups: Record<string, Preset[]> = {};
  PRESETS.forEach((p) => (groups[p.platform] = groups[p.platform] || []).push(p));
  const saved = prefs.presets || PRESETS.filter((p) => p.defaultOn).map((p) => p.id);
  Object.keys(groups).forEach((plat) => {
    const g = h("div", { class: "preset-group", role: "group", "aria-label": plat });
    g.appendChild(h("div", { class: "preset-head", "aria-hidden": "true" }, plat));
    groups[plat].forEach((p) => {
      const cb = h("input", { type: "checkbox", value: p.id });
      if (saved.indexOf(p.id) !== -1) cb.checked = true;
      cb.addEventListener("change", () => {
        persistPresets();
        buildPreviewOptions();
        redraw();
      });
      g.appendChild(h("label", { class: "check" }, cb, " " + p.label.replace(p.platform + " ", "") + " ", h("span", { class: "note" }, p.w + "\u00d7" + p.h)));
    });
    el.presetList.appendChild(g);
  });
}

function persistPresets(): void {
  store.setPref("presets", selectedPresets().map((p) => p.id));
}

function setSizes(ids: string[]): void {
  el.presetList.querySelectorAll<Inp>("input[type=checkbox]").forEach((cb) => (cb.checked = ids.indexOf(cb.value) !== -1));
  buildPreviewOptions();
}

function buildPreviewOptions(): void {
  const sel = selectedPresets();
  const cur = el.previewPreset.value;
  el.previewPreset.innerHTML = "";
  (sel.length ? sel : PRESETS).forEach((p) => el.previewPreset.appendChild(option(p.id, p.label)));
  if (sel.map((p) => p.id).indexOf(cur) !== -1) el.previewPreset.value = cur;
}

// --- content library (stored locally only) ---

export function renderLibrary(): void {
  el.library.innerHTML = "";
  const items = store.getLibrary();
  if (!items.length) {
    el.library.appendChild(
      h("div", { class: "empty" }, h("p", {}, "No saved logos or photos yet. Upload a branch logo or a photo, then choose Save current logo or Save current photo to reuse it next time.")),
    );
    return;
  }
  items.forEach((it) => {
    const label = it.name || (it.kind === "logo" ? "Logo" : "Photo");
    const card = h("div", { class: "lib-item" });
    card.appendChild(h("img", { src: it.dataUrl, alt: label, width: 108, height: 64, loading: "lazy" }));
    card.appendChild(h("span", { class: "lib-name", title: label }, label));
    const row = h("div", { class: "lib-row" });
    row.appendChild(h("button", { type: "button", class: "lib-use", onclick: () => useLibraryItem(it) }, it.kind === "logo" ? "Use as logo" : "Use as photo"));
    row.appendChild(
      h("button", { type: "button", class: "remove-btn", "aria-label": "Remove " + label + " from the library", onclick: () => removeLibraryItem(it) }, "\u00d7"),
    );
    card.appendChild(row);
    el.library.appendChild(card);
  });
}

async function removeLibraryItem(it: LibraryItem): Promise<void> {
  await store.removeLibrary([it.id]);
  renderLibrary();
  redraw();
  notify("info", "Removed " + (it.name || "the item") + " from the library.", {
    action: {
      label: "Undo",
      run: async () => {
        await store.putLibrary([it]);
        renderLibrary();
        redraw();
      },
    },
  });
}

export async function useLibraryItem(it: LibraryItem): Promise<void> {
  state.dirty = true;
  if (it.kind === "logo") {
    el.branch.value = "custom";
    el.customWrap.classList.remove("hidden");
    state.customLogoData = it.dataUrl;
    state.customLogoUrl = null;
    state.customLogoImg = await loadImg(it.dataUrl);
  } else {
    state.photoData = it.dataUrl;
    state.photoUrl = null;
    state.photoImg = await loadImg(it.dataUrl);
    resetFrame();
    updatePhotoControls();
  }
  redraw();
}

async function saveToLibrary(item: LibraryItem): Promise<void> {
  if (!(await store.putLibrary([item]))) {
    notify("error", "Could not save: this browser's storage is full. Remove some library items or saved designs and try again.");
    return;
  }
  renderLibrary();
  redraw();
  notify("success", "Saved " + item.name + " to the library.");
}

// --- share links ---
// General parameters are serialised and applied through PARAM_DEFS (one schema
// shared with the docs); only structural parameters (type, branch, fields,
// sizes, photo, caption, tagline) need bespoke handling.

function control(id: string): Inp | Sel | null {
  return document.getElementById(id) as Inp | Sel | null;
}

function serializeGenericParams(qp: URLSearchParams, withPhoto: boolean, only?: (key: string) => boolean): void {
  PARAM_DEFS.forEach((d) => {
    if (!d.elId) return;
    if (only && !only(d.key)) return;
    if (d.photoOnly && !withPhoto) return;
    const sel = control(d.elId);
    if (!sel) return;
    if (d.kind === "flag") {
      const def = d.defChecked !== false;
      const checked = (sel as Inp).checked;
      if (checked !== def) qp.set(d.key, checked ? "1" : "0");
    } else if (d.kind === "color") {
      if (sel.value === d.def) return;
      const cust = d.customElId ? control(d.customElId) : null;
      qp.set(d.key, sel.value === "custom" ? (cust ? cust.value : "") : sel.value);
    } else if (String(sel.value) !== String(d.def)) {
      qp.set(d.key, sel.value);
    }
  });
}

function hasOption(sel: Sel, v: string): boolean {
  return Array.prototype.some.call(sel.options, (o: HTMLOptionElement) => o.value === v);
}

function applyGenericParams(qp: URLSearchParams, only?: (key: string) => boolean): void {
  PARAM_DEFS.forEach((d) => {
    if (!d.elId || !qp.has(d.key)) return;
    if (only && !only(d.key)) return;
    const sel = control(d.elId);
    if (!sel) return;
    const v = qp.get(d.key) || "";
    if (d.kind === "flag") {
      (sel as Inp).checked = !/^(0|false|no|off)$/i.test(v);
    } else if (d.kind === "color" && /^#[0-9a-f]{6}$/i.test(v)) {
      sel.value = "custom";
      const cust = d.customElId ? control(d.customElId) : null;
      if (cust) cust.value = v;
    } else if (sel instanceof HTMLSelectElement) {
      // Unknown values (old links, typos) keep the current choice rather than
      // leaving the dropdown blank.
      if (hasOption(sel, v)) sel.value = v;
    } else {
      sel.value = v;
    }
  });
}

/** The current form as query parameters: the format of share links and saved designs. */
export function serialize(opts: { download?: boolean } = {}): URLSearchParams {
  const qp = new URLSearchParams();
  qp.set("type", el.postType.value);
  qp.set("branch", el.branch.value);
  if (el.branch.value === "custom" && el.customName.value) qp.set("branchName", el.customName.value);
  // A custom logo that came from a URL travels with the link; an uploaded
  // file cannot, so the receiving side falls back to the text wordmark.
  if (el.branch.value === "custom" && state.customLogoUrl) qp.set("branchLogo", state.customLogoUrl);
  const t = currentTemplate();
  const vals = readValues();
  t.fields.forEach((f) => {
    const v = vals[f.key];
    if (f.type === "list") {
      if (Array.isArray(v) && v.length) qp.set(f.key, JSON.stringify(v));
    } else if (v) qp.set(f.key, String(v));
  });
  if (el.iconWrap.style.display !== "none" && el.presetIcon.value) qp.set("icon", el.presetIcon.value);
  const sizes = selectedPresets().map((p) => p.id);
  if (sizes.length) qp.set("sizes", sizes.join(","));
  if (el.previewPreset.value) qp.set("preview", el.previewPreset.value);
  const withPhoto = !!state.photoImg;
  // A photo that came from a URL travels with the link too.
  if (withPhoto && state.photoUrl) qp.set("photo", state.photoUrl);
  serializeGenericParams(qp, withPhoto);
  if (withPhoto) {
    if (!el.showCaption.checked) qp.set("caption", "off");
    else if (el.captionText.value.trim()) qp.set("caption", el.captionText.value);
  }
  if (el.tagline.value !== CONFIG.tagline) qp.set("tagline", el.tagline.value === "" ? "none" : el.tagline.value);
  if (el.campaignBranch.checked && !el.campaignWrap.classList.contains("hidden")) qp.set("branchOnCampaign", "1");
  if (opts.download) qp.set("download", "1");
  return qp;
}

export function shareLink(opts: { download?: boolean } = {}): string {
  // location.href without its query works from a file:// page too, where
  // location.origin is the string "null".
  const base = location.href.split(/[?#]/)[0];
  return base + "?" + serialize(opts).toString();
}

export interface ApplyResult {
  download: boolean;
  zip: boolean | null;
}

// Applies query parameters to the form. Pure form state only: images are
// loaded separately by loadAssets().
export function applyParams(qp: URLSearchParams): ApplyResult {
  const result: ApplyResult = { download: false, zip: null };
  let hasAny = false;
  qp.forEach(() => (hasAny = true));
  if (!hasAny) return result;

  const type = qp.get("type");
  if (type && templateById(type)) el.postType.value = type;
  renderFields();

  const br = qp.get("branch");
  if (br && (br === "custom" || CONFIG.branches[br])) el.branch.value = br;
  const custom = el.branch.value === "custom";
  el.customWrap.classList.toggle("hidden", !custom);
  if (qp.has("branchName")) el.customName.value = qp.get("branchName") || "";
  if (custom && qp.get("branchLogo")) state.customLogoUrl = qp.get("branchLogo");

  const t = currentTemplate();
  t.fields.forEach((f) => {
    if (!qp.has(f.key)) return;
    const raw = qp.get(f.key) || "";
    if (f.type === "list") {
      let items: unknown = [];
      try {
        items = JSON.parse(raw) || [];
      } catch {
        items = [];
      }
      setListValues(f, Array.isArray(items) ? items : []);
    } else {
      const e = el.dynamic.querySelector<Inp | Sel>('[data-key="' + f.key + '"]');
      if (e instanceof HTMLSelectElement) {
        if (hasOption(e, raw)) e.value = raw;
      } else if (e) e.value = raw;
    }
  });

  const icon = qp.get("icon");
  if (icon && (icon === "none" || ICON_NAMES.indexOf(icon) !== -1)) el.presetIcon.value = icon;

  if (qp.has("sizes")) {
    setSizes((qp.get("sizes") || "").split(",").map((s) => s.trim()));
  }
  const prev = qp.get("preview");
  if (prev && hasOption(el.previewPreset, prev)) el.previewPreset.value = prev;

  applyGenericParams(qp);
  syncIconGrid();
  syncLogoFields();
  syncColorPickers();
  syncFrameDisabled();
  syncLogoPreset();

  if (qp.has("caption")) {
    const capParam = qp.get("caption") || "";
    if (/^off$/i.test(capParam)) el.showCaption.checked = false;
    else {
      el.showCaption.checked = true;
      el.captionText.value = capParam;
    }
  }

  if (qp.has("branchOnCampaign")) el.campaignBranch.checked = /^(1|true|yes)$/i.test(qp.get("branchOnCampaign") || "");
  if (qp.has("tagline")) applyTagline(qp.get("tagline") || "");

  if (qp.get("photo")) state.photoUrl = qp.get("photo");

  if (qp.get("docs") === "1") openAccordion(el.docsBtn, el.docsPanel);
  if (qp.get("brand") === "1") {
    renderBrand();
    openAccordion(el.brandBtn, el.brandPanel);
  }
  result.download = /^(1|true|yes)$/i.test(qp.get("download") || "");
  if (qp.has("zip")) result.zip = /^(1|true|yes)$/i.test(qp.get("zip") || "");
  return result;
}

// Only the two approved taglines (or none) are allowed (Brand Guidelines p.16).
function applyTagline(tg: string): void {
  if (/^none$/i.test(tg) || tg === "") {
    el.tagline.value = "";
    return;
  }
  const match = TAGLINES.find((t) => t.toLowerCase() === tg.trim().toLowerCase());
  if (match) el.tagline.value = match;
  else notify("info", "The link asked for a tagline that is not one of the two approved CAMRA taglines, so the default tagline is shown.");
}

// --- the look (style) controls: brand defaults and personal defaults ---

// Orientation and padding are per-post size choices, so they are not part of
// the look a user saves as their default.
// The icon style belongs with the icon choice, not the look, for the same reason.
const NOT_LOOK = new Set(["orient", "pad", "iconpos", "iconsize", "iconopacity", "iconcolor"]);
const LOOK_KEYS = new Set(PARAM_DEFS.filter((d) => d.elId && !d.photoOnly && !NOT_LOOK.has(d.key)).map((d) => d.key));
const isLookKey = (k: string) => LOOK_KEYS.has(k);

/** The look controls (colours, logo, alignment, padding, tagline) as a query string. */
export function lookQuery(): string {
  const qp = new URLSearchParams();
  serializeGenericParams(qp, false, isLookKey);
  if (el.tagline.value !== CONFIG.tagline) qp.set("tagline", el.tagline.value === "" ? "none" : el.tagline.value);
  return qp.toString();
}

export function isLookDefault(): boolean {
  return lookQuery() === "";
}

/** Puts every look control back to the built-in brand defaults. */
export function resetLook(): void {
  PARAM_DEFS.forEach((d) => {
    if (!d.elId || !isLookKey(d.key)) return;
    const c = control(d.elId);
    if (!c) return;
    if (d.kind === "flag") (c as Inp).checked = d.defChecked !== false;
    else c.value = d.def || "";
  });
  el.tagline.value = CONFIG.tagline;
  syncColorPickers();
  syncLogoPreset();
  syncLogoFields();
}

export function applyLook(query: string): void {
  const qp = new URLSearchParams(query);
  applyGenericParams(qp, isLookKey);
  if (qp.has("tagline")) applyTagline(qp.get("tagline") || "");
  syncColorPickers();
  syncLogoPreset();
  syncLogoFields();
}

/** Resets the whole form to defaults: built-in, then the user's saved default look. */
export function resetForm(opts: { personal: boolean }): void {
  resetLook();
  el.orient.value = "as";
  el.pad.value = "1";
  el.campaignBranch.checked = false;
  el.showLabel.checked = true;
  el.showText.checked = true;
  el.showCaption.checked = true;
  el.captionText.value = "";
  el.frameMode.value = "labelOut";
  el.fbStyle.value = "gradient";
  resetIconStyle();
  resetFrame();
  clearPhotoState();
  renderFields();
  if (opts.personal) {
    const p = store.getPrefs();
    if (p.styleDefaults) applyLook(p.styleDefaults);
  }
  state.currentDesignId = null;
  state.dirty = false;
}

function clearPhotoState(): void {
  state.photoImg = null;
  state.photoData = null;
  state.photoUrl = null;
  el.photo.value = "";
  updatePhotoControls();
}

// Logo size follows the house pattern: a default, a few presets, then free
// fine-tuning. The slider is the single source of truth (and the logoScale
// share parameter); the preset dropdown writes to it and mirrors it, showing
// "Custom" when the slider sits between presets.
function syncLogoPreset(): void {
  const v = parseFloat(el.logoScale.value) || 1.25;
  let match = "";
  Array.prototype.forEach.call(el.logoPreset.options, (o: HTMLOptionElement) => {
    if (o.value !== "custom" && Math.abs(parseFloat(o.value) - v) < 0.001) match = o.value;
  });
  el.logoPreset.value = match || "custom";
}

// --- saved designs: capture and restore the whole form ---

export interface FormSnapshot {
  params: string;
  photo: string | null;
  logo: string | null;
}

export function captureForm(): FormSnapshot {
  return {
    params: serialize().toString(),
    photo: state.photoImg && !state.photoUrl ? state.photoData : null,
    logo: el.branch.value === "custom" && !state.customLogoUrl ? state.customLogoData : null,
  };
}

/** Replaces the form with a snapshot, loading its images. */
export async function restoreForm(s: FormSnapshot): Promise<void> {
  resetForm({ personal: false });
  const qp = new URLSearchParams(s.params);
  state.customLogoUrl = null;
  applyParams(qp);
  if (s.logo) state.customLogoData = s.logo;
  if (s.photo) state.photoData = s.photo;
  await loadAssets();
  updatePhotoControls();
  redrawNow();
}

/** Renders a small JPEG preview of the current form. */
export function thumbnail(maxSide = 240): string | null {
  try {
    const p = activePreset();
    const d = dims(p);
    const c = renderCanvas(renderOptions(buildLayout()), d.w, d.h);
    return imageToDataUrl(c as unknown as Img, maxSide, "image/jpeg", 0.8);
  } catch {
    return null;
  }
}

// --- docs and brand panels ---

function openAccordion(btn: HTMLButtonElement, panel: HTMLElement): void {
  panel.classList.remove("hidden");
  btn.classList.add("open");
  btn.setAttribute("aria-expanded", "true");
}
function toggleAccordion(btn: HTMLButtonElement, panel: HTMLElement): void {
  const willOpen = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !willOpen);
  btn.classList.toggle("open", willOpen);
  btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
  if (willOpen) reveal(panel);
}
function renderDocs(): void {
  el.docsBody.innerHTML = docsHtml();
}
function renderBrand(): void {
  el.brandBody.innerHTML = panelHtml();
}

// --- boot ---

function buildSelectors(): void {
  const prefs = store.getPrefs();
  TEMPLATE_GROUPS.forEach((g) => {
    const list = TEMPLATES.filter((t) => t.group === g);
    if (!list.length) return;
    const og = document.createElement("optgroup");
    og.label = g;
    list.forEach((t) => og.appendChild(option(t.id, t.label)));
    el.postType.appendChild(og);
  });
  if (prefs.postType && templateById(prefs.postType)) el.postType.value = prefs.postType;
  Object.keys(CONFIG.branches).forEach((k) => el.branch.appendChild(option(k, CONFIG.branches[k].name)));
  el.branch.appendChild(option("custom", "Custom (other branch)"));
  const br = prefs.branch && (prefs.branch === "custom" || CONFIG.branches[prefs.branch]) ? prefs.branch : CONFIG.defaultBranch;
  el.branch.value = br;
  el.presetIcon.appendChild(option("none", "None"));
  ICON_NAMES.forEach((k) => el.presetIcon.appendChild(option(k, iconLabel(k))));
  el.region.appendChild(option("", "Choose a region"));
  REGION_LOGOS.forEach((r) => el.region.appendChild(option(r.id, r.name + (r.logo ? "" : " (text wordmark)"))));
  el.subBrand.appendChild(option("", "Choose a sub-brand"));
  SUB_BRAND_LOGOS.forEach((r) => el.subBrand.appendChild(option(r.id, r.name)));
  buildIconGrid();
}

// --- decorative icon picker ---
// A grid of real radio buttons, each showing the icon drawn exactly as the
// renderer draws it. The hidden presetIcon select stays the single source of
// truth for share links and saved designs.

function iconRadio(id: string, label: string): HTMLElement {
  const r = h("input", { type: "radio", name: "iconPick", value: id, "aria-label": label });
  r.addEventListener("change", () => {
    el.presetIcon.value = id;
    state.dirty = true;
    redraw();
  });
  let face: HTMLElement;
  if (id === "none") face = h("span", { class: "none", "aria-hidden": "true" }, "None");
  else {
    const c = h("canvas", { width: 96, height: 96, "aria-hidden": "true" });
    const cx = c.getContext("2d");
    if (cx && ALL_ICONS[id]) {
      cx.fillStyle = "#ffffff";
      ALL_ICONS[id](cx, 48, 48, 70);
    }
    face = c;
  }
  return h("label", { class: "icon-opt", title: label, "data-icon": id, "data-label": label.toLowerCase() }, r, face);
}

function buildIconGrid(): void {
  el.iconGrid.innerHTML = "";
  el.iconGrid.appendChild(iconRadio("none", "No icon"));
  ICON_GROUPS.forEach((g) => {
    el.iconGrid.appendChild(h("h3", { "data-group": "1" }, g.label));
    g.icons.forEach((id) => el.iconGrid.appendChild(iconRadio(id, iconLabel(id))));
  });
}

function syncIconGrid(): void {
  const v = el.presetIcon.value || "none";
  el.iconGrid.querySelectorAll<Inp>("input[name=iconPick]").forEach((r) => (r.checked = r.value === v));
}

function filterIcons(): void {
  const q = el.iconFilter.value.trim().toLowerCase();
  el.iconGrid.querySelectorAll<HTMLElement>(".icon-opt").forEach((o) => {
    o.hidden = !!q && !(o.dataset.label || "").includes(q) && !(o.dataset.icon || "").includes(q);
  });
  el.iconGrid.querySelectorAll<HTMLElement>("h3[data-group]").forEach((hd) => (hd.hidden = !!q));
}

function resetIconStyle(): void {
  el.iconPos.value = "top-right";
  el.iconSize.value = "1";
  el.iconOpacity.value = "0.1";
  el.iconColor.value = "auto";
}

/** Shows the region or sub-brand choice only when that logo is selected. */
function syncLogoFields(): void {
  el.regionWrap.classList.toggle("hidden", el.logos.value !== "region");
  el.subBrandWrap.classList.toggle("hidden", el.logos.value !== "subbrand");
}

async function loadSlotImages(): Promise<void> {
  const r = findLogo(REGION_LOGOS, el.region.value);
  const t = currentTemplate();
  const sbId = el.logos.value === "subbrand" ? el.subBrand.value : t.subBrand;
  const sb = findLogo(SUB_BRAND_LOGOS, sbId);
  const [ri, si] = await Promise.all([loadImg(r && r.logo), loadImg(sb && sb.logo)]);
  state.regionImg = ri;
  state.subBrandImg = si;
}

// Loads the brand typeface before anything is drawn or exported, so canvas
// text never silently bakes in the fallback font. Arboria is licensed, so it
// is not bundled: drop arboria.woff2 and arboria-bold.woff2 into assets/fonts/
// and they are picked up here; without them the approved Arial fallback is used.
declare const __HAS_FONTS__: boolean;
export async function loadFonts(): Promise<void> {
  // The build knows whether the font files exist, so a site without them
  // makes no doomed requests.
  if (!__HAS_FONTS__ || !(window.FontFace && document.fonts)) return;
  const faces = [
    new FontFace("Arboria", 'url("assets/fonts/arboria.woff2")', { weight: "400" }),
    new FontFace("Arboria", 'url("assets/fonts/arboria-bold.woff2")', { weight: "700" }),
  ];
  await Promise.all(
    faces.map((f) =>
      f.load().then(
        (ff) => {
          document.fonts.add(ff);
        },
        () => undefined, // font file not present: Arial fallback
      ),
    ),
  );
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
}

// Loads every image the current state needs, once.
async function reloadSlotPublic(): Promise<void> {
  syncLogoFields();
  await loadSlotImages();
  redraw();
}

export async function loadAssets(): Promise<void> {
  const jobs: Array<Promise<void>> = [loadSlotImages()];
  if (!state.camraLogoImg) jobs.push(loadImg(CONFIG.camraLogo).then((im) => void (state.camraLogoImg = im)));
  if (el.branch.value !== "custom") {
    jobs.push(loadImg(currentBranch().logo).then((im) => void (state.branchLogoImg = im)));
  }
  if (state.customLogoUrl) jobs.push(loadImgCors(state.customLogoUrl).then((im) => void (state.customLogoImg = im)));
  else if (state.customLogoData) jobs.push(loadImg(state.customLogoData).then((im) => void (state.customLogoImg = im)));
  else state.customLogoImg = null;
  if (state.photoUrl) {
    jobs.push(
      loadImgCors(state.photoUrl).then((im) => {
        state.photoImg = im;
        if (im) state.photoData = null;
      }),
    );
  } else if (state.photoData) jobs.push(loadImg(state.photoData).then((im) => void (state.photoImg = im)));
  else state.photoImg = null;
  await Promise.all(jobs);
}

function wireEvents(): void {
  const markDirty = () => (state.dirty = true);
  el.controls.addEventListener("input", markDirty);
  el.controls.addEventListener("change", markDirty);
  el.reframeWrap.addEventListener("input", markDirty);
  el.reframeWrap.addEventListener("change", markDirty);
  el.controls.addEventListener("submit", (e) => e.preventDefault());

  el.postType.addEventListener("change", async () => {
    store.setPref("postType", el.postType.value);
    renderFields();
    redraw();
    // A post type can suggest a sub-brand logo (LocAle, Pub Heritage).
    await loadSlotImages();
    redraw();
  });
  el.logos.addEventListener("change", reloadSlotPublic);
  el.branch.addEventListener("change", async () => {
    const custom = el.branch.value === "custom";
    el.customWrap.classList.toggle("hidden", !custom);
    store.setPref("branch", el.branch.value);
    if (!custom) state.branchLogoImg = await loadImg(currentBranch().logo);
    redraw();
  });
  el.customName.addEventListener("input", () => {
    store.setPref("customName", el.customName.value);
    redraw();
  });
  el.customLogo.addEventListener("change", async () => {
    const f = el.customLogo.files && el.customLogo.files[0];
    if (!f) return;
    const data = await fileToDataUrl(f);
    state.customLogoData = data;
    state.customLogoUrl = null;
    if (el.saveCustomLogo.checked) {
      if (!(await store.setCustomLogo(data))) notify("warn", "The logo is in use, but this browser's storage is full, so it will not be remembered next time.");
    }
    state.customLogoImg = await loadImg(data);
    redraw();
  });
  el.saveCustomLogo.addEventListener("change", () => {
    // Unticking forgets a previously remembered logo, so the box means what it says.
    if (!el.saveCustomLogo.checked) store.setCustomLogo(null);
    else if (state.customLogoData) store.setCustomLogo(state.customLogoData);
  });
  el.dynamic.addEventListener("input", redraw);
  el.dynamic.addEventListener("change", redraw);
  el.photo.addEventListener("change", async () => {
    const f = el.photo.files && el.photo.files[0];
    if (!f) return;
    const data = await fileToDataUrl(f);
    state.photoData = data;
    state.photoUrl = null;
    state.photoImg = await loadImg(data);
    if (!state.photoImg) notify("error", "That file could not be read as an image. Try a JPEG or PNG.");
    resetFrame();
    updatePhotoControls();
    redraw();
  });
  el.clearPhoto.addEventListener("click", () => {
    clearPhotoState();
    redraw();
  });
  el.presetIcon.addEventListener("change", redraw);
  el.iconFilter.addEventListener("input", filterIcons);
  [el.iconPos, el.iconSize].forEach((c) => c.addEventListener("change", redraw));
  el.iconOpacity.addEventListener("input", redraw);
  el.iconColor.addEventListener("change", () => {
    syncColorPickers();
    redraw();
  });
  el.iconCustom.addEventListener("input", redraw);
  const reloadSlot = async () => {
    syncLogoFields();
    await loadSlotImages();
    redraw();
  };
  el.region.addEventListener("change", reloadSlot);
  el.subBrand.addEventListener("change", reloadSlot);
  el.fitMode.addEventListener("change", () => {
    syncFrameDisabled();
    redraw();
  });
  [el.frameMode, el.showLabel, el.showText, el.showCaption, el.campaignBranch, el.tagline, el.orient, el.pad, el.bgStyle, el.fbStyle, el.previewPreset].forEach((c) =>
    c.addEventListener("change", redraw),
  );
  [el.captionText, el.frameX, el.frameY, el.frameZoom, el.photoOpacity].forEach((c) => c.addEventListener("input", redraw));
  el.resetFrame.addEventListener("click", () => {
    resetFrame();
    redraw();
  });
  ([
    [el.bgColor, el.bgCustom],
    [el.titleColor, el.titleCustom],
    [el.subColor, el.subCustom],
    [el.bodyColor, el.bodyCustom],
    [el.capColor, el.capCustom],
  ] as Array<[Sel, Inp]>).forEach(([sel, inp]) => {
    sel.addEventListener("change", () => {
      syncColorPickers();
      redraw();
    });
    inp.addEventListener("input", redraw);
  });
  el.logoPreset.addEventListener("change", () => {
    if (el.logoPreset.value === "custom") return;
    el.logoScale.value = el.logoPreset.value;
    redraw();
  });
  el.logoScale.addEventListener("input", () => {
    syncLogoPreset();
    redraw();
  });
  [el.logoAlign, el.titleAlign, el.subAlign, el.bodyAlign, el.capAlign, el.taglineAlign].forEach((sel) => sel.addEventListener("change", redraw));

  byId("resetLook").addEventListener("click", () => {
    const before = lookQuery();
    resetLook();
    state.dirty = true;
    redraw();
    if (before) notify("info", "Look reset to the brand defaults.", { action: { label: "Undo", run: () => { resetLook(); applyLook(before); redraw(); } } });
  });
  byId("saveLookDefault").addEventListener("click", () => {
    const q = lookQuery();
    store.setPref("styleDefaults", q || undefined);
    notify("success", q ? "Saved as your default look. New posts start with it; shared links still show exactly what was shared." : "Your default look is the brand default.");
  });

  el.saveLogoLib.addEventListener("click", () => {
    const name = el.customName.value || "Branch logo";
    if (state.customLogoData) return void saveToLibrary({ id: newId("itm"), kind: "logo", name, dataUrl: state.customLogoData, createdAt: new Date().toISOString() });
    if (state.customLogoImg) {
      // A logo that came from a URL has no stored data; capture it as PNG
      // (keeps transparency). Fails when the host blocks cross-origin use.
      try {
        return void saveToLibrary({ id: newId("itm"), kind: "logo", name, dataUrl: imageToDataUrl(state.customLogoImg, 1200, "image/png"), createdAt: new Date().toISOString() });
      } catch {
        return void notify("error", "This logo came from a URL whose host blocks cross-origin use, so it cannot be saved. Download the file and upload it instead.");
      }
    }
    notify("warn", "Upload a custom branch logo first: choose Custom under Branch, then Upload branch logo.");
  });
  el.savePhotoLib.addEventListener("click", () => {
    const mk = (dataUrl: string): LibraryItem => ({ id: newId("itm"), kind: "image", name: "Photo " + new Date().toLocaleDateString(), dataUrl, createdAt: new Date().toISOString() });
    if (!state.photoImg && !state.photoData) return void notify("warn", "Add a photo first, under Photo or icon.");
    // Photos are downscaled (longest side 1600px, JPEG) before saving.
    if (state.photoImg) {
      try {
        return void saveToLibrary(mk(imageToDataUrl(state.photoImg, 1600, "image/jpeg", 0.85)));
      } catch {
        if (state.photoData) return void saveToLibrary(mk(state.photoData));
        return void notify("error", "This photo came from a URL whose host blocks cross-origin use, so it cannot be saved. Download the file and upload it instead.");
      }
    }
    if (state.photoData) saveToLibrary(mk(state.photoData));
  });

  el.docsBtn.addEventListener("click", () => toggleAccordion(el.docsBtn, el.docsPanel));
  el.brandBtn.addEventListener("click", () => {
    renderBrand();
    toggleAccordion(el.brandBtn, el.brandPanel);
  });

  // Remember which groups are open between visits.
  el.controls.querySelectorAll<HTMLDetailsElement>("details.group").forEach((d) => {
    const key = d.dataset.group || "";
    const saved = store.getPrefs().groups || {};
    if (key in saved) d.open = !!saved[key];
    d.addEventListener("toggle", () => {
      const g = { ...(store.getPrefs().groups || {}) };
      g[key] = d.open;
      store.setPref("groups", g);
    });
  });
}

/** Builds the form and applies saved preferences and the page's URL parameters. */
export async function initEditor(): Promise<ApplyResult> {
  buildSelectors();
  buildPresets();
  buildPreviewOptions();
  renderFields();
  renderLibrary();
  const prefs = store.getPrefs();
  if (prefs.customName) el.customName.value = prefs.customName;
  if (el.branch.value === "custom") el.customWrap.classList.remove("hidden");
  const remembered = store.getCustomLogo();
  if (remembered) state.customLogoData = remembered;
  renderDocs();
  syncColorPickers();
  wireEvents();
  const qp = new URLSearchParams(window.location.search);
  // A link reproduces exactly what was shared; the user's default look only
  // applies when the studio opens without one.
  const isLink = qp.has("type") || Array.from(qp.keys()).some((k) => LOOK_KEYS.has(k));
  if (!isLink && prefs.styleDefaults) applyLook(prefs.styleDefaults);
  const result = applyParams(qp);
  await loadFonts();
  await loadAssets();
  updatePhotoControls();
  redrawNow();
  return result;
}
