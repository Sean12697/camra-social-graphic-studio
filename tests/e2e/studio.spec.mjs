import { test, expect } from "@playwright/test";
import { axeViolations, openStudio, openGroup, fieldByLabel, pngFile } from "./helpers.mjs";

test("boots cleanly, draws the preview and writes alt text", async ({ page }) => {
  const errors = [];
  await openStudio(page, { errors });
  await (await fieldByLabel(page, "Pub name")).fill("The Copper Kettle");
  await expect(page.locator("#altText")).toHaveValue(/The Copper Kettle/);
  const pixel = await page.evaluate(() => Array.from(document.getElementById("frame").getContext("2d").getImageData(10, 10, 1, 1).data));
  expect(pixel).toEqual([65, 73, 90, 255]);
  expect(errors).toEqual([]);
});

test("no accessibility violations in either theme", async ({ page }) => {
  await openStudio(page);
  for (const theme of ["dark", "light"]) {
    await page.evaluate((t) => localStorage.setItem("camra-studio:prefs", JSON.stringify({ theme: t })), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-ready", "1");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    expect(await axeViolations(page), theme).toEqual([]);
  }
});

test("no horizontal scrolling", async ({ page }) => {
  await openStudio(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("a share link fills the form and keeps unknown values safe", async ({ page }) => {
  const notices = page.locator("#notices");
  await openStudio(page, { query: "?type=beer&kind=cider&beer=Orchard%20Gold&producer=Three%20Tuns&bg=nope&tagline=Made%20up&sizes=ig-square,fb-landscape&logoScale=1.6" });
  await expect(page.locator("#postType")).toHaveValue("beer");
  await expect(await fieldByLabel(page, "Beer / cider name")).toHaveValue("Orchard Gold");
  await expect(page.locator("#bgColor")).toHaveValue("slate");
  await expect(page.locator("#tagline")).toHaveValue("Pubs, Pints, People.");
  await expect(notices).toContainText("approved CAMRA taglines");
  await expect(page.locator("#logoPreset")).toHaveValue("1.6");
  await expect(page.locator("#brandNotes")).toContainText("Why this is Blue");
});

test("downloads every ticked size as PNGs or as one ZIP", async ({ page }) => {
  await openStudio(page, { query: "?type=newcomer&pubName=Test&sizes=ig-square,fb-landscape" });
  await openGroup(page, "export");
  const pngs = [];
  page.on("download", (d) => pngs.push(d.suggestedFilename()));
  await page.locator("#download").click();
  await expect.poll(() => pngs.length).toBe(2);
  expect(pngs.sort()).toEqual(["newcomer-fb-landscape-1200x628.png", "newcomer-ig-square-1080x1080.png"]);
  await page.locator('label:has(input[name="dlFormat"][value="zip"])').click();
  await expect(page.locator("#download")).toHaveText("Download 2 sizes (ZIP)");
  const [zip] = await Promise.all([page.waitForEvent("download"), page.locator("#download").click()]);
  expect(zip.suggestedFilename()).toMatch(/^camra-test-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(page.locator("#exportStatus")).toContainText("2 images in one ZIP");
});

test("download=1 with zip=1 exports automatically on load", async ({ page }) => {
  const done = page.waitForEvent("download");
  await openStudio(page, { query: "?type=festival&name=Winter%20Ales&sizes=ig-square,x-landscape&download=1&zip=1" });
  expect((await done).suggestedFilename()).toMatch(/^camra-winter-ales-.*\.zip$/);
});

test("a photo can be added, reframed, saved to the library, removed and restored", async ({ page }) => {
  await openStudio(page);
  await page.locator("#photo").setInputFiles(pngFile());
  await expect(page.locator("#reframeWrap")).toBeVisible();
  await openGroup(page, "library");
  await page.locator("#savePhotoLib").click();
  await expect(page.locator(".lib-item")).toHaveCount(1);
  await page.locator(".lib-item .remove-btn").click();
  await expect(page.locator(".lib-item")).toHaveCount(0);
  await page.locator(".notice-action", { hasText: "Undo" }).click();
  await expect(page.locator(".lib-item")).toHaveCount(1);
  await page.locator("#clearPhoto").click();
  await expect(page.locator("#reframeWrap")).toBeHidden();
});

test("the theme choice persists and applies before first paint", async ({ page }) => {
  await openStudio(page);
  await page.locator("#settingsBtn").click();
  await page.locator('label:has(input[name="themePref"][value="light"])').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Escape");
  await page.reload();
  // Checked straight away, before the app boots.
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
});

test("tips show once, trap focus, and close with Escape", async ({ page }) => {
  await openStudio(page, { tips: true });
  await expect(page.locator("#tipLayer")).toBeVisible();
  await expect(page.locator("#tipNext")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#tipSkip")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#tipNext")).toBeFocused();
  await page.locator("#tipNext").click();
  await expect(page.locator("#tipCount")).toContainText("2 of");
  await page.keyboard.press("Escape");
  await expect(page.locator("#tipLayer")).toBeHidden();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-ready", "1");
  await expect(page.locator("#tipLayer")).toBeHidden();
});

test("a library saved by an earlier version is migrated", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("__legacy")) return;
    sessionStorage.setItem("__legacy", "1");
    localStorage.setItem("camra-studio:tipsSeen", "true");
    localStorage.setItem(
      "camra-studio:library",
      JSON.stringify([{ id: "itm-old", kind: "logo", name: "Old logo", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=" }]),
    );
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "1");
  await openGroup(page, "library");
  await expect(page.locator(".lib-item")).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("camra-studio:library"))).toBeNull();
});
