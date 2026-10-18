// The content calendar: saved designs with a day to post them on, the copy
// that goes with them, and the national campaigns around them. Pure functions
// with no DOM: month grids, what is on each day, suggested days for campaign
// drafts, reminders for planned posts and an iCalendar export of the plan.

import {
  addDays,
  campaignById,
  CAMPAIGNS,
  daysBetween,
  draftCopy,
  draftParams,
  foldLine,
  icsText,
  localYmd,
  longDate,
  occurrence,
  occurrencesBetween,
  stamp,
  tokens,
  UID_DOMAIN,
  type Campaign,
  type Draft,
  type Occurrence,
} from "./campaigns.ts";
import { kindOf, type Design, type Repeat } from "./designs.ts";

/** Which campaign draft a planned post came from, so it can follow the campaign. */
export interface CampaignRef {
  id: string;
  year: number;
  draft: string;
}

export type PlanStatus = "posted" | "overdue" | "today" | "upcoming" | "unplanned";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function isHm(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function monthTitle(year: number, month: number): string {
  return MONTHS[month - 1] + " " + year;
}

export function addMonths(year: number, month: number, n: number): { year: number; month: number } {
  const i = year * 12 + (month - 1) + n;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

/** The weeks shown for a month: whole weeks, starting on Monday (1) or Sunday (0). */
export function monthGrid(year: number, month: number, weekStart: 0 | 1 = 1): string[][] {
  const first = year + "-" + String(month).padStart(2, "0") + "-01";
  const wd = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  let day = addDays(first, -((wd - weekStart + 7) % 7));
  const weeks: string[][] = [];
  const nextMonth = addMonths(year, month, 1);
  const stop = nextMonth.year + "-" + String(nextMonth.month).padStart(2, "0") + "-01";
  while (day < stop || weeks.length === 0) {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function weekdayHeaders(weekStart: 0 | 1 = 1): string[] {
  return Array.from({ length: 7 }, (_, i) => WEEKDAY_SHORT[(i + weekStart) % 7]);
}

/** Live (not deleted) posts with a day to post them. Designs (templates) never appear. */
export function plannedPosts(designs: Design[]): Design[] {
  return designs
    .filter((d) => !d.deletedAt && !d.sample && kindOf(d) === "post" && isYmd(d.postOn))
    .sort((a, b) => (a.postOn as string).localeCompare(b.postOn as string) || (a.postAt || "99:99").localeCompare(b.postAt || "99:99") || a.name.localeCompare(b.name));
}

function daysIn(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Every day a post falls on from `from` to `to` (inclusive). A one-off post
 * falls on its day; a repeating one every week, month or year from its first
 * day until repeatUntil. Monthly posts on the 31st skip shorter months and
 * yearly posts on 29 February skip other years, as calendar apps do.
 */
export function postDays(d: Pick<Design, "postOn" | "repeat" | "repeatUntil">, from: string, to: string): string[] {
  const start = d.postOn;
  if (!isYmd(start)) return [];
  if (!d.repeat) return start >= from && start <= to ? [start] : [];
  const last = isYmd(d.repeatUntil) && d.repeatUntil < to ? d.repeatUntil : to;
  const out: string[] = [];
  if (start > last) return out;
  if (d.repeat === "week") {
    let day = start;
    if (day < from) day = addDays(start, Math.ceil(daysBetween(start, from) / 7) * 7);
    for (; day <= last; day = addDays(day, 7)) out.push(day);
    return out;
  }
  const [y0, m0, d0] = start.split("-").map(Number);
  const step = d.repeat === "month" ? 1 : 12;
  const fy = Number(from.slice(0, 4));
  const fm = Number(from.slice(5, 7));
  // Jump close to `from` rather than walking from a start years back.
  let i = Math.max(0, Math.floor(((fy - y0) * 12 + (fm - m0)) / step) - 1);
  for (; ; i++) {
    const idx = m0 - 1 + i * step;
    const y = y0 + Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const first = y + "-" + String(m).padStart(2, "0") + "-01";
    if (first > last) break;
    if (d0 > daysIn(y, m)) continue;
    const day = y + "-" + String(m).padStart(2, "0") + "-" + String(d0).padStart(2, "0");
    if (day >= from && day <= last && day >= start) out.push(day);
  }
  return out;
}

/** Whether a post has been marked as posted on a day (any day, for a one-off post). */
export function postedOn(d: Design, day: string): boolean {
  if (d.repeat) return !!(d.postedDays && d.postedDays.includes(day));
  return !!d.postedAt;
}

/**
 * The day that matters for a post now: for a one-off post its day; for a
 * repeating one the most recent day in the last 30 not yet posted, else the
 * next day it falls on, else its last day.
 */
export function currentPostDay(d: Design, today: string): string | null {
  if (!isYmd(d.postOn)) return null;
  if (!d.repeat) return d.postOn;
  const back = postDays(d, addDays(today, -30), today).filter((x) => !postedOn(d, x));
  if (back.length) return back[back.length - 1];
  const next = postDays(d, addDays(today, 1), addDays(today, 400));
  if (next.length) return next[0];
  const past = postDays(d, d.postOn, today);
  return past.length ? past[past.length - 1] : d.postOn;
}

/** The status of a post on a day (or on the day that matters now, when no day is given). */
export function planStatus(d: Design, today: string, day?: string): PlanStatus {
  if (!isYmd(d.postOn)) return d.postedAt ? "posted" : "unplanned";
  const on = day || currentPostDay(d, today) || d.postOn;
  if (postedOn(d, on)) return "posted";
  if (on < today) return "overdue";
  if (on === today) return "today";
  return "upcoming";
}

const REPEAT_WORDS: Record<Repeat, string> = { week: "Every week", month: "Every month", year: "Every year" };

/** "Every week until Monday 1 March 2027", or "" for a one-off post. */
export function repeatLabel(d: Pick<Design, "repeat" | "repeatUntil">): string {
  if (!d.repeat) return "";
  return REPEAT_WORDS[d.repeat] + (isYmd(d.repeatUntil) ? " until " + longDate(d.repeatUntil) + " " + d.repeatUntil.slice(0, 4) : "");
}

export interface DayItems {
  posts: Design[];
  campaigns: Occurrence[];
}

/** Posts and campaigns for every day from `from` to `to` (inclusive). */
export function itemsByDay(designs: Design[], campaigns: Campaign[], from: string, to: string): Map<string, DayItems> {
  const map = new Map<string, DayItems>();
  const slot = (day: string) => {
    let it = map.get(day);
    if (!it) {
      it = { posts: [], campaigns: [] };
      map.set(day, it);
    }
    return it;
  };
  plannedPosts(designs).forEach((d) => {
    postDays(d, from, to).forEach((day) => slot(day).posts.push(d));
  });
  const y1 = Number(from.slice(0, 4));
  const y2 = Number(to.slice(0, 4));
  occurrencesBetween(campaigns, y1 - 1, y2).forEach((o) => {
    if (o.end < from || o.start > to) return;
    let day = o.start < from ? from : o.start;
    const last = o.end > to ? to : o.end;
    while (day <= last) {
      slot(day).campaigns.push(o);
      day = addDays(day, 1);
    }
  });
  return map;
}

/**
 * The day a campaign draft is best posted: a week before for countdowns
 * (later "before" drafts closer to the start), the first day for launches,
 * the last week for "last week" posts and the day after for thank yous.
 * "Any time" drafts suit today, or are spaced out before the day when a
 * whole campaign is planned at once. Never earlier than today.
 */
export function suggestedPostDate(c: Campaign, o: Occurrence, d: Draft, today: string, spread = false): string {
  const before = c.drafts.filter((x) => x.phase === "before");
  let day: string;
  if (d.phase === "anytime") {
    // Any time suits; planning them all at once spaces them out before the day.
    if (!spread) return today;
    const any = c.drafts.filter((x) => x.phase === "anytime");
    const span = Math.max(0, daysBetween(today, o.start) - 1);
    return addDays(today, Math.floor((any.indexOf(d) * span) / any.length));
  }
  if (d.phase === "before") {
    const i = before.indexOf(d);
    day = addDays(o.start, -7 + Math.min(i, 2) * 3);
  } else if (d.phase === "start") {
    day = o.start;
  } else if (d.phase === "end") {
    day = daysBetween(o.start, o.end) > 7 ? addDays(o.end, -6) : o.end;
  } else {
    day = addDays(o.end, 1);
  }
  return day < today ? today : day;
}

/** A draft's query string worked out for the day it will be posted on. */
export function plannedDraftParams(d: Draft, o: Occurrence, postOn: string): URLSearchParams {
  return draftParams(d, o, postOn);
}

export function refOccurrence(ref: CampaignRef | null | undefined): { campaign: Campaign; occ: Occurrence; draft: Draft } | null {
  if (!ref) return null;
  const campaign = campaignById(ref.id);
  if (!campaign) return null;
  const draft = campaign.drafts.find((x) => x.id === ref.draft);
  if (!draft) return null;
  return { campaign, occ: occurrence(campaign, ref.year), draft };
}

/**
 * When a campaign post moves to another day, its "days to go" moves with it,
 * unless the user has already typed their own number.
 */
export function retimeParams(params: string, ref: CampaignRef | null | undefined, oldDay: string | null | undefined, newDay: string): string {
  const r = refOccurrence(ref);
  if (!r || !isYmd(newDay)) return params;
  const raw = r.draft.values.days;
  if (typeof raw !== "string" || !raw.includes("{days}")) return params;
  const qp = new URLSearchParams(params);
  const was = isYmd(oldDay) ? tokens(r.occ, oldDay).days : null;
  if (qp.has("days") && was !== null && qp.get("days") !== was) return params;
  // The suggested post text mentions the days to go too; follow it only if untouched.
  const oldCopy = isYmd(oldDay) ? draftCopy(r.draft, r.occ, tokens(r.occ, oldDay)) : null;
  if (oldCopy !== null && qp.get("copy") === oldCopy) qp.set("copy", draftCopy(r.draft, r.occ, tokens(r.occ, newDay)));
  qp.set("days", tokens(r.occ, newDay).days);
  return qp.toString();
}

// --- copy ---

/** Rough character limits for the post text on each platform. */
export const COPY_LIMITS: Array<{ platform: string; limit: number }> = [
  { platform: "X", limit: 280 },
  { platform: "Bluesky", limit: 300 },
  { platform: "Threads", limit: 500 },
  { platform: "Instagram", limit: 2200 },
  { platform: "LinkedIn", limit: 3000 },
];

/** Characters as people count them (emoji and accented letters count once). */
export function copyLength(s: string): number {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<unknown> } }).Segmenter;
  if (Seg) {
    let n = 0;
    for (const _ of new Seg(undefined, { granularity: "grapheme" }).segment(s)) n++;
    return n;
  }
  return Array.from(s).length;
}

export function copyCheck(s: string): Array<{ platform: string; limit: number; over: number }> {
  const n = copyLength(s);
  return COPY_LIMITS.map((l) => ({ ...l, over: Math.max(0, n - l.limit) }));
}

// --- reminders for planned posts ---

export interface PostAlert {
  key: string;
  day: string;
  today: Design[];
  overdue: Design[];
  title: string;
  body: string;
}

/** One reminder a day: posts planned for today, plus any planned earlier and not yet marked posted. */
export function postAlert(designs: Design[], today: string, dismissed: Record<string, boolean>): PostAlert | null {
  const live = plannedPosts(designs);
  const due = live.filter((d) => postDays(d, today, today).some((x) => !postedOn(d, x)));
  const late = live.filter((d) => postDays(d, addDays(today, -30), addDays(today, -1)).some((x) => !postedOn(d, x)));
  if (!due.length && !late.length) return null;
  const key = "posts:" + today;
  if (dismissed[key]) return null;
  const n = (k: number, w: string) => k + " " + w + (k === 1 ? "" : "s");
  const title = due.length ? n(due.length, "post") + " planned for today" : n(late.length, "planned post") + " not marked as posted";
  const names = due.slice(0, 3).map((d) => d.name + (d.postAt ? " at " + d.postAt : ""));
  const body =
    (due.length ? names.join(", ") + (due.length > 3 ? " and " + (due.length - 3) + " more" : "") + "." : "") +
    (due.length && late.length ? " " : "") +
    (late.length ? n(late.length, "earlier post") + " not marked as posted yet." : "");
  return { key, day: today, today: due, overdue: late, title, body };
}

// --- iCalendar export of the plan ---

function hmCompact(hm: string): string {
  return hm.replace(":", "") + "00";
}

/**
 * The user's plan as an iCalendar file. Timed posts use floating local time
 * (they happen at that clock time wherever the calendar is), untimed ones are
 * all-day events. Each event carries the copy, so it can be pasted from the
 * calendar on the day.
 */
export function planIcs(designs: Design[], now: Date, o: { name?: string; version?: string } = {}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sean O'Mahoney//CAMRA Social Graphics Studio " + (o.version || "") + "//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsText(o.name || "My planned posts"),
  ];
  const ts = stamp(now);
  plannedPosts(designs).forEach((d) => {
    const day = d.postOn as string;
    const copy = new URLSearchParams(d.params).get("copy") || "";
    const ref = refOccurrence(d.campaign);
    const desc = [copy ? "Post text:\n" + copy : "", ref ? "For " + ref.campaign.name + "." : "", "Open the CAMRA Social Graphics Studio and find \"" + d.name + "\" in your designs or the calendar to download the graphic."].filter(Boolean).join("\n\n");
    lines.push("BEGIN:VEVENT", "UID:post-" + d.id + "@" + UID_DOMAIN, "DTSTAMP:" + ts);
    if (isHm(d.postAt)) {
      const start = day.replace(/-/g, "") + "T" + hmCompact(d.postAt);
      const endT = new Date(Date.UTC(2000, 0, 1, Number(d.postAt.slice(0, 2)), Number(d.postAt.slice(3)) + 15));
      const endDay = endT.getUTCDate() === 2 ? addDays(day, 1) : day;
      lines.push("DTSTART:" + start, "DTEND:" + endDay.replace(/-/g, "") + "T" + String(endT.getUTCHours()).padStart(2, "0") + String(endT.getUTCMinutes()).padStart(2, "0") + "00");
    } else {
      lines.push("DTSTART;VALUE=DATE:" + day.replace(/-/g, ""), "DTEND;VALUE=DATE:" + addDays(day, 1).replace(/-/g, ""));
    }
    if (d.repeat) {
      const until = isYmd(d.repeatUntil) ? ";UNTIL=" + d.repeatUntil.replace(/-/g, "") + (isHm(d.postAt) ? "T235959" : "") : "";
      lines.push("RRULE:FREQ=" + { week: "WEEKLY", month: "MONTHLY", year: "YEARLY" }[d.repeat] + until);
    }
    const done = !d.repeat && !!d.postedAt;
    lines.push("SUMMARY:" + icsText("Post: " + d.name), "DESCRIPTION:" + icsText(desc), "STATUS:" + (done ? "CONFIRMED" : "TENTATIVE"), "TRANSP:TRANSPARENT");
    if (!done) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsText("Time to post: " + d.name), isHm(d.postAt) ? "TRIGGER:-PT15M" : "TRIGGER:PT9H", "END:VALARM");
    }
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** "Thursday 24 September 2026, 19:30" style label for a planned post (or one of its days). */
export function planLabel(d: Pick<Design, "postOn" | "postAt">, day?: string): string {
  const on = day || d.postOn;
  if (!isYmd(on)) return "";
  const t = isHm(d.postAt) ? ", " + d.postAt : "";
  return longDate(on) + " " + on.slice(0, 4) + t;
}

export function todayYmd(): string {
  return localYmd(new Date());
}

export { CAMPAIGNS };
