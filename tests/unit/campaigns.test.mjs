// Campaigns: date rules, reminders, drafts and the iCalendar feeds.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGNS,
  CATEGORIES,
  DEFAULT_PREFS,
  FEEDS,
  buildIcs,
  campaignById,
  campaignsMarkdown,
  draftParams,
  dueAlerts,
  emptyState,
  feedFor,
  fillTokens,
  foldLine,
  normalisePrefs,
  nthWeekday,
  occurrence,
  ordinal,
  pruneState,
  rangeLabel,
  suggestedDraft,
  timeline,
  tokens,
} from "../../src/core/campaigns.ts";
import { TEMPLATES, templateById } from "../../src/core/templates.ts";
import { ICON_NAMES } from "../../src/core/icons.ts";
import { readFileSync } from "node:fs";

const c = (id) => campaignById(id);

test("campaign ids are unique and every campaign is complete", () => {
  const ids = CAMPAIGNS.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
  const cats = new Set(CATEGORIES.map((x) => x.id));
  for (const x of CAMPAIGNS) {
    assert.ok(cats.has(x.category), x.id + " category");
    assert.ok(x.summary.length > 20, x.id + " summary");
    assert.ok(x.leadDays >= 7 && x.leadDays <= 60, x.id + " lead");
    assert.ok(x.drafts.length >= 1, x.id + " drafts");
    if (x.url) assert.match(x.url, /^https:\/\//, x.id + " url");
  }
});

test("every draft uses a real post type, real fields and a real icon", () => {
  for (const x of CAMPAIGNS) {
    for (const d of x.drafts) {
      const t = templateById(d.type);
      assert.ok(t, x.id + "/" + d.id + " type " + d.type);
      const keys = new Set(t.fields.map((f) => f.key));
      // copy is the post text, which every post type carries.
      for (const k of Object.keys(d.values)) assert.ok(k === "copy" || keys.has(k), x.id + "/" + d.id + " field " + k);
      if (d.icon) assert.ok(ICON_NAMES.includes(d.icon), x.id + "/" + d.id + " icon " + d.icon);
      const phase = d.values.phase;
      if (phase) {
        const opts = t.fields.find((f) => f.key === "phase").options.map((o) => (Array.isArray(o) ? o[0] : o));
        assert.ok(opts.includes(phase), x.id + "/" + d.id + " phase " + phase);
      }
    }
  }
});

test("nth weekday: first, third and last Thursdays", () => {
  assert.equal(nthWeekday(2026, 8, 4, 1), "2026-08-06");
  assert.equal(nthWeekday(2026, 9, 4, 3), "2026-09-17");
  assert.equal(nthWeekday(2026, 9, 4, -1), "2026-09-24");
  assert.equal(nthWeekday(2027, 9, 4, -1), "2027-09-30");
  assert.equal(nthWeekday(2026, 12, 6, 1), "2026-12-05");
});

test("occurrences match the dates published for 2026 and 2027", () => {
  const o = (id, y) => {
    const r = occurrence(c(id), y);
    return [r.start, r.end];
  };
  assert.deepEqual(o("mild-month", 2027), ["2027-05-01", "2027-05-31"]);
  assert.deepEqual(o("cider-perry-month", 2027), ["2027-07-01", "2027-07-31"]);
  assert.deepEqual(o("cask-ale-week", 2026), ["2026-09-17", "2026-09-27"]);
  assert.deepEqual(o("gbg-launch", 2026), ["2026-09-24", "2026-09-24"]);
  assert.deepEqual(o("gbg-launch", 2025), ["2025-09-25", "2025-09-25"]);
  assert.deepEqual(o("members-weekend", 2027), ["2027-04-16", "2027-04-18"]);
  assert.deepEqual(o("small-business-saturday", 2026), ["2026-12-05", "2026-12-05"]);
  assert.deepEqual(o("beer-day-britain", 2026), ["2026-06-15", "2026-06-15"]);
});

test("the rules for estimated campaigns reproduce the confirmed years", () => {
  // If a rule fits the years we know, it is a fair guess for the next one.
  for (const x of CAMPAIGNS) {
    if (x.rule.kind === "once") continue;
    for (const [y, conf] of Object.entries(x.confirmed || {})) {
      const bare = occurrence({ ...x, confirmed: undefined }, Number(y));
      assert.deepEqual([bare.start, bare.end], [conf.start, conf.end], x.id + " " + y);
    }
  }
});

test("estimated is only set for unconfirmed pattern-based dates", () => {
  assert.equal(occurrence(c("gbg-launch"), 2026).estimated, false);
  assert.equal(occurrence(c("gbg-launch"), 2027).estimated, true);
  assert.equal(occurrence(c("mild-month"), 2030).estimated, false);
  assert.equal(occurrence(c("members-weekend"), 2027).venue, "Chester");
});

test("labels: ranges, single days and ordinals", () => {
  assert.equal(rangeLabel("2027-05-01", "2027-05-31"), "1 to 31 May");
  assert.equal(rangeLabel("2027-04-30", "2027-05-02"), "30 April to 2 May");
  assert.equal(rangeLabel("2026-09-24", "2026-09-24"), "Thursday 24 September");
  assert.equal(rangeLabel("2027-05-01", "2027-05-31", true), "1 to 31 May 2027");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 56, 101, 111].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "56th", "101st", "111th"]);
});

