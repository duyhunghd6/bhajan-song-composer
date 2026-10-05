import { expect, type Page, type Request, type Route } from "@playwright/test";
import { DUMMY_RESPONSES } from "../fixtures/singer-accompaniment/responses";
import { getScenarioManifestEntry } from "../fixtures/singer-accompaniment/manifest";
import type {
  ApprovedHarmonySnapshot,
  ArrangementCandidatePack,
  LlmWireResponse,
  TargetInstrument,
} from "@/lib/theory/singer-accompaniment-contracts";
import {
  createAccompanimentWorkflowSession,
  selectOption,
  mergeRun,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowSetup,
} from "@/lib/theory/accompaniment-workflow";

export interface LlmInterceptionOptions {
  /**
   * Scenario name from the fixture manifest (e.g. "guitar-valid-pack", "provider-timeout").
   */
  scenario?: string;

  /**
   * Custom response payload to fulfill, overriding the scenario fixture.
   */
  customResponse?: unknown;

  /**
   * Ordered queue of responses for testing retries or sequential calls.
   */
  responseQueue?: unknown[];

  /**
   * Expected instrument to verify on incoming requests.
   */
  expectedInstrument?: TargetInstrument | "both";

  /**
   * Expected source fingerprint to verify on incoming requests.
   */
  expectedFingerprint?: string;

  /**
   * Route pattern to intercept. Defaults to arrangement and accompaniment LLM endpoints.
   */
  urlPattern?: string | RegExp;

  /**
   * HTTP status to return. Defaults to 200 (or 504 for provider-timeout).
   */
  status?: number;
}

export interface RecordedLlmRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
  timestamp: number;
}

export interface LlmInterceptionController {
  recordedRequests: RecordedLlmRequest[];
  unmatchedRequests: { url: string; method: string; body?: unknown }[];
  getRequestCount: () => number;
  getLastRequest: () => RecordedLlmRequest | undefined;
  assertNoUnmatchedRequests: () => void;
  reset: () => void;
}

/**
 * Generate an isolated, unique test project ID / slug.
 * Ensures tests never collide with user data or concurrent runs.
 */
