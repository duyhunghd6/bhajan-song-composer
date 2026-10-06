import { expect, test } from '@playwright/test';
import { buildApprovedSnapshotSession } from './helpers/singer-accompaniment';
import { fourFourGapCMajor } from './fixtures/singer-accompaniment/sources';

const snapshot = fourFourGapCMajor;
const prefix = 'bhajan-song-composer:compose:ganesha:';

test('Harmony style: seven candidates, preview, mixer, save, reload and source invalidation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/compose/ganesha/**', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  const samples: string[] = [];
  await page.route('**/midi-js-soundfonts/**', async route => {
    samples.push(route.request().url());
    const wav = Buffer.alloc(44 + 22050 * 4 * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(22050, 24); wav.writeUInt32LE(44100, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
    for (let i = 0; i < 22050 * 4; i++) wav.writeInt16LE(Math.round(5000 * Math.sin(i / 10)), 44 + i * 2);
    await route.fulfill({ contentType: 'audio/wav', body: wav });
  });
  await page.addInitScript(() => {
    const probe = window as unknown as { strummingSilence: number[] };
    probe.strummingSilence = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const node = create.call(this);
      const start = node.start.bind(node);
      node.start = (...args: Parameters<AudioBufferSourceNode['start']>) => {
        if (node.buffer) {
          const samples = node.buffer.getChannelData(0);
          const secondsPerWhole = 240 / 84;
          for (const [from, to] of [[0.52, 0.6], [0.95, 0.98]]) {
            let peak = 0;
            for (let i = Math.floor(from * secondsPerWhole * node.buffer.sampleRate); i < to * secondsPerWhole * node.buffer.sampleRate; i++) peak = Math.max(peak, Math.abs(samples[i] ?? 0));
            probe.strummingSilence.push(peak);
          }
        }
        start(...args);
      };
      return node;
    };
  });
  await page.addInitScript(({ source, workflow, prefix }) => {
    if (sessionStorage.getItem('strumming-seeded')) return;
    sessionStorage.setItem('strumming-seeded', 'true');
    localStorage.setItem(prefix + 'melody', source);
    localStorage.setItem(prefix + 'workspace', JSON.stringify({ accompanimentWorkflow: workflow }));
  }, { source: snapshot.sourceAbc, workflow: buildApprovedSnapshotSession(snapshot), prefix });
  await page.goto('/compose/ganesha/harmony');
  const header = page.getByRole('button', { name: /^4\. Accompaniment Style/ });
  if (await header.getAttribute('aria-expanded') !== 'true') await header.click();
  const styles = page.locator('input[name="accompaniment-style"]');
  const results = page.locator('input[name="strumming-result"]');
  const style = page.getByRole('radio', { name: /^Folk / });
  await expect(style).toBeEnabled();
  await expect(styles).toHaveCount(7);
  await expect(page.getByRole('radio', { name: /^Waltz/ })).toBeDisabled();
  await style.check();
  await expect(results).toHaveCount(7);
  for (const mark of ['↓', '↑', 'X', 'Dead']) {
    await expect(page.locator('svg text').filter({ hasText: new RegExp('^' + mark + '$') }).first()).toBeVisible();
  }
  await expect(page.locator('svg .abcjs-upbow, svg .abcjs-downbow')).toHaveCount(0);
  await expect(page.getByLabel('Strumming technique legend')).toContainText('PM: palm mute');
  await page.locator('summary').filter({ hasText: 'ABC notation' }).click();
  const abc = page.getByLabel('Harmony playback ABC', { exact: true });
  await expect(abc).toContainText('V:GuitarStrumming');
  await expect(abc).toContainText('Slap');
  await expect(abc).toContainText('Choke');
  await page.locator('summary').filter({ hasText: 'TimeGrid JSON' }).click();
  const grid = page.getByLabel('Harmony TimeGrid JSON', { exact: true });
  const initialGrid = await grid.textContent();
  const chordCues = page.locator('[data-guitar-chord]');
  const chordCueCount = await chordCues.count();
  expect(chordCueCount).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Hide Chord Progression', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Chord Progression', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(chordCues).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Chord Progression volume' })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Chord Accompaniment volume' })).toBeDisabled();
  await page.getByRole('button', { name: 'Show Chord Progression', exact: true }).click();
  await expect(chordCues).toHaveCount(chordCueCount);
  await expect(chordCues.first()).toBeVisible();
  await expect(abc).toContainText('"C"');
  await expect(grid).toHaveText(initialGrid!);

  await page.getByRole('button', { name: 'Hide Strumming', exact: true }).click();
  await expect(abc).not.toContainText('V:GuitarStrumming');
  await expect(grid).toHaveText(initialGrid!);
  await page.getByRole('button', { name: 'Show Strumming', exact: true }).click();
  await results.nth(2).check();
  await expect(grid).toContainText('"variant": 2');
  await expect(grid).toContainText('"technique": "dead-strum"');
  await expect(grid).toContainText('"technique": "rest"');
  await results.nth(0).check();
  await page.getByRole('button', { name: 'Hide Melody', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  expect(samples.some(url => url.includes('acoustic_guitar_steel'))).toBe(true);
  expect(samples.some(url => url.includes('percussion'))).toBe(true);
  const silence = await page.evaluate(() => (window as unknown as { strummingSilence: number[] }).strummingSilence);
  expect(silence.length).toBeGreaterThan(0);
  expect(silence.every(peak => peak < 0.00001)).toBe(true);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Hide Chord Progression', exact: true }).click();
  await page.getByRole('button', { name: 'Show Chord Accompaniment', exact: true }).click();
  await expect(chordCues).toHaveCount(0);
  await expect(page.getByRole('slider', { name: 'Chord Accompaniment volume' })).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { strummingSilence: number[] }).strummingSilence = []; });
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  const withChordAudio = await page.evaluate(() => (window as unknown as { strummingSilence: number[] }).strummingSilence);
  expect(withChordAudio.some(peak => peak > 0.001)).toBe(true);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Hide Chord Accompaniment', exact: true }).click();
  await page.getByRole('button', { name: 'Show Chord Progression', exact: true }).click();
  await expect(grid).toHaveText(initialGrid!);

  await page.getByRole('button', { name: 'Show Melody', exact: true }).click();
  await results.nth(2).check();
  const techniques = page.getByRole('group', { name: 'Techniques you can play' });
  await expect(techniques.getByRole('checkbox')).toHaveCount(5);
  for (const name of ['Bass picking', 'Palm mute', 'Dead strum', 'Choke']) {
    await techniques.getByRole('checkbox', { name, exact: false }).uncheck();
  }
  await expect(techniques.getByRole('checkbox', { name: 'String slap' })).toBeChecked();
  await page.getByRole('button', { name: 'Save accompaniment', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();
  await expect.poll(() => page.evaluate(prefix => JSON.parse(localStorage.getItem(prefix + 'workspace') ?? '{}').harmonyStrumming?.variant, prefix)).toBe(2);
  await page.reload();
  await expect(style).toBeChecked();
  await expect(techniques.getByRole('checkbox', { name: 'Palm mute' })).not.toBeChecked();
  await expect(techniques.getByRole('checkbox', { name: 'String slap' })).toBeChecked();
  await expect.poll(() => page.evaluate(prefix => JSON.parse(localStorage.getItem(prefix + 'workspace') ?? '{}').harmonyStrumming?.techniques, prefix)).toEqual(['slap']);
  await techniques.getByRole('checkbox', { name: 'Palm mute' }).check();
  await expect(page.getByRole('button', { name: 'Save accompaniment', exact: true })).toBeEnabled();
  await expect(results.nth(2)).toBeChecked();
  await results.nth(4).check();
  await page.getByRole('button', { name: 'Cancel preview' }).click();
  await expect(results.nth(2)).toBeChecked();
  await expect(techniques.getByRole('checkbox', { name: 'Palm mute' })).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('harmony-strumming.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.evaluate(({ prefix, source }) => localStorage.setItem(prefix + 'melody', source.replace('c e g e', 'c d g e')), { prefix, source: snapshot.sourceAbc });
  await page.reload();
  if (await header.getAttribute('aria-expanded') !== 'true') await header.click();
  await expect(style).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Hide Strumming', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
