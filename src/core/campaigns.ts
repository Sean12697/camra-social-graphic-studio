// National and annual campaigns: the catalogue, the dates each one falls on in
// any year, which reminders are due, the ready-made drafts and the iCalendar
// feed. Pure functions with no DOM, shared by the app, the service worker and
// the build (which writes the static .ics feeds).
//
// Dates are plain calendar days ("YYYY-MM-DD"), never instants, so time zones
// and clock changes cannot move a campaign by a day.

import data from "./data/campaigns.json" with { type: "json" };

export type CategoryId = "camra" | "beer" | "national";
export type DraftPhase = "before" | "start" | "end" | "after";

export interface Category {
  id: CategoryId;
  label: string;
  /** The label as it reads mid-sentence. */
  phrase: string;
  defaultOn: boolean;
}

export type Rule =
  | { kind: "month"; month: number }
  | { kind: "fixed"; month: number; day: number; days?: number }
  | { kind: "nthWeekday"; month: number; weekday: number; n: number; days?: number; estimate?: boolean };

export interface Draft {
  id: string;
  name: string;
  phase: DraftPhase;
  /** Post type id. */
  type: string;
  icon?: string;
  sizes?: string;
  values: Record<string, string | Array<Record<string, string>>>;
}

export interface Campaign {
  id: string;
  name: string;
  category: CategoryId;
  summary: string;
  url?: string;
  hashtags?: string[];
  rule: Rule;
  confirmed?: Record<string, { start: string; end: string; venue?: string }>;
  leadDays: number;
  drafts: Draft[];
}

export interface Occurrence {
  campaign: Campaign;
  year: number;
  start: string;
  end: string;
  /** True when the dates follow the pattern of earlier years and are not yet confirmed. */
  estimated: boolean;
  venue?: string;
}

export const CATEGORIES = data.categories as Category[];
export const CAMPAIGNS = data.campaigns as unknown as Campaign[];
export const DEFAULT_SIZES = "ig-square,ig-story,fb-landscape";
/** CAMRA was founded on 16 March 1971. */
export const CAMRA_FOUNDED = 1971;

export function campaignById(id: string | null | undefined): Campaign | undefined {
  return CAMPAIGNS.find((c) => c.id === id);
}

// --- calendar days ---

const DAY = 86400000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

export function ymd(y: number, m: number, d: number): string {
  return y + "-" + pad(m) + "-" + pad(d);
}

