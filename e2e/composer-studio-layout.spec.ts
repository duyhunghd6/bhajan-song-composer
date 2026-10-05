import { expect, test } from "@playwright/test";
import { convertAbcToTimeSliceGrid } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { analyzeAuthoritativeMelodyPlayability } from "@/lib/theory/fingerstyle-arranger/source-playability";
import { melodyDurationSteps } from "@/lib/theory/fingerstyle-arranger/time-slice-abc-renderer";
import { serializeFingerstyleMeasures } from "@/components/composer/workspace/fingerstyle-measure-persistence";
import { fingerprintAccompanimentSource, getHarmonyValidationAbc } from "@/lib/theory/accompaniment-workflow";
import { fourFourGapCMajor } from "./fixtures/singer-accompaniment/sources";
import { buildApprovedSnapshotSession, seedTestProjectStorage } from "./helpers/singer-accompaniment";

test.use({ colorScheme: "dark", baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:9974" });

const cases = [
  { step: "harmony", score: "#composer-harmony-preview", tool: '[aria-label="Harmony assistant"]', side: "right" },
  { step: "melody", score: "#abc-editor-preview", tool: "#abc-editor-input", side: "left" },
  { step: "accompaniment", score: "#composer-accompaniment-preview", tool: '[aria-label="Accompaniment assistant"]', side: "right" },
  { step: "guitar-fingerstyle", score: "#composer-master-guitar-preview", tool: '[aria-label="Fingerstyle line workflow"]', side: "right" },
  { step: "review", score: "#composer-export-preview", tool: '[aria-label="Export tools"]', side: "right" },
];

for (const item of cases) {
  test(`${item.step}: score starts below nav and tools adapt to narrow screens`, async ({ page }, testInfo) => {
    const slug = `studio-layout-${item.step}`;
    await page.setViewportSize({ width: 1600, height: 1000 });
    // These layout checks never invoke generation or write a durable project.
    await page.route("**/compose/**", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
    const workflow = buildApprovedSnapshotSession(fourFourGapCMajor);
    const harmony = getHarmonyValidationAbc(workflow)!;
    const measures = convertAbcToTimeSliceGrid(harmony, []);
    // A melody-only saved line supplies real fret numbers without an AI request.
    const anchors = analyzeAuthoritativeMelodyPlayability(measures, "beginner").anchors;
    for (const measure of measures) {
      measure.grid.forEach((step, index) => {
        const anchor = anchors.find(item => item.measure === measure.measure && item.step === step.step);
        if (anchor) step.tablature = [{ ...anchor.preferredPosition, finger: null, role: "melody", durationSteps: melodyDurationSteps(measure, index) }];
      });
    }
    await seedTestProjectStorage(page, slug, {
      melody: fourFourGapCMajor.sourceAbc,
      workspace: { accompanimentWorkflow: workflow },
      "fingerstyle-measures": serializeFingerstyleMeasures(measures, fingerprintAccompanimentSource(harmony)),
    });
    await page.goto(`/compose/${slug}/${item.step}`);
    const score = page.locator(item.score);
    await expect(score.locator("svg").first()).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Composer step progress" });
    const tool = page.locator(item.tool);
    await expect(tool).toBeVisible();
    const navBox = (await nav.boundingBox())!;
    const scoreBox = (await score.boundingBox())!;
    const toolBox = (await tool.boundingBox())!;
    // Only the compact playback toolbar separates navigation and the score.
    expect(scoreBox.y - (navBox.y + navBox.height)).toBeLessThan(100);
    expect(scoreBox.width).toBeGreaterThan(600);
    if (item.side === "right") expect(toolBox.x).toBeGreaterThan(scoreBox.x + scoreBox.width - 2);
    else expect(toolBox.x + toolBox.width).toBeLessThan(scoreBox.x);
    await expect(page.getByText("Main Workspace Canvas", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Shape your melody", { exact: true })).toHaveCount(0);
    const player = score.locator("../..");
    const play = player.getByRole("button", { name: "Play", exact: true });
    const pdf = player.getByRole("button", { name: "Download PDF", exact: true });
    const copy = player.getByRole("button", { name: "Copy ABCJS ABC", exact: true });
    await expect(pdf).toHaveText("");
    await expect(copy).toHaveText("");
    for (const button of [play, pdf, copy]) {
      await expect(button).toHaveCSS("height", "32px");
      await expect(button).toHaveCSS("width", "32px");
    }
    expect(Math.abs((await pdf.boundingBox())!.y - (await play.boundingBox())!.y)).toBeLessThan(10);
    await expect(page.getByText(/Space: play \/ stop/)).toHaveCount(0);
    const svgScale = await score.locator('svg[role="img"]').first().evaluate((svg) => (svg as SVGSVGElement).getScreenCTM()!.a);
    expect(svgScale).toBeGreaterThan(0.64);
    expect(svgScale).toBeLessThan(0.72);
    if (item.side === "right") expect(toolBox.width).toBeGreaterThan(600);
    await page.screenshot({ path: testInfo.outputPath(`${item.step}-desktop.png`), fullPage: true });
    if (item.step === "guitar-fingerstyle") {
      await expect(page.getByRole("button", { name: /Generate/ }).first()).toBeVisible();
      await expect(page.getByLabel("Player skill")).toBeVisible();
      await page.getByRole("checkbox", { name: "TAB", exact: true }).check();
      await expect(score.locator(".abcjs-tabNumber").first()).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("fingerstyle-tab-70-percent.png"), fullPage: true });
    }
    if (item.step === "review") await expect(page.getByRole("button", { name: /Publish/ })).toBeDisabled();
    await page.setViewportSize({ width: 1024, height: 768 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => (await tool.boundingBox())!.y > (await score.boundingBox())!.y).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath(`${item.step}-mobile.png`), fullPage: true });
  });
}

for (const step of ["accompaniment", "guitar-fingerstyle"]) {
  test(`${step}: missing harmony keeps the source score ahead of the prerequisite`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.route("**/compose/**", (route) => route.request().method() === "POST" ? route.abort() : route.continue());
    await seedTestProjectStorage(page, `studio-gate-${step}`, { melody: fourFourGapCMajor.sourceAbc });
    await page.goto(`/compose/studio-gate-${step}/${step}`);
    const score = page.locator(step === "accompaniment" ? "#composer-accompaniment-preview" : "#composer-fingerstyle-prerequisite");
    await expect(score.locator("svg").first()).toBeVisible();
    const prerequisite = page.getByRole("link", { name: "Choose your harmony →" });
    await expect(prerequisite).toBeVisible();
    expect((await prerequisite.boundingBox())!.x).toBeGreaterThan((await score.boundingBox())!.x);
    await expect(page.getByRole("button", { name: /Generate/ })).toHaveCount(0);
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`Harmony controls: ${colorScheme} tokens, intrinsic CTA and touch targets`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({ colorScheme, hasTouch: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.route("**/compose/**", route => route.request().method() === "POST" ? route.abort() : route.continue());
      const slug = `token-controls-${colorScheme}`;
      await seedTestProjectStorage(page, slug, { melody: fourFourGapCMajor.sourceAbc });
      await page.goto(`/compose/${slug}/harmony`);
      const assistant = page.getByRole("complementary", { name: "Harmony assistant" });
      const start = page.getByRole("button", { name: "Start shaping harmony →" });
      await expect(start).toBeVisible();
      await expect(start).toHaveCSS("height", "44px");
      expect((await start.boundingBox())!.width).toBeLessThan((await assistant.boundingBox())!.width - 48);
      await expect(start).toHaveCSS("background-color", "rgb(233, 165, 42)");
      await expect(start).toHaveCSS("color", "rgb(36, 26, 8)");
      await expect(assistant).toHaveCSS("background-color", colorScheme === "dark" ? "rgb(25, 25, 28)" : "rgb(255, 255, 255)");
      const pdf = page.getByRole("button", { name: "Download PDF", exact: true });
      await expect(pdf).toHaveCSS("width", "44px");
      await expect(pdf).toHaveCSS("height", "44px");
      await pdf.focus();
      await expect(pdf).toHaveCSS("outline-style", "solid");
      await expect(pdf).toHaveCSS("outline-width", "2px");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.screenshot({ path: testInfo.outputPath(`tokens-${colorScheme}-touch.png`), fullPage: true });
    } finally { await context.close(); }
  });
}
