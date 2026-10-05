import { expect, test, type Page } from '@playwright/test';

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:9974' });
const slug = 'score-selection-gestures';
const key = `bhajan-song-composer:compose:${slug}:melody`;
const abc = 'X:1\nT:Selection gestures\nM:4/4\nL:1/4\nK:C\n"C"C D E F | "G"G A B c |\nC D E F | G A B c |';
async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(({ key, abc }) => localStorage.setItem(key, abc), { key, abc });
  await page.goto(`/compose/${slug}/harmony`);
  await expect(page.locator('#composer-harmony-preview .abcjs-note').first()).toBeVisible();
}
async function source(page: Page) { return page.evaluate(key => localStorage.getItem(key), key); }

test('left drag selects notes and chord together at zoom without changing source or opening a picker', async ({ page }, testInfo) => {
  await open(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const score = page.locator('#composer-harmony-preview');
  const chord = score.locator('text[data-guitar-chord]').first();
  const a = (await chord.boundingBox())!;
  const b = (await score.locator('.abcjs-note').nth(2).boundingBox())!;
  await page.mouse.move(a.x - 4, a.y - 4);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width + 3, b.y + b.height + 3, { steps: 8 });
  await page.screenshot({ path: testInfo.outputPath('selection-marquee.png') });
  await page.mouse.up();
  await expect.poll(() => score.locator('.abcjs-note[data-score-marquee-selected="true"]').count()).toBeGreaterThanOrEqual(3);
  await expect(chord).toHaveAttribute('data-score-marquee-selected', 'true');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await source(page)).toBe(abc);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
});

test('plain drag starting on a note selects; Command-drag pans and retains selection', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const score = page.locator('#composer-harmony-preview');
  const note = score.locator('.abcjs-note').first();
  const first = (await note.boundingBox())!;
  const third = (await score.locator('.abcjs-note').nth(2).boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(third.x + third.width, third.y + third.height + 8, { steps: 6 });
  await page.mouse.up();
  expect(await source(page)).toBe(abc);
  const selectionCount = await score.locator('[data-score-marquee-selected="true"]').count();
  expect(selectionCount).toBeGreaterThan(1);
  const viewport = page.getByLabel('Scrollable score', { exact: true });
  await viewport.evaluate(element => { element.scrollLeft = 0; });
  const next = (await note.boundingBox())!;
  const left = await viewport.evaluate(element => element.scrollLeft);
  await page.keyboard.down('Meta');
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2);
  await page.mouse.down();
  await page.mouse.move(next.x - 70, next.y + next.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Meta');
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(left);
  await expect(score.locator('[data-score-marquee-selected="true"]')).toHaveCount(selectionCount);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await source(page)).toBe(abc);
});

test('Shift toggles selection, Escape cancels a box, and chord double-click opens its inspector', async ({ page }) => {
  await open(page);
  const score = page.locator('#composer-harmony-preview');
  const first = score.locator('.abcjs-note').first();
  const second = score.locator('.abcjs-note').nth(1);
  await first.click();
  await second.click({ modifiers: ['Shift'] });
  await expect(score.locator('.abcjs-note[data-score-marquee-selected="true"]')).toHaveCount(2);
  await first.click({ modifiers: ['Shift'] });
  await expect(score.locator('.abcjs-note[data-score-marquee-selected="true"]')).toHaveCount(1);
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 60, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(second).toHaveAttribute('data-score-marquee-selected', 'true');
  await expect(score.locator('.abcjs-note[data-score-marquee-selected="true"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(score.locator('[data-score-marquee-selected="true"]')).toHaveCount(0);
  const chord = score.locator('text[data-guitar-chord]').first();
  await chord.click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(chord).toHaveAttribute('data-score-marquee-selected', 'true');
  await chord.dblclick();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await source(page)).toBe(abc);
});
