import { expect, test } from "@playwright/test";

const source = 'X:1\nM:4/4\nL:1/4\nQ:1/4=80\nK:Em\n"Em" E4 | "Em" E4 |';
const pitches = [40, 47, 52, 55, 59, 64, 67, 71];
function sample(url: string) {
  const note = decodeURIComponent(url).match(/([A-G])([b#]?)([0-9])\.mp3/)!;
  const midi = (Number(note[3]) + 1) * 12 + ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[note[1]] ?? 0) + (note[2] === "b" ? -1 : note[2] === "#" ? 1 : 0);
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const buffer = Buffer.alloc(44 + 22050 * 2);
  buffer.write("RIFF"); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(22050, 24); buffer.writeUInt32LE(44100, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(44100, 40);
  for (let i = 0; i < 22050; i++) buffer.writeInt16LE(Math.round(10000 * Math.sin(i * 2 * Math.PI * frequency / 22050)), 44 + i * 2);
  return buffer;
}

declare global { interface Window { shapeSpectra: number[][] } }
for (const support of [false, true]) {
for (const step of ["melody", "harmony", "accompaniment"]) {
  test(`${step} (${support ? "GuitarSupport" : "chord symbols"}): main audio buffer uses committed shape pitches immediately and after reload`, async ({ page }) => {
    await page.route("**/compose/ganesha/*", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
    await page.route("**/midi-js-soundfonts/**", (route) => route.fulfill({ contentType: "audio/wav", body: sample(route.request().url()) }));
    await page.addInitScript(({ abc, pitches }) => {
      if (!sessionStorage.getItem("shape-pitch-seeded")) {
        localStorage.setItem("bhajan-song-composer:compose:ganesha:melody", abc);
        sessionStorage.setItem("shape-pitch-seeded", "true");
      }
      window.shapeSpectra = [];
      const create = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const node = create.call(this);
        const start = node.start.bind(node);
        node.start = (...args: Parameters<typeof node.start>) => {
          const buffer = node.buffer;
          if (buffer && buffer.duration > 4) {
            const data = buffer.getChannelData(0);
            const offset = Math.floor(buffer.sampleRate * 0.1);
            const length = Math.floor(buffer.sampleRate * 0.4);
            // Frequency probes on the actual mixed buffer sent to Web Audio,
            // using pitch-specific synthetic samples instead of external soundfonts.
            window.shapeSpectra.push(pitches.map((midi) => {
              const omega = 2 * Math.PI * 440 * 2 ** ((midi - 69) / 12) / buffer.sampleRate;
              let real = 0, imaginary = 0;
              for (let i = 0; i < length; i++) {
                const value = data[offset + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (length - 1)));
                real += value * Math.cos(omega * i);
                imaginary += value * Math.sin(omega * i);
              }
              return Math.hypot(real, imaginary) / length;
            }));
          }
          start(...args);
        };
        return node;
      };
    }, { abc: support
      ? source.replace("K:Em\n", "%%score Melody GuitarSupport\nK:Em\nV:Melody\n") + '\nV:GuitarSupport\n%%MIDI program 25\n[E,,B,,E,G,B,E]4 | [E,,B,,E,G,B,E]4 |'
      : source, pitches });
    await page.goto(`/compose/ganesha/${step}`);
    const verify = async (expected: number[]) => {
      await page.evaluate(() => { window.shapeSpectra = []; });
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.shapeSpectra.length)).toBe(1);
      const spectrum = await page.evaluate(() => window.shapeSpectra[0]);
      for (let i = 0; i < pitches.length; i++) {
        if (expected.includes(pitches[i])) expect(spectrum[i], `MIDI ${pitches[i]} must sound`).toBeGreaterThan(0.001);
        else expect(spectrum[i], `MIDI ${pitches[i]} must be absent`).toBeLessThan(0.001);
      }
      await page.getByRole("button", { name: "Pause", exact: true }).click();
    };
    await verify([40, 47, 52, 55, 59, 64]);
    await page.locator("svg[data-guitar-chord]").first().click();
    await page.getByRole("dialog").getByRole("radio", { name: "Em: 0 2 2 4 5 3", exact: true }).dblclick();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await verify([40, 47, 52, 59, 64, 67]);
    await page.locator("svg[data-guitar-chord]").first().click();
    await page.getByRole("dialog").getByRole("radio", { name: "Em: X 7 9 9 8 7", exact: true }).dblclick();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // No audition or reload may hide reuse of the previous synth buffer.
    await verify([52, 59, 64, 67, 71]);
    await page.reload();
    await verify([52, 59, 64, 67, 71]);
  });
}

}
