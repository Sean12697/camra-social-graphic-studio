import { test, expect } from "@playwright/test";
import { openStudio, openGroup } from "./helpers.mjs";

test("the logo picker sets a branch, a region and a sub-brand", async ({ page }) => {
  await openStudio(page);
  await page.locator("#browseLogos").click();
  const dlg = page.locator("#logoDialog");
  await expect(dlg.locator(".result-count")).toHaveText("217 logos");
  await dlg.getByLabel("Search logos").fill("wirral");
  await expect(dlg.locator(".logo-opt")).toHaveCount(1);
  await dlg.locator(".logo-opt").click();
  await expect(page.locator("#branch")).toHaveValue("wirral");
  await expect(page.locator("#altText")).toHaveValue(/Wirral CAMRA logo/);

  await page.locator("#browseLogos").click();
  await dlg.getByRole("tab", { name: /Regions/ }).click();
  await dlg.locator(".logo-opt", { hasText: "Wales" }).click();
  await expect(page.locator("#logos")).toHaveValue("region");
  await expect(page.locator("#region")).toHaveValue("wales");
  await expect(page.locator("#altText")).toHaveValue(/CAMRA Wales logo/);

  await page.locator("#browseLogos").click();
  await dlg.getByRole("tab", { name: /Sub-brands/ }).click();
  await dlg.locator(".logo-opt", { hasText: "LocAle" }).click();
  await expect(page.locator("#logos")).toHaveValue("subbrand");
  await expect(page.locator("#brandNotes")).toContainText("LocAle logo");
});

test("a branch and region travel in share links", async ({ page }) => {
  await openStudio(page, { query: "?type=newcomer&pubName=X&branch=leeds&logos=region&region=yorkshire" });
  await expect(page.locator("#branch")).toHaveValue("leeds");
  await expect(page.locator("#regionWrap")).not.toHaveClass(/hidden/);
  await expect(page.locator("#altText")).toHaveValue(/Leeds CAMRA social graphic.*CAMRA Yorkshire logo/);
});

test("LocAle posts use the LocAle logo automatically, campaigns keep the CAMRA logo", async ({ page }) => {
  await openStudio(page, { query: "?type=locale&pubName=The%20Foundry" });
  await expect(page.locator("#altText")).toHaveValue(/LocAle logo/);
  await page.locator("#postType").selectOption("campaignmonth");
  await expect(page.locator("#altText")).toHaveValue(/CAMRA logo/);
});

test("the icon picker, position, pattern and colour", async ({ page }) => {
  await openStudio(page, { query: "?type=announcement&heading=Quiz" });
  await openGroup(page, "media");
  await page.locator("#iconFilter").fill("bus");
  await expect(page.locator(".icon-opt:not([hidden])")).toHaveCount(1);
  await page.locator('.icon-opt[data-icon="bus"]').click();
  await expect(page.locator("#presetIcon")).toHaveValue("bus");
  await page.locator("#iconPos").selectOption("pattern");
  await page.locator("#iconColor").selectOption("white");
  await page.locator("#designsBtn").click();
  await page.getByRole("button", { name: "Save current design" }).click();
  await page.locator("#promptOk").click();
  await page.keyboard.press("Escape");
  await page.locator("#designsBtn").click();
  await page.locator("#designsDialog").getByRole("button", { name: /^Open / }).first().click();
  await expect(page.locator("#iconPos")).toHaveValue("pattern");
  await expect(page.locator("#iconColor")).toHaveValue("white");
  await expect(page.locator('input[name="iconPick"][value="bus"]')).toBeChecked();
});

test("print sizes export at 300 dpi", async ({ page }) => {
  await openStudio(page, { query: "?type=festival&name=Winter%20Ales&sizes=print-a5" });
  await openGroup(page, "export");
  const [d] = await Promise.all([page.waitForEvent("download"), page.locator("#download").click()]);
  expect(d.suggestedFilename()).toBe("festival-print-a5-1748x2480.png");
});

test("Ctrl+S saves the design", async ({ page }) => {
  await openStudio(page);
  await page.locator("#postType").focus();
  await page.keyboard.press("Control+s");
  await expect(page.locator("#promptDialog")).toBeVisible();
});
