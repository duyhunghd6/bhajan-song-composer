import { expect, test } from "@playwright/test";

test.describe("playback module", () => {
  test("switches playback views, selectors, and URL state", async ({ page }) => {
    await page.goto("/marathi/namostute");

    await expect(page.getByRole("heading", { name: "Namostute" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "YouTube Player" })).toBeVisible();
    await expect(page.locator("#reference-youtube-iframe-player")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lyrics & Transliteration" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Music Sheet Playback" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Visual Instrument Highlight Panel" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sustain Pedal Indicator" })).toBeVisible();
    await expect(page.getByRole("button", { name: /split view/i })).toBeVisible();
    await expect(page.locator("#youtube-iframe-player")).toBeVisible();
    await expect(page.locator("#abc-music-canvas")).toBeAttached();

    await page.getByRole("button", { name: /sheet view/i }).click();
    await expect(page).toHaveURL(/[?&]view=sheet/);
    await expect(page.getByRole("heading", { name: "Music Sheet Playback" })).toBeVisible();
    await expect(page.locator("#midi-btn-play")).toBeVisible();
    await expect(page.locator("#midi-btn-stop")).toBeVisible();
    await expect(page.locator("#midi-tempo-value")).toHaveText("120");
    await expect(page.locator("#youtube-iframe-player")).toHaveCount(0);

    await page.getByRole("button", { name: /video view/i }).click();
    await expect(page).toHaveURL(/[?&]view=video/);
    await expect(page.locator("#youtube-iframe-player")).toBeVisible();
    await expect(page.locator("#midi-btn-play")).toHaveCount(0);

    await page.locator("#video-only-select-full-performance").click();
    await expect(page).toHaveURL(/[?&]video=full-performance/);

    await page.getByRole("button", { name: /split view/i }).click();
    await expect(page).toHaveURL(/[?&]view=split/);
    await expect(page.getByRole("heading", { name: "Select Video Track" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Select Music Sheet Layer" })).toBeVisible();

    await page.locator("#split-sheet-select-backing-track").click();
    await expect(page).toHaveURL(/[?&]sheet=backing-track/);
    await expect(page.getByRole("heading", { name: "Music Sheet Playback" })).toBeVisible();
  });
});
