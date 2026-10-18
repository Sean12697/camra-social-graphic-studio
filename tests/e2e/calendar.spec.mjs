import { test, expect } from "@playwright/test";
import { axeViolations, fieldByLabel, openGroup, openStudio, pngFile } from "./helpers.mjs";

// Saturday 10 April 2027.
const NOW = "2027-04-10T10:00:00";

async function planPost(page, { pub, text, date, time = "", name }) {
  await (await fieldByLabel(page, "Pub name")).fill(pub);
  await openGroup(page, "copy");
  await page.locator("#postCopy").fill(text);
  await page.locator("#postOn").fill(date);
  if (time) await page.locator("#postAt").fill(time);
  await page.locator("#planSave").click();
  await expect(page.locator("#promptTitle")).toHaveText("Save planned post");
  await page.locator("#promptInput").fill(name);
  await page.locator("#promptOk").click();
  await expect(page.locator("#notices")).toContainText("Saved " + name);
}

test("plan a post with its text, find it in the calendar, mark it posted and move it", async ({ page }) => {
  await openStudio(page, { now: NOW });
  await openGroup(page, "copy");
  await expect(page.locator("#planNote")).toContainText("Not on the calendar");
  await planPost(page, { pub: "The Copper Kettle", text: "Welcome to the Good Beer Guide! #GBG", date: "2027-04-20", time: "19:30", name: "Copper Kettle welcome" });
  await expect(page.locator("#planNote")).toContainText("Tuesday 20 April 2027. That is in 10 days.");

  await page.locator("#calendarBtn").click();
  const cal = page.locator("#calendarDialog");
  await expect(cal.locator("#calMonthTitle")).toHaveText("April 2027");
  const day = cal.locator('.cal-day[data-day="2027-04-20"]');
  await expect(day).toHaveAttribute("aria-label", /1 planned post/);
  await day.click();
  const panel = cal.locator(".cal-day-panel");
  await expect(panel.locator("#calDayTitle")).toHaveText("Tuesday 20 April 2027");
  await expect(panel).toContainText("Copper Kettle welcome");
  await expect(panel).toContainText("Welcome to the Good Beer Guide! #GBG");
  await expect(panel).toContainText("19:30");

  await panel.getByRole("button", { name: "Mark as posted" }).click();
  await expect(panel.locator(".badge.plan")).toHaveText("Posted");
  await panel.getByRole("button", { name: "Mark as not posted" }).click();

  await panel.getByLabel("New date for Copper Kettle welcome").fill("2027-04-22");
  await panel.getByRole("button", { name: "Move Copper Kettle welcome to the chosen date" }).click();
  await expect(cal.locator("#calDayTitle")).toHaveText("Thursday 22 April 2027");
  await expect(cal.locator(".cal-day-panel")).toContainText("Copper Kettle welcome");
  // The open post follows the move.
  await expect(page.locator("#postOn")).toHaveValue("2027-04-22");

  // List view shows it too.
  await cal.getByRole("radio", { name: "List" }).check();
  await expect(cal.locator(".cal-list")).toContainText("Thursday 22 April");
});

