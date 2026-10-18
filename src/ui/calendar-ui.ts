// The content calendar: a month grid and a list of planned posts, with the
// national campaigns alongside. Planned posts are saved designs with a day
// (and optionally a time) to post them, so they keep every image locally and
// can be changed right up to the day. Also wires the Post text and date group
// in the editor.

import {
  CAMPAIGNS,
  addMonths,
  isHm,
  isYmd,
  itemsByDay,
  monthGrid,
  monthTitle,
  planIcs,
  planLabel,
  planStatus,
  plannedPosts,
  retimeParams,
  weekdayHeaders,
  type DayItems,
} from "../core/calendar.ts";
import { addDays, daysBetween, longDate, normalisePrefs, rangeLabel, type Occurrence } from "../core/campaigns.ts";
import type { Design } from "../core/designs.ts";
import { byId, copyText, downloadBlob, flashLabel, h } from "./dom.ts";
import { closeDialog, confirmDialog, openDialog } from "./dialog.ts";
import { notify } from "./notices.ts";
import { store } from "./store.ts";
import * as E from "./editor.ts";
import { confirmReplace, onDesignsChanged, openDesign, replan, saveCurrent, setCalendarOpener as setDesignsOpener, updateDesigns } from "./designs-ui.ts";
import { onPlanned, openCampaigns, refreshCampaigns, setCalendarOpener as setCampaignsOpener, today } from "./campaigns-ui.ts";

declare const __APP_VERSION__: string;

type Mode = "month" | "list";
const dlg = () => byId<HTMLDialogElement>("calendarDialog");
const view = { year: 0, month: 0, selected: "", mode: "month" as Mode };

interface CalendarPrefs {
  weekStart: 0 | 1;
  showCampaigns: boolean;
}

export function calendarPrefs(): CalendarPrefs {
  const raw = (store.getPrefs().calendar || {}) as Partial<CalendarPrefs>;
  return { weekStart: raw.weekStart === 0 ? 0 : 1, showCampaigns: raw.showCampaigns !== false };
}

export function setCalendarPrefs(p: Partial<CalendarPrefs>): void {
  store.setPref("calendar", { ...calendarPrefs(), ...p });
  refreshCalendar();
}

/** Campaigns shown on the calendar: the kinds chosen for reminders. */
function shownCampaigns() {
  if (!calendarPrefs().showCampaigns) return [];
  const cats = new Set(normalisePrefs(store.getPrefs().campaigns).categories);
  return CAMPAIGNS.filter((c) => cats.has(c.category));
}

function posts(): Design[] {
  return store.getDesigns();
}

function n(k: number, word: string): string {
  return k + " " + word + (k === 1 ? "" : "s");
}

// --- actions on a planned post ---

async function save(items: Design[], msg?: string): Promise<void> {
  if (!(await updateDesigns(items))) {
    notify("error", "Could not save the change: this browser's storage is full.");
    return;
  }
  if (msg) notify("success", msg);
  refreshAll();
}

async function markPosted(d: Design, on: boolean): Promise<void> {
  await save([{ ...d, postedAt: on ? new Date().toISOString() : null, updatedAt: new Date().toISOString() }], on ? "Marked " + d.name + " as posted." : "Marked " + d.name + " as not posted.");
}

async function move(d: Design, day: string, time: string | null): Promise<void> {
  if (!isYmd(day)) return void notify("warn", "Pick a date to move it to.");
  const next = replan(d, day, time && isHm(time) ? time : null);
  const daysNote = next.params !== d.params ? " The days to go now count from the new date." : "";
  await save([next], "Moved " + d.name + " to " + planLabel(next) + "." + daysNote);
  if (E.state.currentDesignId === d.id) {
    E.el.postOn.value = next.postOn || "";
    E.el.postAt.value = next.postAt || "";
  }
  view.selected = day;
  focusMonth(day);
  render(true);
}

async function unplan(d: Design): Promise<void> {
  await save([{ ...replan(d, null), postAt: null }]);
  if (E.state.currentDesignId === d.id) {
    E.el.postOn.value = "";
    E.el.postAt.value = "";
  }
  notify("info", "Took " + d.name + " off the calendar. It is still in your designs.", { action: { label: "Undo", run: () => save([d]) } });
}

