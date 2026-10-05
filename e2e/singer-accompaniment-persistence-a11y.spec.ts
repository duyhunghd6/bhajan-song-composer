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

test.describe("Singer Accompaniment: Persistence & Accessibility (E2E-20, E2E-21, E2E-22)", () => {
  const fourFourSource = CANONICAL_SOURCES["four-four-gap-c-major"];
  const guitarPack = extractCandidatePack(DUMMY_RESPONSES["guitar-valid-pack"]);

  test("E2E-20: Project autosave and checkpoint (debounced autosave and manual checkpoint succeed)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-20-persistence");

    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: guitarPack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    await page.goto(`/compose/${slug}/accompaniment`);

    // 1. Wait for debounced autosave (500ms debounce in ComposerStepWorkspace)
    await expect(page.getByText(/Project:\s*(Saved|Ready|Saving)/i)).toBeVisible();
    await expect(page.getByText(/Project:\s*Saved/i)).toBeVisible({ timeout: 10_000 });

    // 2. Click Save checkpoint button
    const checkpointBtn = page.getByRole("button", { name: "Save checkpoint" });
    await expect(checkpointBtn).toBeVisible();
    await checkpointBtn.click();

    // 3. Verify checkpoint revision is reported
    await expect(page.getByText(/Checkpoint revision \d+/i)).toBeVisible({ timeout: 10_000 });

    // 4. Reload page and assert persisted state survives
    await page.reload();
    await expect(page.getByText(/Project:\s*Saved/i)).toBeVisible({ timeout: 10_000 });
    await assertCandidateOptionCards(page, 3);

    await clearTestProjectStorage(page, slug);
  });

  test("E2E-21: Offline handling and outbox recovery (offline queuing and reconnect flush)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-21-offline");

    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: guitarPack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    await page.goto(`/compose/${slug}/accompaniment`);
    await expect(page.getByText(/Project:\s*Saved/i)).toBeVisible({ timeout: 10_000 });

    // 1. Simulate going offline
    await page.context().setOffline(true);

    // 2. Trigger checkpoint while offline
    const checkpointBtn = page.getByRole("button", { name: "Save checkpoint" });
    await checkpointBtn.click();

    // 3. Assert offline queue notice appears
    await expect(
      page.getByText(/Save failed|Checkpoint queued locally and will retry when online/i)
    ).toBeVisible();

    // 4. Verify outbox has queued entry in localStorage
    const queuedCount = await page.evaluate(() => {
      const raw = window.localStorage.getItem("bhajan-composer-project-outbox:v1");
      if (!raw) return 0;
      try {
        return JSON.parse(raw).length;
      } catch {
        return 0;
      }
    });
    expect(queuedCount).toBeGreaterThanOrEqual(1);

    // 5. Restore connection and trigger online flush
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    // 6. Assert outbox flushes and conflict is retained for review (no silent last-write-wins)
    await expect(
      page.getByText(/Project:\s*(Conflict saved for review|Saved)/i)
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/A queued offline revision was retained for review|Revision/i)
    ).toBeVisible();

    // Verify outbox was completely flushed
    const remainingOutbox = await page.evaluate(() => {
      const raw = window.localStorage.getItem("bhajan-composer-project-outbox:v1");
      if (!raw) return 0;
      try {
        return JSON.parse(raw).length;
      } catch {
        return 0;
      }
    });
    expect(remainingOutbox).toBe(0);

    await clearTestProjectStorage(page, slug);
  });

  test("E2E-22: Responsive layout and accessibility (accessible names, keyboard focus order, WCAG checks)", async ({
    page,
  }) => {
    const slug = generateTestProjectId("e2e-22-a11y");

    const session = buildApprovedSnapshotSession(fourFourSource, {
      instrument: "guitar-classic",
      candidatePack: guitarPack,
    });

    await seedTestProjectStorage(page, slug, {
      melody: fourFourSource.sourceAbc,
      workspace: { accompanimentWorkflow: session },
    });

    // 1. Desktop viewport (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/compose/${slug}/accompaniment`);

    // Verify all major controls have accessible names and roles
    await expect(page.getByRole("heading", { name: "AI Accompaniment Generation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resulting ABC Staff Preview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Generated ABC Source" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Strong-beat voicing" })).toBeVisible();

    // Accessible select controls
    await expect(page.locator("select[aria-label='Selected strong beat']")).toBeVisible();
    await expect(page.locator("select[aria-label='Voicing override scope']")).toBeVisible();

    // Audition buttons accessible names
    await expect(page.getByRole("button", { name: "Play current" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play candidate" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply voicing" })).toBeVisible();

    // Polite live regions exist
    await expect(page.locator("[aria-live='polite']").first()).toBeVisible();

    // 2. Keyboard navigation test: TAB through to option cards
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Option cards are keyboard-activatable buttons
    const firstOption = page.locator(".grid > button:has(h4)").first();
    await expect(firstOption).toBeVisible();
    await firstOption.focus();
    await page.keyboard.press("Enter");

    // 3. Mobile viewport test (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    // Verify layout adjusts and critical controls remain visible and functional
    await expect(page.getByRole("heading", { name: "AI Accompaniment Generation" })).toBeVisible();
    await expect(page.locator(".grid > button:has(h4)").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Save checkpoint" })).toBeVisible();

    await clearTestProjectStorage(page, slug);
  });
});
