import { expect, test, type Page } from "@playwright/test";
import { buildApprovedSnapshotSession } from "./helpers/singer-accompaniment";
import { fourFourGapCMajor } from "./fixtures/singer-accompaniment/sources";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:9974" });

const source = 'X:1\nT:Workspace regression\nM:4/4\nL:1/4\nQ:1/4=96\nK:C\n"C"C D E F | "G"G A B c |\nC D E F | G A B c |\nC D E F | G A B c |\nC D E F | G A B c |';
const slug = "score-workspace-regression";
const melodyKey = `bhajan-song-composer:compose:${slug}:melody`;

async function openWorkspace(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(({ key, abc }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, abc);
  }, { key: melodyKey, abc: source });
  await page.goto(`/compose/${slug}/harmony`);
  await expect(page.locator("#composer-harmony-preview .abcjs-note").first()).toBeVisible();
}

test("viewport zoom, horizontal scroll, pan and focus leave musical data untouched", async ({ page }) => {
  await openWorkspace(page);
  const viewport = page.getByLabel("Scrollable score", { exact: true });
  const zoom = page.getByLabel("Score zoom", { exact: true });
  const play = page.getByRole("button", { name: "Play", exact: true });
  const buttonSize = await play.boundingBox();
  const before = await page.evaluate(key => localStorage.getItem(key), melodyKey);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(zoom).toHaveText("120%");
  const viewportBox = (await viewport.boundingBox())!;
  await page.mouse.move(viewportBox.x + 100, viewportBox.y + 100);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await expect.poll(async () => parseInt((await zoom.textContent())!)).toBeGreaterThan(120);
  expect((await play.boundingBox())!.width).toBeCloseTo(buttonSize!.width, 1);
  await viewport.evaluate(element => { element.scrollLeft = 0; });
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 180);
  await page.keyboard.up("Shift");
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  const left = await viewport.evaluate(element => element.scrollLeft);
  await viewport.focus();
  await page.keyboard.down("Space");
  await page.mouse.move(viewportBox.x + 200, viewportBox.y + 150);
  await page.mouse.down();
  await page.mouse.move(viewportBox.x + 120, viewportBox.y + 150, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(left);
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Focus mode", exact: true }).click();
  await expect(page.getByRole("button", { name: "Exit focus", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play focused score", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause focused score", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause focused score", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play focused score", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Focus mode", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset zoom", exact: true }).click();
  await expect(zoom).toHaveText("100%");
  expect(await page.evaluate(key => localStorage.getItem(key), melodyKey)).toBe(before);
});

test("note actions commit to melody, undo/redo and survive reload", async ({ page }) => {
  await openWorkspace(page);
  const note = page.locator("#composer-harmony-preview .abcjs-note").first();
  await note.click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Focus mode", exact: true }).click();
  await note.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Octave up", exact: true }).click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), melodyKey)).not.toBe(source);
  const changed = await page.evaluate(key => localStorage.getItem(key), melodyKey);
  expect(changed).toContain('"C"');
  expect(changed).toContain('"G"G A B c');
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), melodyKey)).toBe(source);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), melodyKey)).toBe(changed);
  await page.reload();
  await expect(page.locator("#composer-harmony-preview .abcjs-note").first()).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), melodyKey)).toBe(changed);
});

test("Option/Alt note drag changes pitch as one transaction and Escape cancels the next drag", async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const note = page.locator("#composer-harmony-preview .abcjs-note").first();
  const box = (await note.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Alt");
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 12, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Alt");
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), melodyKey)).not.toBe(source);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), melodyKey)).toBe(source);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  const original = (await note.boundingBox())!;
  await page.mouse.move(original.x + original.width / 2, original.y + original.height / 2);
  await page.keyboard.down("Alt");
  await page.mouse.down();
  await page.mouse.move(original.x + original.width / 2, original.y + original.height / 2 - 12, { steps: 6 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.keyboard.up("Alt");
  expect(await page.evaluate(key => localStorage.getItem(key), melodyKey)).toBe(source);
});

test("chord context menu stages a persistent draft and preserves the melody and Step 3 gate", async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('#composer-harmony-preview text[data-guitar-chord]').first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Change chord symbol", exact: true }).click();
  await page.getByRole("textbox", { name: "Chord symbol", exact: true }).fill("Am");
  await page.getByRole("button", { name: "Change chord", exact: true }).click();
  await expect(page.locator('#composer-harmony-preview text[data-guitar-chord]').first()).toHaveText("Am");
  expect(await page.evaluate(key => localStorage.getItem(key), melodyKey)).toBe(source);
  await page.reload();
  await expect(page.locator('#composer-harmony-preview text[data-guitar-chord]').first()).toHaveText("Am");
  await page.getByRole("button", { name: "Validate & select manual harmony", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Complete Harmony Steps 1 and 2" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Continue to accompaniment/ })).toHaveCount(0);
});

test("validated manual harmony becomes the selected Step 3 and Undo restores its predecessor", async ({ page }) => {
  const workflow = buildApprovedSnapshotSession(fourFourGapCMajor);
  const key = `bhajan-song-composer:compose:${slug}:workspace`;
  await page.addInitScript(({ melodyKey, melody, key, workflow }) => {
    localStorage.setItem(melodyKey, melody);
    localStorage.setItem(key, JSON.stringify({ accompanimentWorkflow: workflow }));
  }, { melodyKey, melody: fourFourGapCMajor.sourceAbc, key, workflow });
  await openWorkspace(page);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('#composer-harmony-preview text[data-guitar-chord]').first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Change chord symbol", exact: true }).click();
  await page.getByRole("textbox", { name: "Chord symbol", exact: true }).fill("Am");
  await page.getByRole("button", { name: "Change chord", exact: true }).click();
  await page.getByRole("button", { name: "Validate & select manual harmony", exact: true }).click();
  await expect(page.getByRole("button", { name: "Validate & select manual harmony", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Continue to accompaniment/ })).toBeVisible();
  const result = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(JSON.stringify(result.accompanimentWorkflow)).toContain("Manual harmony");
  expect(await page.evaluate(key => localStorage.getItem(key), melodyKey)).toBe(fourFourGapCMajor.sourceAbc);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Validate & select manual harmony", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Validate & select manual harmony", exact: true })).toHaveCount(0);
  const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), key);
  expect(JSON.stringify(restored.accompanimentWorkflow)).not.toContain("Manual harmony");
});

test("Ganesha source note edits mark harmony stale and keyboard Undo restores the melody", async ({ page }) => {
  await page.goto("/compose/ganesha/harmony");
  const key = "bhajan-song-composer:compose:ganesha:melody";
  const score = page.locator("#composer-harmony-preview");
  await expect(score.locator(".abcjs-note").first()).toBeVisible();
  const original = await page.evaluate(key => localStorage.getItem(key), key);
  expect(original).toContain("Ganesha");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  // The first pickup has a comma octave mark; the following E repeats in its bar.
  await score.locator(".abcjs-note").nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Octave up", exact: true }).click();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).not.toBe(original);
  await expect(page.getByRole("status").filter({ hasText: "stale after melody editing" })).toBeVisible();
  await score.focus();
  await page.keyboard.press("Control+z");
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), key)).toBe(original);
});
