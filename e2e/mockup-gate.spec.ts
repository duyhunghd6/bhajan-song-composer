import { expect, test } from "@playwright/test";

test.describe("mockup review gate", () => {
  test("shows integration unlocks when every standalone POC page is review-ready", async ({ page }) => {
    await page.goto("/mockups");

    await expect(page.getByRole("heading", { name: "Mockup Review Gate" })).toBeVisible();
    await expect(page.getByText("UNID: br-plan-09.c01")).toBeVisible();
    await expect(page.getByText("Integration unlocked", { exact: true })).toBeVisible();
    await expect(page.getByText("4 of 4 standalone POC gates review-ready")).toBeVisible();

    const arrangementGate = page.getByRole("listitem").filter({ hasText: "Arrangement Pipeline POC" });
    await expect(arrangementGate.getByText("Review-ready standalone POC")).toBeVisible();
    await expect(arrangementGate.getByRole("link", { name: "Open standalone POC" })).toHaveAttribute(
      "href",
      "/mockups/arrangement",
    );

    const fingerstyleGate = page.getByRole("listitem").filter({ hasText: "Fingerstyle Engine POC" });
    await expect(fingerstyleGate.getByText("Review-ready standalone POC")).toBeVisible();
    await expect(fingerstyleGate.getByRole("link", { name: "Open standalone POC" })).toHaveAttribute(
      "href",
      "/mockups/fingerstyle",
    );

    const pianoGate = page.getByRole("listitem").filter({ hasText: "Piano Accompaniment POC" });
    await expect(pianoGate.getByText("Review-ready standalone POC")).toBeVisible();
    await expect(pianoGate.getByRole("link", { name: "Open standalone POC" })).toHaveAttribute(
      "href",
      "/mockups/piano",
    );

    const ensembleGate = page.getByRole("listitem").filter({ hasText: "Ensemble Expansion POC" });
    await expect(ensembleGate.getByText("Review-ready standalone POC")).toBeVisible();
    await expect(ensembleGate.getByRole("link", { name: "Open standalone POC" })).toHaveAttribute(
      "href",
      "/mockups/ensemble",
    );

    await expect(
      page.getByText("Major workflow integration is blocked until every POC renders input, decisions, final artifact, and validation end-to-end."),
    ).toBeVisible();
  });

  test("keeps the shorter docs/UI.md mockup routes available", async ({ page }) => {
    await page.goto("/mockups/arrangement");
    await expect(page.getByRole("heading", { name: /Arrangement Pipeline/i })).toBeVisible();

    await page.goto("/mockups/fingerstyle");
    await expect(page.getByRole("heading", { name: "Fingerstyle Engine Workstation" })).toBeVisible();

    await page.goto("/mockups/piano");
    await expect(page.getByRole("heading", { name: /Piano Accompaniment/i })).toBeVisible();

    await page.goto("/mockups/ensemble");
    await expect(page.getByRole("heading", { name: /Ensemble Expansion/i })).toBeVisible();
  });
});