/** Today in the device's own time zone, as YYYY-MM-DD. */
export function localYmd(now: Date = new Date()): string {
  return ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function toUtc(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(t: number): string {
  const d = new Date(t);
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(s: string, n: number): string {
  return fromUtc(toUtc(s) + n * DAY);
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The nth weekday (0 Sunday to 6 Saturday) of a month; n = -1 is the last one. */
export function nthWeekday(y: number, m: number, weekday: number, n: number): string {
  if (n < 0) {
    const last = daysInMonth(y, m);
    const wd = new Date(Date.UTC(y, m - 1, last)).getUTCDay();
    return ymd(y, m, last - ((wd - weekday + 7) % 7));
  }
  const wd1 = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return ymd(y, m, 1 + ((weekday - wd1 + 7) % 7) + (n - 1) * 7);
}

function parts(s: string): { y: number; m: number; d: number; wd: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** "Thursday 24 September" */
export function longDate(s: string): string {
  const p = parts(s);
  return WEEKDAYS[p.wd] + " " + p.d + " " + MONTHS[p.m - 1];
}

/** "Thu 24 Sep" */
export function shortDate(s: string): string {
  const p = parts(s);
  return WEEKDAYS[p.wd].slice(0, 3) + " " + p.d + " " + MONTHS[p.m - 1].slice(0, 3);
}

/** "1 to 31 May", "30 April to 2 May", or the long date for a single day. */
export function rangeLabel(start: string, end: string, withYear = false): string {
  const a = parts(start);
  const b = parts(end);
  const yr = withYear ? " " + b.y : "";
  if (start === end) return longDate(start) + yr;
  if (a.m === b.m && a.y === b.y) return a.d + " to " + b.d + " " + MONTHS[a.m - 1] + yr;
  return a.d + " " + MONTHS[a.m - 1] + (a.y !== b.y ? " " + a.y : "") + " to " + b.d + " " + MONTHS[b.m - 1] + yr;
}

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return n + "th";
  return n + (["th", "st", "nd", "rd"][n % 10] || "th");
}

// --- occurrences ---

export function occurrence(c: Campaign, year: number): Occurrence {
  const conf = c.confirmed && c.confirmed[String(year)];
  if (conf) return { campaign: c, year, start: conf.start, end: conf.end, estimated: false, venue: conf.venue };
  const r = c.rule;
  let start: string;
  let end: string;
  if (r.kind === "month") {
    start = ymd(year, r.month, 1);
    end = ymd(year, r.month, daysInMonth(year, r.month));
  } else if (r.kind === "fixed") {
    start = ymd(year, r.month, r.day);
    end = addDays(start, (r.days || 1) - 1);
  } else {
    start = nthWeekday(year, r.month, r.weekday, r.n);
    end = addDays(start, (r.days || 1) - 1);
  }
  return { campaign: c, year, start, end, estimated: r.kind === "nthWeekday" && !!r.estimate };
}

/** Every occurrence of the given campaigns from one year to another, in date order. */
export function occurrencesBetween(list: Campaign[], fromYear: number, toYear: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (let y = fromYear; y <= toYear; y++) list.forEach((c) => out.push(occurrence(c, y)));
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.campaign.name.localeCompare(b.campaign.name));
}

export type Status = "live" | "soon" | "later" | "past";

export interface TimelineEntry {
  occ: Occurrence;
  status: Status;
  /** Days until it starts (negative once started). */
  daysToStart: number;
  /** Days left including today, while it is on. */
  daysLeft: number;
}

/** What is on now and what is coming up in the next `horizon` days. */
export function timeline(list: Campaign[], today: string, horizon = 366, leadOverride: number | null = null): TimelineEntry[] {
  const y = parts(today).y;
  const last = addDays(today, horizon);
  return occurrencesBetween(list, y - 1, y + 2)
    .filter((o) => o.end >= today && o.start <= last)
    .map((occ) => {
      const daysToStart = daysBetween(today, occ.start);
      const live = occ.start <= today && today <= occ.end;
      const lead = leadOverride || occ.campaign.leadDays;
      const status: Status = live ? "live" : daysToStart <= lead ? "soon" : "later";
      return { occ, status, daysToStart, daysLeft: live ? daysBetween(today, occ.end) + 1 : 0 };
    });
}

// --- reminders ---

export interface CampaignPrefs {
  /** Show reminders in the studio. */
  enabled: boolean;
  categories: CategoryId[];
  /** Days of warning before a campaign starts; null uses each campaign's own. */
  leadDays: number | null;
  /** Also show a system notification (when the browser allows it). */
  system: boolean;
  /** Campaign ids with reminders turned off. */
  muted: string[];
}

export interface AlertState {
  dismissed: Record<string, boolean>;
  /** Reminder key to the day it shows again. */
  snoozed: Record<string, string>;
  /** Reminder keys already sent as a system notification. */
  notified: Record<string, boolean>;
}

export const DEFAULT_PREFS: CampaignPrefs = {
  enabled: true,
  categories: CATEGORIES.filter((c) => c.defaultOn).map((c) => c.id),
  leadDays: null,
  system: false,
  muted: [],
};

export const LEAD_OPTIONS: Array<[string, string]> = [
  ["", "Each campaign's own (10 days to 6 weeks)"],
  ["7", "1 week"],
  ["14", "2 weeks"],
  ["28", "4 weeks"],
  ["42", "6 weeks"],
];

/** Fills in anything missing or malformed with the defaults. */
export function normalisePrefs(raw: unknown): CampaignPrefs {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<CampaignPrefs>;
  const known = new Set(CATEGORIES.map((c) => c.id));
  return {
    enabled: typeof p.enabled === "boolean" ? p.enabled : DEFAULT_PREFS.enabled,
    categories: Array.isArray(p.categories) ? p.categories.filter((c) => known.has(c)) : DEFAULT_PREFS.categories.slice(),
    leadDays: typeof p.leadDays === "number" && p.leadDays > 0 && p.leadDays <= 120 ? Math.round(p.leadDays) : null,
    system: p.system === true,
    muted: Array.isArray(p.muted) ? p.muted.filter((m) => typeof m === "string") : [],
  };
}

export function emptyState(): AlertState {
  return { dismissed: {}, snoozed: {}, notified: {} };
}

export function normaliseState(raw: unknown): AlertState {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<AlertState>;
  const obj = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, never>) : {});
  return { dismissed: { ...obj(s.dismissed) }, snoozed: { ...obj(s.snoozed) }, notified: { ...obj(s.notified) } };
}

export type AlertPhase = "prep" | "live";

export interface Alert {
  key: string;
  phase: AlertPhase;
  entry: TimelineEntry;
  title: string;
  body: string;
}

export function alertKey(o: Occurrence, phase: AlertPhase): string {
  return o.campaign.id + ":" + o.year + ":" + phase;
}

/** The words of a reminder, shared by the banner and system notifications. */
export function alertText(e: TimelineEntry, phase: AlertPhase): { title: string; body: string } {
  const o = e.occ;
  const name = o.campaign.name;
  const oneDay = o.start === o.end;
  const est = o.estimated ? " (date estimated)" : "";
  if (phase === "live") {
    if (oneDay) return { title: name + " is today", body: "Your drafts are ready if you still need a post." };
    const left = e.daysLeft === 1 ? "Last day today." : e.daysLeft + " days left, until " + longDate(o.end) + ".";
    return { title: name + " is on now", body: left + " Your drafts are ready if you still need a post." };
  }
  const when = e.daysToStart === 1 ? "tomorrow" : "in " + e.daysToStart + " days";
  return {
    title: name + (oneDay ? " is " : " starts ") + when,
    body: "On " + longDate(o.start) + est + ". Time to schedule your posts.",
  };
}

/** Reminders due today: one before each campaign (to schedule posts) and one while it is on. */
export function dueAlerts(list: Campaign[], today: string, prefs: CampaignPrefs, state: AlertState): Alert[] {
  if (!prefs.enabled) return [];
  const cats = new Set(prefs.categories);
  const muted = new Set(prefs.muted);
  const active = list.filter((c) => cats.has(c.category) && !muted.has(c.id));
  const out: Alert[] = [];
  timeline(active, today, 120, prefs.leadDays).forEach((entry) => {
    if (entry.status === "later") return;
    const phase: AlertPhase = entry.status === "live" ? "live" : "prep";
    const key = alertKey(entry.occ, phase);
    if (state.dismissed[key]) return;
    const until = state.snoozed[key];
    if (until && until > today) return;
    out.push({ key, phase, entry, ...alertText(entry, phase) });
  });
  return out.sort((a, b) => (a.phase === b.phase ? a.entry.occ.start.localeCompare(b.entry.occ.start) : a.phase === "live" ? -1 : 1));
}

/** Drops state for campaigns that ended more than a year ago, so it never grows without bound. */
export function pruneState(state: AlertState, today: string): AlertState {
  const minYear = parts(today).y - 1;
  const keep = (k: string) => {
    const y = parseInt(k.split(":")[1], 10);
    return !Number.isFinite(y) || y >= minYear;
  };
  const f = <T>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => keep(k)));
  return { dismissed: f(state.dismissed), snoozed: f(state.snoozed), notified: f(state.notified) };
}

