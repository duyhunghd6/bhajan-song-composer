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
    await expect(page.getByRole("link", { name: /Melody\s+Current/ })).toBeVisible();
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
    await expect(page.getByRole("link", { name: /Melody\s+Current/ })).toBeVisible();
    await expect(page.locator("#abc-editor-preview")).toBeVisible();

    await page.getByRole("link", { name: "Save & Harmonize" }).click();
    await expect(page).toHaveURL(`/compose/${slug}/harmony`);
    await expect(page.getByRole("heading", { name: "Step 2: Harmonization" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Melody\s+Complete/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Harmony\s+Current/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI Analysis Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Chord Track Editor (Ghosted Melody below)" })).toBeVisible();

    await page.getByRole("link", { name: "Save & Add Accompaniment" }).click();
    await expect(page).toHaveURL(`/compose/${slug}/accompaniment`);
    await expect(page.getByRole("heading", { name: "Step 3: Accompaniment" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Accompaniment\s+Current/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI Accompaniment Generation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resulting ABC Staff Preview" })).toBeVisible();

    await page.getByRole("link", { name: "Save & Add Ensemble" }).click();
    await expect(page).toHaveURL(`/compose/${slug}/ensemble`);
    await expect(page.getByRole("heading", { name: "Step 4: Ensemble Expansion" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI Ensemble Generation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Step-by-step AI Ensemble Workflow" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start 8-step Ensemble Workflow" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Conflict Resolution Hierarchy Log" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Multi-track ABCJS Render (Full Score View)" })).toBeVisible();

    await page.getByRole("link", { name: "Save & Review" }).click();
    await expect(page).toHaveURL(`/compose/${slug}/review`);
    await expect(page.getByRole("heading", { name: "Step 5: Review & Export" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Playback Simulation: Test Full Audio & Sync" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Raw Markdown Output File Preview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy Markdown" })).toBeVisible();
  });

  test("keeps Solo/Fingerstyle off accompaniment while preserving the dedicated route", async ({ page }) => {
    await page.goto("/compose/hari-bol/accompaniment");

    await expect(page.getByText("Harmony validation required")).toBeVisible();
    await expect(page.getByRole("button", { name: /Solo\/Fingerstyle/ })).toHaveCount(0);
    await expect(page.getByText(/Step-by-step Guitar Fingerstyle Workflow/)).toHaveCount(0);

    await page.goto("/compose/hari-bol/guitar-fingerstyle");
    await expect(page).toHaveURL(/\/compose\/hari-bol\/guitar-fingerstyle$/);
    await expect(page.getByText("Harmony validation required")).toBeVisible();
    await expect(page.getByText("Guitar Fingerstyle TimeGrid")).toBeVisible();
  });

  test("places source on the left and playback on the right at widescreen", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    for (const step of ["harmony", "accompaniment", "ensemble", "review"] as const) {
      await page.goto(`/compose/happy-birthday/${step}`);

      const sourcePanel = page.locator(".composer-step-source-panel").first();
      const previewPanel = page.locator(".composer-step-responsive-grid > div").nth(1);
      const previewCanvas = page.locator(`#composer-${step}-preview`);
      await expect(sourcePanel).toBeVisible();
      await expect(previewPanel).toBeVisible();
      await expect(previewCanvas).toBeVisible();

      const sourceBox = await sourcePanel.boundingBox();
      const previewPanelBox = await previewPanel.boundingBox();
      const previewBox = await previewCanvas.boundingBox();
      expect(sourceBox).not.toBeNull();
      expect(previewPanelBox).not.toBeNull();
      expect(previewBox).not.toBeNull();
      if (!sourceBox || !previewPanelBox || !previewBox) throw new Error(`Could not measure ${step} composer layout`);

      expect(sourceBox.x + sourceBox.width).toBeLessThanOrEqual(previewBox.x);
      expect(previewPanelBox.width).toBeGreaterThanOrEqual(sourceBox.width);
      expect(previewPanelBox.width / (sourceBox.width + previewPanelBox.width)).toBeGreaterThanOrEqual(0.48);
    }
  });

  test("stacks source above playback below the widescreen breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1279, height: 900 });
    await page.goto("/compose/happy-birthday/harmony");

    const sourcePanel = page.locator(".composer-step-source-panel").first();
    const previewCanvas = page.locator("#composer-harmony-preview");
    await expect(sourcePanel).toBeVisible();
    await expect(previewCanvas).toBeVisible();

    const sourceBox = await sourcePanel.boundingBox();
    const previewBox = await previewCanvas.boundingBox();
    expect(sourceBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    if (!sourceBox || !previewBox) throw new Error("Could not measure stacked composer layout");

    expect(previewBox.y).toBeGreaterThan(sourceBox.y + sourceBox.height);
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