async function trash(d: Design): Promise<void> {
  const ok = await confirmDialog({ title: "Delete " + d.name + "?", body: "It moves to Recently deleted in your designs, where you can restore it for 30 days.", confirmLabel: "Delete", danger: true });
  if (!ok) return;
  await save([{ ...d, deletedAt: new Date().toISOString() }]);
  notify("info", "Moved " + d.name + " to Recently deleted.", { action: { label: "Undo", run: () => save([d]) } });
}

async function open(d: Design): Promise<void> {
  closeDialog(dlg());
  if (!(await openDesign(d))) openCalendar(d.postOn || undefined);
}

/** Starts a new post planned for a day. */
async function planNew(day: string): Promise<void> {
  closeDialog(dlg());
  if (!(await confirmReplace())) return openCalendar(day);
  E.resetForm({ personal: true });
  E.el.postOn.value = day;
  await E.loadAssets();
  E.redrawNow();
  updatePlanNote();
  revealPlan();
  notify("info", "New post for " + longDate(day) + ". Fill it in and write the post text, then choose Save to calendar.");
}

/** Plans the post that is open in the editor for a day. */
async function planCurrent(day: string): Promise<void> {
  E.el.postOn.value = day;
  updatePlanNote();
  closeDialog(dlg());
  const d = await saveCurrent();
  if (!d) openCalendar(day);
}

function revealPlan(): void {
  const g = document.querySelector<HTMLDetailsElement>('details.group[data-group="copy"]');
  if (g) {
    g.open = true;
    g.scrollIntoView({ block: "start" });
  }
}

// --- the month grid ---

function chipsFor(items: DayItems | undefined): HTMLElement | null {
  if (!items || (!items.posts.length && !items.campaigns.length)) return null;
  const t = today();
  const all: HTMLElement[] = [];
  items.campaigns.forEach((o) => all.push(h("span", { class: "chip camp " + o.campaign.category }, o.campaign.name)));
  items.posts.forEach((d) => all.push(h("span", { class: "chip post " + planStatus(d, t) }, (d.postAt ? d.postAt + " " : "") + d.name)));
  const max = 3;
  const shown = all.slice(0, max);
  if (all.length > max) shown.push(h("span", { class: "chip more" }, "+" + (all.length - max) + " more"));
  return h("span", { class: "chips", "aria-hidden": "true" }, ...shown);
}

function dayLabel(day: string, items: DayItems | undefined): string {
  const parts = [longDate(day) + " " + day.slice(0, 4)];
  if (day === today()) parts.push("today");
  if (items && items.posts.length) parts.push(n(items.posts.length, "planned post"));
  if (items && items.campaigns.length) parts.push(items.campaigns.map((o) => o.campaign.name).join(", "));
  return parts.join(", ");
}

function monthView(map: Map<string, DayItems>): HTMLElement {
  const weeks = monthGrid(view.year, view.month, calendarPrefs().weekStart);
  const t = today();
  const table = h(
    "table",
    { class: "cal-grid", role: "grid", "aria-labelledby": "calMonthTitle" },
    h("thead", {}, h("tr", {}, ...weekdayHeaders(calendarPrefs().weekStart).map((w) => h("th", { scope: "col", abbr: w }, w)))),
  );
  const body = h("tbody", {});
  weeks.forEach((week) => {
    const tr = h("tr", {});
    week.forEach((day) => {
      const items = map.get(day);
      const inMonth = Number(day.slice(5, 7)) === view.month;
      const cls = ["cal-day", inMonth ? "" : "other", day === t ? "today" : "", day === view.selected ? "selected" : "", items && items.posts.length ? "has-posts" : "", items && items.campaigns.length ? "has-camp" : ""].filter(Boolean).join(" ");
      const btn = h(
        "button",
        { type: "button", class: cls, "data-day": day, "aria-label": dayLabel(day, items), "aria-pressed": day === view.selected ? "true" : "false", tabindex: day === view.selected ? "0" : "-1", onclick: () => select(day) },
        h("span", { class: "num", "aria-hidden": "true" }, String(Number(day.slice(8)))),
        h("span", { class: "dots", "aria-hidden": "true" }, items && items.campaigns.length ? h("i", { class: "dot camp" }) : null, items && items.posts.length ? h("i", { class: "dot post" }) : null),
        chipsFor(items),
      );
      tr.append(h("td", { role: "gridcell" }, btn));
    });
    body.append(tr);
  });
  table.append(body);
  table.addEventListener("keydown", (e) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: string | null = null;
    if (e.key in steps) next = addDays(view.selected, steps[e.key]);
    else if (e.key === "PageUp" || e.key === "PageDown") {
      const m = addMonths(Number(view.selected.slice(0, 4)), Number(view.selected.slice(5, 7)), e.key === "PageUp" ? -1 : 1);
      const dd = Math.min(Number(view.selected.slice(8)), 28);
      next = m.year + "-" + String(m.month).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
    } else if (e.key === "Home" || e.key === "End") {
      const idx = weeks.findIndex((w) => w.includes(view.selected));
      if (idx > -1) next = e.key === "Home" ? weeks[idx][0] : weeks[idx][6];
    }
    if (!next) return;
    e.preventDefault();
    select(next, true);
  });
  return table;
}