test("the arrow keys move between days and months", async ({ page }) => {
  await openStudio(page, { now: NOW });
  await page.locator("#calendarBtn").click();
  const cal = page.locator("#calendarDialog");
  await expect(cal.locator('.cal-day[data-day="2027-04-10"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(cal.locator('.cal-day[data-day="2027-04-11"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(cal.locator('.cal-day[data-day="2027-04-18"]')).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect(cal.locator("#calMonthTitle")).toHaveText("May 2027");
  await expect(cal.locator('.cal-day[data-day="2027-05-18"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(cal.locator("#calDayTitle")).toContainText("18 May 2027");
  // Mild Month runs all May.
  await expect(cal.locator(".cal-day-panel")).toContainText("Mild Month (day 18)");
});

test("images are kept on the device, so a planned post reopens exactly", async ({ page }) => {
  await openStudio(page, { now: NOW });
  await page.locator("#photo").setInputFiles(pngFile());
  await expect(page.locator("#mediaHint")).toHaveText("Photo added");
  await planPost(page, { pub: "The Orchard Arms", text: "Cider tasting", date: "2027-04-12", name: "Orchard tasting" });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-ready", "1");
  await page.locator("#calendarBtn").click();
  const cal = page.locator("#calendarDialog");
  await cal.locator('.cal-day[data-day="2027-04-12"]').click();
  await cal.getByRole("button", { name: "Open Orchard tasting in the editor" }).click();
  await expect(cal).toBeHidden();
  await expect(await fieldByLabel(page, "Pub name")).toHaveValue("The Orchard Arms");
  await expect(page.locator("#mediaHint")).toHaveText("Photo added");
  await expect(page.locator("#postCopy")).toHaveValue("Cider tasting");
  await expect(page.locator("#postOn")).toHaveValue("2027-04-12");
});

test("a post due today shows a reminder and a count on Calendar", async ({ page }) => {
  await openStudio(page, { now: NOW });
  await planPost(page, { pub: "The Foundry", text: "Tap takeover tonight", date: "2027-04-10", name: "Foundry takeover" });
  const banner = page.locator("#campaignAlerts");
  await expect(banner).toContainText("1 post planned for today");
  await expect(page.locator("#calendarBtn .count-badge")).toHaveText("1");
  await banner.getByRole("button", { name: "Open the calendar" }).click();
  await expect(page.locator("#calendarDialog #calDayTitle")).toHaveText("Saturday 10 April 2027 (today)");
  await page.locator("#calendarDialog").getByRole("button", { name: "Mark as posted" }).click();
  await expect(page.locator("#calendarBtn .count-badge")).toBeHidden();
});

test("post text travels in share links and counts characters", async ({ page }) => {
  await openStudio(page, { query: "?type=newcomer&pubName=The%20Pigeon&copy=" + encodeURIComponent("Hello ".repeat(60).trim()) });
  await openGroup(page, "copy");
  await expect(page.locator("#postCopy")).toHaveValue(/^Hello Hello/);
  await expect(page.locator("#copyCount")).toContainText("359 characters. Too long for X (280)");
});

test("a campaign countdown keeps its days to go in step when moved", async ({ page }) => {
  await openStudio(page, { now: NOW, campaigns: true });
  await page.locator("#campaignsBtn").click();
  const camp = page.locator("#campaignsDialog");
  await camp.locator('[data-campaign="mild-month"]').first().getByRole("button", { name: "Plan all 4 in my calendar" }).click();
  await page.locator("#notices").getByRole("button", { name: "Open calendar" }).click();
  const cal = page.locator("#calendarDialog");
  await cal.getByLabel("New date for Mild Month 2027: Countdown").fill("2027-04-27");
  await cal.getByRole("button", { name: "Move Mild Month 2027: Countdown to the chosen date" }).click();
  await expect(page.locator("#notices")).toContainText("The days to go now count from the new date.");
  await cal.getByRole("button", { name: "Open Mild Month 2027: Countdown in the editor" }).click();
  await expect(await fieldByLabel(page, "Days to go (for a countdown)")).toHaveValue("4");
  await openGroup(page, "copy");
  await expect(page.locator("#postCopy")).toHaveValue(/#MildMay/);
  // Planning again does not duplicate.
  await page.locator("#campaignsBtn").click();
  await camp.locator('[data-campaign="mild-month"]').first().getByRole("button", { name: "Plan all 4 in my calendar" }).click();
  await expect(page.locator("#notices")).toContainText("already in your calendar");
});

test("the calendar is accessible in both themes and both views", async ({ page }) => {
  for (const theme of ["dark", "light"]) {
    await openStudio(page, { now: NOW, prefs: { theme } });
    await planPost(page, { pub: "The Lamplighter", text: "Quiz night", date: "2027-04-15", name: "Quiz " + theme });
    await page.locator("#calendarBtn").click();
    await page.locator('.cal-day[data-day="2027-04-15"]').click();
    expect(await axeViolations(page)).toEqual([]);
    await page.locator("#calendarDialog").getByRole("radio", { name: "List" }).check();
    expect(await axeViolations(page)).toEqual([]);
    await page.locator("#calendarDialog").getByRole("radio", { name: "Month" }).check();
    await page.evaluate(() => sessionStorage.clear());
  }
});
