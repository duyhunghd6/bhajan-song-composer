import { expect, test, type Locator } from "@playwright/test";

const SOURCE = 'X:1\nT:Guitar chord picker QA\nM:4/4\nL:1/4\nQ:1/4=120\n%%score Melody GuitarSupport\nK:Em\nV:Melody\n"Em" E2 "Am" A2 | "Em" E4 |\nV:GuitarSupport\n%%MIDI program 24\nE2 A2 | E4 |';

function sampleWav(url: string): Buffer {
  const note = decodeURIComponent(url).match(/([A-G])([b#]?)([0-9])\.mp3/)!;
  const midi = (Number(note[3]) + 1) * 12 + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[note[1]] ?? 0) + (note[2] === "b" ? -1 : note[2] === "#" ? 1 : 0);
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const length = 22050;
  const buffer = Buffer.alloc(44 + length * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(22050, 24); buffer.writeUInt32LE(44100, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) buffer.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * frequency / 22050) * 10000 * (1 - i / length)), 44 + i * 2);
  return buffer;
}

for (const step of ["melody", "accompaniment", "harmony"]) {
test(`${step}: guitar diagrams select, audition, persist and scope physical chord shapes`, async ({ page }) => {
  const samples: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise the real audio decoder/synth with deterministic samples and keep QA
  // autosaves out of the user's durable Ganesha project.
  await page.route("**/midi-js-soundfonts/**", async (route) => {
    samples.push(route.request().url());
    if (process.env.GUITAR_QA_REAL_SAMPLES) await route.continue();
    else await route.fulfill({ contentType: "audio/wav", body: sampleWav(route.request().url()) });
  });
  await page.route("**/compose/ganesha/*", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
  await page.addInitScript((source) => {
    if (!sessionStorage.getItem("guitar-qa-seeded")) {
      localStorage.setItem("bhajan-song-composer:compose:ganesha:melody", source);
      sessionStorage.setItem("guitar-qa-seeded", "true");
    }
    const win = window as typeof window & { guitarQaAudio: { duration: number; nonzero: boolean; signature: number[] }[] };
    win.guitarQaAudio = [];
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const node = original.call(this);
      const start = node.start.bind(node);
      node.start = (...args: Parameters<typeof node.start>) => {
        win.guitarQaAudio.push({ signature: Array.from({ length: 1000 }, (_, index) => node.buffer?.getChannelData(0)[1000 + index * 100] ?? 0), duration: node.buffer?.duration ?? 0, nonzero: node.buffer?.getChannelData(0).some((sample) => Math.abs(sample) > 0.00001) ?? false });
        start(...args);
      };
      return node;
    };
  }, step === "melody" ? SOURCE.replace("%%score Melody GuitarSupport\n", "").split("\nV:GuitarSupport")[0] : SOURCE);
  await page.goto(`/compose/ganesha/${step}`);
  const names = page.locator("text[data-guitar-chord]");
  const openPicker = async (chord: Locator) => {
    if (await page.locator("[data-score-workspace-viewport]").count()) await chord.dblclick();
    else await chord.click();
  };
  await expect(names).toHaveCount(3);
  await expect(page.locator("svg[data-guitar-chord]").first()).toHaveAttribute("width", "32.2");
  const tempoBox = await page.locator("g.abcjs-tempo").first().boundingBox();
  const shapeBox = await page.locator("svg[data-guitar-chord]").first().boundingBox();
  expect(tempoBox).not.toBeNull();
  expect(shapeBox).not.toBeNull();
  expect(tempoBox!.y + tempoBox!.height).toBeLessThanOrEqual(shapeBox!.y);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { guitarQaAudio: unknown[] }).guitarQaAudio.length)).toBe(1);
  const baseline = await page.evaluate(() => (window as typeof window & { guitarQaAudio: { signature: number[] }[] }).guitarQaAudio[0].signature);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.evaluate(() => { (window as typeof window & { guitarQaAudio: unknown[] }).guitarQaAudio = []; });
  await openPicker(names.first());
  const dialog = page.getByRole("dialog");
  // Compare score playback for shapes sharing E2 as their bass, without
  // audition or reload masking synth invalidation after saving the choice.
  const sameBassShape = dialog.getByRole("radio", { name: "Em: 0 2 2 4 5 3", exact: true });
  await sameBassShape.click();
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { guitarQaAudio: unknown[] }).guitarQaAudio.length)).toBe(1);
  const sameBassAudio = await page.evaluate(() => (window as typeof window & { guitarQaAudio: { signature: number[] }[] }).guitarQaAudio[0].signature);
  expect(sameBassAudio).not.toEqual(baseline);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.evaluate(() => { (window as typeof window & { guitarQaAudio: unknown[] }).guitarQaAudio = []; });
  await openPicker(names.first());
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: /^(Select|Selected|Use shape)$/ })).toHaveCount(0);
  const barre = dialog.locator("[data-selected]").filter({ has: page.getByText("X–7–9–9–8–7", { exact: true }) });
  const open = dialog.locator("[data-selected]").filter({ has: page.getByText("0–2–2–0–0–0", { exact: true }) });
  await open.getByRole("button", { name: /^Listen to Em:/ }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { guitarQaAudio: { signature: number[] }[] }).guitarQaAudio.length)).toBe(1);
  await barre.getByRole("button", { name: /^Listen to Em:/ }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { guitarQaAudio: { signature: number[] }[] }).guitarQaAudio.length)).toBe(2);
  const signatures = await page.evaluate(() => (window as typeof window & { guitarQaAudio: { signature: number[] }[] }).guitarQaAudio.map((event: { signature: number[] }) => event.signature));
  expect(signatures[0]).not.toEqual(signatures[1]);
  await expect.poll(() => page.evaluate(() => (window as typeof window & { guitarQaAudio: { nonzero: boolean }[] }).guitarQaAudio.some((event) => event.nonzero))).toBe(true);
  expect(samples.length).toBeGreaterThan(0);
  expect(samples.some((url) => url.includes("acoustic_guitar_nylon"))).toBe(true);
  await barre.dblclick();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await openPicker(names.first());
  await expect(dialog.locator('[data-selected="true"]')).toContainText("X–7–9–9–8–7");
  await dialog.getByRole("button", { name: "Close guitar shapes" }).click();
  const otherStep = step === "harmony" ? "accompaniment" : "harmony";
  await page.goto(`/compose/ganesha/${otherStep}`);
  await openPicker(names.first());
  await expect(dialog.locator('[data-selected="true"]')).toContainText("X–7–9–9–8–7");
  await page.keyboard.press("Escape");
  await page.goto(`/compose/ganesha/${step}`);
  await openPicker(names.nth(2));
  await expect(dialog.locator('[data-selected="true"]')).toContainText("0–2–2–0–0–0");
  const applyAll = dialog.getByRole("button", { name: "Apply to every Em in this score" });
  await expect(applyAll).toBeDisabled();
  await barre.click();
  await expect(applyAll).toBeEnabled();
  await applyAll.click();
  await expect(dialog).not.toBeVisible();
  await expect(names).toHaveCount(3);
  await names.first().focus();
  await page.keyboard.press("Enter");
  await expect(dialog.locator('[data-selected="true"]')).toContainText("X–7–9–9–8–7");
  await open.click();
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await openPicker(names.first());
  await expect(dialog.locator('[data-selected="true"]')).toContainText("0–2–2–0–0–0");
  await barre.click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await openPicker(names.first());
  await expect(dialog.locator('[data-selected="true"]')).toContainText("0–2–2–0–0–0");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { guitarQaAudio: { duration: number; nonzero: boolean; signature: number[] }[] }).guitarQaAudio.some((event) => event.nonzero && event.duration > 4))).toBe(true);
  const changed = await page.evaluate(() => (window as typeof window & { guitarQaAudio: { signature: number[] }[] }).guitarQaAudio.at(-1)!.signature);
  // Only the later Em remains a barre shape; the complete rendered audio must change.
  expect(changed).not.toEqual(baseline);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  if (step === "melody") {
    expect(await page.evaluate(() => localStorage.getItem("bhajan-song-composer:compose:ganesha:melody")))
      .toBe(SOURCE.replace("%%score Melody GuitarSupport\n", "").split("\nV:GuitarSupport")[0]);
    await page.screenshot({ path: test.info().outputPath("melody-chord-shapes.png"), fullPage: true });
  }
  expect(errors).toEqual([]);
});

}
