import { expect, test } from "@playwright/test";

test.describe("beat annotation mockup", () => {
  test("keeps beat-only live editor icons between the Melody staff and TAB without overlap", async ({ page }) => {
    await page.goto("/test-beats");

    const canvas = page.locator("#live-editor-canvas");
    await expect(page.getByRole("heading", { name: "Interactive Beat Auto-Annotator" })).toBeVisible();
    await expect(canvas.locator("svg")).toBeVisible();
    await expect(canvas).toHaveClass(/has-lyrics/);

    const spacing = await canvas.evaluate((element) => {
      const melodyStaff = element.querySelector("g.abcjs-staff.abcjs-l0:not(.abcjs-tablature-staff)");
      const tabStaff = element.querySelector("g.abcjs-l0.abcjs-tablature-staff");
      
      // Find the first lyric element that contains a beat glyph
      const lyricNodes = Array.from(element.querySelectorAll("text.abcjs-lyric"));
      const firstBeat = lyricNodes.find(n => n.textContent?.trim() === "⬤");

      if (!melodyStaff || !tabStaff || !firstBeat) {
        return null;
      }

      const melodyBox = melodyStaff.getBoundingClientRect();
      const tabBox = tabStaff.getBoundingClientRect();
      const beatBox = firstBeat.getBoundingClientRect();

      return {
        beatText: firstBeat.textContent?.trim(),
        melodyToTabGap: tabBox.top - melodyBox.bottom,
        beatToTabGap: tabBox.top - beatBox.bottom,
        melodyToBeatGap: beatBox.top - melodyBox.bottom,
      };
    });

    expect(spacing).not.toBeNull();
    expect(spacing?.beatText).toBe("⬤");
    expect(spacing?.melodyToBeatGap).toBeGreaterThan(0);
    expect(spacing?.beatToTabGap).toBeGreaterThanOrEqual(0);
  });
});
