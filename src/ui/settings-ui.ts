// Settings: appearance, defaults, help, data (storage, backup, import, clear)
// and about. Settings apply straight away and are kept in this browser.
// Precedence for the look of a graphic, later wins: brand defaults, your
// saved default look (fresh posts only), then a link's parameters.

import { byId, formatBytes, h } from "./dom.ts";
import { confirmDialog, openDialog } from "./dialog.ts";
import { notify } from "./notices.ts";
import { store } from "./store.ts";
import { applyTheme, type ThemePref } from "./theme.ts";
import { exportAll, pickImportFile } from "./backup-ui.ts";
import { startTips } from "./tips.ts";
import * as E from "./editor.ts";
import { CATEGORIES, LEAD_OPTIONS } from "../core/campaigns.ts";
import { backgroundActive, getPrefs as campaignPrefs, openCampaigns, resetReminders, setPrefs as setCampaignPrefs, setSystem, systemSupported } from "./campaigns-ui.ts";

declare const __APP_VERSION__: string;

const dlg = () => byId<HTMLDialogElement>("settingsDialog");

function section(title: string, ...children: Array<Node | null>): HTMLElement {
  return h("section", { class: "dlg-section" }, h("h3", {}, title), ...children);
}

function radioGroup(name: string, legend: string, options: Array<[string, string]>, value: string, onChange: (v: string) => void): HTMLElement {
  const fs = h("fieldset", { class: "field" }, h("legend", {}, legend));
  const seg = h("div", { class: "segmented" });
  options.forEach(([v, label]) => {
    const r = h("input", { type: "radio", name, value: v });
    r.checked = v === value;
    r.addEventListener("change", () => onChange(v));
    seg.append(h("label", {}, r, h("span", {}, label)));
  });
  fs.append(seg);
  return fs;
}

