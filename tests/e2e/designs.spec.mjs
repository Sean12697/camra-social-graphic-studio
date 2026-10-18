import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openStudio, fieldByLabel } from "./helpers.mjs";

async function saveAs(page, name) {
  await page.locator("#quickSave").click();
  await page.locator("#promptInput").fill(name);
  await page.locator("#promptOk").click();
  await expect(page.locator("#notices")).toContainText("Saved " + name);
}

test("save, open, rename, duplicate, delete with undo, restore and purge", async ({ page }) => {
  await openStudio(page);
  await (await fieldByLabel(page, "Pub name")).fill("The Lamplighter");
  await saveAs(page, "Lamplighter welcome");

  await (await fieldByLabel(page, "Pub name")).fill("Something else");
  await page.locator("#designsBtn").click();
  const dlg = page.locator("#designsDialog");
  await expect(dlg.locator(".design")).toHaveCount(1);
  await dlg.getByRole("button", { name: "Open Lamplighter welcome" }).click();
  await page.locator("#confirmOk").click(); // replace unsaved changes
  await expect(await fieldByLabel(page, "Pub name")).toHaveValue("The Lamplighter");

  await page.locator("#designsBtn").click();
  await dlg.getByRole("button", { name: "Rename Lamplighter welcome" }).click();
  await page.locator("#promptInput").fill("Renamed");
  await page.locator("#promptOk").click();
  await expect(dlg.locator(".design-name").first()).toContainText("Renamed");

  await dlg.getByRole("button", { name: "Duplicate Renamed" }).click();
  await expect(dlg.locator(".design")).toHaveCount(2);
  await expect(dlg).toContainText("Renamed (copy)");

  await dlg.getByRole("button", { name: "Delete Renamed (copy)" }).click();
  await expect(dlg.locator(".design")).toHaveCount(1);
  await page.locator(".notice-action", { hasText: "Undo" }).click();
  await expect(dlg.locator(".design")).toHaveCount(2);

  await dlg.getByRole("button", { name: "Delete Renamed (copy)" }).click();
  await dlg.getByRole("button", { name: /Recently deleted \(1\)/ }).click();
  await expect(dlg.locator(".design")).toHaveCount(1);
  await dlg.getByRole("button", { name: "Restore" }).click();
  await expect(dlg.locator(".design")).toHaveCount(0);
  await dlg.getByRole("button", { name: "Back to your designs" }).click();
  await expect(dlg.locator(".design")).toHaveCount(2);

  // Bulk delete then purge for good.
  await dlg.getByRole("button", { name: "Select all 2" }).click();
  await dlg.getByRole("button", { name: "Delete selected" }).click();
  await expect(page.locator("#confirmTitle")).toHaveText("Delete 2 designs?");
  await page.locator("#confirmOk").click();
  await dlg.getByRole("button", { name: /Recently deleted \(2\)/ }).click();
  await dlg.getByRole("button", { name: "Empty Recently deleted" }).click();
  await expect(page.locator("#confirmBody")).toContainText("2 designs");
  await page.locator("#confirmOk").click();
  await expect(dlg.getByText("Nothing in Recently deleted.")).toBeVisible();
});

test("search and the sample designs", async ({ page }) => {
  await openStudio(page);
  await page.locator("#designsBtn").click();
  const dlg = page.locator("#designsDialog");
  await dlg.getByRole("button", { name: "Load sample designs" }).first().click();
  await expect(dlg.locator(".design")).toHaveCount(12);
  await expect(dlg.locator(".design img").first()).toHaveAttribute("src", /^data:image\/jpeg/);
  await dlg.getByLabel("Search saved designs").fill("copper kettle");
  await expect(dlg.locator(".design")).toHaveCount(1);
  await dlg.getByLabel("Search saved designs").fill("");
  await dlg.getByLabel("Filter by post type").selectOption("beer");
  await expect(dlg.locator(".design")).toHaveCount(2);
  await dlg.getByRole("button", { name: "Open Real Cider: Orchard Gold" }).click();
  await expect(page.locator("#postType")).toHaveValue("beer");
  await expect(page.locator("#brandNotes")).toContainText("Why this is Blue");
});

test("a backup restores everything after clearing all data", async ({ page }) => {
  await openStudio(page);
  await (await fieldByLabel(page, "Pub name")).fill("Backup test");
  await saveAs(page, "Backup test");
  await page.locator("#settingsBtn").click();
  const settings = page.locator("#settingsDialog");
  const [dl] = await Promise.all([page.waitForEvent("download"), settings.getByRole("button", { name: "Download backup" }).click()]);
  const path = await dl.path();
  expect(dl.suggestedFilename()).toMatch(/^camra-studio-backup-.*\.zip$/);

  await settings.getByRole("button", { name: "Delete all my data" }).click();
  await expect(page.locator("#confirmBody")).toContainText("1 design");
  await page.locator("#confirmOk").click();
  await expect(page.locator("#notices")).toContainText("has been deleted");

  const chooser = page.waitForEvent("filechooser");
  await settings.getByRole("button", { name: "Import a backup" }).click();
  await (await chooser).setFiles({ name: "backup.zip", mimeType: "application/zip", buffer: readFileSync(path) });
  const imp = page.locator("#importDialog");
  await expect(imp).toContainText("adds 1 design");
  await imp.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator("#notices")).toContainText("Import complete");
  await page.keyboard.press("Escape");
  await page.locator("#designsBtn").click();
  await expect(page.locator("#designsDialog .design")).toHaveCount(1);
});

test("hostile text in an imported file is shown as text, never run", async ({ page }) => {
  await openStudio(page);
  await page.locator("#designsBtn").click();
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#designsDialog").getByRole("button", { name: "Import a backup" }).first().click();
  await (await chooser).setFiles({ name: "test.json", mimeType: "application/json", buffer: readFileSync(new URL("../../seeds/test.json", import.meta.url)) });
  const imp = page.locator("#importDialog");
  await expect(imp).toContainText("Some entries could not be read");
  await imp.getByRole("button", { name: "Import", exact: true }).click();
  const dlg = page.locator("#designsDialog");
  await expect(dlg.locator(".design")).toHaveCount(7);
  await expect(dlg).toContainText('<img src=x onerror="window.__pwned=1">');
  await dlg.getByRole("button", { name: /^Open <img/ }).click();
  await expect(page.locator("#postType")).toHaveValue("custom");
  for (const id of ["t-long", "t-rtl", "t-bad-values", "t-many", "t-unicode"]) {
    await page.locator("#designsBtn").click();
    await dlg.locator(`#sel-${id}`).locator("xpath=ancestor::li").getByRole("button", { name: /^Open/ }).click();
    const confirm = page.locator("#confirmDialog[open]");
    if (await confirm.count()) await page.locator("#confirmOk").click();
    await expect(page.locator("html")).toHaveAttribute("data-ready", "1");
  }
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});
