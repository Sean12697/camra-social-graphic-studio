// 2.6: designs vs calendar posts, repeating posts, one-off campaigns and
// drafts that suit any time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { kindOf, queryDesigns } from "../../src/core/designs.ts";
import { cleanDesign } from "../../src/core/bundle.ts";
import { currentPostDay, planIcs, plannedPosts, planStatus, postAlert, postDays, repeatLabel, suggestedPostDate } from "../../src/core/calendar.ts";
import { campaignById, draftCopy, occurrence, occurrencesBetween } from "../../src/core/campaigns.ts";

const rec =(o) => ({ id: "x", name: "X", typeId: "custom", params: "type=custom", createdAt: "2027-01-01T00:00:00Z", updatedAt: "2027-01-01T00:00:00Z", ...o });

test("records with a date are posts; designs never reach the calendar", () => {
  assert.equal(kindOf(rec({ postOn: "2027-04-10" })), "post");
  assert.equal(kindOf(rec({})), "design");
  assert.equal(kindOf(rec({ kind: "design", postOn: "2027-04-10" })), "design");
  const list = [rec({ id: "a", kind: "design" }), rec({ id: "b", kind: "post", postOn: "2027-04-10" })];
  assert.deepEqual(plannedPosts(list).map((d) => d.id), ["b"]);
  assert.deepEqual(queryDesigns(list, { kind: "design" }).map((d) => d.id), ["a"]);
  // A 2.5 backup's dated design arrives as a post.
  assert.equal(cleanDesign(rec({ postOn: "2027-04-10" })).kind, "post");
  assert.equal(cleanDesign(rec({ postOn: "2027-04-10", repeat: "fortnight" })).repeat, null);
});

test("repeating posts fall on every week, month or year until they end", () => {
  assert.deepEqual(postDays(rec({ postOn: "2027-04-08", repeat: "week" }), "2027-04-01", "2027-04-30"), ["2027-04-08", "2027-04-15", "2027-04-22", "2027-04-29"]);
  assert.deepEqual(postDays(rec({ postOn: "2027-04-08", repeat: "week", repeatUntil: "2027-04-20" }), "2027-04-01", "2027-04-30"), ["2027-04-08", "2027-04-15"]);
  // The 31st skips shorter months, 29 February skips other years.
  assert.deepEqual(postDays(rec({ postOn: "2027-01-31", repeat: "month" }), "2027-01-01", "2027-05-31"), ["2027-01-31", "2027-03-31", "2027-05-31"]);
  assert.deepEqual(postDays(rec({ postOn: "2028-02-29", repeat: "year" }), "2028-01-01", "2033-12-31"), ["2028-02-29", "2032-02-29"]);
  // Far from the start, it still lands on the right weekday.
  assert.deepEqual(postDays(rec({ postOn: "2020-01-02", repeat: "week" }), "2027-04-01", "2027-04-10"), ["2027-04-01", "2027-04-08"]);
  assert.deepEqual(postDays(rec({ postOn: "2027-04-08" }), "2027-04-01", "2027-04-30"), ["2027-04-08"]);
  assert.equal(repeatLabel({ repeat: "month", repeatUntil: "2027-12-31" }), "Every month until Friday 31 December 2027");
});

test("a repeating post is marked posted day by day", () => {
  const d = rec({ kind: "post", postOn: "2027-04-08", repeat: "week", postedDays: ["2027-04-08"] });
  assert.equal(planStatus(d, "2027-04-10", "2027-04-08"), "posted");
  assert.equal(planStatus(d, "2027-04-10", "2027-04-15"), "upcoming");
  assert.equal(currentPostDay(d, "2027-04-10"), "2027-04-15");
  assert.equal(currentPostDay(d, "2027-04-16"), "2027-04-15");
  assert.equal(planStatus(d, "2027-04-16"), "overdue");
  const a = postAlert([d], "2027-04-15", {});
  assert.equal(a.today.length, 1);
});

test("the plan .ics repeats a repeating post", () => {
  const ics = planIcs([rec({ kind: "post", postOn: "2027-04-08", postAt: "19:30", repeat: "week", repeatUntil: "2027-06-24" })], new Date("2027-04-01T00:00:00Z"));
  assert.match(ics, /RRULE:FREQ=WEEKLY;UNTIL=20270624T235959/);
});

test("one-off campaigns only happen in their year, and any-time drafts suit today", () => {
  const ymf = campaignById("young-members-forum");
  assert.ok(ymf);
  const occ = occurrencesBetween([ymf], 2025, 2028);
  assert.equal(occ.length, 1);
  assert.equal(occ[0].start, "2026-11-07");
  const draft = ymf.drafts.find((x) => x.id === "see-you-there");
  assert.equal(suggestedPostDate(ymf, occ[0], draft, "2026-10-19"), "2026-10-19");
  // Planned together, they are spread before the day.
  const days = ymf.drafts.map((x) => suggestedPostDate(ymf, occ[0], x, "2026-10-19", true));
  assert.equal(new Set(days).size, 3);
  assert.ok(days.every((x) => x >= "2026-10-19" && x < "2026-11-07"));
  assert.match(draftCopy(draft, occ[0]), /Saturday 7 November/);
});

test("Volunteers' Week is the first week of June", () => {
  const v = campaignById("volunteers-week");
  const o = occurrence({ ...v, confirmed: undefined }, 2027);
  assert.deepEqual([o.start, o.end], ["2027-06-07", "2027-06-13"]);
});
