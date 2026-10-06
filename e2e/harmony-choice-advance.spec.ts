import { expect, test } from '@playwright/test';
import { buildApprovedSnapshotSession } from './helpers/singer-accompaniment';
import { fourFourGapCMajor as snapshot } from './fixtures/singer-accompaniment/sources';

test('Harmony choices advance reopened steps and finish at accompaniment style', async ({ page }) => {
  await page.route('**/compose/ganesha/**', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.addInitScript(({ source, workflow }) => {
    const prefix = 'bhajan-song-composer:compose:ganesha:';
    localStorage.setItem(prefix + 'melody', source);
    localStorage.setItem(prefix + 'workspace', JSON.stringify({ accompanimentWorkflow: workflow, harmonyStrummingExpanded: false }));
  }, { source: snapshot.sourceAbc, workflow: buildApprovedSnapshotSession(snapshot) });
  await page.goto('/compose/ganesha/harmony');
  const headers = [
    page.getByRole('button', { name: /^1\. Key & Beats/ }),
    page.getByRole('button', { name: /^2\. Chords/ }),
    page.getByRole('button', { name: /^3\. Validate Harmony/ }),
  ];
  await expect(headers[0]).toBeEnabled();
  if (await headers[0].getAttribute('aria-expanded') !== 'true') await headers[0].click();
  for (let index = 0; index < headers.length; index++) {
    await expect(headers[index]).toHaveAttribute('aria-expanded', 'true');
    const section = headers[index].locator('..');
    const choice = section.locator('button[aria-pressed]').first();
    const padding = await choice.evaluate(element => {
      const style = getComputedStyle(element);
      return [parseFloat(style.paddingTop), parseFloat(style.paddingLeft)];
    });
    expect(padding[0]).toBeGreaterThanOrEqual(12);
    expect(padding[1]).toBeGreaterThanOrEqual(14);
    await choice.click();
    await expect(headers[index]).toHaveAttribute('aria-expanded', 'false');
    if (index < 2) await expect(headers[index + 1]).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(page.getByRole('button', { name: /^4\. Accompaniment Style/ })).toHaveAttribute('aria-expanded', 'true');
});


test('Harmony sidebar keeps pointer and keyboard resize after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1759, height: 887 });
  await page.route('**/compose/ganesha/**', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.goto('/compose/ganesha/harmony');
  const handle = page.getByRole('button', { name: 'Resize harmony assistant', exact: true });
  await expect(handle).toBeVisible();
  const sidebar = handle.locator('..');
  const before = await sidebar.boundingBox();
  const grip = await handle.boundingBox();
  await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + 40);
  await page.mouse.down();
  await page.mouse.move(grip!.x + grip!.width / 2 - 120, grip!.y + 40, { steps: 8 });
  await page.mouse.up();
  const resized = await sidebar.boundingBox();
  expect(resized!.width).toBeGreaterThan(before!.width + 100);
  await page.reload();
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(Math.round(resized!.width));
  await handle.focus();
  await handle.press('ArrowLeft');
  const keyboardWidth = await sidebar.boundingBox();
  expect(keyboardWidth!.width).toBeGreaterThan(resized!.width);
  await page.reload();
  await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(Math.round(keyboardWidth!.width));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(handle).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
