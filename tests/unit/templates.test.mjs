// Templates, presets and the parameter schema: the rules the old in-browser
// test page checked, plus the generated docs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, templateById } from "../../src/core/templates.ts";
import { PRESETS, orientDims } from "../../src/core/presets.ts";
import { PARAM_DEFS, docsHtml, docsMarkdown } from "../../src/core/params.ts";

const tmpl = (id) => templateById(id);

test("template ids are unique", () => {
  const ids = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every template build() tolerates empty values", () => {
  for (const t of TEMPLATES) assert.equal(typeof t.build({}), "object", t.id);
});

test("award: gold result uses the gold accent", () => {
  assert.equal(tmpl("award").build({ result: "gold", recipient: "Test", award: "Pub of the Year" }).accentKey, "gold");
});

test("award: a cider award is a Blue campaign", () => {
  const l = tmpl("award").build({ award: "Cider Pub of the Year", recipient: "Test" });
  assert.deepEqual([l.accentKey, l.campaign, l.cider], ["blue", true, true]);
});

test("beer: cider kind is a Real Cider and Perry campaign", () => {
  const l = tmpl("beer").build({ kind: "cider", beer: "Test" });
  assert.deepEqual([l.accentKey, l.campaign, l.campaignName], ["blue", true, "Real Cider and Perry"]);
});

test("beer: beer kind is a One to Try campaign with the amber accent", () => {
  const l = tmpl("beer").build({ kind: "beer", beer: "Test" });
  assert.deepEqual([l.accentKey, l.campaign, l.campaignName], ["amber", true, "One to Try"]);
});

test("pub feature: One to Try headline is a campaign", () => {
  const l = tmpl("pubfeature").build({ headline: "One to Try", pubName: "X" });
  assert.equal(l.campaign, true);
  assert.equal(l.campaignName, "One to Try");
});

test("meeting: the type control fills the eyebrow", () => {
  assert.equal(tmpl("meeting").build({ meetingType: "AGM" }).eyebrow, "AGM");
});

test("what's on: events become list rows joined with a middle dot", () => {
  const l = tmpl("whatson").build({ events: [{ name: "Quiz", date: "Fri 7pm", venue: "The Pub" }] });
  assert.deepEqual(l.list, [{ primary: "Quiz", secondary: "Fri 7pm \u00b7 The Pub" }]);
  assert.equal(l.listStyle, "events");
});

test("custom: a fully blank build keeps everything empty", () => {
  const l = tmpl("custom").build({});
  assert.ok(!l.eyebrow && !l.title && !l.subtitle);
});

test("preset ids are unique and every preset has dimensions and a platform", () => {
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  for (const p of PRESETS) assert.ok(p.w > 0 && p.h > 0 && p.platform, p.id);
});

test("orientation swaps only where needed", () => {
  assert.deepEqual(orientDims({ w: 1080, h: 1920 }, "landscape"), { w: 1920, h: 1080 });
  assert.deepEqual(orientDims({ w: 1200, h: 628 }, "landscape"), { w: 1200, h: 628 });
  assert.deepEqual(orientDims({ w: 1200, h: 628 }, "portrait"), { w: 628, h: 1200 });
  assert.deepEqual(orientDims({ w: 1080, h: 1080 }, "portrait"), { w: 1080, h: 1080 });
});

test("param keys are unique", () => {
  const keys = PARAM_DEFS.map((d) => d.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("every generic param def has a kind and a default", () => {
  for (const d of PARAM_DEFS) {
    if (!d.elId) continue;
    if (d.kind === "flag") assert.equal(typeof d.defChecked, "boolean", d.key);
    else assert.ok(d.kind && d.def != null, d.key);
  }
});

test("no template field key collides with a general param key", () => {
  const keys = new Set(PARAM_DEFS.map((d) => d.key));
  for (const t of TEMPLATES) for (const f of t.fields) assert.ok(!keys.has(f.key), t.id + "." + f.key);
});

test("the HTML and Markdown references mention every general param", () => {
  const html = docsHtml();
  const md = docsMarkdown();
  for (const d of PARAM_DEFS) {
    assert.ok(html.includes("<code>" + d.key + "</code>"), "html " + d.key);
    assert.ok(md.includes("| `" + d.key + "` |"), "md " + d.key);
  }
  for (const p of PRESETS) assert.ok(md.includes("`" + p.id + "`"), p.id);
});
