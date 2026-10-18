// Campaigns: reminders in the studio before each national campaign (time to
// schedule posts) and while it is on, the Campaigns panel with ready-made
// drafts for each one, calendar subscriptions, and optional system
// notifications. Everything is worked out on this device from the bundled
// campaign list; nothing is fetched or uploaded.

import {
  CAMPAIGNS,
  CATEGORIES,
  FEEDS,
  PHASE_LABELS,
  buildIcs,
  campaignById,
  dueAlerts,
  hashtags,
  localYmd,
  normalisePrefs,
  normaliseState,
  draftParams,
  pruneState,
  rangeLabel,
  suggestedDraft,
  timeline,
  addDays,
  type Alert,
  type AlertState,
  type CampaignPrefs,
  type Draft,
  type Feed,
  type TimelineEntry,
} from "../core/campaigns.ts";
import { newId, type Design } from "../core/designs.ts";
import { byId, copyText, downloadBlob, flashLabel, h } from "./dom.ts";
import { closeDialog, openDialog } from "./dialog.ts";
import { notify } from "./notices.ts";
import { store } from "./store.ts";
import * as E from "./editor.ts";
import { confirmReplace, openDesigns } from "./designs-ui.ts";

declare const __APP_VERSION__: string;

/** kv record the service worker reads for background reminders. */
export const STATE_KEY = "campaignState";
const SYNC_TAG = "campaign-reminders";
const SNOOZE_DAYS = 3;
const MAX_BANNER = 2;

const dlg = () => byId<HTMLDialogElement>("campaignsDialog");
const view = { cat: "", feed: FEEDS[0].file };

export function today(): string {
  return localYmd(new Date());
}

export function getPrefs(): CampaignPrefs {
  return normalisePrefs(store.getPrefs().campaigns);
}

function getState(): AlertState {
  const rec = store.getKv<{ state?: unknown }>(STATE_KEY);
  return normaliseState(rec && rec.state);
}

async function saveState(state: AlertState): Promise<void> {
  // The preferences travel with the state so the service worker sees both.
  await store.putKv(STATE_KEY, { state: pruneState(state, today()), prefs: getPrefs() });
}

export async function setPrefs(p: CampaignPrefs): Promise<void> {
  store.setPref("campaigns", p);
  await saveState(getState());
  await syncBackground(p.system);
  refreshCampaigns();
}

export function currentAlerts(): Alert[] {
  return dueAlerts(CAMPAIGNS, today(), getPrefs(), getState());
}

// --- the reminder banner and the nav badge ---

function renderBanner(alerts: Alert[]): void {
  const box = byId("campaignAlerts");
  box.innerHTML = "";
  box.hidden = !alerts.length;
  if (!alerts.length) return;
  box.append(h("h2", { class: "sr-only" }, "Campaign reminders"));
  alerts.slice(0, MAX_BANNER).forEach((a) => {
    const id = a.entry.occ.campaign.id;
    box.append(
      h(
        "article",
        { class: "camp-alert " + a.phase, "data-key": a.key },
        h("span", { class: "camp-alert-dot", "aria-hidden": "true" }),
        h("div", { class: "camp-alert-text" }, h("p", { class: "camp-alert-title" }, a.title), h("p", {}, a.body)),
        h(
          "div",
          { class: "camp-alert-actions" },
          h("button", { type: "button", class: "btn primary", onclick: () => openCampaigns(id) }, "Get drafts"),
          h("button", { type: "button", class: "ghost", onclick: () => snooze(a), "aria-label": "Remind me about " + a.entry.occ.campaign.name + " in " + SNOOZE_DAYS + " days" }, "Remind me later"),
          h("button", { type: "button", class: "ghost", onclick: () => dismiss(a), "aria-label": "Dismiss the " + a.entry.occ.campaign.name + " reminder" }, "Dismiss"),
        ),
      ),
    );
  });
  if (alerts.length > MAX_BANNER) {
    const more = alerts.length - MAX_BANNER;
    box.append(h("button", { type: "button", class: "ghost camp-more", onclick: () => openCampaigns() }, "And " + more + " more " + (more === 1 ? "reminder" : "reminders")));
  }
}

