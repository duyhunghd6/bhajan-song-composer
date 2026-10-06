import { expect, test } from '@playwright/test';

const source = 'X:1\nM:4/4\nL:1/16\nQ:1/4=120\nK:C\nV:GuitarStrumming\n%%MIDI program 25\n"^↓"[C,EG]2 "^↑"[GEC,]2 z12 |';
test('staff speed menu slows actual audio and traces directional steel-string attacks', async ({ page }) => {
  const traces: { midi: number; direction: string; program: number; atSeconds: number }[] = [];
  page.on('console', async message => {
    if (message.text().startsWith('[StaffPlayback 0.1x] note')) traces.push(await message.args()[1].jsonValue());
  });
  await page.route('**/compose/ganesha/*', route => route.request().method() === 'POST' ? route.abort() : route.continue());
  await page.route('**/midi-js-soundfonts/**', async route => {
    const wav = Buffer.alloc(44 + 22050 * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(22050, 24); wav.writeUInt32LE(44100, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
    wav.write('data', 36); wav.writeUInt32LE(44100, 40);
    for (let i = 0; i < 22050; i++) wav.writeInt16LE(Math.round(5000 * Math.sin(i / 10)), 44 + i * 2);
    await route.fulfill({ contentType: 'audio/wav', body: wav });
  });
  await page.addInitScript(abc => {
    localStorage.setItem('bhajan-song-composer:compose:ganesha:melody', abc);
    const probe = window as unknown as { speedDurations: number[] };
    probe.speedDurations = [];
    const create = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const node = create.call(this), start = node.start.bind(node);
      node.start = (...args: Parameters<typeof node.start>) => {
        if (node.buffer) probe.speedDurations.push(node.buffer.duration);
        start(...args);
      };
      return node;
    };
  }, source);
  await page.goto('/compose/ganesha/melody');
  const openMenu = () => page.getByRole('button', { name: 'Score zoom', exact: true }).click();
  await openMenu();
  for (const speed of ['0.1x', '0.5x', '1x', '1.25x', '1.5x', '2x', '3x']) await expect(page.getByRole('menuitemradio', { name: speed, exact: true })).toBeVisible();
  await page.getByRole('menuitemradio', { name: '1x', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  expect(traces).toHaveLength(0);
  await openMenu();
  await page.getByRole('menuitemradio', { name: '0.1x', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await openMenu();
  await expect(page.getByRole('menuitemradio', { name: '0.1x', exact: true })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => traces.length).toBe(6);
  expect(traces.map(e => e.midi)).toEqual([48, 64, 67, 67, 64, 48]);
  expect(traces.map(e => e.direction)).toEqual(['down', 'down', 'down', 'up', 'up', 'up']);
  expect(traces.every(e => e.program === 25)).toBe(true);
  expect(traces[2].atSeconds - traces[0].atSeconds).toBeCloseTo(0.42);
  expect(traces[5].atSeconds - traces[3].atSeconds).toBeCloseTo(0.26);
  const durations = await page.evaluate(() => (window as unknown as { speedDurations: number[] }).speedDurations);
  // abcjs appends a fixed tail to the buffer; musical duration grows by 18s (2s → 20s).
  expect(durations.at(-1)! - durations[0]).toBeCloseTo(18, 1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
});
