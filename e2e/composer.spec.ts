import { expect, test } from "@playwright/test";

const composerAbc = `X:7
T:Composer E2E Draft
M:4/4
L:1/8
Q:1/4=100
K:Em
| E2 F2 G2 A2 | B8 |`;

test.describe("composer workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("starts on the metadata dashboard and opens the route-based melody step", async ({ page }) => {
    await page.goto("/compose");

    await expect(page.getByRole("heading", { name: "Song Metadata & Layers Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Metadata & Layer Status" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Arrangement tracks" })).toHaveCount(0);

    await page.getByRole("link", { name: "Save & Start Melody" }).click();

    await expect(page).toHaveURL(/\/compose\/new-bhajan-arrangement\/melody$/);
    await expect(page.getByRole("heading", { name: "Step 1: Melody Input" })).toBeVisible();
    await expect(page.getByText("Layers & Navigation")).toBeVisible();
    await expect(page.getByText("[▶] 1. Melody")).toBeVisible();
    await expect(page.locator("#abc-editor-input")).toBeVisible();
    await expect(page.getByRole("link", { name: "Save & Harmonize" })).toHaveAttribute(
      "href",
      "/compose/new-bhajan-arrangement/harmony",
    );
  });

  test("keeps metadata editing and YAML preview on the composer dashboard", async ({ page }) => {
    await page.goto("/compose");

    await page.locator("#song-title").fill("E2E Bhajan Draft");
    await page.locator("#song-slug").fill("e2e-bhajan-draft");
    await page.locator("#song-tags").fill("bhajan, e2e, playwright");

    const yamlPreview = page.locator("#song-metadata-yaml-preview");
    await expect(yamlPreview).toHaveValue(/title: "E2E Bhajan Draft"/);
    await expect(yamlPreview).toHaveValue(/slug: "e2e-bhajan-draft"/);
    await expect(yamlPreview).toHaveValue(/tags: \["bhajan", "e2e", "playwright"\]/);

    await expect(page.getByRole("link", { name: "Save & Start Melody" })).toHaveAttribute(
      "href",
      "/compose/e2e-bhajan-draft/melody",
    );
  });

  test("shows the dedicated child UIs with sidebar progress and step navigation", async ({ page }) => {
    const slug = "new-bhajan-arrangement";

    await page.goto(`/compose/${slug}/melody`);
    await page.locator("#abc-editor-input").fill(composerAbc);
    await expect(page.getByRole("heading", { name: "Step 1: Melody Input" })).toBeVisible();
    await expect(page.getByText("[▶] 1. Melody")).toBeVisible();
    await expect(page.locator("#abc-editor-preview")).toBeVisible();

    await page.getByRole("link", { name: "Save & Harmonize" }).click();
    await expect(page).toHaveURL(`/compose/${slug}/harmony`);
    await expect(page.getByRole("heading", { name: "Step 2: Harmonization" })).toBeVisible();
    await expect(page.getByText("[✓] 1. Melody")).toBeVisible();
    await expect(page.getByText("[▶] 2. Harmony")).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI Analysis Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chord Track Editor (Ghosted Melody below)" })).toBeVisible();

    await page.getByRole("link", { name: "Save & Add Accompaniment" }).click();
    await expect(page).toHaveURL(`/compose/${slug}/accompaniment`);
    await expect(page.getByRole("heading", { name: "Step 3: Accompaniment" })).toBeVisible();
    await expect(page.getByText("[▶] 3. Accompaniment")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Engine Toggle" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Playability Validation Report" })).toBeVisible();
    await page.getByRole("button", { name: "Generate Accompaniment Matrix" }).click();
    await expect(page.getByRole("heading", { name: "Resulting ABC Staff Preview" })).toBeVisible();

    await page.getByRole("link", { name: "Save & Add Ensemble" }).click();
    await expect(page).toHaveURL(`/compose/${slug}/ensemble`);
    await expect(page.getByRole("heading", { name: "Step 4: Ensemble Expansion" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enable Layers" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Conflict Resolution Hierarchy Log" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Multi-track ABCJS Render (Full Score View)" })).toBeVisible();

    await page.getByRole("link", { name: "Save & Review" }).click();
    await expect(page).toHaveURL(`/compose/${slug}/review`);
    await expect(page.getByRole("heading", { name: "Step 5: Review & Export" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Playback Simulation: Test Full Audio & Sync" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Raw Markdown Output File Preview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy Markdown" })).toBeVisible();
  });

  test("loads an existing song into the metadata dashboard and continues to melody", async ({ page }) => {
    await page.goto("/compose?edit=happy-birthday");

    await expect(page.getByRole("heading", { name: "Song Metadata & Layers Dashboard" })).toBeVisible();
    await expect(page.getByText("Review metadata for Happy Birthday")).toBeVisible();
    await expect(page.locator("#song-title")).toHaveValue("Happy Birthday");
    await expect(page.getByRole("link", { name: "Continue arrangement" })).toHaveAttribute(
      "href",
      "/compose/happy-birthday/melody",
    );
  });
});