function select(day: string, keepFocus = false): void {
  view.selected = day;
  focusMonth(day);
  render(keepFocus);
  const target = dlg().querySelector<HTMLElement>(keepFocus ? '.cal-day[data-day="' + day + '"]' : "#calDayTitle");
  if (target) target.focus();
}

function focusMonth(day: string): void {
  view.year = Number(day.slice(0, 4));
  view.month = Number(day.slice(5, 7));
}

// --- one day, and one post ---

function postCard(d: Design): HTMLElement {
  const t = today();
  const st = planStatus(d, t);
  const copy = new URLSearchParams(d.params).get("copy") || "";
  const dateIn = h("input", { type: "date", value: d.postOn || "", "aria-label": "New date for " + d.name });
  const timeIn = h("input", { type: "time", value: d.postAt || "", "aria-label": "New time for " + d.name + " (optional)" });
  const copyBtn = h("button", { type: "button", class: "ghost" }, "Copy post text");
  copyBtn.addEventListener("click", async () => flashLabel(copyBtn, (await copyText(copy)) ? "Copied" : "Copy failed"));
  const statusText = st === "posted" ? "Posted" : st === "overdue" ? "Not posted yet" : st === "today" ? "Post today" : "Planned";
  return h(
    "li",
    { class: "plan-post " + st, "data-design": d.id },
    d.thumb ? h("img", { src: d.thumb, alt: "", width: 72, height: 72, loading: "lazy" }) : h("span", { class: "thumb-ph", "aria-hidden": "true" }),
    h(
      "div",
      { class: "plan-main" },
      h("p", { class: "design-name" }, d.name, h("span", { class: "badge plan " + st }, statusText)),
      h("p", { class: "design-meta" }, planLabel(d) + (d.postedAt ? " \u00b7 posted " + longDate(d.postedAt.slice(0, 10)) : "")),
      copy ? h("p", { class: "plan-copy" }, copy) : h("p", { class: "note" }, "No post text yet. Open it to write some."),
      h(
        "div",
        { class: "design-actions" },
        h("button", { type: "button", class: "btn primary", onclick: () => open(d), "aria-label": "Open " + d.name + " in the editor" }, "Open"),
        copy ? copyBtn : null,
        h("button", { type: "button", class: "ghost", onclick: () => markPosted(d, !d.postedAt) }, d.postedAt ? "Mark as not posted" : "Mark as posted"),
        h("button", { type: "button", class: "ghost", onclick: () => unplan(d) }, "Take off calendar"),
        h("button", { type: "button", class: "ghost", onclick: () => trash(d), "aria-label": "Delete " + d.name }, "Delete"),
      ),
      h(
        "div",
        { class: "plan-move" },
        dateIn,
        timeIn,
        h("button", { type: "button", class: "ghost", onclick: () => move(d, dateIn.value, timeIn.value || null), "aria-label": "Move " + d.name + " to the chosen date" }, "Move"),
      ),
    ),
  );
}

