import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:9974" });

test("Harmony keyboard transport, score navigation and mixer retain the document and staff", async ({ page }) => {
  let documents = 0;
  page.on("request", (request) => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
  await page.goto("/compose/ganesha/harmony");
  const score = page.locator("#composer-harmony-preview");
  await expect(score.locator(".abcjs-note").first()).toBeVisible();
  await page.evaluate(() => { (window as unknown as { originalScore: Element | null }).originalScore = document.querySelector("#composer-harmony-preview svg"); });
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await score.focus();
  await page.keyboard.press("ArrowRight");
  await expect(score.locator('[data-score-item]:focus')).toHaveCount(1);
  const first = await score.locator('[data-score-item]:focus').getAttribute("aria-label");
  await page.keyboard.press("ArrowRight");
  await expect(score.locator('[data-score-item]:focus')).not.toHaveAttribute("aria-label", first!);
  await page.keyboard.press("ArrowLeft");
  await expect(score.locator('[data-score-item]:focus')).toHaveAttribute("aria-label", first!);
  await page.getByRole("button", { name: "Whole sheet", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { originalScore: Element }).originalScore === document.querySelector("#composer-harmony-preview svg"))).toBe(true);
  const mixer = page.locator("details").filter({ has: page.locator("summary", { hasText: "Layers & volume" }) });
  if (!(await page.getByRole("slider", { name: "Melody volume" }).isVisible())) await mixer.locator("summary").click();
  await page.getByRole("slider", { name: "Melody volume" }).fill("80");
  await page.waitForTimeout(500);
  expect(documents).toBe(1);
});

test("Score chord activation keeps Space for transport and leaves the dialog keyboard alone", async ({ page }) => {
  await page.goto("/compose/ganesha/harmony");
  const chord = page.locator('#composer-harmony-preview [data-guitar-chord]').first();
  await expect(chord).toBeVisible();
  await chord.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("Stopping while audio is loading cancels a late start", async ({ page }) => {
  const pending: (() => void)[] = [];
  await page.route("**/midi-js-soundfonts/**", async (route) => {
    await new Promise<void>((resolve) => pending.push(resolve));
    await route.abort();
  });
  await page.goto("/compose/ganesha/harmony");
  const score = page.locator("#composer-harmony-preview");
  await expect(score.locator(".abcjs-note").first()).toBeVisible();
  await score.focus();
  await page.keyboard.press("Space");
  await expect.poll(() => pending.length).toBeGreaterThan(0);
  await page.keyboard.press("Space");
  pending.forEach((resolve) => resolve());
  await page.waitForTimeout(500);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
});

test("Horizontal chord navigation skips notes and duplicate diagrams across score lines", async ({ page }) => {
  await page.goto("/compose/ganesha/harmony");
  const score = page.locator("#composer-harmony-preview");
  const rows = score.locator(".abcjs-staff-wrapper");
  const firstChord = rows.nth(0).locator('text[data-guitar-chord]').first();
  const secondChord = rows.nth(0).locator('text[data-guitar-chord]').nth(1);
  const lastChord = rows.nth(0).locator('text[data-guitar-chord]').last();
  const nextLineChord = rows.nth(1).locator('text[data-guitar-chord]').first();
  await expect(firstChord).toBeVisible();
  await firstChord.focus();
  await page.keyboard.press("ArrowRight");
  await expect(secondChord).toBeFocused();
  await lastChord.focus();
  await page.keyboard.press("ArrowRight");
  await expect(nextLineChord).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(lastChord).toBeFocused();
  const firstDiagram = rows.nth(0).locator('svg[data-guitar-chord]').first();
  const secondDiagram = rows.nth(0).locator('svg[data-guitar-chord]').nth(1);
  await firstDiagram.focus();
  await page.keyboard.press("ArrowRight");
  await expect(secondDiagram).toBeFocused();
  await page.keyboard.press("Home");
  await expect(firstDiagram).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(firstDiagram).toBeFocused();
  await firstChord.dblclick();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(firstChord).toBeFocused();
  await expect(firstChord).toHaveAttribute("tabindex", "0");
  await page.keyboard.press("ArrowRight");
  await expect(secondChord).toBeFocused();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
});

test("Horizontal note navigation continues onto the next line and back", async ({ page }) => {
  await page.goto("/compose/ganesha/harmony");
  const rows = page.locator("#composer-harmony-preview .abcjs-staff-wrapper");
  const lastNote = rows.nth(0).locator(".abcjs-note.abcjs-v0").last();
  const nextLineNote = rows.nth(1).locator(".abcjs-note.abcjs-v0").first();
  await expect(lastNote).toBeVisible();
  await lastNote.focus();
  await page.keyboard.press("ArrowRight");
  await expect(nextLineNote).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(lastNote).toBeFocused();
});
