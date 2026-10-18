// Content calendar: month grids, day items, suggested dates, retiming, copy
// limits, post reminders, the plan export and planned fields in backups.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  copyCheck,
  copyLength,
  isHm,
  isYmd,
  itemsByDay,
  monthGrid,
  planIcs,
  planStatus,
  plannedPosts,
  postAlert,
  retimeParams,
  suggestedPostDate,
  weekdayHeaders,
} from "../../src/core/calendar.ts";
import { CAMPAIGNS, campaignById, draftCopy, draftParams, occurrence } from "../../src/core/campaigns.ts";
import { cleanDesign } from "../../src/core/bundle.ts";
import { queryDesigns } from "../../src/core/designs.ts";

const d = (over) => ({ id: "x", name: "Post", typeId: "newcomer", params: "type=newcomer", createdAt: "2027-01-01T00:00:00Z", updatedAt: "2027-01-01T00:00:00Z", deletedAt: null, ...over });

test("dates and times are validated", () => {
  assert.ok(isYmd("2028-02-29"));
  assert.equal(isYmd("2027-02-29"), false);
  assert.equal(isYmd("2027-4-1"), false);
  assert.ok(isHm("19:30"));
  assert.equal(isHm("24:00"), false);
});

test("month grids are whole weeks starting Monday or Sunday", () => {
  const g = monthGrid(2027, 4, 1);
  assert.equal(g[0][0], "2027-03-29");
  assert.equal(g[g.length - 1][6], "2027-05-02");
  assert.ok(g.every((w) => w.length === 7));
  assert.equal(monthGrid(2027, 4, 0)[0][0], "2027-03-28");
  // February 2027 starts on a Monday and fits exactly four weeks.
  assert.equal(monthGrid(2027, 2, 1).length, 4);
  assert.deepEqual(weekdayHeaders(1).slice(0, 2), ["Mon", "Tue"]);
  assert.deepEqual(addMonths(2027, 12, 1), { year: 2028, month: 1 });
  assert.deepEqual(addMonths(2027, 1, -1), { year: 2026, month: 12 });
});

test("items by day: planned posts and every day of a campaign", () => {
  const posts = [d({ id: "a", postOn: "2027-05-03" }), d({ id: "b", postOn: "2027-05-03", deletedAt: "2027-01-02" }), d({ id: "c" })];
  const map = itemsByDay(posts, [campaignById("mild-month")], "2027-04-28", "2027-05-04");
  assert.equal(map.get("2027-05-03").posts.length, 1);
  assert.equal(map.get("2027-05-01").campaigns[0].campaign.id, "mild-month");
  assert.equal(map.get("2027-04-30"), undefined);
});

test("statuses", () => {
  assert.equal(planStatus(d({ postOn: "2027-04-01" }), "2027-04-10"), "overdue");
  assert.equal(planStatus(d({ postOn: "2027-04-10" }), "2027-04-10"), "today");
  assert.equal(planStatus(d({ postOn: "2027-04-11" }), "2027-04-10"), "upcoming");
  assert.equal(planStatus(d({ postOn: "2027-04-01", postedAt: "2027-04-01T19:00:00Z" }), "2027-04-10"), "posted");
  assert.equal(planStatus(d({}), "2027-04-10"), "unplanned");
});

test("suggested days for each kind of campaign draft", () => {
  const c = campaignById("mild-month");
  const o = occurrence(c, 2027);
  const by = Object.fromEntries(c.drafts.map((x) => [x.id, suggestedPostDate(c, o, x, "2027-04-01")]));
  assert.deepEqual(by, { countdown: "2027-04-24", "on-now": "2027-05-01", "last-week": "2027-05-25", thanks: "2027-06-01" });
  // Never in the past.
  assert.equal(suggestedPostDate(c, o, c.drafts[0], "2027-04-28"), "2027-04-28");
  const g = campaignById("gbg-launch");
  const go = occurrence(g, 2026);
  assert.deepEqual(g.drafts.map((x) => suggestedPostDate(g, go, x, "2026-01-01")), ["2026-09-17", "2026-09-20", "2026-09-24"]);
});

test("moving a countdown recounts its days, unless the user typed their own", () => {
  const ref = { id: "mild-month", year: 2027, draft: "countdown" };
  const params = draftParams(campaignById("mild-month").drafts[0], occurrence(campaignById("mild-month"), 2027), "2027-04-24").toString();
  assert.equal(new URLSearchParams(params).get("days"), "7");
  const moved = retimeParams(params, ref, "2027-04-24", "2027-04-27");
  assert.equal(new URLSearchParams(moved).get("days"), "4");
  assert.match(new URLSearchParams(moved).get("copy"), /^4 days to go: Mild Month\./);
  const edited = new URLSearchParams(params);
  edited.set("days", "12");
  assert.equal(retimeParams(edited.toString(), ref, "2027-04-24", "2027-04-27"), edited.toString());
  // Drafts without a countdown are left alone.
  assert.equal(retimeParams("type=x", { id: "mild-month", year: 2027, draft: "thanks" }, "2027-06-01", "2027-06-02"), "type=x");
});