function campaignLine(o: Occurrence, day: string): HTMLElement {
  const c = o.campaign;
  const pos = o.start === o.end ? "" : day === o.start ? " (starts)" : day === o.end ? " (last day)" : " (day " + (daysBetween(o.start, day) + 1) + ")";
  return h(
    "li",
    { class: "plan-camp " + c.category },
    h("div", {}, h("p", { class: "design-name" }, c.name + pos), h("p", { class: "design-meta" }, rangeLabel(o.start, o.end, true) + (o.estimated ? " \u00b7 date estimated" : ""))),
    h("button", { type: "button", class: "btn", onclick: () => { closeDialog(dlg()); openCampaigns(c.id); }, "aria-label": "Drafts for " + c.name }, "Drafts"),
  );
}

function dayPanel(map: Map<string, DayItems>): HTMLElement {
  const day = view.selected;
  const items = map.get(day) || { posts: [], campaigns: [] };
  const past = day < today();
  return h(
    "section",
    { class: "cal-day-panel", "aria-labelledby": "calDayTitle" },
    h("h3", { id: "calDayTitle", tabindex: "-1" }, longDate(day) + " " + day.slice(0, 4) + (day === today() ? " (today)" : "")),
    items.campaigns.length ? h("ul", { class: "plan-list" }, ...items.campaigns.map((o) => campaignLine(o, day))) : null,
    items.posts.length ? h("ul", { class: "plan-list" }, ...items.posts.map(postCard)) : h("p", { class: "note" }, past ? "Nothing was planned for this day." : "Nothing planned for this day yet."),
    h(
      "div",
      { class: "row-actions" },
      h("button", { type: "button", class: "btn primary", onclick: () => planNew(day) }, "Plan a new post on this day"),
      h("button", { type: "button", class: "ghost", onclick: () => planCurrent(day) }, E.state.currentDesignId ? "Move the open post to this day" : "Plan the open post on this day"),
    ),
  );
}

// --- the list ---

function listView(map: Map<string, DayItems>): HTMLElement {
  const t = today();
  const wrap = h("div", { class: "cal-list" });
  const late = plannedPosts(posts()).filter((d) => planStatus(d, t) === "overdue");
  if (late.length) wrap.append(h("section", { class: "dlg-section" }, h("h3", {}, "Not posted yet"), h("p", { class: "note" }, "Planned for an earlier day and not marked as posted."), h("ul", { class: "plan-list" }, ...late.map(postCard))));
  const days = Array.from(map.keys()).filter((d) => d >= t).sort();
  let any = false;
  days.forEach((day) => {
    const it = map.get(day) as DayItems;
    // Campaigns appear on their first day (or today, when already on), not every day.
    const camps = it.campaigns.filter((o) => o.start === day || (day === t && o.start < t));
    if (!it.posts.length && !camps.length) return;
    any = true;
    wrap.append(
      h(
        "section",
        { class: "dlg-section cal-list-day" },
        h("h3", {}, longDate(day) + (day.slice(0, 4) !== t.slice(0, 4) ? " " + day.slice(0, 4) : "") + (day === t ? " (today)" : "")),
        camps.length ? h("ul", { class: "plan-list" }, ...camps.map((o) => campaignLine(o, day))) : null,
        it.posts.length ? h("ul", { class: "plan-list" }, ...it.posts.map(postCard)) : null,
      ),
    );
  });
  if (!any && !late.length) {
    wrap.append(h("div", { class: "empty" }, h("p", {}, "Nothing planned in the next three months. Plan a post from the editor's Post text and date section, or plan a campaign's drafts in one go from Campaigns."), h("div", { class: "row-actions" }, h("button", { type: "button", class: "btn", onclick: () => { closeDialog(dlg()); openCampaigns(); } }, "Open Campaigns"))));
  }
  return wrap;
}

// --- the dialog ---

