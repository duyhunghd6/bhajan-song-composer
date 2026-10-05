import { expect, test } from '@playwright/test';

test('Harmony guitar diagram opens from its whitespace with one click', async ({ page }) => {
  await page.route('**/compose/ganesha/**', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.addInitScript(() => {
    localStorage.setItem('bhajan-song-composer:compose:ganesha:melody', 'X:1\nT:Diagram click QA\nM:4/4\nL:1/4\nK:Em\n"Em"E4 | "Am"A4 |');
  });
  await page.goto('/compose/ganesha/harmony');
  const diagram = page.locator('svg[data-guitar-chord-diagram]').first();
  await expect(diagram).toBeVisible();
  // A point in the upper-left SVG whitespace misses every string/dot glyph.
  await diagram.click({ position: { x: 2, y: 2 } });
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radiogroup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.locator('text[data-guitar-chord]').first().click();
  await expect(dialog).not.toBeVisible();
  await diagram.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('heading').click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(dialog).not.toBeVisible();
  await diagram.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close guitar shapes' }).click();
  await expect(dialog).not.toBeVisible();
});
