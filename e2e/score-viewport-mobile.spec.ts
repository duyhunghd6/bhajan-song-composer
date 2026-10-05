import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("mobile score scroll stays contained and focus mode fits the screen", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("bhajan-song-composer:compose:viewport-mobile:melody", "X:1\nT:Mobile viewport\nM:4/4\nL:1/4\nK:C\nC D E F | G A B c |\nC D E F | G A B c |");
  });
  await page.goto("/compose/viewport-mobile/harmony");
  const workspace = page.locator("[data-score-workspace-viewport]");
  const viewport = page.getByLabel("Scrollable score", { exact: true });
  await expect(page.locator("#composer-harmony-preview .abcjs-note").first()).toBeVisible();
  const box = (await workspace.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await viewport.evaluate(element => { element.scrollLeft = 180; });
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await viewport.click({ button: "right", position: { x: 80, y: 250 } });
  await expect(page.getByRole("menu", { name: "Score viewport actions" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Fit width", exact: true }).click();
  await expect(page.getByRole("menu", { name: "Score viewport actions" })).toHaveCount(0);
  await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
  await page.getByRole("button", { name: "Focus mode", exact: true }).click();
  const focused = (await workspace.boundingBox())!;
  expect(focused.x).toBeGreaterThanOrEqual(0);
  expect(focused.y).toBeGreaterThanOrEqual(0);
  expect(focused.x + focused.width).toBeLessThanOrEqual(390);
  expect(focused.y + focused.height).toBeLessThanOrEqual(844);
  const screenshot = testInfo.outputPath("score-viewport-mobile-focus.png");
  await page.screenshot({ path: screenshot });
  await testInfo.attach("Mobile score focus", { path: screenshot, contentType: "image/png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Focus mode", exact: true })).toBeFocused();
});