async function render(): Promise<void> {
  const body = byId("settingsBody");
  const prefs = store.getPrefs();
  body.innerHTML = "";

  body.append(
    section(
      "Appearance",
      radioGroup("themePref", "Theme", [["dark", "Dark"], ["light", "Light"], ["system", "Match system"]], prefs.theme || "dark", (v) => {
        store.setPref("theme", v);
        applyTheme(v as ThemePref);
      }),
      h("p", { class: "note" }, "Changes the studio only. Graphics always use the CAMRA brand colours."),
    ),
  );

  const lookState = h("p", { class: "note" }, prefs.styleDefaults ? "You have a saved default look. New posts start with it." : "New posts start with the CAMRA brand defaults.");
  const lookRow = h("div", { class: "row-actions" },
    h("button", { type: "button", class: "btn", onclick: () => { const q = E.lookQuery(); store.setPref("styleDefaults", q || undefined); notify("success", q ? "Saved the current look as your default." : "The current look is the brand default."); render(); } }, "Use the current look as my default"),
    prefs.styleDefaults ? h("button", { type: "button", class: "ghost", onclick: () => { store.setPref("styleDefaults", undefined); notify("info", "Cleared your default look. New posts use the brand defaults."); render(); } }, "Clear my default look") : null,
  );
  body.append(
    section(
      "Defaults",
      lookState,
      lookRow,
      radioGroup("dlFormatPref", "Download format", [["png", "Separate PNGs"], ["zip", "One ZIP file"]], prefs.downloadFormat || "png", (v) => {
        store.setPref("downloadFormat", v);
        document.querySelectorAll<HTMLInputElement>('input[name="dlFormat"]').forEach((r) => {
          r.checked = r.value === v;
        });
        E.redraw();
      }),
      h("p", { class: "note" }, "Links always show exactly what was shared. Your default look applies when you open the studio without a link, or start a new post."),
    ),
  );

  // Campaign reminders.
  const cp = campaignPrefs();
  const remind = h("input", { type: "checkbox", id: "campRemind" });
  remind.checked = cp.enabled;
  remind.addEventListener("change", async () => {
    await setCampaignPrefs({ ...campaignPrefs(), enabled: remind.checked });
    render();
  });
  const catBoxes = CATEGORIES.map((c) => {
    const cb = h("input", { type: "checkbox", id: "campCat-" + c.id });
    cb.checked = cp.categories.includes(c.id);
    cb.disabled = !cp.enabled;
    cb.addEventListener("change", () => {
      const p = campaignPrefs();
      p.categories = cb.checked ? Array.from(new Set(p.categories.concat(c.id))) : p.categories.filter((x) => x !== c.id);
      setCampaignPrefs(p);
    });
    return h("label", { class: "check", for: cb.id }, cb, " " + c.label);
  });
  const lead = h("select", { id: "campLead" }, ...LEAD_OPTIONS.map(([v, l]) => h("option", { value: v }, l)));
  lead.value = cp.leadDays ? String(cp.leadDays) : "";
  lead.disabled = !cp.enabled;
  lead.addEventListener("change", () => setCampaignPrefs({ ...campaignPrefs(), leadDays: lead.value ? Number(lead.value) : null }));
  const sys = h("input", { type: "checkbox", id: "campSystem" });
  sys.checked = cp.system && systemSupported() && Notification.permission === "granted";
  sys.disabled = !cp.enabled || !systemSupported();
  sys.addEventListener("change", async () => {
    sys.checked = await setSystem(sys.checked);
    render();
  });
  const bgNote = h("p", { class: "note" }, systemSupported() ? "Notifications arrive when you open the studio. Installed as an app in Chrome or Edge, it can also check while closed." : "This browser cannot show notifications; reminders still appear in the studio.");
  if (sys.checked) backgroundActive().then((on) => { if (on) bgNote.textContent = "Notifications are on, including checks while the studio is closed."; });
  const campaignsSection = section(
    "Campaign reminders",
    h("label", { class: "check", for: remind.id }, remind, " Remind me before national campaigns (to schedule posts) and while they are on"),
    h("fieldset", { class: "field" }, h("legend", {}, "Remind me about"), ...catBoxes),
    h("div", { class: "field" }, h("label", { for: lead.id }, "How far ahead"), lead),
    h("label", { class: "check", for: sys.id }, sys, " Also show a system notification"),
    bgNote,
    h("div", { class: "row-actions" },
      h("button", { type: "button", class: "ghost", onclick: () => { dlg().close(); openCampaigns(); } }, "Open Campaigns and calendar links"),
      h("button", { type: "button", class: "ghost", onclick: async () => { await resetReminders(); notify("info", "Dismissed and snoozed reminders are back."); } }, "Bring back dismissed reminders"),
    ),
  );
  body.append(campaignsSection);

  const tipsCb = h("input", { type: "checkbox" });
  tipsCb.checked = !store.tipsSeen();
  tipsCb.addEventListener("change", () => store.setTipsSeen(!tipsCb.checked));
  body.append(
    section(
      "Help",
      h("label", { class: "check" }, tipsCb, " Show the tips walkthrough next time the studio opens"),
      h("div", { class: "row-actions" }, h("button", { type: "button", class: "ghost", onclick: () => { dlg().close(); startTips(true, byId("helpBtn")); } }, "Show the tips now")),
    ),
  );

  const designs = store.getDesigns();
  const library = store.getLibrary();
  const est = await store.estimate();
  const persisted = await store.persisted();
  const usage = h("p", { class: "note" }, (est ? "Using " + formatBytes(est.usage) + (est.quota ? " of about " + formatBytes(est.quota) + " available" : "") + ". " : "") + designs.filter((d) => !d.deletedAt).length + " saved designs, " + designs.filter((d) => d.deletedAt).length + " recently deleted, " + library.length + " library items. Stored in " + (store.kind === "indexeddb" ? "this browser's database" : "this browser's local storage") + " only; nothing is uploaded.");
  const choice = { designs: true, trash: false, library: true, prefs: true };
  const cbx = (label: string, key: keyof typeof choice) => {
    const cb = h("input", { type: "checkbox" });
    cb.checked = choice[key];
    cb.addEventListener("change", () => (choice[key] = cb.checked));
    return h("label", { class: "check" }, cb, " " + label);
  };
  body.append(
    section(
      "Your data",
      usage,
      persisted === false
        ? h("div", { class: "row-actions" }, h("button", { type: "button", class: "ghost", onclick: async () => { const ok = await store.persist(); notify(ok ? "success" : "info", ok ? "The browser will keep your designs even when space runs low." : "The browser decided not to grant permanent storage. Regular backups keep your designs safe."); render(); } }, "Ask the browser to keep my data"))
        : persisted
          ? h("p", { class: "note" }, "The browser has agreed to keep this data even when space runs low.")
          : null,
      h("p", {}, "Back up to a file you can import on another browser or device."),
      cbx("Saved designs", "designs"),
      cbx("Include recently deleted designs", "trash"),
      cbx("Content library", "library"),
      cbx("Settings and remembered logo", "prefs"),
      h("div", { class: "row-actions" },
        h("button", { type: "button", class: "btn", onclick: () => exportAll(choice) }, "Download backup"),
        h("button", { type: "button", class: "ghost", onclick: () => pickImportFile() }, "Import a backup"),
      ),
      h("div", { class: "row-actions" },
        h("button", {
          type: "button",
          class: "btn danger",
          onclick: async () => {
            const n = designs.length;
            const ok = await confirmDialog({
              title: "Delete everything in this browser?",
              body: "This permanently deletes " + n + (n === 1 ? " design" : " designs") + " (including recently deleted), " + library.length + " library items, your settings and the remembered logo. Download a backup first if you might want them. This cannot be undone.",
              confirmLabel: "Delete everything",
              danger: true,
            });
            if (!ok) return;
            await store.clearAll();
            applyTheme("dark");
            E.renderLibrary();
            E.redraw();
            notify("info", "Everything the studio stored in this browser has been deleted.");
            render();
          },
        }, "Delete all my data"),
      ),
    ),
  );

  body.append(
    section(
      "About",
      h("dl", { class: "kv" }, h("dt", {}, "Version"), h("dd", {}, __APP_VERSION__), h("dt", {}, "Made by"), h("dd", {}, h("a", { href: "https://seanomahoney.com", target: "_blank", rel: "noopener" }, "Sean O'Mahoney"), ", a CAMRA volunteer")),
      h("p", { class: "note" }, "An unofficial tool, not affiliated with or endorsed by CAMRA. "),
      h("p", {}, h("a", { href: "CHANGELOG.md", target: "_blank", rel: "noopener" }, "What's changed in each version"), " \u00b7 ", h("a", { href: "?docs=1", target: "_blank", rel: "noopener" }, "Query parameter docs")),
    ),
  );
}

export function initSettings(): void {
  const btn = byId("settingsBtn");
  btn.addEventListener("click", async () => {
    await render();
    openDialog(dlg(), dlg().querySelector<HTMLElement>("input:checked"));
  });
}

export function refreshSettings(): void {
  if (dlg().open) render();
}