// --- drafts ---

/** The values the {tokens} in drafts and hashtags are replaced with. */
export function tokens(o: Occurrence, today: string): Record<string, string> {
  const days = Math.max(1, daysBetween(today, o.start));
  const age = o.year - CAMRA_FOUNDED;
  return {
    year: String(o.year),
    edition: String(o.year + 1),
    dates: rangeLabel(o.start, o.end),
    start: longDate(o.start),
    end: longDate(o.end),
    days: String(days),
    venue: o.venue || "",
    where: o.venue ? "in " + o.venue : "",
    age: String(age),
    ordinal: ordinal(age),
  };
}

export function fillTokens(s: string, t: Record<string, string>): string {
  return s
    .replace(/\{(\w+)\}/g, (m, k: string) => (Object.prototype.hasOwnProperty.call(t, k) ? t[k] : m))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,:])/g, "$1")
    .split("\n")
    .map((l) => l.trim())
    .join("\n");
}

export function hashtags(o: Occurrence): string[] {
  const t = tokens(o, o.start);
  return (o.campaign.hashtags || []).map((h) => fillTokens(h, t));
}

/** A draft as the query string a share link or saved design uses (without a branch). */
export function draftParams(d: Draft, o: Occurrence, today: string): URLSearchParams {
  const t = tokens(o, today);
  const qp = new URLSearchParams();
  qp.set("type", d.type);
  Object.entries(d.values).forEach(([k, v]) => {
    if (Array.isArray(v)) qp.set(k, JSON.stringify(v.map((row) => Object.fromEntries(Object.entries(row).map(([rk, rv]) => [rk, fillTokens(rv, t)])))));
    else qp.set(k, fillTokens(v, t));
  });
  if (d.icon) qp.set("icon", d.icon);
  qp.set("sizes", d.sizes || DEFAULT_SIZES);
  if (!qp.has("copy")) qp.set("copy", draftCopy(d, o, t));
  return qp;
}

