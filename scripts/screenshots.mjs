// Retakes the README screenshots from the sample designs (the demo seed), in
// both themes and at desktop and phone widths. Run after any visible change:
//   npm run build && npm run screenshots
// Needs Playwright's Chromium (npx playwright install chromium).

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs/screenshots");
mkdirSync(out, { recursive: true });
const port = 4199;
const server = await startServer({ port });
const browser = await chromium.launch();

async function studio(theme, viewport, deviceScaleFactor = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, colorScheme: theme });
  await ctx.addInitScript((t) => {
    if (sessionStorage.getItem("__shot")) return;
    sessionStorage.setItem("__shot", "1");
    localStorage.setItem("camra-studio:tipsSeen", "true");
    localStorage.setItem("camra-studio:prefs", JSON.stringify({ theme: t, groups: { look: false, library: false } }));
  }, theme);
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.click("#designsBtn");
  await page.getByRole("button", { name: "Load sample designs" }).first().click();
  await page.waitForSelector("#designsDialog .design >> nth=11");
  await quiet(page);
  return { ctx, page };
}

// Toasts are transient; keep them out of the documentation.
const quiet = (page) => page.evaluate(() => document.querySelectorAll(".notice").forEach((n) => n.remove()));

async function openSample(page, name) {
  if (!(await page.locator("#designsDialog[open]").count())) await page.click("#designsBtn");
  await page.getByRole("button", { name: "Open " + name }).click();
  await page.waitForTimeout(300);
  await quiet(page);
}

const shots = [];
for (const theme of ["dark", "light"]) {
  const { ctx, page } = await studio(theme, { width: 1360, height: 900 });
  await page.screenshot({ path: join(out, `designs-${theme}.png`) });
  shots.push(`designs-${theme}.png`);
  await openSample(page, "What's on in November");
  await page.screenshot({ path: join(out, `editor-${theme}.png`) });
  shots.push(`editor-${theme}.png`);
  if (theme === "dark") {
    await page.click("#browseLogos");
    await page.waitForTimeout(600);
    await quiet(page);
    await page.screenshot({ path: join(out, "logos-dark.png") });
    shots.push("logos-dark.png");
    await page.keyboard.press("Escape");
    await page.evaluate(() => { const d = document.querySelector('details[data-group="media"]'); d.open = true; document.getElementById("iconWrap").scrollIntoView({ block: "center" }); });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(out, "icons-dark.png") });
    shots.push("icons-dark.png");
    await page.click("#settingsBtn");
    await page.waitForTimeout(200);
    await quiet(page);
    await page.screenshot({ path: join(out, "settings-dark.png") });
    shots.push("settings-dark.png");
  }
  await ctx.close();
}
{
  const { ctx, page } = await studio("dark", { width: 390, height: 844 }, 2);
  await openSample(page, "Real Cider: Orchard Gold");
  await page.screenshot({ path: join(out, "mobile-dark.png") });
  shots.push("mobile-dark.png");
  await ctx.close();
}
{
  // The content calendar, on a fixed day so the shot is the same every time:
  // 10 April 2027, with Mild Month and Members' Weekend planned and one post of our own.
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: "dark" });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem("__shot")) return;
    sessionStorage.setItem("__shot", "1");
    localStorage.setItem("camra-studio:tipsSeen", "true");
    localStorage.setItem("camra-studio:prefs", JSON.stringify({ theme: "dark", groups: { look: false, library: false } }));
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2027-04-10T10:00:00"));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.click("#campaignsBtn");
  for (const id of ["mild-month", "members-weekend"]) await page.locator(`[data-campaign="${id}"]`).first().getByRole("button", { name: /^Plan / }).click();
  await page.keyboard.press("Escape");
  await page.locator("#dynamicFields").getByLabel("Pub name", { exact: true }).fill("The Copper Kettle");
  await page.fill("#postCopy", "A warm welcome to our newest real ale pub.");
  await page.fill("#postOn", "2027-04-14");
  await page.fill("#postAt", "19:30");
  await page.click("#planSave");
  await page.fill("#saveName", "Newcomer: The Copper Kettle");
  await page.click("#saveOk");
  await page.click("#calendarBtn");
  await page.locator('.cal-day[data-day="2027-04-24"]').click();
  await page.waitForTimeout(300);
  await quiet(page);
  await page.screenshot({ path: join(out, "calendar-dark.png") });
  shots.push("calendar-dark.png");
  await ctx.close();
}
{
  // The graphics themselves, exported exactly as a volunteer would get them.
  const { ctx, page } = await studio("dark", { width: 1280, height: 900 });
  for (const [name, file] of [["Newcomer: The Copper Kettle", "graphic-newcomer.png"], ["What's on in November", "graphic-whats-on.png"], ["Real Cider: Orchard Gold", "graphic-cider.png"], ["LocAle: The Foundry", "graphic-locale.png"], ["Countdown: Winter Ales Festival", "graphic-countdown.png"], ["Trip: Ropewalk Brewing tour", "graphic-trip.png"]]) {
    await openSample(page, name);
    const data = await page.evaluate(() => document.getElementById("frame").toDataURL("image/png"));
    writeFileSync(join(out, file), Buffer.from(data.split(",")[1], "base64"));
    shots.push(file);
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log("Wrote " + shots.map((s) => "docs/screenshots/" + s).join(", "));
