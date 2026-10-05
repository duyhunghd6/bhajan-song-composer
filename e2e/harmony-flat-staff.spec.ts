import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:9974" });

test("Harmony staff shares the player frame and has one scroll viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/compose/ganesha/harmony");
  const score = page.locator("#composer-harmony-preview");
  await expect(score.locator("svg").first()).toBeVisible();
  const workspace = page.getByRole("region", { name: "Harmony score", exact: true });
  await expect(workspace).toHaveCSS("border-top-width", "0px");
  await expect(workspace).toHaveCSS("border-radius", "0px");
  await expect(score.locator("..")).toHaveCSS("overflow-y", "visible");
  await expect(page.getByLabel("Scrollable score", { exact: true })).toHaveCSS("overflow-y", "auto");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  const zoom = page.getByRole("button", { name: "Score zoom", exact: true });
  await zoom.click();
  await page.getByRole("menuitem", { name: "Focus mode", exact: true }).click();
  await expect(workspace).toHaveCSS("position", "fixed");
  await expect(workspace).toHaveCSS("border-top-width", "1px");
  await page.getByLabel("Scrollable score", { exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(workspace).toHaveCSS("border-top-width", "0px");
  await page.screenshot({ path: testInfo.outputPath("harmony-flat-desktop.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(score.locator("svg").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("harmony-flat-mobile.png") });
});
