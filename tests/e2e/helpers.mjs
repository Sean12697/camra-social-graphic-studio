import { expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { iconPng } from "../../scripts/icon.mjs";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

/**
 * Opens the studio with tips already seen (unless asked) and waits for boot.
 * Campaign reminders are off unless `campaigns` is set, so tests do not depend
 * on the date they run; `now` fixes the date for the ones that do.
 */
export async function openStudio(page, { query = "", tips = false, prefs = null, errors = null, campaigns = false, now = null } = {}) {
  if (!campaigns) prefs = { campaigns: { enabled: false }, ...(prefs || {}) };
  if (now) await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(
    ([seen, p]) => {
      if (sessionStorage.getItem("__init")) return;
      sessionStorage.setItem("__init", "1");
      if (seen) localStorage.setItem("camra-studio:tipsSeen", "true");
      if (p) localStorage.setItem("camra-studio:prefs", JSON.stringify(p));
    },
    [!tips, prefs],
  );
  if (errors) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
  }
  await page.goto("/" + query);
  await expect(page.locator("html")).toHaveAttribute("data-ready", "1");
}

export async function axeViolations(page) {
  await page.evaluate(AXE);
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const r = await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] });
    return r.violations.map((v) => v.id + ": " + v.nodes.map((n) => n.target.join(" ")).join(", "));
  });
}

export function pngFile(name = "photo.png", size = 96) {
  return { name, mimeType: "image/png", buffer: iconPng(size, 1) };
}

export async function openGroup(page, group) {
  const d = page.locator(`details.group[data-group="${group}"]`);
  if (!(await d.evaluate((e) => e.open))) await d.locator("summary").click();
}

export async function fieldByLabel(page, label) {
  return page.locator("#dynamicFields").getByLabel(label, { exact: true });
}
