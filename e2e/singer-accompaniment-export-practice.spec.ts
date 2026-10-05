import { expect, test } from "@playwright/test";
import { CANONICAL_SOURCES } from "./fixtures/singer-accompaniment/sources";
import { DUMMY_RESPONSES } from "./fixtures/singer-accompaniment/responses";
import {
  assertRenderedNotation,
  buildApprovedSnapshotSession,
  clearTestProjectStorage,
  extractCandidatePack,
  generateTestProjectId,
  seedTestProjectStorage,
} from "./helpers/singer-accompaniment";

test.describe("Singer Accompaniment: Export Eligibility & Practice Isolation (E2E-18, E2E-19)", () => {
  const fourFourSource = CANONICAL_SOURCES["four-four-gap-c-major"];
  const guitarCandidatePack = extractCandidatePack(DUMMY_RESPONSES["guitar-valid-pack"]);

  test("E2E-18: Explicit export eligibility (only validated/applied layers selectable, no implicit publish)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-18-export-eligibility");

    // 1. Session where Step 3 is completed and Guitar is applied
    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: guitarCandidatePack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    // Navigate to Review / Export step
    await page.goto(`/compose/${slug}/review`);

    // 2. Verify export header and description
    await expect(page.getByRole("heading", { name: "Export selected notation layers" })).toBeVisible();
    await expect(
      page.getByText("Choose the validated layers to publish. Composer drafts stay local until this step succeeds.")
    ).toBeVisible();

    // 3. Verify no layer is selected by default (no implicit selection)
    const publishBtn = page.getByRole("button", { name: /Publish/i });
    await expect(publishBtn).toBeDisabled();

    // 4. Verify exportable layers listed
    const melodyCheckbox = page.getByRole("checkbox", { name: /^Melody Music Sheet/i });
    const harmonyCheckbox = page.getByRole("checkbox", { name: /^Validated Harmony/i });
    const accompCheckbox = page.getByRole("checkbox", { name: /^Accompaniment Arrangement/i });

    await expect(melodyCheckbox).toBeVisible();
    await expect(harmonyCheckbox).toBeVisible();
    await expect(accompCheckbox).toBeVisible();

    // Piano must be absent because it was never configured or generated
    await expect(page.locator("label:has-text('Piano Accompaniment')")).toHaveCount(0);

    // 5. Select Accompaniment layer
    await accompCheckbox.click();
    await expect(publishBtn).toBeEnabled();
    await expect(publishBtn).toHaveText(/Publish 1 layer/i);

    // 6. Select Melody layer as well
    await melodyCheckbox.click();
    await expect(publishBtn).toHaveText(/Publish 2 layers/i);

    // 7. Uncheck both layers -> publish is disabled again
    await accompCheckbox.click();
    await melodyCheckbox.click();
    await expect(publishBtn).toBeDisabled();

    await clearTestProjectStorage(page, slug);
  });

  test("E2E-19: Practice isolation (Practice fetches catalogue only, completely decoupled from local drafts)", async ({
    page,
    browser,
  }) => {
    const slug = generateTestProjectId("e2e-19-practice-isolation");

    // 1. In Composer context, create an unpublished local draft
    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: guitarCandidatePack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    await page.goto(`/compose/${slug}/accompaniment`);
    await expect(page.getByText("Devotional PIMA Arpeggio").first()).toBeVisible();

    // 2. Open Practice in a completely fresh, separate browser context
    const practiceContext = await browser.newContext();
    const practicePage = await practiceContext.newPage();

    // Practice loads published catalog song happy-birthday
    await practicePage.goto("/practice/happy-birthday");
    await assertRenderedNotation(practicePage);

    // 3. Verify Practice is not contaminated by Composer's unpublished draft
    const practicePageText = await practicePage.locator("body").innerText();
    expect(practicePageText).not.toContain(slug);
    expect(practicePageText).not.toContain("four-four-gap-c-major");

    // 4. In Composer context, edit the local draft
    const draftTextarea = page.locator("textarea[placeholder*='Optional: add style']");
    if (await draftTextarea.isVisible()) {
      await draftTextarea.fill("Local unpublished draft changes");
    }

    // 5. Verify Practice in the separate context remains completely stable
    await practicePage.reload();
    await assertRenderedNotation(practicePage);
    const reloadedText = await practicePage.locator("body").innerText();
    expect(reloadedText).not.toContain("Local unpublished draft changes");

    await practiceContext.close();
    await clearTestProjectStorage(page, slug);
  });
});
