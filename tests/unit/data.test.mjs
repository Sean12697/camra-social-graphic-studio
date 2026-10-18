// ZIP, backups, saved-design list operations, alt text and file helpers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { createZip, readZip, crc32 } from "../../src/core/zip.ts";
import { exportBundle, readBundle, planImport, applyImport, cleanDesign } from "../../src/core/bundle.ts";
import { queryDesigns, copyName, duplicateDesign, purgeExpired, defaultDesignName } from "../../src/core/designs.ts";
import { altText } from "../../src/core/alttext.ts";
import { slug, pngName, dataUrlToBytes, bytesToDataUrl } from "../../src/core/files.ts";
import { templateById, TEMPLATES } from "../../src/core/templates.ts";
import { PRESETS } from "../../src/core/presets.ts";
import { PARAM_DEFS } from "../../src/core/params.ts";

const seed = (name) => JSON.parse(readFileSync(new URL("../../seeds/" + name, import.meta.url), "utf8"));
const enc = new TextEncoder();
const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(enc.encode("123456789")), 0xcbf43926);
});

test("a ZIP round-trips, including UTF-8 names", async () => {
  const zip = createZip([{ name: "a.txt", data: enc.encode("hello") }, { name: "dir/caf\u00e9.json", data: enc.encode("{}") }]);
  const files = await readZip(zip);
  assert.equal(new TextDecoder().decode(files.get("a.txt")), "hello");
  assert.ok(files.has("dir/caf\u00e9.json"));
});

test("deflated entries from other tools can be read", async () => {
  const data = enc.encode("compressed ".repeat(50));
  const comp = deflateRawSync(data);
  const zip = createZip([{ name: "x.txt", data: comp }]);
  // Patch the entry to say "deflate" with the real uncompressed size and CRC.
  const v = new DataView(zip.buffer);
  const cd = v.getUint32(zip.length - 6, true);
  for (const [off, m, crcAt, usizeAt] of [[0, 8, 14, 22], [cd, 10, 16, 24]]) {
    v.setUint16(off + m, 8, true);
    v.setUint32(off + crcAt, crc32(data), true);
    v.setUint32(off + usizeAt, data.length, true);
  }
  const files = await readZip(zip);
  assert.equal(new TextDecoder().decode(files.get("x.txt")), "compressed ".repeat(50));
});

