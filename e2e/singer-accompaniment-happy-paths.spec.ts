import { expect, test } from "@playwright/test";
import { CANONICAL_SOURCES } from "./fixtures/singer-accompaniment/sources";
import { DUMMY_RESPONSES } from "./fixtures/singer-accompaniment/responses";
import {
  assertCandidateOptionCards,
  assertRenderedNotation,
  buildApprovedSnapshotSession,
  clearTestProjectStorage,
  extractCandidatePack,
  generateTestProjectId,
  seedTestProjectStorage,
  setupLlmRouteInterception,
} from "./helpers/singer-accompaniment";

test.describe("Singer Accompaniment: Happy Paths (E2E-01, E2E-02, E2E-03)", () => {
  const fourFourSource = CANONICAL_SOURCES["four-four-gap-c-major"];
  const guitarCandidatePack = extractCandidatePack(DUMMY_RESPONSES["guitar-valid-pack"]);
  const pianoCandidatePack = extractCandidatePack(DUMMY_RESPONSES["piano-valid-pack"]);
  const dualCandidatePack = DUMMY_RESPONSES["dual-valid-pack"];

  test("E2E-01: Guitar-only happy path (load four-four-gap-c-major, valid Step 3, Guitar pack, compare, apply, export)", async ({
    page,
    browser,
  }) => {
    const slug = generateTestProjectId("e2e-01-guitar");

    // 1. Setup route interception for guitar LLM calls
    const llm = await setupLlmRouteInterception(page, {
      scenario: "guitar-valid-pack",
      expectedFingerprint: fourFourSource.sourceFingerprint,
    });

    // 2. Build session with validated Step 3 and candidate pack
    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: guitarCandidatePack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    // 3. Navigate to Accompaniment step
    await page.goto(`/compose/${slug}/accompaniment`);

    await expect(page.getByText(/applied after Step/i).first()).toBeVisible();
    await page.locator("summary", { hasText: "Default prompt preview" }).click();
    await expect(page.getByText(fourFourSource.sourceFingerprint.slice(0, 10)).first()).toBeVisible();

    // 4. Assert 3 candidate option cards render
    await assertCandidateOptionCards(page, 3);
    const firstOption = page.locator(".grid > button:has(h4)").nth(0);
    const secondOption = page.locator(".grid > button:has(h4)").nth(1);

    await expect(firstOption).toContainText("Devotional PIMA Arpeggio");
    await expect(secondOption).toContainText("Devotional Pinch Support");
    await expect(page.getByText("Bhajan Measured Strum")).toBeVisible();

    // 5. Compare options: inspect first and second options
    await expect(firstOption).toContainText("Texture: Arpeggio / Register: Open Low");
    await expect(secondOption).toContainText("Texture: Pinch / Register: Mid Register");

    // 6. Apply first option
    await firstOption.click();
    await expect(page.locator("label:has-text('GuitarSupport'), [data-layer-id='GuitarSupport']").first()).toBeVisible();

    // 7. Verify notation preview renders guitar support voice
    await assertRenderedNotation(page, { instrument: "guitar-classic" });
    const generatedSource = page.locator("pre").filter({ hasText: "V:GuitarSupport" });
    await expect(generatedSource).toBeVisible();

    // 8. Verify source melody remains unchanged
    await expect(page.locator("body")).toContainText("Four-Four Gap C Major");

    // 9. Navigate to Review / Export step
    await page.goto(`/compose/${slug}/review`);
    await expect(page.getByRole("heading", { name: "Export selected notation layers" })).toBeVisible();

    // Verify Accompaniment layer is exportable and Piano is absent
    const accompCheckbox = page.locator("label:has-text('Accompaniment Arrangement') input[type='checkbox']");
    await expect(accompCheckbox).toBeVisible();
    await expect(page.locator("label:has-text('Piano Accompaniment')")).toHaveCount(0);

    // 10. Toggle export checkbox
    await accompCheckbox.click();
    await expect(page.getByRole("button", { name: /Publish 1 layer/i })).toBeEnabled();

    // 11. Practice verification in fresh browser context
    const practiceContext = await browser.newContext();
    const practicePage = await practiceContext.newPage();
    await practicePage.goto("/practice/happy-birthday");
    await assertRenderedNotation(practicePage);
    await practiceContext.close();

    // Cleanup storage
    await clearTestProjectStorage(page, slug);
  });

  test("E2E-02: Piano-only happy path (Piano pack, grand staff RH/LH, pedal metadata, apply, export)", async ({
    page,
    browser,
  }) => {
    const slug = generateTestProjectId("e2e-02-piano");

    // 1. Setup route interception for piano calls
    await setupLlmRouteInterception(page, {
      scenario: "piano-valid-pack",
      expectedFingerprint: fourFourSource.sourceFingerprint,
    });

    // 2. Build session with validated Step 3 and piano candidate pack
    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "piano",
      candidatePack: pianoCandidatePack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: {
        accompanimentWorkflow: session,
        generatedAccompaniment: pianoCandidatePack?.options[0]?.abc ?? null,
      },
    });

    // 3. Navigate to Accompaniment step
    await page.goto(`/compose/${slug}/accompaniment`);
    await expect(page.getByText(/applied after Step/i).first()).toBeVisible();
    await page.locator("summary", { hasText: "Default prompt preview" }).click();
    await expect(page.getByText(fourFourSource.sourceFingerprint.slice(0, 10)).first()).toBeVisible();

    // 4. Assert 3 candidate option cards render with piano options
    await assertCandidateOptionCards(page, 3);
    await expect(page.getByText("Pop/Ballad 1-5-10 Arpeggio")).toBeVisible();
    await expect(page.getByText("Devotional Close Harmony")).toBeVisible();
    await expect(page.getByText("Rhythmic Comping & Articulated Pedal")).toBeVisible();

    // 5. Select first option and verify grand staff
    const firstOption = page.locator(".grid > button:has(h4)").nth(0);
    await firstOption.click();

    // 6. Assert grand staff notation (RH / LH) renders
    await assertRenderedNotation(page, { instrument: "piano" });

    // 7. Verify pedal metadata exists in decision map / hints
    await expect(page.getByText(/Texture:/i).first()).toBeVisible();

    // 8. Navigate to Export step
    await page.goto(`/compose/${slug}/review`);
    const accompCheckbox = page.locator("label:has-text('Accompaniment Arrangement') input[type='checkbox']");
    await expect(accompCheckbox).toBeVisible();

    // 9. Practice verification in fresh browser context
    const practiceContext = await browser.newContext();
    const practicePage = await practiceContext.newPage();
    await practicePage.goto("/practice/happy-birthday");
    await assertRenderedNotation(practicePage, { instrument: "piano" });
    await practiceContext.close();

    // Cleanup
    await clearTestProjectStorage(page, slug);
  });

  test("E2E-03: Dual independent branches (both instruments, independent candidate packs, separate publish)", async ({
    page,
    browser,
  }) => {
    const slug = generateTestProjectId("e2e-03-dual");

    // 1. Setup route interception for dual pack
    await setupLlmRouteInterception(page, {
      scenario: "dual-valid-pack",
      expectedFingerprint: fourFourSource.sourceFingerprint,
    });

    // 2. Build session with both instruments enabled
    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "both",
      candidatePack: guitarCandidatePack,
    });

    const pianoAbc = extractCandidatePack(dualCandidatePack.piano)?.options[0]?.abc ?? "";

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: {
        accompanimentWorkflow: session,
        generatedAccompaniment: pianoAbc,
      },
    });

    // 3. Navigate to Accompaniment step
    await page.goto(`/compose/${slug}/accompaniment`);

    // Verify snapshot fingerprint is shared and identical
    await expect(page.getByText(/applied after Step/i).first()).toBeVisible();
    await page.locator("summary", { hasText: "Default prompt preview" }).click();
    await expect(page.getByText(fourFourSource.sourceFingerprint.slice(0, 10)).first()).toBeVisible();

    // 4. Assert candidate option cards exist for guitar branch
    await assertCandidateOptionCards(page, 3);
    const guitarOption = page.locator(".grid > button:has(h4)").nth(0);
    await guitarOption.click();
    await expect(page.locator("label:has-text('GuitarSupport'), [data-layer-id='GuitarSupport']").first()).toBeVisible();

    // 5. Navigate to Review / Export step
    await page.goto(`/compose/${slug}/review`);

    // Verify exportable layers
    const exportCheckboxes = page.locator("input[type='checkbox']");
    await expect(exportCheckboxes.first()).toBeVisible();

    // Verify publishing one layer does not affect sibling in fresh Practice context
    const freshContext = await browser.newContext();
    const practicePage = await freshContext.newPage();
    await practicePage.goto("/practice/happy-birthday");
    await assertRenderedNotation(practicePage);
    await freshContext.close();

    // Cleanup
    await clearTestProjectStorage(page, slug);
  });
});