test("reminders: before (to schedule posts) and while it is on", () => {
  const prefs = DEFAULT_PREFS;
  const before = dueAlerts(CAMPAIGNS, "2027-04-10", prefs, emptyState());
  const mild = before.find((a) => a.entry.occ.campaign.id === "mild-month");
  assert.equal(mild.phase, "prep");
  assert.equal(mild.entry.daysToStart, 21);
  assert.match(mild.body, /schedule your posts/);
  const during = dueAlerts(CAMPAIGNS, "2027-05-20", prefs, emptyState()).find((a) => a.entry.occ.campaign.id === "mild-month");
  assert.equal(during.phase, "live");
  assert.equal(during.entry.daysLeft, 12);
  assert.equal(dueAlerts(CAMPAIGNS, "2027-06-01", prefs, emptyState()).some((a) => a.entry.occ.campaign.id === "mild-month"), false);
  assert.equal(dueAlerts(CAMPAIGNS, "2027-03-01", prefs, emptyState()).some((a) => a.entry.occ.campaign.id === "mild-month"), false);
});

test("reminders: live ones come first", () => {
  const list = dueAlerts(CAMPAIGNS, "2027-07-25", DEFAULT_PREFS, emptyState());
  assert.equal(list[0].phase, "live");
  assert.ok(list.some((a) => a.phase === "prep"));
});

test("reminders: dismissing one stage keeps the other, snoozing hides until the day", () => {
  const key = "mild-month:2027:prep";
  const s = { ...emptyState(), dismissed: { [key]: true } };
  assert.equal(dueAlerts(CAMPAIGNS, "2027-04-10", DEFAULT_PREFS, s).some((a) => a.key === key), false);
  assert.ok(dueAlerts(CAMPAIGNS, "2027-05-02", DEFAULT_PREFS, s).some((a) => a.key === "mild-month:2027:live"));
  const z = { ...emptyState(), snoozed: { [key]: "2027-04-13" } };
  assert.equal(dueAlerts(CAMPAIGNS, "2027-04-12", DEFAULT_PREFS, z).some((a) => a.key === key), false);
  assert.ok(dueAlerts(CAMPAIGNS, "2027-04-13", DEFAULT_PREFS, z).some((a) => a.key === key));
});

test("reminders: categories, mutes, lead override and the off switch", () => {
  const day = "2027-04-20"; // St George's Day is three days away
  const has = (p, id) => dueAlerts(CAMPAIGNS, day, p, emptyState()).some((a) => a.entry.occ.campaign.id === id);
  assert.equal(has(DEFAULT_PREFS, "st-georges-day"), false, "national days are off by default");
  assert.equal(has({ ...DEFAULT_PREFS, categories: ["national"] }, "st-georges-day"), true);
  assert.equal(has({ ...DEFAULT_PREFS, muted: ["mild-month"] }, "mild-month"), false);
  assert.equal(has({ ...DEFAULT_PREFS, leadDays: 7 }, "mild-month"), false);
  assert.equal(has({ ...DEFAULT_PREFS, enabled: false }, "mild-month"), false);
});

test("prefs and state survive junk", () => {
  assert.deepEqual(normalisePrefs(null), DEFAULT_PREFS);
  const p = normalisePrefs({ enabled: "yes", categories: ["camra", "nope"], leadDays: 999, muted: [1, "x"] });
  assert.deepEqual([p.enabled, p.categories, p.leadDays, p.muted], [true, ["camra"], null, ["x"]]);
  const pruned = pruneState({ dismissed: { "a:2020:prep": true, "a:2027:prep": true }, snoozed: {}, notified: {} }, "2027-01-01");
  assert.deepEqual(Object.keys(pruned.dismissed), ["a:2027:prep"]);
});

test("drafts: tokens fill in, and countdowns count from the day used", () => {
  const occ = occurrence(c("gbg-launch"), 2026);
  const t = tokens(occ, "2026-09-10");
  assert.equal(t.edition, "2027");
  assert.equal(t.days, "14");
  const qp = draftParams(c("gbg-launch").drafts[0], occ, "2026-09-10");
  assert.equal(qp.get("type"), "countdown");
  assert.equal(qp.get("event"), "The 2027 Good Beer Guide");
  assert.equal(qp.get("date"), "Out Thursday 24 September");
  assert.equal(qp.get("days"), "14");
  const list = JSON.parse(draftParams(c("camra-birthday").drafts[1], occurrence(c("camra-birthday"), 2027), "2027-03-01").get("benefits"));
  assert.equal(list[0].benefit, "56 years of campaigning");
  assert.equal(fillTokens("CAMRA Members' Weekend {where}", { where: "" }), "CAMRA Members' Weekend");
  assert.equal(fillTokens("{dates} {where}.", { dates: "1 to 3 May", where: "" }), "1 to 3 May.");
});