function renderBadge(alerts: Alert[]): void {
  const btn = byId("campaignsBtn");
  const badge = btn.querySelector<HTMLElement>(".count-badge");
  if (badge) {
    badge.textContent = alerts.length ? String(alerts.length) : "";
    badge.hidden = !alerts.length;
  }
  btn.setAttribute("aria-label", alerts.length ? "Campaigns, " + alerts.length + (alerts.length === 1 ? " reminder" : " reminders") : "Campaigns");
}

async function snooze(a: Alert): Promise<void> {
  const s = getState();
  s.snoozed[a.key] = addDays(today(), SNOOZE_DAYS);
  await saveState(s);
  refreshCampaigns();
  notify("info", "We will remind you about " + a.entry.occ.campaign.name + " again in " + SNOOZE_DAYS + " days.");
}

async function dismiss(a: Alert): Promise<void> {
  const before = getState();
  const s = normaliseState(before);
  s.dismissed[a.key] = true;
  await saveState(s);
  refreshCampaigns();
  notify("info", "Dismissed. " + (a.phase === "prep" ? "You will still get a reminder when it starts." : "Find it any time under Campaigns."), {
    action: {
      label: "Undo",
      run: async () => {
        await saveState(before);
        refreshCampaigns();
      },
    },
  });
}

export async function resetReminders(): Promise<void> {
  const s = getState();
  s.dismissed = {};
  s.snoozed = {};
  await saveState(s);
  refreshCampaigns();
}

// --- drafts ---

function draftQuery(e: TimelineEntry, d: Draft): URLSearchParams {
  // Your default look first, then the draft, then your branch, so a draft
  // always arrives in your own colours with your own logo.
  const merged = new URLSearchParams(store.getPrefs().styleDefaults || "");
  draftParams(d, e.occ, today()).forEach((v, k) => merged.set(k, v));
  const cur = E.serialize();
  ["branch", "branchName", "branchLogo"].forEach((k) => {
    const v = cur.get(k);
    if (v) merged.set(k, v);
  });
  return merged;
}

async function useDraft(e: TimelineEntry, d: Draft): Promise<void> {
  if (!(await confirmReplace())) return;
  const logo = E.captureForm().logo;
  await E.restoreForm({ params: draftQuery(e, d).toString(), photo: null, logo });
  E.state.currentDesignId = null;
  E.state.dirty = true;
  closeDialog(dlg());
  notify("success", "Draft ready: " + e.occ.campaign.name + ", " + d.name.toLowerCase() + ". Check the details, then download or save it.");
}

