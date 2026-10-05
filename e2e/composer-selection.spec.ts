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
    await expect(hbCard.locator(".song-key-badge")).toHaveText("Key: G");

    // Check indicators (Video, Backing Track, Melody, Guitar should be visible based on happy-birthday resources)
    await expect(hbCard.locator("[data-indicator='video']")).toBeVisible();
    await expect(hbCard.locator("[data-indicator='backing-track']")).toBeVisible();
    await expect(hbCard.locator("[data-indicator='melody']")).toBeVisible();
    await expect(hbCard.locator("[data-indicator='guitar']")).toHaveAttribute(
      "href",
      "/compose/happy-birthday/accompaniment?instrument=guitar-classic"
    );
    await expect(hbCard.locator("[data-indicator='piano']")).toHaveAttribute(
      "href",
      "/compose/happy-birthday/accompaniment?instrument=piano"
    );

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
    
    // Check back link exists and works (using breadcrumb to go back to catalogue).
    // Continuing from this screen saves the song to disk, which is intentionally
    // outside the read-only navigation coverage of this spec.
    await page.getByRole("link", { name: "Catalogue Editor" }).click();
    await expect(page).toHaveURL(/\/edit/);

    // Resource chips are real controls: an unavailable Piano layer starts its focused
    // accompaniment lane, rather than behaving like a passive status badge.
    await hbCard.locator("[data-indicator='piano']").click();
    await expect(page).toHaveURL(/\/compose\/happy-birthday\/accompaniment\?instrument=piano/);
    await expect(page.getByRole("heading", { name: "Accompaniment workflow" })).toBeVisible();
    await expect(page.getByText("Piano lane", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Harmony.*Select & validate source/i })).toBeVisible();
  });
});
