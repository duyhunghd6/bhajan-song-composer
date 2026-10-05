import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:9974" });

test("Harmony loads the music staff after a fresh navigation", async ({ page }) => {
  await page.goto("/compose/ganesha/harmony", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Loading Music Notation Renderer...")).toHaveCount(0);
  await expect(page.locator('svg[role="img"]').first()).toBeVisible();
  await expect(page.getByText("Could not load the ABC notation renderer.")).toHaveCount(0);

  const tempo = page.locator("#midi-tempo-value");
  const initialTempo = Number(await tempo.innerText());
  await page.getByRole("button", { name: "+", exact: true }).click();
  await expect(tempo).toHaveText(String(initialTempo + 5));
});