test("drafts come with suggested post text and hashtags", () => {
  const c = campaignById("mild-month");
  const o = occurrence(c, 2027);
  const copy = draftCopy(c.drafts[1], o);
  assert.match(copy, /^Make yours a Mild this May\./);
  assert.match(copy, /#MildMay #MildMonth$/);
  assert.equal(draftParams(c.drafts[1], o, "2027-05-01").get("copy"), copy);
  for (const x of CAMPAIGNS) for (const dr of x.drafts) assert.ok(draftCopy(dr, occurrence(x, 2027)).length > 5, x.id + "/" + dr.id);
});

test("copy length counts characters as people do", () => {
  assert.equal(copyLength("Cheers 🍺"), 8);
  assert.equal(copyLength("é"), 1);
  const c = copyCheck("x".repeat(290));
  assert.equal(c.find((x) => x.platform === "X").over, 10);
  assert.equal(c.find((x) => x.platform === "Bluesky").over, 0);
});

test("post reminder: today's posts and earlier ones not marked posted", () => {
  const list = [d({ id: "a", name: "Quiz", postOn: "2027-04-10", postAt: "19:00" }), d({ id: "b", postOn: "2027-04-08" }), d({ id: "c", postOn: "2027-04-09", postedAt: "x" }), d({ id: "e", postOn: "2027-04-11" })];
  const a = postAlert(list, "2027-04-10", {});
  assert.equal(a.title, "1 post planned for today");
  assert.equal(a.body, "Quiz at 19:00. 1 earlier post not marked as posted yet.");
  assert.equal(postAlert(list, "2027-04-10", { "posts:2027-04-10": true }), null);
  assert.equal(postAlert([list[3]], "2027-04-10", {}), null);
  assert.equal(postAlert([list[1]], "2027-04-10", {}).title, "1 planned post not marked as posted");
});

test("the plan exports as iCalendar with timed and all-day posts", () => {
  const list = [d({ id: "a", name: "Quiz night", postOn: "2027-04-10", postAt: "23:50", params: "type=x&copy=" + encodeURIComponent("Quiz, tonight; 8pm") }), d({ id: "b", name: "GBG", postOn: "2027-09-24", campaign: { id: "gbg-launch", year: 2027, draft: "in-the-guide" } })];
  const ics = planIcs(list, new Date(Date.UTC(2027, 3, 1)));
  assert.match(ics, /DTSTART:20270410T235000\r\nDTEND:20270411T000500/);
  assert.match(ics, /DTSTART;VALUE=DATE:20270924\r\nDTEND;VALUE=DATE:20270925/);
  assert.match(ics.replace(/\r\n /g, ""), /Quiz\\, tonight\\; 8pm/);
  assert.match(ics.replace(/\r\n /g, ""), /For Good Beer Guide launch\./);
  assert.match(ics, /TRIGGER:-PT15M/);
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75);
});

test("planned fields survive a backup, and junk is dropped", () => {
  const ok = cleanDesign({ id: "a", name: "A", params: "", postOn: "2027-04-10", postAt: "19:30", postedAt: "2027-04-10T19:40:00Z", campaign: { id: "mild-month", year: 2027, draft: "countdown" } });
  assert.deepEqual([ok.postOn, ok.postAt, ok.postedAt, ok.campaign], ["2027-04-10", "19:30", "2027-04-10T19:40:00Z", { id: "mild-month", year: 2027, draft: "countdown" }]);
  const bad = cleanDesign({ id: "a", name: "A", params: "", postOn: "<script>", postAt: "19:30", campaign: { id: 1 } });
  assert.deepEqual([bad.postOn, bad.postAt, bad.campaign], [null, null, null]);
});

test("designs filter and sort by the calendar", () => {
  const list = [d({ id: "a", name: "A", postOn: "2027-05-01" }), d({ id: "b", name: "B" }), d({ id: "c", name: "C", postOn: "2027-04-01", postedAt: "x" }), d({ id: "e", name: "E", postOn: "2027-04-20" })];
  assert.deepEqual(queryDesigns(list, { plan: "planned", sort: "planned" }).map((x) => x.id), ["e", "a"]);
  assert.deepEqual(queryDesigns(list, { plan: "unplanned" }).map((x) => x.id), ["b"]);
  assert.deepEqual(queryDesigns(list, { plan: "posted" }).map((x) => x.id), ["c"]);
  assert.deepEqual(plannedPosts(list).map((x) => x.id), ["c", "e", "a"]);
});

