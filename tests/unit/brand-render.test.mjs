// Brand rules, colour maths and the renderer's logo and text-fit behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, shade, hexToRgb } from "../../src/core/colour.ts";
import { contextNotes } from "../../src/core/brand.ts";
import { draw, resolveLogos } from "../../src/core/renderer.ts";
import { templateById } from "../../src/core/templates.ts";
import { CONFIG } from "../../src/core/config.ts";

test("contrast ratio matches WCAG reference values", () => {
  assert.equal(Math.round(contrastRatio("#ffffff", "#000000")), 21);
  assert.equal(contrastRatio("#41495a", "#41495a"), 1);
  assert.equal(contrastRatio("nope", "#000"), null);
  assert.deepEqual(hexToRgb("#abc"), { r: 170, g: 187, b: 204 });
});

test("shade lightens and darkens hex colours and leaves others alone", () => {
  assert.equal(shade("#000000", 0.5), "rgb(128,128,128)");
  assert.equal(shade("#ffffff", -0.5), "rgb(128,128,128)");
  assert.equal(shade("red", 0.2), "red");
});

test("only one logo ever shows, following the brand rules", () => {
  assert.deepEqual(resolveLogos("auto", false, false), { branch: true, camra: false });
  assert.deepEqual(resolveLogos("auto", true, false), { branch: false, camra: true });
  assert.deepEqual(resolveLogos("auto", true, true), { branch: true, camra: false });
  assert.deepEqual(resolveLogos("camra", false, false), { branch: false, camra: true });
  assert.deepEqual(resolveLogos("both", false, false), { branch: true, camra: false });
});

test("cider posts explain Blue and campaigns explain the CAMRA logo", () => {
  const l = templateById("beer").build({ kind: "cider" });
  const titles = contextNotes(l, { who: resolveLogos("auto", true, false) }).map((n) => n.title);
  assert.ok(titles.includes("Why this is Blue"));
  assert.ok(titles.includes("The CAMRA logo shows"));
  const off = contextNotes(l, { who: resolveLogos("auto", true, true) }).map((n) => n.title);
  assert.ok(off.includes("Branch logo on a campaign (off-brand)"));
});

test("a low-contrast text colour is flagged", () => {
  const notes = contextNotes({ accentKey: "amber" }, { bg: "amber", bgColor: "amber", textColors: { title: "#ffffff" } });
  assert.ok(notes.some((n) => n.title === "Low colour contrast"));
  assert.ok(notes.some((n) => n.title === "Background colour changed" && n.tone === "warn"));
});

// A canvas context that records what is drawn. measureText assumes each
// character is half the font size wide.
function mockCtx(w, h) {
  const calls = [];
  let font = "10px Arial";
  const target = {
    canvas: { width: w, height: h },
    measureText: (t) => ({ width: String(t).length * (parseFloat(/(\d+(\.\d+)?)px/.exec(font)?.[1] || "10") * 0.5) }),
    createLinearGradient: () => ({ addColorStop() {} }),
    calls,
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return (...args) => calls.push([k, ...args]);
    },
    set(t, k, v) {
      if (k === "font") font = v;
      t[k] = v;
      return true;
    },
  });
}

const fakeImg = (name) => ({ width: 400, height: 100, name });

function render(tmplId, values, extra = {}) {
  const ctx = mockCtx(1080, 1080);
  const info = draw({
    ctx, width: 1080, height: 1080,
    template: templateById(tmplId), values,
    branch: CONFIG.branches["central-manchester"],
    branchLogoImg: fakeImg("branch"), camraLogoImg: fakeImg("camra"),
    ...extra,
  });
  return { info, calls: ctx.calls };
}

test("a branch post draws the branch logo only, a campaign the CAMRA logo only", () => {
  const drawn = (r) => r.calls.filter((c) => c[0] === "drawImage").map((c) => c[1].name);
  assert.deepEqual(drawn(render("newcomer", { pubName: "X" })), ["branch"]);
  assert.deepEqual(drawn(render("beer", { kind: "beer", beer: "X" })), ["camra"]);
  assert.deepEqual(drawn(render("beer", { kind: "beer", beer: "X" }, { showBranchOnCampaign: true })), ["branch"]);
});

test("text that cannot fit is reported rather than trimmed silently", () => {
  assert.equal(render("announcement", { heading: "Short" }).info.clamped, false);
  const long = "Words ".repeat(400);
  assert.equal(render("announcement", { heading: "Short", body: long }).info.clamped, true);
});

test("the tagline is drawn unless turned off", () => {
  const texts = (r) => r.calls.filter((c) => c[0] === "fillText").map((c) => c[1]);
  assert.ok(texts(render("newcomer", {}, { tagline: "Pubs, Pints, People." })).includes("Pubs, Pints, People."));
  assert.ok(!texts(render("newcomer", {}, { tagline: "" })).includes("Pubs, Pints, People."));
});
