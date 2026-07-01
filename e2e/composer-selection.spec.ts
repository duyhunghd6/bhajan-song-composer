import { expect, test } from "@playwright/test";

test.describe("composer song edit dashboard and redirect", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("displays searchable song listing on /edit page and redirects to composer", async ({ page }) => {
    // 1. Navigate to the edit dashboard
    await page.goto("/edit");

    // Expect header and navigation links
    await expect(page.getByRole("heading", { name: "Catalogue Editor" })).toBeVisible();
    
    // Check search input presence
    const searchInput = page.locator("#song-search-input");
    await expect(searchInput).toBeVisible();

    // Verify key tone and resource indicators on Happy Birthday card/row
    const hbCard = page.locator("[data-song-slug='happy-birthday']");
    await expect(hbCard).toBeVisible();
    await expect(hbCard.locator(".song-key-badge")).toHaveText("Key: C");

    // Check indicators (Video, Backing Track, Melody, Guitar should be visible based on happy-birthday resources)
    await expect(hbCard.locator("[data-indicator='video']")).toBeVisible();
    await expect(hbCard.locator("[data-indicator='backing-track']")).toBeVisible();
    await expect(hbCard.locator("[data-indicator='melody']")).toBeVisible();

    // Check search filter works
    await searchInput.fill("Namostute");
    await expect(hbCard).not.toBeVisible();
    const namostuteCard = page.locator("[data-song-slug='namostute']");
    await expect(namostuteCard).toBeVisible();

    // Clear search
    await searchInput.fill("");
    await expect(hbCard).toBeVisible();

    // 2. Click Edit on Happy Birthday
    await hbCard.locator(".edit-song-btn").click();

    // Asserts redirect to /compose?edit=happy-birthday
    await expect(page).toHaveURL(/\/compose\?edit=happy-birthday/);

    // Verify metadata and layers are loaded on the compose page
    await expect(page.locator("#song-title")).toHaveValue("Happy Birthday");
    await expect(page.locator("#song-slug")).toHaveValue("happy-birthday");
    
    // The active layer name should default to "Melody Music Sheet"
    await expect(page.getByLabel("Active layer name")).toHaveValue("Melody Music Sheet");

    // The ABC editor input should contain the Happy Birthday melody notation
    const abcEditor = page.locator("#abc-editor-input");
    await expect(abcEditor).toContainText("T:Happy Birthday (Melody)");
    await expect(abcEditor).toContainText("K:C");

    // Check back link exists and works
    await page.getByRole("link", { name: "Back to Edit List" }).click();
    await expect(page).toHaveURL(/\/edit/);
  });
});
