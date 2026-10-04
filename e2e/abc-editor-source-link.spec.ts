import { expect, test, type Page } from "@playwright/test";

const linkAbc = `X:1
T:Source Link
M:4/4
L:1/8
K:C
| C2 D2 E2 F2 | "Am" G2 A2 B2 c2 |
w: do re mi fa | sol la ti do`;

const score = "#abc-editor-preview";
const editor = "#abc-editor-input";

async function openMelodyEditor(page: Page) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/compose/e2e-source-link/melody");
  await page.locator(editor).fill(linkAbc);
  await expect(page.locator(`${score} .abcjs-note`)).toHaveCount(8);
}

const selectedNotes = (page: Page) => page.locator(`${score} .abcjs-note.abcjs-source-selected`);

test.describe("ABC editor ↔ score source link", () => {
  test("a caret in the ABC source highlights the matching note", async ({ page }) => {
    await openMelodyEditor(page);

    await page.locator(`${editor} .tok-string`, { hasText: '"Am"' }).click();
    await expect(selectedNotes(page)).toHaveCount(1);
    await expect(selectedNotes(page)).toHaveClass(/abcjs-m1\b.*abcjs-n0\b|abcjs-n0\b.*abcjs-m1\b/);

    await page.locator(`${editor} .tok-variableName`, { hasText: /^E2$/ }).click();
    await expect(selectedNotes(page)).toHaveCount(1);
    await expect(selectedNotes(page)).toHaveClass(/abcjs-m0\b.*abcjs-n2\b|abcjs-n2\b.*abcjs-m0\b/);
  });

  test("a caret in a lyric syllable highlights the note it is sung on", async ({ page }) => {
    await openMelodyEditor(page);

    await page.locator(`${editor} .tok-labelName`, { hasText: /^ti$/ }).click();
    await expect(selectedNotes(page)).toHaveCount(1);
    await expect(selectedNotes(page)).toHaveClass(/abcjs-m1\b.*abcjs-n2\b|abcjs-n2\b.*abcjs-m1\b/);
  });

  test("clicking a score note selects its source and never starts playback", async ({ page }) => {
    await openMelodyEditor(page);

    const note = page.locator(`${score} .abcjs-note.abcjs-m1.abcjs-n2`);
    // abcjs hit-tests on the <svg> by coordinates, so click where the note is drawn.
    const box = await note.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    await expect(note).toHaveClass(/abcjs-source-selected/);
    await expect(page.locator(`${editor} .cm-activeLine`)).toContainText("B2 c2");
    await page.waitForTimeout(800);
    await expect(page.locator(`${score} .abcjs-note-active`)).toHaveCount(0);
  });
});
