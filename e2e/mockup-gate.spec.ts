import { expect, test } from "@playwright/test";

test.describe("mockup review gate", () => {
  test("shows integration remains locked until standalone POC pages are review-ready", async ({ page }) => {
    await page.goto("/mockups");

    await expect(page.getByRole("heading", { name: "Mockup Review Gate" })).toBeVisible();
    await expect(page.getByText("UNID: br-plan-09.c01")).toBeVisible();
    await expect(page.getByText("Integration locked", { exact: true })).toBeVisible();
    await expect(page.getByText("2 of 4 standalone POC gates review-ready")).toBeVisible();

    const arrangementGate = page.getByRole("listitem").filter({ hasText: "Arrangement Pipeline POC" });
    await expect(arrangementGate.getByText("Required before integration")).toBeVisible();
    await expect(arrangementGate.getByText("Not ready")).toBeVisible();

    const fingerstyleGate = page.getByRole("listitem").filter({ hasText: "Fingerstyle Engine POC" });
    await expect(fingerstyleGate.getByText("Review-ready standalone POC")).toBeVisible();
    await expect(fingerstyleGate.getByRole("link", { name: "Open standalone POC" })).toHaveAttribute(
      "href",
      "/mockups/fingerstyle-engine",
    );

    const pianoGate = page.getByRole("listitem").filter({ hasText: "Piano Accompaniment POC" });
    await expect(pianoGate.getByText("Required before integration")).toBeVisible();
    await expect(pianoGate.getByText("Not ready")).toBeVisible();

    const ensembleGate = page.getByRole("listitem").filter({ hasText: "Ensemble Expansion POC" });
    await expect(ensembleGate.getByText("Review-ready standalone POC")).toBeVisible();
    await expect(ensembleGate.getByRole("link", { name: "Open standalone POC" })).toHaveAttribute(
      "href",
      "/mockups/ensemble-expansion",
    );

    await expect(
      page.getByText("Major workflow integration is blocked until every POC renders input, decisions, final artifact, and validation end-to-end."),
    ).toBeVisible();
  });
});