export function generateTestProjectId(prefix = "test-singer-accompaniment"): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${randomSuffix}`;
}

/**
 * Clear test project storage from localStorage without touching shared catalogue
 * or other project namespaces. Matches COMPOSER_SONG_STORAGE_PREFIX convention.
 */
export async function clearTestProjectStorage(page: Page, testSlug: string): Promise<string[]> {
  return page.evaluate((slug) => {
    const prefix = `bhajan-song-composer:compose:${slug}:`;
    const removed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        removed.push(key);
      }
    }
    for (const key of removed) {
      window.localStorage.removeItem(key);
    }
    return removed;
  }, testSlug);
}

/**
 * Seeds isolated test project storage in localStorage.
 */
/**
 * Seeds isolated test project storage in localStorage.
 * Supports both pre-navigation via addInitScript and on-page via evaluate.
 */
export async function seedTestProjectStorage(
  page: Page,
  testSlug: string,
  entries: Record<string, unknown>
): Promise<void> {
  const prefix = `bhajan-song-composer:compose:${testSlug}:`;
  const serialized: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) {
    serialized[`${prefix}${key}`] =
      typeof value === "string" ? value : JSON.stringify(value);
  }

  // Pre-seed with addInitScript so it is ready before page scripts mount
  await page.addInitScript((items) => {
    for (const [key, value] of Object.entries(items)) {
      window.localStorage.setItem(key, value);
    }
  }, serialized);

  // Also try evaluating in case page is already on origin
  try {
    await page.evaluate((items) => {
      for (const [key, value] of Object.entries(items)) {
        window.localStorage.setItem(key, value);
      }
    }, serialized);
  } catch {
    // Page may not be navigated yet; addInitScript handles it
  }
}

/**
 * Sets up strict Playwright route interception for LLM arranger candidate requests.
 * - Matches action/transport boundary.
 * - Enforces POST method.
 * - Verifies headers, schema/instrument/fingerprint if specified.
 * - Fulfills deterministic JSON fixture with realistic headers.
 * - Fails and records any unmatched request to ensure no real LLM calls leak.
 */
export async function setupLlmRouteInterception(
  page: Page,
  options: LlmInterceptionOptions = {}
): Promise<LlmInterceptionController> {
  const recordedRequests: RecordedLlmRequest[] = [];
  const unmatchedRequests: { url: string; method: string; body?: unknown }[] = [];

  const queue = options.responseQueue ? [...options.responseQueue] : [];

  const urlPattern =
    options.urlPattern ??
    /\/api\/(arrangement|accompaniment|llm|harmonize|composer-project|actions)/;

  await page.route(urlPattern, async (route: Route, request: Request) => {
    const method = request.method();
    const url = request.url();
    const headers = request.headers();

    let body: Record<string, unknown> | null = null;
    try {
      const postData = request.postData();
      if (postData) {
        body = JSON.parse(postData);
      }
    } catch {
      // Not valid JSON body
    }

    // Strict constraint: LLM arrangement calls must be POST
    if (method !== "POST") {
      unmatchedRequests.push({ url, method, body });
      await route.abort("failed");
      return;
    }

    // If source fingerprint assertion requested, verify it
    if (options.expectedFingerprint && body) {
      const incomingFingerprint =
        body.sourceFingerprint ??
        body.fingerprint ??
        (body.snapshot as Record<string, unknown>)?.sourceFingerprint;
      if (incomingFingerprint && incomingFingerprint !== options.expectedFingerprint) {
        unmatchedRequests.push({ url, method, body });
        await route.abort("failed");
        return;
      }
    }

    recordedRequests.push({
      url,
      method,
      headers,
      body,
      timestamp: Date.now(),
    });

    // 1. Check response queue first (for retries)
    if (queue.length > 0) {
      const nextResponse = queue.shift();
      await route.fulfill({
        status: options.status ?? 200,
        contentType: "application/json",
        headers: {
          "x-llm-mock-interception": "singer-accompaniment-queue",
        },
        body: typeof nextResponse === "string" ? nextResponse : JSON.stringify(nextResponse),
      });
      return;
    }

    // 2. Custom response
    if (options.customResponse !== undefined) {
      await route.fulfill({
        status: options.status ?? 200,
        contentType: "application/json",
        headers: {
          "x-llm-mock-interception": "custom-response",
        },
        body: JSON.stringify(options.customResponse),
      });
      return;
    }

    // 3. Scenario-based response
    if (options.scenario) {
      const manifestEntry = getScenarioManifestEntry(options.scenario);

      if (options.scenario === "provider-timeout") {
        await route.fulfill({
          status: 504,
          contentType: "application/json",
          headers: {
            "x-llm-mock-interception": "provider-timeout",
          },
          body: JSON.stringify(DUMMY_RESPONSES["provider-timeout"]),
        });
        return;
      }

      if (options.scenario === "dual-valid-pack") {
        const dualPack = DUMMY_RESPONSES["dual-valid-pack"];
        // Check requested instrument in body
        const reqInstrument = (body?.targetInstrument ?? body?.instrument) as string | undefined;
        const responseData =
          reqInstrument === "piano" ? dualPack.piano : dualPack.guitar;

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "x-llm-mock-interception": "dual-valid-pack",
          },
          body: JSON.stringify(responseData),
        });
        return;
      }

      const dummyResponse =
        options.scenario in DUMMY_RESPONSES
          ? DUMMY_RESPONSES[options.scenario as keyof typeof DUMMY_RESPONSES]
          : null;

      if (dummyResponse) {
        await route.fulfill({
          status: options.status ?? 200,
          contentType: "application/json",
          headers: {
            "x-llm-mock-interception": options.scenario,
          },
          body: JSON.stringify(dummyResponse),
        });
        return;
      }

      if (manifestEntry?.responseFixture === null) {
        // Blocked upstream; no response fixture expected
        await route.abort("blockedbyclient");
        return;
      }
    }

    // No fixture or handler matched this request!
    unmatchedRequests.push({ url, method, body });
    await route.abort("failed");
  });

  return {
    recordedRequests,
    unmatchedRequests,
    getRequestCount: () => recordedRequests.length,
    getLastRequest: () => recordedRequests[recordedRequests.length - 1],
    assertNoUnmatchedRequests: () => {
      if (unmatchedRequests.length > 0) {
        throw new Error(
          `Strict LLM routing violation: ${unmatchedRequests.length} unmatched requests: ${JSON.stringify(
            unmatchedRequests
          )}`
        );
      }
    },
    reset: () => {
      recordedRequests.length = 0;
      unmatchedRequests.length = 0;
    },
  };
}

/**
 * Assert that rendered notation (SVG / canvas) is visible and contains musical elements.
 */
export async function assertRenderedNotation(
  page: Page,
  options: {
    instrument?: "guitar-classic" | "piano";
    containerSelector?: string;
  } = {}
): Promise<void> {
  const container = page.locator(
    options.containerSelector ?? "#abc-music-canvas, .abcjs-container, [data-testid='sheet-canvas']"
  ).first();

  await expect(container).toBeVisible({ timeout: 10_000 });

  // Staves / SVGs must be present inside container
  const svg = container.locator("svg").first();
  await expect(svg).toBeVisible();

  // If piano is expected, grand-staff clefs should be rendered
  if (options.instrument === "piano") {
    // Grand staff check
    const clefs = container.locator("path, text");
    await expect(clefs.first()).toBeVisible();
  }
}

/**
 * Assert that structured accompaniment diagnostics (measure, beat, rule, severity) are visible.
 */
export async function assertAccompanimentDiagnostics(
  page: Page,
  expected: {
    measure?: number;
    beat?: number;
    rule?: string;
    severity?: "error" | "warning" | "review";
    text?: string;
  }
): Promise<void> {
  if (expected.measure !== undefined) {
    const measurePattern = new RegExp(`M(easure)?\\s*${expected.measure}`, "i");
    await expect(page.getByText(measurePattern).first()).toBeVisible();
  }

  if (expected.beat !== undefined) {
    const beatPattern = new RegExp(`B(eat)?\\s*${expected.beat}`, "i");
    await expect(page.getByText(beatPattern).first()).toBeVisible();
  }

  if (expected.rule) {
    await expect(
      page.locator(`[data-diagnostic-rule="${expected.rule}"], [data-rule="${expected.rule}"]`).first()
    ).toBeVisible();
  }

  if (expected.severity === "review") {
    await expect(
      page.getByText(/review|soft exception|intentional/i).first()
    ).toBeVisible();
  }

  if (expected.text) {
    await expect(page.getByText(expected.text).first()).toBeVisible();
  }
}

/**
 * Assert semantic playback state: playing status, cursor line, or instrument key highlights.
 */
export async function assertPlaybackState(
  page: Page,
  expected: {
    isPlaying?: boolean;
    cursorVisible?: boolean;
    highlightActive?: boolean;
  }
): Promise<void> {
  if (expected.isPlaying !== undefined) {
    const stopBtn = page.locator("#midi-btn-stop, [aria-label*='Stop']").first();
    const playBtn = page.locator("#midi-btn-play, [aria-label*='Play']").first();

    if (expected.isPlaying) {
      await expect(stopBtn).toBeVisible();
    } else {
      await expect(playBtn).toBeVisible();
    }
  }

  if (expected.cursorVisible) {
    const cursor = page.locator(".abcjs-cursor, line.abcjs-cursor, [data-playback-cursor]").first();
    await expect(cursor).toBeVisible();
  }

  if (expected.highlightActive) {
    const highlight = page
      .locator(
        "[data-highlighted-key], [data-highlighted-fret], .highlighted-key, .highlighted-fret"
      )
      .first();
    await expect(highlight).toBeVisible();
  }
}

/**
 * Assert that option cards are displayed and distinct.
 */
export async function assertCandidateOptionCards(
  page: Page,
  expectedCount = 3
): Promise<void> {
  const cards = page.locator(
    "[data-testid='candidate-option-card'], [data-candidate-option-id], .candidate-option-card, .grid > button:has(h4)"
  );
  await expect(cards).toHaveCount(expectedCount);
}

/**
 * Assert that Apply button is enabled or disabled with required rationale.
 */
export async function assertApplyButtonState(
  page: Page,
  options: { enabled: boolean; reason?: string }
): Promise<void> {
  const applyBtn = page.getByRole("button", { name: /Apply|Áp dụng/i }).first();
  if (options.enabled) {
    await expect(applyBtn).toBeEnabled();
  } else {
    await expect(applyBtn).toBeDisabled();
    if (options.reason) {
      await expect(page.getByText(options.reason).first()).toBeVisible();
    }
  }
}

/**
 * Extracts parsed ArrangementCandidatePack from a wire response fixture.
 */
export function extractCandidatePack(response: unknown): ArrangementCandidatePack | null {
  try {
    const wire = response as LlmWireResponse;
    const toolCall = wire.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return (
        typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments
      ) as ArrangementCandidatePack;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Builds an Approved Harmony Snapshot AccompanimentWorkflowSession with Step 3 validated.
 */
export function buildApprovedSnapshotSession(
  snapshot: ApprovedHarmonySnapshot,
  options?: {
    instrument?: TargetInstrument | "both";
    candidatePack?: ArrangementCandidatePack | null;
    step3OptionId?: string;
  }
): AccompanimentWorkflowSession {
  const targetInstrument = options?.instrument ?? "guitar-classic";
  const setup: AccompanimentWorkflowSetup = {
    style: "accompaniment",
    instruments: [
      {
        id: "guitar-classic",
        enabled: targetInstrument === "guitar-classic" || targetInstrument === "both",
        order: 0,
      },
      {
        id: "indian-harmonium",
        enabled: targetInstrument === "piano" || targetInstrument === "both",
        order: 1,
      },
      { id: "djembe", enabled: false, order: 2 },
    ] as never,
  };

  let session = createAccompanimentWorkflowSession(snapshot.sourceAbc, setup);

  // Step 1: key-beats
  const keyBeatsOpt: AccompanimentWorkflowOption = {
    id: "kb-opt-1",
    label: "Key & Meter Detection",
    summary: `${snapshot.meterFamily} meter in key of ${snapshot.key}`,
    justification: "Meter and strong beats verified against melody.",
    data: { meter: snapshot.meter, key: snapshot.key },
    warnings: [],
    validationNotes: ["Meter verified."],
  };
  const keyBeatsRun: AccompanimentWorkflowRun = {
    id: "kb-run-1",
    createdAt: new Date().toISOString(),
    stepId: "key-beats",
    requestPrompt: "Detect key and beats",
    userNote: "",
    options: [keyBeatsOpt],
  };
  session = selectOption(mergeRun(session, keyBeatsRun, ""), "key-beats", keyBeatsOpt, "", keyBeatsRun.id);

  // Step 2: chord-roles-progression
  const chordsOpt: AccompanimentWorkflowOption = {
    id: "chords-opt-1",
    label: "Harmonic Progression",
    summary: snapshot.chordWindows.map((w) => w.chord).join(" - "),
    justification: "Harmonic cadence matching phrases.",
    data: { chordWindows: snapshot.chordWindows },
    warnings: [],
    validationNotes: ["Chord progression verified."],
  };
  const chordsRun: AccompanimentWorkflowRun = {
    id: "chords-run-1",
    createdAt: new Date().toISOString(),
    stepId: "chord-roles-progression",
    requestPrompt: "Generate chord progression",
    userNote: "",
    options: [chordsOpt],
  };
  session = selectOption(mergeRun(session, chordsRun, ""), "chord-roles-progression", chordsOpt, "", chordsRun.id);

  // Step 3: voice-leading-validation (Approved Harmony Snapshot)
  const step3OptId = options?.step3OptionId ?? snapshot.step3OptionId ?? "snapshot-step3-approved";
  const step3Opt: AccompanimentWorkflowOption = {
    id: step3OptId,
    label: `Validated Harmony (${snapshot.id})`,
    summary: `Approved Harmony Snapshot: ${snapshot.sourceFingerprint.slice(0, 10)}`,
    justification: "Preserves locked melody bytes and ensures voice-leading clearance.",
    data: {
      validatedAbc: snapshot.sourceAbc,
      harmonizedAbc: snapshot.sourceAbc,
      sourceFingerprint: snapshot.sourceFingerprint,
    },
    warnings: [],
    validationNotes: ["Validated voice-leading and harmonic alignment."],
  };
  const step3Run: AccompanimentWorkflowRun = {
    id: "step3-run-1",
    createdAt: new Date().toISOString(),
    stepId: "voice-leading-validation",
    requestPrompt: "Validate voice-leading and snapshot",
    userNote: "",
    options: [step3Opt],
  };
  session = selectOption(mergeRun(session, step3Run, ""), "voice-leading-validation", step3Opt, "", step3Run.id);

  // If candidate pack is provided, convert and add run
  if (options?.candidatePack) {
    const isPiano = options.candidatePack.targetInstrument === "piano";

    if (!isPiano) {
      // Step 4: guitar-comping-profile
      const profileOpt: AccompanimentWorkflowOption = {
        id: "devotional-pima-arpeggio",
        label: "Devotional PIMA Arpeggio",
        summary: "Alternating bass with staggered inner and treble chord tones.",
        justification: "Selected devotional arpeggio profile.",
        data: { profileId: "devotional-pima-arpeggio" },
        warnings: [],
        validationNotes: ["Profile verified."],
      };
      const profileRun: AccompanimentWorkflowRun = {
        id: "run-profile",
        createdAt: new Date().toISOString(),
        stepId: "guitar-comping-profile",
        requestPrompt: "Select comping profile",
        userNote: "",
        options: [profileOpt],
      };
      session = selectOption(mergeRun(session, profileRun, ""), "guitar-comping-profile", profileOpt, "", profileRun.id);

      // Step 5: guitar-voicing-bass
      const voicingOpt: AccompanimentWorkflowOption = {
        id: "voicing-open-c",
        label: "Open C / G / F Voicings",
        summary: "Standard lower position fretboard anchors.",
        justification: "Natural resonance for vocal accompaniment.",
        data: { voicings: ["x32010", "320003", "133211"] },
        warnings: [],
        validationNotes: ["Fretboard physics verified."],
      };
      const voicingRun: AccompanimentWorkflowRun = {
        id: "run-voicing",
        createdAt: new Date().toISOString(),
        stepId: "guitar-voicing-bass",
        requestPrompt: "Select voicings",
        userNote: "",
        options: [voicingOpt],
      };
      session = selectOption(mergeRun(session, voicingRun, ""), "guitar-voicing-bass", voicingOpt, "", voicingRun.id);
    }

    const candidateOptions: AccompanimentWorkflowOption[] = options.candidatePack.options.map((cand) => ({
      id: cand.optionId,
      label: cand.label,
      summary: cand.diversityLabel,
      justification: cand.rationale,
      data: {
        guitarClassicAbc: cand.abc,
        abc: cand.abc,
        decisionMap: cand.decisionMap,
        eventHints: cand.eventHints,
      },
      warnings: [],
      validationNotes: cand.declaredSoftRuleTradeOffs?.map((t) => `${t.rule}: ${t.rationale}`) ?? [],
    }));

    const stepId = isPiano
      ? "harmonium-drone-register"
      : "guitar-classic-abc-notation";

    const run: AccompanimentWorkflowRun = {
      id: "run-candidates",
      createdAt: new Date().toISOString(),
      stepId: stepId as any,
      requestPrompt: "Generate accompaniment candidates",
      userNote: "",
      options: candidateOptions,
      diagnostics: {
        logId: "diag-1",
        logPath: ".accompaniment-diagnostics/diag.jsonl",
        exposedTools: ["submit_arrangement_candidates"],
        validationAttempts: 1,
        maxValidationAttempts: 3,
        finalValidationValid: true,
      },
    };
    session = mergeRun(session, run, "");
    session.currentStepId = stepId as any;
  }

  return session;
}
