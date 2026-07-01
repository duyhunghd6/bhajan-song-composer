import { expect, test } from "@playwright/test";

test.describe("piano accompaniment mockup page", () => {
  test("renders the piano accompaniment POC evidence needed by the review gate", async ({ page }) => {
    await page.goto("/mockups/piano-accompaniment");

    await expect(page.getByRole("heading", { name: "Piano Accompaniment Workstation" })).toBeVisible();
    await expect(page.getByText("UNID: br-plan-09.c04")).toBeVisible();
    await expect(page.getByText("Validation Passed", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Comping Profile" })).toBeVisible();
    await expect(page.getByText("Pop/Ballad", { exact: true })).toBeVisible();
    await expect(page.getByText("1-5-10 arpeggiation")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Bass Anchoring & Low Interval Limit" })).toBeVisible();
    await expect(page.getByText("Low Interval Limit: clear").first()).toBeVisible();
    await expect(page.getByText("Foundation: 1-5-8").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Right-Hand Voice Leading" })).toBeVisible();
    await expect(page.getByText("Melody masking avoided").first()).toBeVisible();
    await expect(page.getByText("Guide tones").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Melodic Gap Fills" })).toBeVisible();
    await expect(page.getByText("passing-fill").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Pedal Automation" })).toBeVisible();
    await expect(page.getByText("MIDI CC 64 · down 127 · up 0")).toBeVisible();
    await expect(page.getByText("pedal-flush").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Grand Staff Preview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Piano Key Highlights" })).toBeVisible();
    await expect(page.locator("#midi-btn-play")).toBeVisible();
  });
});