async function saveDrafts(e: TimelineEntry): Promise<void> {
  const saved = E.captureForm();
  const savedId = E.state.currentDesignId;
  const savedDirty = E.state.dirty;
  const now = new Date().toISOString();
  const out: Design[] = [];
  for (const d of e.occ.campaign.drafts) {
    const params = draftQuery(e, d).toString();
    await E.restoreForm({ params, photo: null, logo: saved.logo });
    out.push({
      id: newId("dsn"),
      name: e.occ.campaign.name + " " + e.occ.year + ": " + d.name,
      typeId: d.type,
      params: E.serialize().toString(),
      logo: saved.logo,
      thumb: E.thumbnail(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }
  await E.restoreForm(saved);
  E.state.currentDesignId = savedId;
  E.state.dirty = savedDirty;
  if (!(await store.putDesigns(out))) {
    notify("error", "Could not save the drafts: this browser's storage is full.");
    return;
  }
  notify("success", "Saved " + out.length + (out.length === 1 ? " draft" : " drafts") + " for " + e.occ.campaign.name + " to your designs.", { action: { label: "View designs", run: () => { closeDialog(dlg()); openDesigns(); } } });
}

// --- calendar ---

function siteBase(): string {
  return location.href.split(/[?#]/)[0].replace(/[^/]*$/, "");
}

function feedUrl(f: Feed): string {
  return siteBase() + f.file;
}

function hosted(): boolean {
  return location.protocol === "https:" || (location.protocol === "http:" && !/^(localhost|127\.|\[::1\])/.test(location.hostname));
}

function downloadIcs(name: string, text: string): void {
  downloadBlob(new Blob([text], { type: "text/calendar;charset=utf-8" }), name);
}

function calendarSection(): HTMLElement {
  const feed = FEEDS.find((f) => f.file === view.feed) || FEEDS[0];
  const url = feedUrl(feed);
  const webcal = url.replace(/^https?:/, "webcal:");
  const seg = h("div", { class: "segmented feed-pick" });
  FEEDS.forEach((f) => {
    const r = h("input", { type: "radio", name: "feedPick", value: f.file });
    r.checked = f.file === feed.file;
    r.addEventListener("change", () => {
      view.feed = f.file;
      render();
      document.querySelector<HTMLInputElement>('input[name="feedPick"]:checked')?.focus();
    });
    seg.append(h("label", {}, r, h("span", {}, f.short)));
  });
  const copyBtn = h("button", { type: "button", class: "ghost" }, "Copy calendar link");
  copyBtn.addEventListener("click", async () => {
    flashLabel(copyBtn, (await copyText(url)) ? "Copied" : "Copy failed");
  });
  const ext = { target: "_blank", rel: "noopener" };
  const links = hosted()
    ? h(
        "div",
        { class: "row-actions" },
        h("a", { class: "btn", href: "https://calendar.google.com/calendar/render?cid=" + encodeURIComponent(webcal), ...ext }, "Google Calendar"),
        h("a", { class: "btn", href: "https://outlook.live.com/calendar/0/addfromweb?url=" + encodeURIComponent(url) + "&name=" + encodeURIComponent(feed.name), ...ext }, "Outlook"),
        h("a", { class: "btn", href: webcal }, "Apple Calendar or other"),
        copyBtn,
      )
    : h("p", { class: "note" }, "Calendar subscriptions work from the hosted studio, not from a copy on this computer. You can still download the file below.");
  return h(
    "section",
    { class: "dlg-section" },
    h("h3", {}, "Add to your calendar"),
    h("p", { class: "note" }, "Subscribe and your calendar stays in sync: new campaigns and confirmed dates arrive by themselves. Events carry a reminder when it is time to schedule posts."),
    h("fieldset", { class: "field" }, h("legend", {}, "Which calendar"), seg),
    h("p", { class: "note" }, feed.description.replace(/ From the unofficial CAMRA Social Graphics Studio\./, "")),
    links,
    h("div", { class: "row-actions" }, h("a", { class: "ghost", href: feed.file, download: feed.file.split("/").pop() || "campaigns.ics" }, "Download the .ics file")),
  );
}

// --- the Campaigns panel ---

const STATUS_LABEL = { live: "On now", soon: "Coming up", later: "Further ahead", past: "" } as const;

function whenText(e: TimelineEntry): string {
  if (e.status === "live") return e.occ.start === e.occ.end ? "Today" : e.daysLeft === 1 ? "Last day today" : e.daysLeft + " days left";
  return e.daysToStart === 1 ? "Tomorrow" : "In " + e.daysToStart + " days";
}

function entryCard(e: TimelineEntry, prefs: CampaignPrefs): HTMLElement {
  const c = e.occ.campaign;
  const cat = CATEGORIES.find((x) => x.id === c.category);
  const suggested = suggestedDraft(e);
  const tags = hashtags(e.occ);
  const muted = prefs.muted.includes(c.id);
  const mute = h("input", { type: "checkbox", id: "mute-" + c.id + "-" + e.occ.year });
  mute.checked = !muted;
  mute.addEventListener("change", () => {
    const p = getPrefs();
    p.muted = mute.checked ? p.muted.filter((m) => m !== c.id) : Array.from(new Set(p.muted.concat(c.id)));
    setPrefs(p);
  });
  const copyTags = h("button", { type: "button", class: "ghost small" }, "Copy hashtags");
  copyTags.addEventListener("click", async () => flashLabel(copyTags, (await copyText(tags.join(" "))) ? "Copied" : "Copy failed"));
  return h(
    "li",
    { class: "campaign " + e.status, id: "camp-" + c.id + "-" + e.occ.year, "data-campaign": c.id, tabindex: "-1" },
    h(
      "div",
      { class: "campaign-head" },
      h("h4", {}, c.name),
      h("span", { class: "badge when" }, whenText(e)),
      e.occ.estimated ? h("span", { class: "badge", title: "Follows the pattern of earlier years. Check the official announcement." }, "Date estimated") : null,
      cat ? h("span", { class: "badge subtle" }, cat.label) : null,
    ),
    h("p", { class: "campaign-date" }, rangeLabel(e.occ.start, e.occ.end, true) + (e.occ.venue ? ", " + e.occ.venue : "")),
    h("p", { class: "note" }, c.summary),
    tags.length ? h("p", { class: "campaign-tags" }, h("span", {}, tags.join(" ")), copyTags) : null,
    h(
      "div",
      { class: "draft-row", role: "group", "aria-label": "Drafts for " + c.name },
      ...c.drafts.map((d) =>
        h(
          "button",
          { type: "button", class: d === suggested ? "btn primary" : "btn", onclick: () => useDraft(e, d), title: PHASE_LABELS[d.phase], "aria-label": "Use the " + d.name + " draft for " + c.name + (d === suggested ? " (suggested now)" : "") },
          d.name,
        ),
      ),
    ),
    h(
      "div",
      { class: "row-actions campaign-more" },
      h("button", { type: "button", class: "ghost", onclick: () => saveDrafts(e) }, c.drafts.length === 1 ? "Save the draft to my designs" : "Save all " + c.drafts.length + " drafts to my designs"),
      h("button", { type: "button", class: "ghost", onclick: () => downloadIcs(c.id + "-" + e.occ.year + ".ics", buildIcs([e.occ], { name: c.name, description: c.summary, now: new Date(), version: __APP_VERSION__, siteUrl: hosted() ? siteBase() : undefined, leadOverride: prefs.leadDays })) }, "Add this one to my calendar"),
      c.url ? h("a", { class: "ghost", href: c.url, target: "_blank", rel: "noopener" }, "About " + c.name) : null,
      h("label", { class: "check", for: mute.id }, mute, " Remind me"),
    ),
  );
}

function render(focusCampaign?: string): void {
  const body = byId("campaignsBody");
  const prefs = getPrefs();
  const scroll = body.scrollTop;
  body.innerHTML = "";

  const cats = new Set(prefs.categories);
  const on = CATEGORIES.filter((c) => cats.has(c.id)).map((c) => c.phrase);
  body.append(
    h(
      "p",
      { class: "note" },
      !prefs.enabled
        ? "Reminders are off. "
        : on.length
          ? "You get reminders for " + (on.length > 1 ? on.slice(0, -1).join(", ") + " and " + on[on.length - 1] : on[0]) + ", before each one starts and while it is on. "
          : "Reminders are on, but no kinds of campaign are chosen. ",
      h("button", { type: "button", class: "linkish", onclick: () => { closeDialog(dlg()); byId("settingsBtn").click(); } }, "Change reminder settings"),
    ),
  );
  body.append(calendarSection());

  const filter = h("select", { id: "campaignCat", "aria-label": "Show which campaigns" }, h("option", { value: "" }, "All campaigns"), ...CATEGORIES.map((c) => h("option", { value: c.id }, c.label)));
  filter.value = view.cat;
  filter.addEventListener("change", () => {
    view.cat = filter.value;
    render();
    byId("campaignCat").focus();
  });
  body.append(h("div", { class: "toolbar" }, filter));

  const list = CAMPAIGNS.filter((c) => !view.cat || c.category === view.cat);
  const entries = timeline(list, today(), 366, prefs.leadDays);
  (["live", "soon", "later"] as const).forEach((st) => {
    const group = entries.filter((e) => e.status === st);
    if (!group.length) return;
    body.append(h("section", { class: "dlg-section" }, h("h3", {}, STATUS_LABEL[st]), h("ul", { class: "campaign-list" }, ...group.map((e) => entryCard(e, prefs)))));
  });
  if (!entries.length) body.append(h("div", { class: "empty" }, h("p", {}, "Nothing in the next twelve months for this filter.")));

  if (focusCampaign) {
    const target = body.querySelector<HTMLElement>('[data-campaign="' + focusCampaign + '"]');
    if (target) {
      target.classList.add("focus-ring");
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    }
  } else body.scrollTop = scroll;
}

export function openCampaigns(id?: string): void {
  render(id);
  openDialog(dlg(), id ? dlg().querySelector<HTMLElement>('[data-campaign="' + id + '"]') : byId("campaignCat"));
  if (id) render(id);
}

export function refreshCampaigns(): void {
  const alerts = currentAlerts();
  renderBanner(alerts);
  renderBadge(alerts);
  if (dlg().open) render();
}

// --- system notifications ---

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    return navigator.serviceWorker ? await navigator.serviceWorker.getRegistration() : undefined;
  } catch {
    return undefined;
  }
}

async function showSystem(a: Alert): Promise<void> {
  const opts: NotificationOptions = { body: a.body, tag: a.key, icon: "assets/icons/icon-192.png", data: { url: siteBase() + "?campaign=" + a.entry.occ.campaign.id } };
  const reg = await registration();
  if (reg) await reg.showNotification(a.title, opts);
  else new Notification(a.title, opts);
}

/** Sends any reminder not yet sent as a system notification. */
async function sendSystem(alerts: Alert[]): Promise<void> {
  if (!getPrefs().system || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const s = getState();
  const fresh = alerts.filter((a) => !s.notified[a.key]);
  if (!fresh.length) return;
  for (const a of fresh) {
    try {
      await showSystem(a);
      s.notified[a.key] = true;
    } catch {
      /* the browser refused; the banner still shows */
    }
  }
  await saveState(s);
}

type PeriodicSync = { register(tag: string, o: { minInterval: number }): Promise<void>; unregister(tag: string): Promise<void> };

/** Background checks while the studio is closed: installed Chrome and Edge apps only. */
async function syncBackground(on: boolean): Promise<boolean> {
  const reg = await registration();
  const ps = reg && (reg as unknown as { periodicSync?: PeriodicSync }).periodicSync;
  if (!ps) return false;
  try {
    if (!on) {
      await ps.unregister(SYNC_TAG);
      return false;
    }
    const perm = await navigator.permissions.query({ name: "periodic-background-sync" as PermissionName });
    if (perm.state !== "granted") return false;
    await ps.register(SYNC_TAG, { minInterval: 12 * 3600 * 1000 });
    return true;
  } catch {
    return false;
  }
}

export function systemSupported(): boolean {
  return typeof Notification !== "undefined";
}

/** Turns system notifications on (asking the browser) or off. */
export async function setSystem(on: boolean): Promise<boolean> {
  const p = getPrefs();
  if (on) {
    if (!systemSupported()) {
      notify("info", "This browser cannot show notifications. Reminders still appear in the studio.");
      return false;
    }
    const perm = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (perm !== "granted") {
      notify("warn", "The browser blocked notifications for this site. Allow them in the browser's site settings, then try again. Reminders still appear in the studio.");
      return false;
    }
  }
  p.system = on;
  await setPrefs(p);
  if (on) {
    const bg = await syncBackground(true);
    notify("success", bg ? "Notifications are on, including checks while the studio is closed." : "Notifications are on. They arrive when you open the studio; install it as an app in Chrome or Edge to get them while it is closed too.");
    await sendSystem(currentAlerts());
  }
  return on;
}

export async function backgroundActive(): Promise<boolean> {
  const reg = await registration();
  const ps = reg && (reg as unknown as { periodicSync?: { getTags(): Promise<string[]> } }).periodicSync;
  if (!ps) return false;
  try {
    return (await ps.getTags()).includes(SYNC_TAG);
  } catch {
    return false;
  }
}

export function initCampaigns(): void {
  byId("campaignsBtn").addEventListener("click", () => openCampaigns());
  const qp = new URLSearchParams(location.search);
  const wanted = qp.get("campaign");
  refreshCampaigns();
  // Keep the service worker's copy of the settings current.
  saveState(getState());
  if (wanted) window.setTimeout(() => openCampaigns(campaignById(wanted) ? wanted : undefined), 60);
  sendSystem(currentAlerts());
  // Reminders roll over at midnight for anyone who leaves the studio open.
  let day = today();
  window.setInterval(() => {
    if (today() !== day) {
      day = today();
      refreshCampaigns();
      sendSystem(currentAlerts());
    }
  }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && today() !== day) {
      day = today();
      refreshCampaigns();
    }
  });
}

