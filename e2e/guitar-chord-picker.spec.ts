import { expect, test } from "@playwright/test";

const SOURCE = 'X:1\nT:Guitar chord picker QA\nM:4/4\nL:1/4\nQ:1/4=120\nK:Em\n"Em" E2 "Am" A2 | "Em" E4 |';

function sampleWav(): Buffer {
  const length = 22050;
  const buffer = Buffer.alloc(44 + length * 2);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(22050, 24); buffer.writeUInt32LE(44100, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++) buffer.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 220 / 22050) * 10000 * (1 - i / length)), 44 + i * 2);
  return buffer;
}

test("guitar diagrams select, audition, persist and scope physical chord shapes", async ({ page }) => {
  const samples: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Exercise the real audio decoder/synth with deterministic samples and keep QA
  // autosaves out of the user's durable Ganesha project.
  await page.route("**/midi-js-soundfonts/**", async (route) => {
    samples.push(route.request().url());
    await route.fulfill({ contentType: "audio/wav", body: sampleWav() });
  });
  await page.route("**/compose/ganesha/accompaniment*", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
  await page.addInitScript((source) => {
    if (!sessionStorage.getItem("guitar-qa-seeded")) {
      localStorage.setItem("bhajan-song-composer:compose:ganesha:melody", source);
      sessionStorage.setItem("guitar-qa-seeded", "true");
    }
    const win = window as typeof window & { guitarQaAudio: { duration: number; nonzero: boolean }[] };
    win.guitarQaAudio = [];
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const node = original.call(this);
      const start = node.start.bind(node);
      node.start = (...args: Parameters<typeof node.start>) => {
        win.guitarQaAudio.push({ duration: node.buffer?.duration ?? 0, nonzero: node.buffer?.getChannelData(0).some((sample) => Math.abs(sample) > 0.00001) ?? false });
        start(...args);
      };
      return node;
    };
  }, SOURCE);
  await page.goto("/compose/ganesha/accompaniment");
  const names = page.locator("text[data-guitar-chord]");
  await expect(names).toHaveCount(3);
  await names.first().click();
  const dialog = page.getByRole("dialog");
  const barre = dialog.locator("[data-selected]").filter({ has: page.getByText("X–7–9–9–8–7", { exact: true }) });
  await barre.getByRole("button", { name: "Listen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { guitarQaAudio: { nonzero: boolean }[] }).guitarQaAudio.some((event) => event.nonzero))).toBe(true);
  expect(samples.length).toBeGreaterThan(0);
  expect(samples.filter((url) => !url.includes("acoustic_guitar_nylon"))).toEqual([]);
  await barre.getByRole("button", { name: "Use shape", exact: true }).click();
  await expect(barre).toHaveAttribute("data-selected", "true");
  await dialog.getByRole("button", { name: "Close guitar shapes" }).click();
  await page.reload();
  await names.first().click();
  await expect(dialog.locator('[data-selected="true"]')).toContainText("X–7–9–9–8–7");
  await dialog.getByRole("button", { name: "Close guitar shapes" }).click();
  await names.nth(2).click();
  await expect(dialog.locator('[data-selected="true"]')).toContainText("0–2–2–0–0–0");
  await dialog.getByRole("checkbox", { name: "Apply to every Em in this score" }).check();
  await barre.getByRole("button", { name: "Use shape", exact: true }).click();
  await dialog.getByRole("button", { name: "Close guitar shapes" }).click();
  await names.first().focus();
  await page.keyboard.press("Enter");
  await expect(dialog.locator('[data-selected="true"]')).toContainText("X–7–9–9–8–7");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { guitarQaAudio: { duration: number; nonzero: boolean }[] }).guitarQaAudio.some((event) => event.nonzero && event.duration > 4))).toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(errors).toEqual([]);
});
