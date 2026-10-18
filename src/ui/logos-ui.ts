// The logo picker: every branch, region and sub-brand logo in one searchable
// grid, plus the user's own uploaded logos. Picking one sets the matching
// form controls, so share links, saved designs and the Logo shown rules all
// keep working exactly as if the dropdowns had been used.

import { BRANCH_LOGOS, REGION_LOGOS, SUB_BRAND_LOGOS, searchLogos, type LogoEntry } from "../core/logos.ts";
import { byId, h } from "./dom.ts";
import { closeDialog, openDialog } from "./dialog.ts";
import { notify } from "./notices.ts";
import { store } from "./store.ts";
import * as E from "./editor.ts";

type Tab = "branch" | "region" | "subBrand" | "own";
const view = { tab: "branch" as Tab, q: "" };
const dlg = () => byId<HTMLDialogElement>("logoDialog");

function set(sel: HTMLSelectElement, value: string): void {
  sel.value = value;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

function pick(e: LogoEntry): void {
  if (e.category === "branch") {
    set(E.el.branch, e.id);
    if (E.el.logos.value === "region" || E.el.logos.value === "subbrand") set(E.el.logos, "auto");
  } else if (e.category === "region") {
    set(E.el.region, e.id);
    set(E.el.logos, "region");
  } else {
    set(E.el.subBrand, e.id);
    set(E.el.logos, "subbrand");
  }
  E.state.dirty = true;
  closeDialog(dlg());
  notify("success", "Using the " + e.name + (e.category === "region" ? " region" : "") + " logo." + (e.logo ? "" : " There is no logo file for it yet, so a text wordmark shows."));
}

function isCurrent(e: LogoEntry): boolean {
  const logos = E.el.logos.value;
  if (e.category === "branch") return E.el.branch.value === e.id && logos !== "region" && logos !== "subbrand";
  if (e.category === "region") return logos === "region" && E.el.region.value === e.id;
  return logos === "subbrand" && E.el.subBrand.value === e.id;
}

function card(e: LogoEntry): HTMLElement {
  const face = e.thumb ? h("img", { src: e.thumb, alt: "", width: 240, height: 114, loading: "lazy", decoding: "async" }) : h("span", { class: "wordmark", "aria-hidden": "true" }, e.category === "region" ? "CAMRA " + e.name : e.name);
  return h(
    "li",
    {},
    h(
      "button",
      { type: "button", class: "logo-opt" + (isCurrent(e) ? " current" : ""), "aria-pressed": isCurrent(e) ? "true" : "false", onclick: () => pick(e) },
      face,
      h("span", {}, e.name),
      e.logo ? null : h("span", { class: "missing" }, "Logo file needed: shows as text"),
    ),
  );
}

function render(): void {
  const body = byId("logoBody");
  const focusId = document.activeElement && document.activeElement.id;
  body.innerHTML = "";
  const own = store.getLibrary().filter((i) => i.kind === "logo");
  const tabs: Array<[Tab, string, number]> = [
    ["branch", "Branches", BRANCH_LOGOS.length],
    ["region", "Regions", REGION_LOGOS.length],
    ["subBrand", "Sub-brands", SUB_BRAND_LOGOS.length],
    ["own", "Your logos", own.length],
  ];
  const bar = h("div", { class: "tabs", role: "tablist", "aria-label": "Logo type" });
  tabs.forEach(([id, label, n]) => {
    bar.append(
      h("button", { type: "button", class: "tab", role: "tab", id: "logoTab-" + id, "aria-selected": view.tab === id ? "true" : "false", "aria-controls": "logoPanel", onclick: () => { view.tab = id; render(); } }, label + " (" + n + ")"),
    );
  });
  body.append(bar);
  const panel = h("div", { id: "logoPanel", role: "tabpanel", "aria-labelledby": "logoTab-" + view.tab });
  body.append(panel);

  if (view.tab === "own") {
    panel.append(h("p", { class: "note" }, "Logos you have uploaded and saved to the content library. They stay in this browser only."));
    panel.append(
      h("div", { class: "row-actions" }, h("button", { type: "button", class: "btn", onclick: () => { closeDialog(dlg()); set(E.el.branch, "custom"); E.el.customLogo.click(); } }, "Upload a logo")),
    );
    if (!own.length) panel.append(h("div", { class: "empty" }, h("p", {}, "No saved logos yet. Upload a white PNG logo, then choose Save current logo in the Content library to keep it here.")));
    else
      panel.append(
        h("ul", { class: "logo-grid" }, ...own.map((it) =>
          h("li", {}, h("button", { type: "button", class: "logo-opt", onclick: () => { E.useLibraryItem(it); closeDialog(dlg()); notify("success", "Using " + it.name + "."); } }, h("img", { src: it.dataUrl, alt: "", width: 240, height: 114 }), h("span", {}, it.name))),
        )),
      );
  } else {
    const list = view.tab === "branch" ? BRANCH_LOGOS : view.tab === "region" ? REGION_LOGOS : SUB_BRAND_LOGOS;
    const search = h("input", { type: "search", id: "logoSearch", placeholder: view.tab === "branch" ? "Search branches, for example Leeds or Wirral" : "Search", "aria-label": "Search logos", value: view.q });
    search.addEventListener("input", () => {
      view.q = search.value;
      render();
    });
    panel.append(h("div", { class: "toolbar", role: "search" }, search));
    if (view.tab === "region" && REGION_LOGOS.some((r) => !r.logo)) {
      panel.append(h("p", { class: "note" }, "Region logos without a file show as a text wordmark. Add the white PNGs with scripts/import-logos.py and they appear here."));
    }
    if (view.tab === "subBrand") panel.append(h("p", { class: "note" }, "Sub-brand logos replace the branch logo, so a graphic still carries one logo."));
    const found = searchLogos(list, view.q);
    panel.append(h("p", { class: "result-count", role: "status", "aria-live": "polite" }, found.length === list.length ? list.length + " logos" : found.length + " of " + list.length + " logos"));
    if (found.length) panel.append(h("ul", { class: "logo-grid" }, ...found.map(card)));
    else panel.append(h("div", { class: "empty" }, h("p", {}, "No logos match that search. Try part of the name, or pick Custom under Branch to upload your own.")));
  }
  if (focusId) {
    const back = document.getElementById(focusId);
    if (back instanceof HTMLInputElement) {
      back.focus();
      back.setSelectionRange(back.value.length, back.value.length);
    } else if (back) back.focus();
  }
}

export function openLogoPicker(tab?: Tab): void {
  if (tab) view.tab = tab;
  else view.tab = E.el.logos.value === "region" ? "region" : E.el.logos.value === "subbrand" ? "subBrand" : "branch";
  view.q = "";
  render();
  openDialog(dlg(), document.getElementById("logoSearch"));
}

export function initLogoPicker(): void {
  byId("browseLogos").addEventListener("click", () => openLogoPicker());
}