test("drafts render through their post type", () => {
  const occ = occurrence(c("mild-month"), 2027);
  const qp = draftParams(c("mild-month").drafts[0], occ, "2027-04-10");
  const v = Object.fromEntries(qp);
  const l = templateById("campaignmonth").build(v);
  assert.deepEqual([l.eyebrow, l.title, l.subtitle, l.campaign], ["MILD MONTH", "21 days to go", "1 to 31 May", true]);
});

test("suggested draft follows the moment", () => {
  const [before] = timeline([c("mild-month")], "2027-04-10");
  assert.equal(suggestedDraft(before).phase, "before");
  const [start] = timeline([c("mild-month")], "2027-05-03");
  assert.equal(suggestedDraft(start).phase, "start");
  const [end] = timeline([c("mild-month")], "2027-05-27");
  assert.equal(suggestedDraft(end).phase, "end");
});

test("stages: campaign posts look the same as before when no stage is set", () => {
  const l = templateById("campaignmonth").build({ campaignName: "Mild Month", heading: "H", note: "N" });
  assert.deepEqual([l.eyebrow, l.title, l.lines], ["MILD MONTH", "H", ["N"]]);
  const o = templateById("occasion").build({ occasion: "St George's Day", phase: "today" });
  assert.deepEqual([o.eyebrow, o.title, o.campaign, o.accentKey], ["TODAY", "St George's Day", undefined, "watermelon"]);
  assert.equal(templateById("occasion").build({ occasion: "World Cider Day" }).accentKey, "blue");
  assert.equal(TEMPLATES.filter((t) => t.id === "occasion").length, 1);
});

test("iCalendar: CRLF lines no longer than 75 octets, escaped text, unique UIDs", () => {
  const now = new Date(Date.UTC(2026, 9, 18, 12, 0, 0));
  for (const f of FEEDS) {
    const ics = feedFor(f, now, { siteUrl: "https://example.org/studio/", version: "2.4.0" });
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"), f.file);
    assert.equal(/[^\r]\n/.test(ics), false, f.file + " bare LF");
    const enc = new TextEncoder();
    for (const line of ics.split("\r\n")) assert.ok(enc.encode(line).length <= 75, f.file + " long line: " + line);
    const uids = ics.match(/^UID:.*$/gm);
    assert.equal(new Set(uids).size, uids.length, f.file + " duplicate UID");
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
  }
  const all = feedFor(FEEDS[0], now, {});
  assert.match(all, /UID:mild-month-2027@camra-graphics-studio/);
  assert.match(all, /DTSTART;VALUE=DATE:20270501\r\nDTEND;VALUE=DATE:20270601/);
  assert.match(all, /TRIGGER:-P28D/);
  assert.match(all, /SUMMARY:Good Beer Guide launch \(date estimated\)/);
  assert.match(all, /DTSTAMP:20261018T120000Z/);
  // Four years ahead are not included; last year is.
  assert.match(all, /tryanuary-2025@/);
  assert.equal(/tryanuary-2030@/.test(all), false);
  const camraOnly = feedFor(FEEDS[1], now, {});
  assert.equal(/beer-day-britain/.test(camraOnly), false);
  const plan = feedFor(FEEDS[2], now, { siteUrl: "https://example.org/" });
  assert.match(plan, /UID:mild-month-2027-plan@/);
  assert.match(plan, /DTSTART;VALUE=DATE:20270403/);
  assert.match(plan.replace(/\r\n /g, ""), /\?campaign=mild-month/);
});

test("iCalendar: folding never splits a character and text is escaped", () => {
  const long = "DESCRIPTION:" + "é".repeat(80);
  const folded = foldLine(long);
  assert.equal(folded.replace(/\r\n /g, ""), long);
  const one = buildIcs([occurrence(c("mild-month"), 2027)], { name: "A, B; C", description: "x\ny", now: new Date(0) });
  assert.match(one, /X-WR-CALNAME:A\\, B\\; C/);
  assert.match(one, /X-WR-CALDESC:x\\ny/);
});

test("docs/CAMPAIGNS.md is generated from the catalogue", () => {
  const md = campaignsMarkdown();
  for (const x of CAMPAIGNS) assert.ok(md.includes("`" + x.id + "`"), x.id);
  assert.equal(readFileSync(new URL("../../docs/CAMPAIGNS.md", import.meta.url), "utf8"), md);
  assert.equal(/[\u2013\u2014]/.test(md), false, "no dashes");
});