function render(keepFocus = false): void {
  const body = byId("calendarBody");
  const prefs = calendarPrefs();
  const scroll = body.scrollTop;
  body.innerHTML = "";
  const t = today();
  if (!view.selected) view.selected = t;
  if (!view.year) focusMonth(view.selected);

  const nav = h(
    "div",
    { class: "cal-nav" },
    h("button", { type: "button", class: "ghost", "aria-label": "Previous month", onclick: () => shift(-1) }, "\u2039"),
    h("h3", { id: "calMonthTitle", "aria-live": "polite" }, view.mode === "month" ? monthTitle(view.year, view.month) : "Coming up"),
    h("button", { type: "button", class: "ghost", "aria-label": "Next month", onclick: () => shift(1) }, "\u203a"),
    h("button", { type: "button", class: "ghost", onclick: () => select(t) }, "Today"),
  );
  if (view.mode === "list") nav.querySelectorAll<HTMLButtonElement>("button[aria-label]").forEach((b) => (b.hidden = true));
  const seg = h("div", { class: "segmented cal-mode" });
  (["month", "list"] as Mode[]).forEach((m) => {
    const r = h("input", { type: "radio", name: "calMode", value: m });
    r.checked = view.mode === m;
    r.addEventListener("change", () => {
      view.mode = m;
      render();
      dlg().querySelector<HTMLInputElement>('input[name="calMode"]:checked')?.focus();
    });
    seg.append(h("label", {}, r, h("span", {}, m === "month" ? "Month" : "List")));
  });
  const showCamp = h("input", { type: "checkbox", id: "calShowCamp" });
  showCamp.checked = prefs.showCampaigns;
  showCamp.addEventListener("change", () => {
    setCalendarPrefs({ showCampaigns: showCamp.checked });
    byId("calShowCamp").focus();
  });
  body.append(h("div", { class: "cal-bar" }, nav, h("fieldset", { class: "cal-mode-wrap" }, h("legend", { class: "sr-only" }, "Calendar view"), seg), h("label", { class: "check", for: showCamp.id }, showCamp, " Show campaigns")));

  const planned = plannedPosts(posts());
  const upcoming = planned.filter((d) => !d.postedAt && (d.postOn as string) >= t).length;
  const late = planned.filter((d) => planStatus(d, t) === "overdue").length;
  body.append(
    h(
      "p",
      { class: "note" },
      (planned.length ? n(upcoming, "post") + " coming up" + (late ? ", " + late + " not marked as posted" : "") + ". " : "Nothing planned yet. ") + "Planned posts keep their images on this device, so you can change them right up to the day. ",
      planned.length ? h("button", { type: "button", class: "linkish", onclick: () => downloadPlan() }, "Add my plan to a calendar app (.ics)") : null,
    ),
  );

  if (view.mode === "month") {
    const weeks = monthGrid(view.year, view.month, prefs.weekStart);
    const map = itemsByDay(posts(), shownCampaigns(), weeks[0][0], weeks[weeks.length - 1][6]);
    if (!map.has(view.selected)) map.set(view.selected, itemsByDay(posts(), shownCampaigns(), view.selected, view.selected).get(view.selected) || { posts: [], campaigns: [] });
    body.append(h("div", { class: "cal-layout" }, h("div", { class: "cal-grid-wrap" }, monthView(map), h("p", { class: "note cal-key" }, h("i", { class: "dot camp", "aria-hidden": "true" }), " Campaign  ", h("i", { class: "dot post", "aria-hidden": "true" }), " Planned post  \u00b7  Arrow keys move between days")), dayPanel(map)));
  } else {
    body.append(listView(itemsByDay(posts(), shownCampaigns(), t, addDays(t, 92))));
  }
  if (keepFocus) body.scrollTop = scroll;
}

function shift(by: number): void {
  const m = addMonths(view.year, view.month, by);
  view.year = m.year;
  view.month = m.month;
  // Keep the selection inside the month shown.
  const dd = Math.min(Number(view.selected.slice(8)) || 1, 28);
  const t = today();
  view.selected = t.slice(0, 7) === m.year + "-" + String(m.month).padStart(2, "0") ? t : m.year + "-" + String(m.month).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
  render(true);
  dlg().querySelector<HTMLElement>(by < 0 ? 'button[aria-label="Previous month"]' : 'button[aria-label="Next month"]')?.focus();
}

function downloadPlan(): void {
  const text = planIcs(posts(), new Date(), { version: __APP_VERSION__ });
  downloadBlob(new Blob([text], { type: "text/calendar;charset=utf-8" }), "my-planned-posts.ics");
  notify("info", "Downloaded your plan. Open it to add the posts to your calendar app. It is a snapshot: download it again after changes.");
}

export function openCalendar(day?: string): void {
  view.selected = day && isYmd(day) ? day : view.selected || today();
  focusMonth(view.selected);
  render();
  openDialog(dlg(), dlg().querySelector<HTMLElement>(view.mode === "month" ? '.cal-day[data-day="' + view.selected + '"]' : "#calMonthTitle"));
}

