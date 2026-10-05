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
} from "./helpers/singer-accompaniment";

test.describe("Singer Accompaniment: Musical Validation & Physics Repairs (E2E-08 to E2E-12)", () => {
  const fourFourSource = CANONICAL_SOURCES["four-four-gap-c-major"];
  const splitWindowSource = CANONICAL_SOURCES["split-window-four-four"];
  const sixEightSource = CANONICAL_SOURCES["six-eight-devotional-a-minor"];
  const highMelodySource = CANONICAL_SOURCES["high-melody-register"];
  const noSafeGapSource = CANONICAL_SOURCES["no-safe-gap"];
  const guitarStretchSource = CANONICAL_SOURCES["guitar-stretch-fail"];
  const pianoSpanSource = CANONICAL_SOURCES["piano-span-collision-fail"];

  test("E2E-08: Chord-window and meter alignment (split windows re-articulate, 6/8 preserves meter)", async ({
    page,
  }) => {
    const slugSplit = generateTestProjectId("e2e-08-split-window");
    const guitarPack = extractCandidatePack(DUMMY_RESPONSES["guitar-valid-pack"]);

    // 1. Split window 4/4 test
    const splitSession = buildApprovedSnapshotSession(splitWindowSource, {
      instrument: "guitar-classic",
      candidatePack: guitarPack,
    });

    await seedTestProjectStorage(page, slugSplit, {
      melody: splitWindowSource.sourceAbc,
      workspace: { accompanimentWorkflow: splitSession },
    });

    await page.goto(`/compose/${slugSplit}/harmony`);
    // Verify step grid displays progression
    const chordStepBtn = page.locator("button:has-text('2. Chords')").first();
    await chordStepBtn.click();
    // Chord progression summary contains split chords: C, G, F
    await expect(page.locator(".grid > button:has(h4)").first()).toBeVisible();
    await expect(page.getByText("C - C - G - F - G - C")).toBeVisible();

    await clearTestProjectStorage(page, slugSplit);

    // 2. Six-Eight meter test
    const slugSixEight = generateTestProjectId("e2e-08-six-eight");
    const sixEightSession = buildApprovedSnapshotSession(sixEightSource, {
      instrument: "guitar-classic",
      candidatePack: guitarPack,
    });

    await seedTestProjectStorage(page, slugSixEight, {
      melody: sixEightSource.sourceAbc,
      workspace: { accompanimentWorkflow: sixEightSession },
    });

    await page.goto(`/compose/${slugSixEight}/harmony`);
    // Verify meter detection in step 1
    const keyBeatsStepBtn = page.locator("button:has-text('Key & Beats')").first();
    await keyBeatsStepBtn.click();
    await expect(page.getByText("6/8 meter in key of Am")).toBeVisible();

    await clearTestProjectStorage(page, slugSixEight);
  });

  test("E2E-09: Singer-yield (register conflict avoidance and continuous fill suppression)", async ({
    page,
  }) => {
    const slugHigh = generateTestProjectId("e2e-09-singer-yield");
    const guitarPack = extractCandidatePack(DUMMY_RESPONSES["guitar-valid-pack"]);

    // 1. High melody register: vocal lead above accompaniment
    const highSession = buildApprovedSnapshotSession(highMelodySource, {
      instrument: "guitar-classic",
      candidatePack: guitarPack,
    });

    await seedTestProjectStorage(page, slugHigh, {
      melody: highMelodySource.sourceAbc,
      workspace: { accompanimentWorkflow: highSession },
    });

    await page.goto(`/compose/${slugHigh}/accompaniment`);

    // Verify candidate options are displayed
    await assertCandidateOptionCards(page, 3);
    const firstOption = page.locator(".grid > button:has(h4)").nth(0);
    // Devotional PIMA Arpeggio anchors in Open Low register below high vocal
    await expect(firstOption).toContainText("Register: Open Low");
    await firstOption.click();

    // Verify notation preview has V:GuitarSupport with low bass notes (C, and G,,)
    const previewPre = page.locator("pre").filter({ hasText: "V:GuitarSupport" });
    await expect(previewPre).toBeVisible();
    await expect(previewPre).toContainText("[C,E]");

    await clearTestProjectStorage(page, slugHigh);

    // 2. Continuous lyrics (no safe gap): comping profile suppresses intrusive fills
    const slugNoGap = generateTestProjectId("e2e-09-no-gap");
    const noGapSession = buildApprovedSnapshotSession(noSafeGapSource, {
      instrument: "guitar-classic",
      candidatePack: guitarPack,
    });

    await seedTestProjectStorage(page, slugNoGap, {
      melody: noSafeGapSource.sourceAbc,
      workspace: { accompanimentWorkflow: noGapSession },
    });

    await page.goto(`/compose/${slugNoGap}/accompaniment`);
    await assertCandidateOptionCards(page, 3);
    // Select measured strum candidate
    const strumOption = page.locator(".grid > button:has(h4)").nth(2);
    await expect(strumOption).toContainText("Bhajan Measured Strum");
    await strumOption.click();

    await clearTestProjectStorage(page, slugNoGap);
  });

  test("E2E-10: Guitar physics repair (flagged stretch at M3/B1 repaired to playable barre)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-10-guitar-repair");
    const repairPack = extractCandidatePack(DUMMY_RESPONSES["repair-guitar-physics"]);

    // Build session with repaired guitar candidate
    const session = buildApprovedSnapshotSession(guitarStretchSource, {
      instrument: "guitar-classic",
      candidatePack: repairPack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: guitarStretchSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    await page.goto(`/compose/${slug}/accompaniment`);

    // 1. Assert repaired option card renders with repair lineage and scope details
    await expect(page.getByRole("heading", { name: /Repaired Guitar Support/i })).toBeVisible();
    const repairCard = page.locator(".grid > button:has(h4)").first();
    await expect(repairCard).toContainText("Fret Span Resolved");
    await expect(repairCard).toContainText("Scoped: Measure 3 Only");
    await expect(repairCard).toContainText("shifted high fret reach to playable 1st-position F barre");

    // 2. Apply repaired option
    await repairCard.click();

    // 3. Verify notation preview renders playable V:GuitarSupport with measure 3 barre [F,,C]
    await assertRenderedNotation(page, { instrument: "guitar-classic" });
    const generatedSource = page.locator("pre").filter({ hasText: "V:GuitarSupport" });
    await expect(generatedSource).toBeVisible();
    await expect(generatedSource).toContainText("[F,,C] A, C F");

    await clearTestProjectStorage(page, slug);
  });

  test("E2E-11: Piano physics repair (span collision resolved with shifted register)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-11-piano-repair");
    const pianoRepairPack = extractCandidatePack(DUMMY_RESPONSES["repair-piano-span"]);

    const session = buildApprovedSnapshotSession(pianoSpanSource, {
      instrument: "piano",
      candidatePack: pianoRepairPack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: pianoSpanSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    await page.goto(`/compose/${slug}/accompaniment`);

    // 1. Assert repaired piano option card renders with resolution description
    await expect(page.getByRole("heading", { name: /Repaired Piano Accompaniment/i })).toBeVisible();
    const repairCard = page.locator(".grid > button:has(h4)").first();
    await expect(repairCard).toContainText("Hand Span & Collision Cleared");
    await expect(repairCard).toContainText("Scoped: Measure 2 Only");
    await expect(repairCard).toContainText("shifted RH to middle inversion [G B d]");

    // 2. Apply repaired piano option
    await repairCard.click();

    // 3. Verify staff preview renders and generated ABC source contains repair annotations
    await assertRenderedNotation(page, { instrument: "piano" });
    const generatedSource = page.locator("h2:has-text('Generated ABC Source') + pre");
    await expect(generatedSource).toBeVisible();
    await expect(generatedSource).toContainText("Repaired Piano Accompaniment (Span Resolved)");
    await expect(generatedSource).toContainText("Repair: Hand Span & Collision Cleared / Scoped: Measure 2 Only");

    await clearTestProjectStorage(page, slug);
  });

  test("E2E-12: Soft-rule exception review (declared suspended color marked as review, not false failure)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-12-soft-exception");
    const softPack = extractCandidatePack(DUMMY_RESPONSES["soft-exception"]);

    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: softPack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    await page.goto(`/compose/${slug}/accompaniment`);

    // 1. Assert 3 options rendered, including the soft exception option
    await assertCandidateOptionCards(page, 3);
    const softOption = page.locator(".grid > button:has(h4)").nth(0);
    await expect(softOption).toContainText("Devotional Suspended Color (Review Required)");
    await expect(softOption).toContainText("Exception: Third Omission");

    // 2. Assert that declared trade-off rationale is visible in validation notes
    await expect(softOption).toContainText("third-retention: Intentional suspended 4th and open fifth drone for meditative devotional mood");

    // 3. Select the soft exception option; it is usable with explicit rationale
    await softOption.click();
    const generatedSource = page.locator("pre").filter({ hasText: "V:GuitarSupport" });
    await expect(generatedSource).toBeVisible();
    await expect(generatedSource).toContainText("[C,F] G, C F");

    await clearTestProjectStorage(page, slug);
  });
});
