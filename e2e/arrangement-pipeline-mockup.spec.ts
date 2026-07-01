import { expect, test } from "@playwright/test";

test.describe("arrangement pipeline mockup page", () => {
  test("renders the arrangement pipeline POC evidence needed by the review gate", async ({ page }) => {
    await page.goto("/mockups/arrangement-pipeline");

    await expect(page.getByRole("heading", { name: "Arrangement Pipeline Workstation" })).toBeVisible();
    await expect(page.getByText("UNID: br-plan-09.c02")).toBeVisible();
    await expect(page.getByText("Validation Passed", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Melody Input" })).toBeVisible();
    await expect(page.getByText("Key: Em")).toBeVisible();
    await expect(page.getByText("Scale: natural minor")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Strong Beats & Chord Decisions" })).toBeVisible();
    await expect(page.getByText("Strong beat").first()).toBeVisible();
    await expect(page.getByText("Cadence role").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Layer 2 Accompaniment" })).toBeVisible();
    await expect(page.getByText("Voice-leading distance").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Full-Track Decisions" })).toBeVisible();
    await expect(page.getByText("Bass/kick alignment", { exact: true })).toBeVisible();
    await expect(page.getByText("Counter-melody gap fills", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Combined Full-Track Preview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validation Checklist" })).toBeVisible();
    await expect(page.locator("#midi-btn-play")).toBeVisible();
  });
});
