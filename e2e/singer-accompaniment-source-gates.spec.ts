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
  setupLlmRouteInterception,
} from "./helpers/singer-accompaniment";
import {
  clearAccompanimentWorkflowStepResults,
  ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS,
  isAccompanimentWorkflowStepComplete,
} from "@/lib/theory/accompaniment-workflow";

test.describe("Singer Accompaniment: Source Gates (E2E-04, E2E-05, E2E-06, E2E-07)", () => {
  const fourFourSource = CANONICAL_SOURCES["four-four-gap-c-major"];
  const invalidAbcSource = CANONICAL_SOURCES["invalid-abc"];
  const invalidMeterSource = CANONICAL_SOURCES["invalid-meter-abc"];
  const twoSnapshotsSource = CANONICAL_SOURCES["two-step3-snapshots"];
  const guitarCandidatePack = extractCandidatePack(DUMMY_RESPONSES["guitar-valid-pack"]);

  test("E2E-04: Invalid melody gate (invalid-abc & invalid-meter-abc block Step 3 snapshot and publish)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-04-invalid-melody");

    // 1. Seed with invalid ABC syntax
    await seedTestProjectStorage(page, slug, {
      melody: invalidAbcSource.sourceAbc,
    });

    // 2. Navigate to Melody editor and verify content
    await page.goto(`/compose/${slug}/melody`);
    const editorTextarea = page.locator("#abc-editor-input");
    await expect(editorTextarea).toBeVisible();
    // The editor is CodeMirror (contenteditable), so compare its rendered lines.
    await expect(editorTextarea).toHaveText(invalidAbcSource.sourceAbc, { useInnerText: true });

    // 3. Attempt navigation to Accompaniment step
    await page.goto(`/compose/${slug}/accompaniment`);
    // Accompaniment step must require Harmony Step 3 validation first
    await expect(page.getByText("Harmony validation required")).toBeVisible();
    await expect(
      page.getByText("Select an option in Harmony step 3, Validate Harmony, before generating accompaniment branches.")
    ).toBeVisible();

    // 4. Navigate to Review / Export step
    await page.goto(`/compose/${slug}/review`);
    // Neither Harmony nor Accompaniment layers should be exportable
    await expect(page.locator("label:has-text('Accompaniment Arrangement')")).toHaveCount(0);
    await expect(page.locator("label:has-text('Validated Harmony')")).toHaveCount(0);
    await expect(
      page.getByText("Complete and select Harmony Step 3 before accompaniment or Guitar Fingerstyle can be exported.")
    ).toBeVisible();

    // 5. Repeat test with invalid-meter-abc
    await seedTestProjectStorage(page, slug, {
      melody: invalidMeterSource.sourceAbc,
    });

    await page.goto(`/compose/${slug}/accompaniment`);
    await expect(page.getByText("Harmony validation required")).toBeVisible();

    await page.goto(`/compose/${slug}/review`);
    await expect(page.locator("label:has-text('Accompaniment Arrangement')")).toHaveCount(0);

    // Cleanup storage
    await clearTestProjectStorage(page, slug);
  });

  test("E2E-05: Exact source selection (switching Step 3 snapshot marks drafts stale and blocks publish)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-05-exact-source");

    // 1. Build session based on Snapshot A
    const snapshotA = twoSnapshotsSource.snapshotA;
    const sessionA = buildApprovedSnapshotSession(snapshotA, {
      instrument: "guitar-classic",
      candidatePack: guitarCandidatePack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: snapshotA.sourceAbc,
      workspace: { accompanimentWorkflow: sessionA },
    });

    // 2. Open Accompaniment step with Snapshot A; verify candidate options
    await page.goto(`/compose/${slug}/accompaniment`);
    await expect(page.locator(".grid > button:has(h4)").first()).toContainText("Devotional PIMA Arpeggio");

    // 3. Switch source melody/snapshot to Snapshot B (different fingerprint)
    const snapshotB = twoSnapshotsSource.snapshotB;
    await seedTestProjectStorage(page, slug, {
      melody: snapshotB.sourceAbc,
      workspace: { accompanimentWorkflow: sessionA },
    });

    // 4. Check Harmony step shows stale notice and reset button
    await page.goto(`/compose/${slug}/harmony`);
    await expect(
      page.getByText("The melody or harmonized ABC changed since the saved workflow was created.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset Workflow for Current ABC" })).toBeVisible();

    // 5. Check Accompaniment step blocks generation until Harmony is re-validated
    await page.goto(`/compose/${slug}/accompaniment`);
    await expect(page.getByText("Harmony validation required")).toBeVisible();

    // 6. Navigate to Review / Export step and assert publish is blocked
    await page.goto(`/compose/${slug}/review`);
    await expect(
      page.getByText("Harmony and accompaniment selections were created for an older melody draft and cannot be exported.")
    ).toBeVisible();
    await expect(page.locator("label:has-text('Accompaniment Arrangement')")).toHaveCount(0);

    // Cleanup storage
    await clearTestProjectStorage(page, slug);
  });

  test("E2E-06: Melody invalidation (editing melody makes accompaniment stale, Practice isolated)", async ({
    page,
    browser,
  }) => {
    const slug = generateTestProjectId("e2e-06-melody-invalidation");

    // 1. Set up valid guitar session on fourFourSource
    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: guitarCandidatePack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    // 2. Navigate to Accompaniment step, select option
    await page.goto(`/compose/${slug}/accompaniment`);
    const firstOption = page.locator(".grid > button:has(h4)").nth(0);
    await firstOption.click();

    // 3. Navigate to Review and verify exportable
    await page.goto(`/compose/${slug}/review`);
    const accompCheckbox = page.locator("label:has-text('Accompaniment Arrangement') input[type='checkbox']");
    await expect(accompCheckbox).toBeVisible();
    await accompCheckbox.click();
    await expect(page.getByRole("button", { name: /Publish 1 layer/i })).toBeEnabled();

    // 4. Now modify the melody ABC (pitch change in measure 1)
    const modifiedMelody = fourFourSource.sourceAbc.replace("c e g e", "c e g g");
    await seedTestProjectStorage(page, slug, {
      melody: modifiedMelody,
      workspace: { accompanimentWorkflow: session },
    });

    // 5. Navigate to Harmony step; verify stale notification
    await page.goto(`/compose/${slug}/harmony`);
    await expect(
      page.getByText("The melody or harmonized ABC changed since the saved workflow was created.")
    ).toBeVisible();

    // 6. Navigate to Accompaniment step; verify blocked until revalidated
    await page.goto(`/compose/${slug}/accompaniment`);
    await expect(page.getByText("Harmony validation required")).toBeVisible();

    // 7. Navigate to Review step; verify accompaniment is stale & cannot be exported
    await page.goto(`/compose/${slug}/review`);
    await expect(
      page.getByText("Harmony and accompaniment selections were created for an older melody draft and cannot be exported.")
    ).toBeVisible();
    await expect(page.locator("label:has-text('Accompaniment Arrangement')")).toHaveCount(0);

    // 8. Practice verification in fresh browser context (must still show stable published catalog)
    const practiceContext = await browser.newContext();
    const practicePage = await practiceContext.newPage();
    await practicePage.goto("/practice/happy-birthday");
    await assertRenderedNotation(practicePage);
    await practiceContext.close();

    // Cleanup storage
    await clearTestProjectStorage(page, slug);
  });

  test("E2E-07: Branch-local invalidation (clearing Guitar does not invalidate Piano)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-07-branch-local");

    // 1. Build session with both Guitar and Harmonium/Piano enabled
    const dualPack = DUMMY_RESPONSES["dual-valid-pack"];
    const guitarPack = extractCandidatePack(dualPack.guitar)!;
    const pianoPack = extractCandidatePack(dualPack.piano)!;

    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "both",
      candidatePack: guitarPack,
    });

    // Also populate harmonium step with piano pack options
    const pianoOptions = pianoPack.options.map((opt) => ({
      id: opt.optionId,
      label: opt.label,
      summary: opt.diversityLabel,
      justification: opt.rationale,
      data: {
        abc: opt.abc,
        decisionMap: opt.decisionMap,
      },
      warnings: [],
      validationNotes: [],
    }));

    (session.steps as Record<string, unknown>)["harmonium-drone-register"] = {
      runs: [
        {
          id: "run-piano-test",
          createdAt: new Date().toISOString(),
          stepId: "harmonium-drone-register",
          requestPrompt: "Generate harmonium / piano options",
          userNote: "",
          options: pianoOptions,
        },
      ],
      activeRunId: "run-piano-test",
      selectedOptionId: pianoOptions[0].id,
      selectedAt: new Date().toISOString(),
      promptNote: "",
    };

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    // 2. Open Accompaniment step
    await page.goto(`/compose/${slug}/accompaniment`);

    // Verify both guitar and harmonium steps exist
    const clearGuitarBtn = page.getByRole("button", { name: "Clear Guitar Result Set" });
    await expect(clearGuitarBtn).toBeVisible();

    // 3. Clear Guitar branch work
    await clearGuitarBtn.click();

    // 4. Verify Guitar step results were cleared
    await expect(
      page.getByText("No LLM output stored for this step yet.")
    ).toBeVisible();

    // 5. Navigate to Harmonium step via step grid
    const harmoniumStepBtn = page.locator("button:has-text('Harmonium Drone')").first();
    await harmoniumStepBtn.click();

    // 6. Verify Piano / Harmonium selected option is still complete and intact!
    await expect(page.getByRole("heading", { name: "Piano Ballad Foundation" })).toBeVisible();
    await expect(page.locator("span.rounded-full", { hasText: "Selected" })).toBeVisible();

    // Cleanup storage
    await clearTestProjectStorage(page, slug);
  });
});