/** Suggested post text for a draft: its message (or the campaign and dates) and the hashtags. */
export function draftCopy(d: Draft, o: Occurrence, t: Record<string, string> = tokens(o, o.start)): string {
  const v = d.values;
  const pick = (k: string) => (typeof v[k] === "string" ? fillTokens(v[k] as string, t) : "");
  const days = pick("days");
  const what = pick("event") || pick("campaignName") || pick("occasion") || o.campaign.name;
  const lead = days ? days + (days === "1" ? " day" : " days") + " to go: " + what : pick("heading") || what;
  const msg = pick("note") || pick("body").replace(/\n/g, " ");
  const when = t.dates && !msg.includes(t.dates) ? (o.start === o.end ? "On " + t.start + "." : t.dates + ".") : "";
  const tags = hashtags(o).join(" ");
  return [lead + (/[.!?]$/.test(lead) ? "" : "."), [msg, when].filter(Boolean).join(" "), tags].filter(Boolean).join("\n\n");
}

/** The draft that suits the moment: before it starts, while it is on, or after. */
export function suggestedDraft(e: TimelineEntry): Draft | undefined {
  const drafts = e.occ.campaign.drafts;
  const want: DraftPhase[] = e.status === "live" ? (e.daysLeft <= 7 && e.occ.start !== e.occ.end && daysBetween(e.occ.start, e.occ.end) > 7 ? ["end", "start"] : ["start"]) : ["before", "start"];
  for (const p of want) {
    const d = drafts.find((x) => x.phase === p);
    if (d) return d;
  }
  return drafts[0];
}

export const PHASE_LABELS: Record<DraftPhase, string> = { before: "Before", start: "When it starts", end: "Near the end", after: "Afterwards" };

// --- iCalendar (RFC 5545) ---

export function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line to 75 octets, never splitting a character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
      limit = 74;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

const compact = (s: string) => s.replace(/-/g, "");

export interface FeedOptions {
  name: string;
  description: string;
  /** DTSTAMP for every event: the build time. */
  now: Date;
  /** Absolute URL of the studio, for links back to the drafts. Optional. */
  siteUrl?: string;
  /** "events": the campaigns themselves, with alarms. "planning": one reminder on the day to start scheduling posts. */
  kind?: "events" | "planning";
  leadOverride?: number | null;
  version?: string;
}

export const UID_DOMAIN = "camra-graphics-studio";

