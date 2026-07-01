import { expect, test } from "@playwright/test";

const POC_PAGES = [
  "/mockups/arrangement-pipeline",
  "/mockups/fingerstyle-engine",
  "/mockups/piano-accompaniment",
  "/mockups/ensemble-expansion",
];

test.describe("POC integration handoff checklist", () => {
  for (const href of POC_PAGES) {
    test(`${href} exposes a review-ready handoff checklist`, async ({ page }) => {
      await page.goto(href);

      const handoff = page.getByRole("region", { name: "Integration handoff checklist" });
      await expect(handoff).toBeVisible();
      await expect(handoff.getByText("Review-ready for Composer integration")).toBeVisible();
      await expect(handoff.getByText("Composer integration: unlocked")).toBeVisible();

      await expect(handoff.getByText("Input sample rendered")).toBeVisible();
      await expect(handoff.getByText("Intermediate decisions rendered")).toBeVisible();
      await expect(handoff.getByText("Final artifact rendered")).toBeVisible();
      await expect(handoff.getByText("Validation report rendered")).toBeVisible();
    });
  }
});
