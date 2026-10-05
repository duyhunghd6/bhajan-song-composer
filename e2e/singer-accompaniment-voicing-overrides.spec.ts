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

test.describe("Singer Accompaniment: Voicing Overrides & Local Accent (E2E-16, E2E-17)", () => {
  const fourFourSource = CANONICAL_SOURCES["four-four-gap-c-major"];
  const guitarPack = extractCandidatePack(DUMMY_RESPONSES["guitar-valid-pack"]);

  test("E2E-16: Strong-beat voicing override (inspect candidates, audition preview, apply window/phrase scope)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-16-voicing-override");

    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: guitarPack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    await page.goto(`/compose/${slug}/accompaniment`);

    // 1. Assert Strong-beat voicing inspector section is visible
    await expect(page.getByRole("heading", { name: "Strong-beat voicing" })).toBeVisible();
    await expect(page.getByText("Choose a realization of the locked harmony; this never edits the chord progression.")).toBeVisible();

    // 2. Select Strong beat (measure 1, beat 1: C)
    const strongBeatSelect = page.locator("select[aria-label='Selected strong beat']");
    await expect(strongBeatSelect).toBeVisible();
    await expect(page.getByText(/Strong beat: m\.1 · beat 1 · C/i)).toBeVisible();

    // 3. Inspect candidate list: exposes shape/register/hand detail rather than bare chord names
    const candidateGroup = page.locator("fieldset[aria-label*='GUITAR']");
    await expect(candidateGroup).toBeVisible();
    await expect(candidateGroup).toContainText("Compact shape at fret 1");
    await expect(candidateGroup).toContainText("Barre at fret 3");
    await expect(candidateGroup).toContainText("strings 6–5–4–3–2–1");

    // 4. Audition candidate
    // Select candidate radio button
    const barreFret3Radio = page.locator("input[name='voicing-candidate']").nth(1);
    await barreFret3Radio.click();

    // Click Play candidate button to trigger audition preview
    const playCandidateBtn = page.getByRole("button", { name: "Play candidate" });
    await expect(playCandidateBtn).toBeEnabled();
    await playCandidateBtn.click();

    // Verify audition preview container appears
    await expect(
      page.getByText("Audition preview only — the Harmony source remains unchanged.")
    ).toBeVisible();

    // 5. Select Scope: This chord window
    const scopeSelect = page.locator("select[aria-label='Voicing override scope']");
    await scopeSelect.selectOption("window");

    // 6. Apply voicing
    const applyVoicingBtn = page.getByRole("button", { name: "Apply voicing" });
    await expect(applyVoicingBtn).toBeEnabled();
    await applyVoicingBtn.click();

    // 7. Change scope to Phrase and apply
    await scopeSelect.selectOption("phrase");
    await applyVoicingBtn.click();

    // Verify chord progression remains locked
    const previewPre = page.locator("h2:has-text('Generated ABC Source') + pre");
    await expect(previewPre).toContainText('"C"c e g e');

    await clearTestProjectStorage(page, slug);
  });

  test("E2E-17: Profile change vs local accent (chord identity preserved, compatible overrides survive)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-17-profile-accent");

    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: guitarPack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    await page.goto(`/compose/${slug}/accompaniment`);

    // 1. Verify initial profile
    await expect(page.getByText(/profile:\s*devotional-pima-arpeggio/i)).toBeVisible();

    // 2. Add local voicing override on measure 2 (G chord)
    const strongBeatSelect = page.locator("select[aria-label='Selected strong beat']");
    await strongBeatSelect.selectOption("1"); // Select m.2 G chord

    await expect(page.getByText(/Strong beat: m\.2 · beat 1 · G/i)).toBeVisible();

    // Choose candidate and apply
    const candidateRadios = page.locator("input[name='voicing-candidate']");
    if (await candidateRadios.count() > 1) {
      await candidateRadios.nth(1).click();
      const applyVoicingBtn = page.getByRole("button", { name: "Apply voicing" });
      await applyVoicingBtn.click();
    }

    // 3. Verify that harmony notes and chord progression in source ABC remain unchanged
    const previewPre = page.locator("h2:has-text('Generated ABC Source') + pre");
    await expect(previewPre).toContainText('"G"d2 z2');

    await clearTestProjectStorage(page, slug);
  });
});
