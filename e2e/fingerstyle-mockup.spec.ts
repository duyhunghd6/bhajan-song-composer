import { expect, test } from "@playwright/test";

test.describe("fingerstyle engine mockup page", () => {
  test("loads controls, handles selections, and renders guitar diagrams and music playback", async ({ page }) => {
    // 1. Navigate to mockup page
    await page.goto("/mockups/fingerstyle-engine");

    // 2. Assert page headers and identity
    await expect(page.getByRole("heading", { name: "Fingerstyle Engine Workstation" })).toBeVisible();
    await expect(page.getByText("UNID: br-plan-09.c03")).toBeVisible();
    await expect(page.getByText("Validation Passed")).toBeVisible();

    // 3. Verify configuration inputs exist
    const songSelect = page.locator("#song-select");
    const capoSelect = page.locator("#capo-select");
    const profileSelect = page.locator("#profile-select");
    const pruningSelect = page.locator("#pruning-select");

    await expect(songSelect).toBeVisible();
    await expect(capoSelect).toBeVisible();
    await expect(profileSelect).toBeVisible();
    await expect(pruningSelect).toBeVisible();

    // 4. Check initial values
    await expect(songSelect).toHaveValue("namostute");
    await expect(capoSelect).toHaveValue("0");
    await expect(profileSelect).toHaveValue("travis");
    await expect(pruningSelect).toHaveValue("guide-tones");

    // 5. Verify the compression steps table renders correctly
    const table = page.locator("table");
    await expect(table).toBeVisible();
    // Namostute has 4 measures in our mockup data
    await expect(page.locator("tbody tr")).toHaveCount(4);

    // 6. Verify guitar fretboard and visual overlays are rendered
    await expect(page.locator("[aria-label*='guitar fretboard diagram']")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Em Voicing" })).toBeVisible();

    // 7. Verify music sheet playback container
    await expect(page.getByRole("heading", { name: "Solo Guitar Notation" })).toBeVisible();
    await expect(page.locator("#midi-btn-play")).toBeVisible();
    await expect(page.locator("#midi-btn-stop")).toBeVisible();

    // 8. Interact with configuration controls and verify changes
    // Select Happy Birthday
    await songSelect.selectOption("happy-birthday");
    // Happy Birthday has 8 measures in our mockup data
    await expect(page.locator("tbody tr")).toHaveCount(8);
    // Initial chord fret shape changes to C Voicing
    await expect(page.getByRole("heading", { name: "C Voicing" })).toBeVisible();

    // Select Capo 3
    await capoSelect.selectOption("3");
    await expect(page.locator("[aria-label*='Capo on fret 3']")).toBeVisible();

    // Select PIMA profile
    await profileSelect.selectOption("pima");
    await expect(page.getByText("Classical floating PIMA")).toBeVisible();
  });
});