/** A complete iCalendar file for the given occurrences. */
export function buildIcs(list: Occurrence[], o: FeedOptions): string {
  const kind = o.kind || "events";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sean O'Mahoney//CAMRA Social Graphics Studio " + (o.version || "") + "//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsText(o.name),
    "X-WR-CALDESC:" + icsText(o.description),
    "X-WR-TIMEZONE:Europe/London",
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
  ];
  const ts = stamp(o.now);
  list.forEach((occ) => {
    const c = occ.campaign;
    const lead = o.leadOverride || c.leadDays;
    const link = o.siteUrl ? o.siteUrl.replace(/\/?$/, "/") + "?campaign=" + encodeURIComponent(c.id) : "";
    const tags = hashtags(occ);
    const desc = [
      c.summary,
      occ.estimated ? "Date estimated from earlier years. Check the official announcement." : "",
      occ.venue ? "Where: " + occ.venue + "." : "",
      tags.length ? "Suggested hashtags: " + tags.join(" ") : "",
      c.url ? "More: " + c.url : "",
      link ? "Ready-made graphics: " + link : "",
    ].filter(Boolean).join("\n\n");
    lines.push("BEGIN:VEVENT");
    if (kind === "planning") {
      const day = addDays(occ.start, -lead);
      lines.push(
        "UID:" + c.id + "-" + occ.year + "-plan@" + UID_DOMAIN,
        "DTSTAMP:" + ts,
        "DTSTART;VALUE=DATE:" + compact(day),
        "DTEND;VALUE=DATE:" + compact(addDays(day, 1)),
        "SUMMARY:" + icsText("Schedule posts: " + c.name + " (" + shortDate(occ.start) + ")"),
        "DESCRIPTION:" + icsText(c.name + " " + (occ.start === occ.end ? "is" : "starts") + " on " + longDate(occ.start) + ", in " + lead + " days. Time to prepare and schedule your posts.\n\n" + desc),
      );
    } else {
      lines.push(
        "UID:" + c.id + "-" + occ.year + "@" + UID_DOMAIN,
        "DTSTAMP:" + ts,
        "DTSTART;VALUE=DATE:" + compact(occ.start),
        "DTEND;VALUE=DATE:" + compact(addDays(occ.end, 1)),
        "SUMMARY:" + icsText(c.name + (occ.estimated ? " (date estimated)" : "")),
        "DESCRIPTION:" + icsText(desc),
        "STATUS:" + (occ.estimated ? "TENTATIVE" : "CONFIRMED"),
      );
    }
    lines.push("CATEGORIES:" + icsText(CATEGORIES.find((x) => x.id === c.category)?.label || c.category));
    if (c.url) lines.push("URL:" + c.url);
    lines.push("TRANSP:TRANSPARENT");
    if (kind === "events") {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:" + icsText(c.name + " " + (occ.start === occ.end ? "is" : "starts") + " in " + lead + " days: time to schedule your posts"),
        "TRIGGER:-P" + lead + "D",
        "END:VALARM",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:" + icsText(c.name + (occ.start === occ.end ? " is today" : " starts today")),
        "TRIGGER:PT9H",
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export interface Feed {
  file: string;
  name: string;
  /** Label for the feed picker. */
  short: string;
  description: string;
  kind: "events" | "planning";
  categories: CategoryId[];
}

/** The static feeds the build writes to calendar/. */
export const FEEDS: Feed[] = [
  { file: "calendar/campaigns.ics", short: "Everything", name: "CAMRA campaigns and beer days", description: "CAMRA campaigns, beer and pub days and national days, with a reminder when it is time to schedule posts. From the unofficial CAMRA Social Graphics Studio.", kind: "events", categories: ["camra", "beer", "national"] },
  { file: "calendar/camra.ics", short: "CAMRA only", name: "CAMRA campaigns", description: "CAMRA's own campaigns and dates only, with a reminder when it is time to schedule posts. From the unofficial CAMRA Social Graphics Studio.", kind: "events", categories: ["camra"] },
  { file: "calendar/planning.ics", short: "Planning reminders", name: "CAMRA campaigns: schedule your posts", description: "One all-day reminder before each CAMRA campaign and beer day, on the day to start scheduling posts. Works in calendars that ignore alarms in subscribed feeds, such as Google Calendar.", kind: "planning", categories: ["camra", "beer"] },
];

export function feedFor(f: Feed, buildDate: Date, o: { siteUrl?: string; version?: string } = {}): string {
  const y = buildDate.getUTCFullYear();
  const cats = new Set(f.categories);
  const occs = occurrencesBetween(CAMPAIGNS.filter((c) => cats.has(c.category)), y - 1, y + 3);
  return buildIcs(occs, { name: f.name, description: f.description, now: buildDate, siteUrl: o.siteUrl, kind: f.kind, version: o.version });
}

/** docs/CAMPAIGNS.md: every campaign, its date rule and its drafts. */
export function campaignsMarkdown(): string {
  const out: string[] = [];
  out.push("# Campaigns");
  out.push("");
  out.push("The studio knows these national and annual campaigns. It reminds you in the studio before each one (to schedule posts) and while it is on, offers ready-made drafts, and publishes them as calendar feeds you can subscribe to. This file is generated from `src/core/data/campaigns.json` by `npm run docs`.");
  out.push("");
  out.push("## Calendar feeds");
  out.push("");
  out.push("The build writes these to `dist/calendar/`, covering last year and the next three. Subscribe to the hosted URL (not a downloaded copy) and your calendar keeps itself up to date whenever the site is redeployed.");
  out.push("");
  out.push("| Feed | What it holds |");
  out.push("| --- | --- |");
  FEEDS.forEach((f) => out.push("| `" + f.file + "` | " + f.description.replace(/ From the unofficial CAMRA Social Graphics Studio\./, "") + " |"));
  CATEGORIES.forEach((cat) => {
    out.push("");
    out.push("## " + cat.label + (cat.defaultOn ? "" : " (reminders off by default)"));
    out.push("");
    out.push("| Campaign | When | Reminder | Drafts |");
    out.push("| --- | --- | --- | --- |");
    CAMPAIGNS.filter((c) => c.category === cat.id).forEach((c) => {
      const conf = Object.entries(c.confirmed || {}).map(([y, v]) => y + ": " + rangeLabel(v.start, v.end) + (v.venue ? ", " + v.venue : "")).join("; ");
      const name = c.url ? "[" + c.name + "](" + c.url + ")" : c.name;
      out.push("| " + name + " (`" + c.id + "`) | " + ruleText(c.rule) + (conf ? ". Confirmed " + conf : "") + " | " + c.leadDays + " days before | " + c.drafts.map((d) => d.name).join(", ") + " |");
    });
  });
  out.push("");
  out.push("## Editing");
  out.push("");
  out.push("Add or change a campaign in `src/core/data/campaigns.json`. A `rule` gives the date in any year: `month` (the whole month), `fixed` (a day of the year) or `nthWeekday` (for example the last Thursday of September, with `n: -1`). Mark a rule `estimate` when it follows the pattern of recent years rather than a fixed definition, and add `confirmed` dates for a year once they are announced. Draft values can use these tokens:");
  out.push("");
  out.push("| Token | Becomes |");
  out.push("| --- | --- |");
  const ex: Array<[string, string]> = [
    ["{year}", "the year it happens"],
    ["{edition}", "the year after, as Good Beer Guide editions are named"],
    ["{dates}", "the date range, for example 1 to 31 May"],
    ["{start} and {end}", "the first and last day, for example Thursday 24 September"],
    ["{days}", "days to go from the day the draft is used"],
    ["{venue} and {where}", "the host city, and \"in\" plus the host city, when confirmed"],
    ["{age} and {ordinal}", "CAMRA's age that year, as a number and as 55th"],
  ];
  ex.forEach(([k, v]) => out.push("| `" + k + "` | " + v + " |"));
  out.push("");
  return out.join("\n");
}

const NTH = ["", "first", "second", "third", "fourth", "fifth"];

export function ruleText(r: Rule): string {
  if (r.kind === "month") return "All of " + MONTHS[r.month - 1];
  if (r.kind === "fixed") return r.day + " " + MONTHS[r.month - 1] + (r.days && r.days > 1 ? " for " + r.days + " days" : "");
  const which = r.n < 0 ? "last" : NTH[r.n] || r.n + "th";
  const base = "The " + which + " " + WEEKDAYS[r.weekday] + " of " + MONTHS[r.month - 1] + (r.days && r.days > 1 ? ", for " + r.days + " days" : "");
  return base + (r.estimate ? " (estimated)" : "");
}
