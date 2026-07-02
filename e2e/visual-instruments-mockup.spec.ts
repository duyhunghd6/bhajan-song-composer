import { expect, test } from "@playwright/test";

const consoleFailurePattern = /Maximum update depth exceeded|Error rendering ABC notation|Error loading ABC notation renderer/i;

test.describe("visual instruments mockup", () => {
  test("teacher mode and linked variant showcases render without console failures", async ({ page }) => {
    const failures: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error" && consoleFailurePattern.test(message.text())) {
        failures.push(message.text());
      }
    });
    page.on("pageerror", (error) => failures.push(error.message));

    await page.goto("/mockups/visual-instruments?variant=teacher-mode");
    await expect(page.getByRole("heading", { name: "Visual Instrument & Note Markers POC" })).toBeVisible();
    await expect(page.locator("section").filter({ hasText: "Current variant" }).getByText("Teacher Mode", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Measure-by-Measure Coaching" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Instrument Sync" })).toHaveAttribute(
      "href",
      "/mockups/visual-instruments?variant=instrument-sync",
    );
    await page.goto("/mockups/visual-instruments?variant=instrument-sync");
    await expect(page.locator("section").filter({ hasText: "Current variant" }).getByText("Instrument Sync", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Synchronized Guitar Fretboard" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Note Markers" })).toHaveAttribute(
      "href",
      "/mockups/visual-instruments?variant=note-markers",
    );
    await page.goto("/mockups/visual-instruments?variant=note-markers");
    await expect(page.locator("section").filter({ hasText: "Current variant" }).getByText("Note Markers", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Playback-Driven Guitar Note Markers" })).toBeVisible();

    expect(failures).toEqual([]);
  });
});