export function refreshCalendar(): void {
  if (dlg().open) render(true);
  renderBadge();
}

function refreshAll(): void {
  refreshCalendar();
  refreshCampaigns();
}

function renderBadge(): void {
  const t = today();
  const due = plannedPosts(posts()).filter((d) => !d.postedAt && d.postOn === t).length;
  const btn = byId("calendarBtn");
  const badge = btn.querySelector<HTMLElement>(".count-badge");
  if (badge) {
    badge.textContent = due ? String(due) : "";
    badge.hidden = !due;
  }
  btn.setAttribute("aria-label", due ? "Calendar, " + n(due, "post") + " to post today" : "Calendar");
}

// --- the editor's Post text and date group ---

let lastDay = "";

function updatePlanNote(): void {
  const day = E.el.postOn.value;
  if (!isYmd(day)) {
    E.el.planNote.textContent = "Not on the calendar. Pick a date to plan it.";
    return;
  }
  const on = itemsByDay([], shownCampaigns(), day, day).get(day);
  const camp = on && on.campaigns.length ? " That is during " + on.campaigns.map((o) => o.campaign.name).join(" and ") + "." : "";
  const t = today();
  const when = day < t ? " That date has passed." : day === t ? " That is today." : " That is in " + n(daysBetween(t, day), "day") + ".";
  E.el.planNote.textContent = longDate(day) + " " + day.slice(0, 4) + "." + when + camp;
}

// A countdown planned from a campaign keeps its days to go in step with the date.
function retimeOpenPost(): void {
  const day = E.el.postOn.value;
  const ref = E.state.campaignRef;
  if (!ref || !isYmd(day)) {
    lastDay = day;
    return;
  }
  const before = E.serialize().toString();
  const after = retimeParams(before, ref, lastDay || null, day);
  lastDay = day;
  if (after === before) return;
  const field = E.el.dynamic.querySelector<HTMLInputElement>('[data-key="days"]');
  const v = new URLSearchParams(after).get("days");
  if (field && v) {
    field.value = v;
    E.redraw();
  }
}

function wireEditor(): void {
  byId("copyPostText").addEventListener("click", async (e) => {
    const btn = e.currentTarget as HTMLElement;
    if (!E.el.postCopy.value.trim()) return void notify("info", "Write the post text first.");
    flashLabel(btn, (await copyText(E.el.postCopy.value)) ? "Copied" : "Copy failed");
  });
  E.el.postOn.addEventListener("focus", () => (lastDay = E.el.postOn.value));
  E.el.postOn.addEventListener("change", () => {
    if (!E.el.postOn.value) E.el.postAt.value = "";
    retimeOpenPost();
    updatePlanNote();
    E.redraw();
  });
  byId("clearPlan").addEventListener("click", () => {
    E.el.postOn.value = "";
    E.el.postAt.value = "";
    E.state.dirty = true;
    updatePlanNote();
    E.redraw();
  });
  byId("planSave").addEventListener("click", async () => {
    if (!isYmd(E.el.postOn.value)) {
      notify("info", "Pick the date you mean to post it first.");
      E.el.postOn.focus();
      return;
    }
    await saveCurrent();
  });
  byId("openCalendar").addEventListener("click", () => openCalendar(isYmd(E.el.postOn.value) ? E.el.postOn.value : undefined));
  // Restoring a design or using a draft sets the fields directly.
  E.onRedraw(() => {
    if (E.el.postOn.value !== lastDay && document.activeElement !== E.el.postOn) lastDay = E.el.postOn.value;
    updatePlanNote();
  });
}

export function initCalendar(): void {
  byId("calendarBtn").addEventListener("click", () => openCalendar());
  setDesignsOpener((day) => openCalendar(day));
  setCampaignsOpener((day) => openCalendar(day));
  onDesignsChanged(refreshCalendar);
  onPlanned(refreshCalendar);
  wireEditor();
  updatePlanNote();
  renderBadge();
  const wanted = new URLSearchParams(location.search).get("calendar");
  if (wanted) window.setTimeout(() => openCalendar(isYmd(wanted) ? wanted : undefined), 60);
}
