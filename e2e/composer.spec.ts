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

  test("edits metadata, resource rows, and YAML preview", async ({ page }) => {
    await page.goto("/compose");

    await expect(page.getByRole("heading", { name: "Draft an ABC notation layer" })).toBeVisible();
    await expect(page.getByText("Schema valid")).toBeVisible();

    await page.locator("#song-title").fill("E2E Bhajan Draft");
    await page.locator("#song-slug").fill("e2e-bhajan-draft");
    await page.locator("#song-tags").fill("bhajan, e2e, playwright");

    const yamlPreview = page.locator("#song-metadata-yaml-preview");
    await expect(yamlPreview).toHaveValue(/title: "E2E Bhajan Draft"/);
    await expect(yamlPreview).toHaveValue(/slug: "e2e-bhajan-draft"/);
    await expect(yamlPreview).toHaveValue(/tags: \["bhajan", "e2e", "playwright"\]/);

    await page.getByRole("button", { name: "Add video" }).click();
    await page.locator("#video-type-1").fill("practice-track");
    await page.locator("#video-label-1").fill("Practice Track");
    await page.locator("#video-url-1").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await expect(yamlPreview).toHaveValue(/type: "practice-track"/);
    await expect(yamlPreview).toHaveValue(/label: "Practice Track"/);

    await page.getByRole("button", { name: "Add layer" }).first().click();
    await page.locator("#notation-type-1").fill("e2e-harmony");
    await page.locator("#notation-label-1").fill("E2E Harmony Sheet");
    await expect(yamlPreview).toHaveValue(/type: "e2e-harmony"/);
    await expect(yamlPreview).toHaveValue(/label: "E2E Harmony Sheet"/);

    await page.getByRole("button", { name: "Clear metadata draft" }).click();
    await expect(page.locator("#song-title")).toHaveValue("New Bhajan Arrangement");
    await expect(page.getByText("Metadata draft cleared. The starter form has been restored.")).toBeVisible();
  });

  test("manages ABC layers and editor state", async ({ page }) => {
    await page.goto("/compose");

    await expect(page.getByRole("heading", { name: "Arrangement tracks" })).toBeVisible();
    await expect(page.getByText("3 total layers", { exact: true })).toBeVisible();
    await expect(page.getByText("2 visible", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Visible" }).first().click();
    await expect(page.getByText("1 visible", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Add layer" }).nth(1).click();
    await expect(page.getByText("4 total layers", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Active layer name")).toHaveValue("Layer 4");

    await page.getByLabel("Active layer name").fill("E2E Lead Layer");
    await expect(page.getByRole("heading", { name: "Editing: E2E Lead Layer" })).toBeVisible();

    await page.locator("#abc-editor-input").fill(composerAbc);
    await expect(page.locator("#abc-editor-input")).toHaveValue(/Composer E2E Draft/);
    await expect(page.locator("#abc-editor-preview")).toBeVisible();

    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByText("5 total layers", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Active layer name")).toHaveValue("E2E Lead Layer Copy");

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByText("3 total layers", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Active layer name")).toHaveValue("Melody");
  });

  test("keeps the ABCJS music sheet visible after editing in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/compose?edit=happy-birthday");

    await expect(page.getByRole("heading", { name: "Editing: Happy Birthday" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Music Sheet (ABCJS rendering)" })).toBeVisible();

    const abcEditor = page.locator("#abc-editor-input");
    await abcEditor.fill(`${await abcEditor.inputValue()}\n% e2e edit`);

    const preview = page.locator("#abc-editor-preview");
    await expect(preview.locator("svg")).toBeVisible();
    await expect(preview.locator(".abcjs-top-line").first()).toBeVisible();
    await expect(page.locator("#abc-editor-render-error")).toHaveCount(0);

    await expect
      .poll(async () =>
        preview.evaluate((element) => {
          const staffLine = element.querySelector(".abcjs-top-line");
          return {
            previewColor: getComputedStyle(element).color,
            staffFill: staffLine ? getComputedStyle(staffLine).fill : null,
          };
        })
      )
      .toEqual({ previewColor: "rgb(0, 0, 0)", staffFill: "rgb(0, 0, 0)" });
  });
});
