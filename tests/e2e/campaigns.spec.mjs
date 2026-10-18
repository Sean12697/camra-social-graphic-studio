import { test, expect } from "@playwright/test";
import { axeViolations, fieldByLabel, openStudio } from "./helpers.mjs";

// 10 April 2027: Mild Month is 21 days away and Members' Weekend 6 days away.
const APRIL = "2027-04-10T10:00:00";

test("reminders appear before a campaign and a draft fills the form", async ({ page }) => {
  await openStudio(page, { campaigns: true, now: APRIL });
  const banner = page.locator("#campaignAlerts");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Mild Month starts in 21 days");
  await expect(banner).toContainText("Members' Weekend and AGM starts in 6 days");
  await expect(page.locator("#campaignsBtn .count-badge")).toHaveText("2");

  // Pick another branch first: the draft must keep it.
  const branch = page.locator("#branch");
  const other = await branch.locator("option").nth(3).getAttribute("value");
  await branch.selectOption(other);

  await banner.locator("article", { hasText: "Mild Month" }).getByRole("button", { name: "Get drafts" }).click();
  const dlg = page.locator("#campaignsDialog");
  await expect(dlg).toBeVisible();
  const card = dlg.locator('[data-campaign="mild-month"]').first();
  await expect(card).toContainText("1 to 31 May 2027");
  await card.getByRole("button", { name: /Use the Countdown draft/ }).click();
  // Changing the branch made the post unsaved, so the studio asks first.
  await expect(page.locator("#confirmDialog")).toContainText("Replace the current post?");
  await page.locator("#confirmOk").click();
  await expect(dlg).toBeHidden();
  await expect(page.locator("#postType")).toHaveValue("campaignmonth");
  await expect(await fieldByLabel(page, "Days to go (for a countdown)")).toHaveValue("21");
  await expect(await fieldByLabel(page, "Dates")).toHaveValue("1 to 31 May");
  await expect(branch).toHaveValue(other);
});

test("dismissing a reminder sticks after a reload, and snoozing hides the rest", async ({ page }) => {
  await openStudio(page, { campaigns: true, now: APRIL });
  const banner = page.locator("#campaignAlerts");
  await banner.getByRole("button", { name: "Dismiss the Mild Month reminder" }).click();
  await expect(banner).not.toContainText("Mild Month");
  await expect(page.locator("#campaignsBtn .count-badge")).toHaveText("1");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-ready", "1");
  await expect(banner).toContainText("Members' Weekend");
  await expect(banner).not.toContainText("Mild Month");
  // Snooze the other one: the banner empties and hides.
  await banner.getByRole("button", { name: /Remind me about CAMRA Members' Weekend/ }).click();
  await expect(banner).toBeHidden();
});

test("a reminder shows while the campaign is on", async ({ page }) => {
  await openStudio(page, { campaigns: true, now: "2027-07-20T09:00:00" });
  const banner = page.locator("#campaignAlerts");
  await expect(banner).toContainText("Cider and Perry Month is on now");
  await expect(banner).toContainText("12 days left, until Saturday 31 July");
});

test("the Campaigns panel lists drafts, deep links and saves drafts to designs", async ({ page }) => {
  await openStudio(page, { campaigns: true, now: APRIL, query: "?campaign=gbg-launch" });
  const dlg = page.locator("#campaignsDialog");
  await expect(dlg).toBeVisible();
  const gbg = dlg.locator('[data-campaign="gbg-launch"]').first();
  await expect(gbg).toBeFocused();
  await expect(gbg).toContainText("Date estimated");
  await expect(gbg).toContainText("#GBG2028");
  // Served from 127.0.0.1, so subscribing is explained rather than offered.
  await expect(dlg).toContainText("Calendar subscriptions work from the hosted studio");
  await expect(dlg.getByRole("link", { name: "Download the .ics file" })).toHaveAttribute("href", "calendar/campaigns.ics");

  const mild = dlg.locator('[data-campaign="mild-month"]').first();
  await mild.getByRole("button", { name: "Save all 4 drafts to my designs" }).click();
  await expect(page.locator("#notices")).toContainText("Saved 4 drafts for Mild Month");
  await page.locator("#notices").getByRole("button", { name: "View designs" }).click();
  await expect(page.locator("#designsDialog")).toContainText("Mild Month 2027: Countdown");
  await expect(page.locator("#designsDialog")).toContainText("Mild Month 2027: Thank you");
});

test("turning reminders off in Settings hides the banner", async ({ page }) => {
  await openStudio(page, { campaigns: true, now: APRIL });
  await expect(page.locator("#campaignAlerts")).toBeVisible();
  await page.locator("#settingsBtn").click();
  await page.getByLabel(/Remind me before national campaigns/).uncheck();
  await expect(page.locator("#campaignAlerts")).toBeHidden();
  await expect(page.locator("#campaignsBtn .count-badge")).toBeHidden();
});

test("the calendar feeds are served as text/calendar", async ({ request }) => {
  for (const f of ["calendar/campaigns.ics", "calendar/camra.ics", "calendar/planning.ics"]) {
    const res = await request.get("/" + f);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body).toContain("BEGIN:VEVENT");
  }
});

test("campaign panel and banner are accessible in both themes", async ({ page }) => {
  for (const theme of ["dark", "light"]) {
    await openStudio(page, { campaigns: true, now: APRIL, prefs: { theme } });
    expect(await axeViolations(page)).toEqual([]);
    await page.locator("#campaignsBtn").click();
    await expect(page.locator("#campaignsDialog")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.evaluate(() => sessionStorage.clear());
  }
});
