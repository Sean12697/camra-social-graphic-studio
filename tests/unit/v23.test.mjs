// The logo catalogue, the extra post types, icons and print sizes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { BRANCH_LOGOS, REGION_LOGOS, SUB_BRAND_LOGOS, searchLogos, shortName, findLogo } from "../../src/core/logos.ts";
import { CONFIG } from "../../src/core/config.ts";
import { TEMPLATES, TEMPLATE_GROUPS, templateById } from "../../src/core/templates.ts";
import { ALL_ICONS, ICON_GROUPS, ICON_NAMES, iconLabel } from "../../src/core/icons.ts";
import { PRESETS } from "../../src/core/presets.ts";
import { contextNotes } from "../../src/core/brand.ts";
import { logosMarkdown } from "../../src/core/params.ts";

const root = new URL("../../", import.meta.url);

test("the catalogue has every branch, region and sub-brand, with unique ids", () => {
  assert.equal(BRANCH_LOGOS.length, 217);
  assert.equal(REGION_LOGOS.length, 16);
  assert.equal(SUB_BRAND_LOGOS.length, 6);
  for (const list of [BRANCH_LOGOS, REGION_LOGOS, SUB_BRAND_LOGOS]) assert.equal(new Set(list.map((e) => e.id)).size, list.length);
});

test("every catalogue file and preview exists", () => {
  for (const e of [...BRANCH_LOGOS, ...REGION_LOGOS, ...SUB_BRAND_LOGOS]) {
    if (e.logo) assert.ok(existsSync(new URL(e.logo, root)), e.logo);
    if (e.thumb) assert.ok(existsSync(new URL(e.thumb, root)), e.thumb);
  }
  assert.ok(BRANCH_LOGOS.every((b) => b.logo), "every branch has a logo");
});

test("branches keep the original default and its id", () => {
  assert.equal(CONFIG.branches["central-manchester"].name, "Central Manchester CAMRA");
  assert.equal(Object.keys(CONFIG.branches).length, 217);
  assert.equal(shortName("Bridgnorth (sub-branch)"), "Bridgnorth");
});

test("logo search ignores case, accents and & versus and", () => {
  assert.deepEqual(searchLogos(BRANCH_LOGOS, "bristol and").map((e) => e.id), ["bristol-district"]);
  assert.ok(searchLogos(BRANCH_LOGOS, "GWYNEDD MON").length === 1);
  assert.equal(searchLogos(BRANCH_LOGOS, "").length, 217);
  assert.ok(findLogo(SUB_BRAND_LOGOS, "locale"));
});

test("every post type has a group and the new ones build sensibly", () => {
  assert.equal(TEMPLATES.length, 23);
  for (const t of TEMPLATES) assert.ok(TEMPLATE_GROUPS.includes(t.group), t.id);
  assert.equal(templateById("countdown").build({ days: "1" }).title, "1 day to go");
  assert.equal(templateById("countdown").build({ days: "12" }).title, "12 days to go");
  assert.equal(templateById("pubcampaign").build({ status: "saved", pubName: "X" }).eyebrow, "PUB SAVED");
  const cider = templateById("campaignmonth").build({ campaignName: "Cider and Perry Month" });
  assert.deepEqual([cider.campaign, cider.cider, cider.campaignName], [true, true, "Real Cider and Perry"]);
  assert.equal(templateById("locale").subBrand, "locale");
  assert.ok(findLogo(SUB_BRAND_LOGOS, templateById("heritage").subBrand));
  for (const t of TEMPLATES) assert.ok(ALL_ICONS[t.defaultIcon], t.id + " icon " + t.defaultIcon);
});

test("icons: solid and line sets, every icon grouped once", () => {
  assert.ok(ICON_NAMES.length >= 70);
  const grouped = ICON_GROUPS.flatMap((g) => g.icons);
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual([...grouped].sort(), [...ICON_NAMES].sort());
  assert.equal(iconLabel("apple-outline"), "Apple");
  assert.equal(iconLabel("apple"), "Apple (solid)");
});

test("print sizes are 300 dpi A4 and A5", () => {
  const a4 = PRESETS.find((p) => p.id === "print-a4");
  assert.deepEqual([a4.w, a4.h], [2480, 3508]);
});

test("region and sub-brand logos get their own brand notes", () => {
  const titles = (o) => contextNotes({}, o).map((n) => n.title);
  assert.ok(titles({ slotKind: "subBrand", slotName: "LocAle" }).includes("LocAle logo"));
  assert.ok(titles({ slotKind: "region", slotName: "CAMRA Wales" }).includes("Region logo"));
  const camp = contextNotes({ campaign: true, campaignName: "One to Try" }, { who: { branch: true, camra: false }, slotKind: "region" });
  assert.ok(camp.some((n) => n.title === "Region logo on a campaign (off-brand)"));
});

test("docs/LOGOS.md lists every logo", () => {
  const md = logosMarkdown();
  for (const e of [...BRANCH_LOGOS, ...REGION_LOGOS, ...SUB_BRAND_LOGOS]) assert.ok(md.includes("`" + e.id + "`"), e.id);
});
