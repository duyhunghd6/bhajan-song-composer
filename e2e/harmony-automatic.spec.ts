import { expect, test } from '@playwright/test';
import { fourFourGapCMajor } from './fixtures/singer-accompaniment/sources';
import { seedTestProjectStorage } from './helpers/singer-accompaniment';

test('harmony calculates choices automatically and validates selected chords', async ({ page }) => {
  await page.route('**/compose/**', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  const slug = 'automatic-harmony-regression';
  await seedTestProjectStorage(page, slug, { melody: fourFourGapCMajor.sourceAbc });
  await page.goto(`/compose/${slug}/harmony`);
  const assistant = page.getByRole('complementary', { name: 'Harmony assistant' });
  await expect(assistant.getByRole('button', { name: /Generate|Recalculate|Start shaping/ })).toHaveCount(0);
  await expect(assistant.getByRole('button', { name: /Validate Harmony/ })).toHaveCount(0);
  await assistant.getByRole('button', { name: /Primary and secondary pulses/ }).click();
  await assistant.getByRole('button', { name: /Rank 1/ }).click();
  const continueLink = page.getByRole('link', { name: /Continue to accompaniment/ });
  await expect(continueLink).toBeVisible();
  await expect(assistant.getByRole('button', { name: /3. Accompaniment Style/ })).toBeVisible();
  await expect(assistant.getByRole('radio', { name: /Folk/ }).first()).toBeEnabled();
  await page.reload();
  await expect(continueLink).toBeVisible();
  const keyStep = assistant.getByRole('button', { name: /1.*Key.*Beats/ });
  if (await keyStep.getAttribute('aria-expanded') !== 'true') await keyStep.click();
  await assistant.getByRole('button', { name: /Downbeat emphasis/ }).click();
  await expect(continueLink).toHaveCount(0);
  await expect(assistant.getByRole('button', { name: /Rank 1/ })).toBeVisible();
  await assistant.getByRole('button', { name: /Rank 1/ }).click();
  await expect(continueLink).toBeVisible();
});