test("a backup round-trips designs, library images and settings", async () => {
  const data = {
    designs: [{ id: "d1", name: "One", typeId: "newcomer", params: "type=newcomer&pubName=X", photo: PNG_1PX, thumb: PNG_1PX, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" }],
    library: [{ id: "l1", kind: "logo", name: "Logo", dataUrl: PNG_1PX }],
    prefs: { theme: "light" },
  };
  const zip = await exportBundle(data, { appVersion: "9.9.9", selection: "all" });
  const files = await readZip(zip);
  assert.ok(files.has("manifest.json") && files.has("designs.json") && files.has("assets/d1-photo.png"));
  const manifest = JSON.parse(new TextDecoder().decode(files.get("manifest.json")));
  assert.deepEqual(manifest.counts, { designs: 1, library: 1, prefs: 1 });
  const back = await readBundle(zip);
  assert.equal(back.data.designs[0].photo, PNG_1PX);
  assert.equal(back.data.library[0].dataUrl, PNG_1PX);
  assert.deepEqual(back.data.prefs, { theme: "light" });
  assert.deepEqual(back.warnings, []);
});

test("a damaged backup is refused with a clear message", async () => {
  const zip = await exportBundle({ designs: [], library: [{ id: "l1", kind: "logo", name: "L", dataUrl: PNG_1PX }] }, { appVersion: "1", selection: "all" });
  const files = await readZip(zip);
  files.set("library.json", enc.encode("[]"));
  const tampered = createZip(Array.from(files, ([name, data]) => ({ name, data })));
  await assert.rejects(readBundle(tampered), /checksum/);
});

test("other files, newer schemas and other apps' JSON are refused", async () => {
  await assert.rejects(readBundle(enc.encode("hello")), /not a studio backup/);
  await assert.rejects(readBundle(enc.encode(JSON.stringify({ format: "something-else" }))), /not a CAMRA/);
  await assert.rejects(readBundle(enc.encode(JSON.stringify({ format: "camra-studio-backup", schema: 99 }))), /newer version/);
});

test("the test seed's malformed entries are skipped with warnings", async () => {
  const r = await readBundle(enc.encode(JSON.stringify(seed("test.json"))));
  assert.equal(r.data.designs.length, 8);
  assert.equal(r.data.library.length, 1);
  assert.equal(r.warnings.length, 4);
  assert.ok(r.data.designs.find((d) => d.id === "t-inject").name.includes("<img"));
});

test("import plans and modes: merge skips, overwrite replaces, copies duplicates", () => {
  const mk = (id, name) => ({ id, name, typeId: "custom", params: "type=custom", createdAt: "x", updatedAt: "x" });
  const here = { designs: [mk("a", "A"), mk("b", "B")], library: [], prefs: { theme: "dark" } };
  const inc = { designs: [mk("b", "B2"), mk("c", "C")], library: [], prefs: { theme: "light" } };
  assert.deepEqual(planImport(here, inc, "merge", false).designs, { create: 1, overwrite: 0, skip: 1 });
  assert.deepEqual(planImport(here, inc, "overwrite", true), { designs: { create: 1, overwrite: 1, skip: 0 }, library: { create: 0, overwrite: 0, skip: 0 }, prefs: true });
  const merged = applyImport(here, inc, "merge", false);
  assert.deepEqual(merged.designs.map((d) => d.name), ["A", "B", "C"]);
  assert.equal(merged.prefs.theme, "dark");
  assert.deepEqual(applyImport(here, inc, "overwrite", true).designs.map((d) => d.name), ["A", "B2", "C"]);
  const copies = applyImport(here, inc, "copies", false).designs;
  assert.equal(copies.length, 4);
  assert.equal(new Set(copies.map((d) => d.id)).size, 4);
});

test("saved designs: search, filter, sort and Recently deleted", () => {
  const d = (id, name, type, updated, extra = {}) => ({ id, name, typeId: type, params: "type=" + type + "&pubName=" + encodeURIComponent(name + " pub"), createdAt: updated, updatedAt: updated, ...extra });
  const list = [d("1", "Zebra Arms", "newcomer", "2026-01-01"), d("2", "Apple Tree", "award", "2026-03-01"), d("3", "Caf\u00e9 Bar", "newcomer", "2026-02-01"), d("4", "Gone", "custom", "2026-04-01", { deletedAt: "2026-04-02" })];
  assert.deepEqual(queryDesigns(list).map((x) => x.id), ["2", "3", "1"]);
  assert.deepEqual(queryDesigns(list, { sort: "name" }).map((x) => x.id), ["2", "3", "1"]);
  assert.deepEqual(queryDesigns(list, { type: "newcomer" }).map((x) => x.id), ["3", "1"]);
  assert.deepEqual(queryDesigns(list, { q: "cafe" }).map((x) => x.id), ["3"]);
  assert.deepEqual(queryDesigns(list, { q: "zebra pub" }).map((x) => x.id), ["1"]);
  assert.deepEqual(queryDesigns(list, { trash: true }).map((x) => x.id), ["4"]);
  const { kept, purged } = purgeExpired(list, new Date("2026-06-01"), 30);
  assert.equal(purged, 1);
  assert.equal(kept.length, 3);
});

test("copies get unique names", () => {
  assert.equal(copyName("Quiz", ["Quiz"]), "Quiz (copy)");
  assert.equal(copyName("Quiz", ["Quiz", "Quiz (copy)"]), "Quiz (copy 2)");
  assert.equal(copyName("Quiz (copy)", ["Quiz", "Quiz (copy)"]), "Quiz (copy 2)");
  const orig = { id: "x", name: "Quiz", typeId: "custom", params: "", createdAt: "a", updatedAt: "a", sample: true };
  const dup = duplicateDesign(orig, [orig]);
  assert.notEqual(dup.id, "x");
  assert.equal(dup.sample, false);
  assert.equal(defaultDesignName("The Pigeon", "Newcomer (new pub welcome)"), "Newcomer: The Pigeon");
});

test("alt text describes the graphic in plain sentences", () => {
  const layout = templateById("whatson").build({ heading: "This week", events: [{ name: "Quiz", date: "Fri 7pm" }] });
  const t = altText({ layout, branch: { name: "Central Manchester CAMRA", short: "x" }, templateLabel: "What's On (events list)", hasPhoto: false, tagline: "Pubs, Pints, People.", logo: "branch" });
  assert.equal(t, 'Central Manchester CAMRA social graphic: What\'s On. This week. Quiz, Fri 7pm. Central Manchester CAMRA logo, with the tagline "Pubs, Pints, People.".');
});

test("file helpers", () => {
  assert.equal(slug("Caf\u00e9 Z\u00fcrich: The Big One!"), "cafe-zurich-the-big-one");
  assert.equal(slug(""), "graphic");
  assert.equal(pngName("newcomer", "ig-square", 1080, 1080), "newcomer-ig-square-1080x1080.png");
  const { mime, bytes } = dataUrlToBytes(PNG_1PX);
  assert.equal(mime, "image/png");
  assert.equal(bytesToDataUrl(bytes, mime), PNG_1PX);
});

test("demo seed designs use real post types, sizes and parameters", () => {
  const known = new Set(PARAM_DEFS.map((p) => p.key));
  for (const raw of seed("demo.json").designs) {
    const d = cleanDesign(raw);
    assert.equal(typeof d, "object", String(d));
    const t = templateById(d.typeId);
    assert.ok(t, d.typeId);
    const fields = new Set(t.fields.map((f) => f.key));
    const qp = new URLSearchParams(d.params);
    for (const k of qp.keys()) assert.ok(known.has(k) || fields.has(k), d.id + ": " + k);
    for (const s of (qp.get("sizes") || "").split(",")) assert.ok(PRESETS.some((p) => p.id === s), s);
    assert.equal(qp.get("type"), d.typeId);
  }
  assert.ok(TEMPLATES.length >= 9);
});
