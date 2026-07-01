import { expect, test } from "@playwright/test";

const POC_PAGES = [
  "/mockups/arrangement-pipeline",
  "/mockups/fingerstyle-engine",
  "/mockups/piano-accompaniment",
  "/mockups/ensemble-expansion",
];

const HANDOFF_CHECKS = [
  "Input sample rendered",
  "Intermediate decisions rendered",
  "Final artifact rendered",
  "Validation report rendered",
];

test.describe("POC integration handoff checklist", () => {
  for (const href of POC_PAGES) {
    test(`${href} exposes a review-ready handoff checklist`, async ({ page }) => {
      await page.goto(href);

      const handoff = page.getByRole("region", { name: "Integration handoff checklist" });
      await expect(handoff).toBeVisible();
      await expect(handoff.getByText("Review-ready for Composer integration")).toBeVisible();
      await expect(handoff.getByText("Composer integration: unlocked")).toBeVisible();

      for (const label of HANDOFF_CHECKS) {
        const row = handoff.getByRole("listitem").filter({ hasText: label });
        await expect(row).toBeVisible();
        await expect(row.getByText("pass", { exact: true })).toBeVisible();
      }
    });
  }
});
