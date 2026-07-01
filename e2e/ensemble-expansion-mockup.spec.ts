import { expect, test } from "@playwright/test";

test.describe("ensemble expansion mockup page", () => {
  test("renders the ensemble expansion POC evidence needed by the review gate", async ({ page }) => {
    await page.goto("/mockups/ensemble-expansion");

    await expect(page.getByRole("heading", { name: "Ensemble Expansion Workstation" })).toBeVisible();
    await expect(page.getByText("UNID: br-plan-09.c05")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validation Passed" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Integration Handshake" })).toBeVisible();
    await expect(page.getByText("Layer 1 melody: ready")).toBeVisible();
    await expect(page.getByText("Layer 2 foundation: ready")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Rhythmic Density Grid" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bass Map" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Melodic Gaps" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Djembe Interlock" })).toBeVisible();
    await expect(page.getByText("layer2-bass-transient").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Flute / Violin Yield States" })).toBeVisible();
    await expect(page.getByText("Flute yield decisions")).toBeVisible();
    await expect(page.getByText("Violin yield decisions")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Conflict Report" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Combined Ensemble Preview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Layer 3 Ensemble Notation" })).toBeVisible();
    await expect(page.locator("#midi-btn-play")).toBeVisible();
  });
});
