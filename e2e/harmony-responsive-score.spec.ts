import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:9974" });

test("Harmony reflows on resize and keeps wheel navigation without scrollbar tracks", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/compose/ganesha/harmony");
  const score = page.locator("#composer-harmony-preview");
  const viewport = page.getByLabel("Scrollable score", { exact: true });
  await expect(score.locator(".abcjs-note").first()).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem("bhajan-song-composer:compose:ganesha:melody"));
  const notes = await score.locator(".abcjs-note").count();
  for (const width of [1440, 1100, 900, 390, 768, 1600]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => viewport.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await expect(viewport).toHaveCSS("scrollbar-width", "none");
    await expect(score.locator(".abcjs-note")).toHaveCount(notes);
    const frame = (await viewport.boundingBox())!;
    const svg = (await score.locator("svg").first().boundingBox())!;
    expect(svg.x + svg.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    await page.screenshot({ path: testInfo.outputPath("harmony-" + width + ".png") });
  }
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await viewport.hover();
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 180);
  await page.keyboard.up("Shift");
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await page.mouse.wheel(0, 220);
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Fit score width", exact: true }).click();
  await expect.poll(() => viewport.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Score zoom", exact: true }).click();
  await page.getByRole("menuitem", { name: "Focus mode", exact: true }).click();
  await expect.poll(() => viewport.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  await viewport.focus();
  await page.keyboard.press("Escape");
  await expect.poll(() => viewport.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => localStorage.getItem("bhajan-song-composer:compose:ganesha:melody"))).toBe(before);
});
