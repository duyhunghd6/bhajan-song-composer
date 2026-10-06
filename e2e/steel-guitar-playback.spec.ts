import { expect, test } from "@playwright/test";

const source = 'X:1\nM:4/4\nL:1/4\nQ:1/4=80\nK:Em\n"Em" E4 | "Am" A4 |';
function sample() {
  const buffer = Buffer.alloc(44 + 22050 * 2);
  buffer.write("RIFF"); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(22050, 24); buffer.writeUInt32LE(44100, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36); buffer.writeUInt32LE(44100, 40);
  for (let i = 0; i < 22050; i++) buffer.writeInt16LE(Math.round(5000 * Math.sin(i / 10)), 44 + i * 2);
  return buffer;
}

for (const step of ["melody", "harmony", "accompaniment"]) {
  test(`${step}: staff and shape audition request steel-string samples`, async ({ page }) => {
    const samples: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/compose/ganesha/*", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
    await page.route("**/midi-js-soundfonts/**", async (route) => {
      samples.push(route.request().url());
      await route.fulfill({ contentType: "audio/wav", body: sample() });
    });
    await page.addInitScript((abc) => {
      localStorage.setItem("bhajan-song-composer:compose:ganesha:melody", abc);
    }, source);
    await page.goto(`/compose/ganesha/${step}`);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    expect(samples.some((url) => url.includes("acoustic_guitar_steel"))).toBe(true);
    expect(samples.some((url) => url.includes("acoustic_guitar_nylon"))).toBe(false);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.locator("svg[data-guitar-chord]").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const listen = dialog.getByRole("button", { name: /^Listen to Em:/ }).first();
    await listen.click();
    await expect(listen).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    expect(samples.some((url) => url.includes("acoustic_guitar_nylon"))).toBe(false);
    await dialog.getByRole("button", { name: "Close guitar shapes" }).click();
    expect(errors).toEqual([]);
  });
}
