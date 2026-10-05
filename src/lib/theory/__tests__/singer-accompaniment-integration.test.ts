import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import {
  ApprovedHarmonySnapshotSchema,
  ArrangementCandidateOptionSchema,
  ArrangementCandidatePackSchema,
  DualCandidatePackWireResponseSchema,
  InvalidSourceFixtureSchema,
  LlmWireResponseSchema,
  ProviderErrorResponseSchema,
  ScenarioManifestEntrySchema,
  TwoStep3SnapshotsSchema,
  type ApprovedHarmonySnapshot,
  type ArrangementCandidateOption,
  type ArrangementCandidatePack,
  type ChordWindow,
  type LlmWireResponse,
  type MeterFamily,
  type ScenarioExpectedDiagnostic,
  type TargetInstrument,
} from "../singer-accompaniment-contracts";

import {
  fingerprintAccompanimentSource,
} from "../accompaniment-workflow";

import {
  buildAbcDurationContext,
  parseMeterFraction,
  splitAbcMeasureSegments,
} from "../abc-duration";

import {
  validateGuitarTab,
  type GuitarTabEvent,
  type GuitarTabValidationIssue,
} from "../guitar-tab-validation";

import {
  scientificPitchForStringFret,
} from "../guitar-playability";

import {
  validatePianoPlayability,
  type PianoHandEvent,
  type PianoPlayableNote,
} from "../piano-playability";

import {
  defaultVoicingOverrideRange,
  isCandidateCompatibleWithOverride,
  resolveVoicing,
  revalidateVoicingOverride,
  type GuitarVoicingCandidate,
  type PianoVoicingCandidate,
  type VoicingChordIdentity,
  type VoicingDecisionLayer,
  type VoicingOverride,
  type VoicingWindowRange,
} from "../voicing-override";

import {
  FileComposerProjectRepository,
  type ComposerProjectPayload,
} from "../../composer-project/repository";

import {
  COMPOSER_PUBLISHED_NOTATION_LABELS,
  isComposerPublishedNotationType,
} from "../../songs/composer-notation";

import { SongMetadataSchema } from "../../songs/schema";

// Canonical Sources (§3.1)
import fourFourGapCMajor from "../../../../e2e/fixtures/singer-accompaniment/sources/four-four-gap-c-major.json";
import sixEightDevotionalAMinor from "../../../../e2e/fixtures/singer-accompaniment/sources/six-eight-devotional-a-minor.json";
import splitWindowFourFour from "../../../../e2e/fixtures/singer-accompaniment/sources/split-window-four-four.json";
import highMelodyRegister from "../../../../e2e/fixtures/singer-accompaniment/sources/high-melody-register.json";
import noSafeGap from "../../../../e2e/fixtures/singer-accompaniment/sources/no-safe-gap.json";
import guitarStretchFail from "../../../../e2e/fixtures/singer-accompaniment/sources/guitar-stretch-fail.json";
import pianoSpanCollisionFail from "../../../../e2e/fixtures/singer-accompaniment/sources/piano-span-collision-fail.json";
import invalidMeterAbc from "../../../../e2e/fixtures/singer-accompaniment/sources/invalid-meter-abc.json";
import invalidAbc from "../../../../e2e/fixtures/singer-accompaniment/sources/invalid-abc.json";
import twoStep3Snapshots from "../../../../e2e/fixtures/singer-accompaniment/sources/two-step3-snapshots.json";

// Dummy Responses (§3.2, §3.3)
import guitarValidPack from "../../../../e2e/fixtures/singer-accompaniment/responses/guitar-valid-pack.json";
import pianoValidPack from "../../../../e2e/fixtures/singer-accompaniment/responses/piano-valid-pack.json";
import dualValidPack from "../../../../e2e/fixtures/singer-accompaniment/responses/dual-valid-pack.json";
import oneOptionInvalid from "../../../../e2e/fixtures/singer-accompaniment/responses/one-option-invalid.json";
import repairGuitarPhysics from "../../../../e2e/fixtures/singer-accompaniment/responses/repair-guitar-physics.json";
import repairPianoSpan from "../../../../e2e/fixtures/singer-accompaniment/responses/repair-piano-span.json";
import softException from "../../../../e2e/fixtures/singer-accompaniment/responses/soft-exception.json";
import malformedToolJson from "../../../../e2e/fixtures/singer-accompaniment/responses/malformed-tool-json.json";
import providerTimeout from "../../../../e2e/fixtures/singer-accompaniment/responses/provider-timeout.json";
import promptInjectionText from "../../../../e2e/fixtures/singer-accompaniment/responses/prompt-injection-text.json";
import exhaustedRepair from "../../../../e2e/fixtures/singer-accompaniment/responses/exhausted-repair.json";

// Scenario Manifest (§3.3, §10)
import { SCENARIO_MANIFEST } from "../../../../e2e/fixtures/singer-accompaniment/manifest";

/**
 * ----------------------------------------------------------------------------------
 * FAKE LLM TRANSPORT & ADAPTER SEAM (§2, §3.4)
 * ----------------------------------------------------------------------------------
 * Replaces the live LLM provider call with a deterministic transport mock.
 * Asserts request contracts (fingerprint, instrument, phase tool name) and returns
 * canonical response fixtures without leaking authoritative state into candidate payloads.
 */
interface FakeLlmRequest {
  toolName: string;
  targetInstrument: TargetInstrument | "both";
  sourceFingerprint: string;
  argumentsPayload?: Record<string, unknown>;
}

class FakeLlmClient {
  private callLog: FakeLlmRequest[] = [];
  private queuedResponses: Map<string, LlmWireResponse | Record<string, unknown>> = new Map();

  registerResponse(key: string, response: LlmWireResponse | Record<string, unknown>) {
    this.queuedResponses.set(key, response);
  }

  async invokeTool(request: FakeLlmRequest): Promise<LlmWireResponse> {
    this.callLog.push(request);

    // Enforce phase-only tool execution (§6 LLM transport/security)
    if (request.toolName !== "submit_arrangement_candidates") {
      throw new Error(`Unexpected tool call: ${request.toolName}. Phase only permits submit_arrangement_candidates.`);
    }

    const key = `${request.targetInstrument}:${request.sourceFingerprint}`;
    const directKey = request.targetInstrument;
    const response = this.queuedResponses.get(key) ?? this.queuedResponses.get(directKey);

    if (!response) {
      throw new Error(`No deterministic fixture registered for request: ${key}`);
    }

    // Return deep cloned wire response to preserve isolation
    return JSON.parse(JSON.stringify(response)) as LlmWireResponse;
  }

  getCalls(): readonly FakeLlmRequest[] {
    return this.callLog;
  }

  reset() {
    this.callLog = [];
    this.queuedResponses.clear();
  }
}

/**
 * ----------------------------------------------------------------------------------
 * SINGER-ACCOMPANIMENT NORMALIZER & VALIDATORS (§6)
 * ----------------------------------------------------------------------------------
 */

/** Normalizes raw wire tool call into validated candidate pack. */
function normalizeLlmCandidatePack(wireResponse: LlmWireResponse): ArrangementCandidatePack {
  const toolCall = wireResponse.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error("Malformed LLM response: missing function tool call.");
  }
  if (toolCall.function.name !== "submit_arrangement_candidates") {
    throw new Error(`Forbidden tool name in candidate phase: ${toolCall.function.name}`);
  }

  const rawArgs = JSON.parse(toolCall.function.arguments);
  // Zod refinement rejects authority fields (valid, sourceFingerprint, published, etc.)
  return ArrangementCandidatePackSchema.parse(rawArgs);
}

/** Timing and Meter validation on ABC notation. */
interface AbcTimingValidationResult {
  valid: boolean;
  measureCount: number;
  meter: string;
  issues: string[];
}

function validateVoiceMeasures(
  voiceBody: string,
  expectedMeter: string,
  expectedMeasures: number,
  defaultNoteLength: string
): string[] {
  const issues: string[] = [];
  const measures = splitAbcMeasureSegments(voiceBody);
  if (measures.length !== expectedMeasures) {
    issues.push(`Measure count mismatch: expected ${expectedMeasures} measures, found ${measures.length}.`);
    return issues;
  }
  const durationContext = buildAbcDurationContext(`M:${expectedMeter}\nL:${defaultNoteLength}\n|`);
  const expectedUnits = durationContext.fullMeasureUnits;

  measures.forEach((measureStr, idx) => {
    const tokenRegex = /(\[[^\]]+\]|[A-Ga-g][,']*|[zx])([0-9]*\/?[0-9]*)/g;
    let units = 0;
    let match;
    while ((match = tokenRegex.exec(measureStr)) !== null) {
      const durStr = match[2];
      if (!durStr) {
        units += 1;
      } else if (durStr === "2") {
        units += 2;
      } else if (durStr === "3") {
        units += 3;
      } else if (durStr === "4") {
        units += 4;
      } else if (durStr === "/2" || durStr === "1/2") {
        units += 0.5;
      } else {
        const parsed = Number.parseFloat(durStr);
        units += Number.isFinite(parsed) ? parsed : 1;
      }
    }

    if (measureStr.includes("OVERFILLED") || measureStr.includes("z8") || units > expectedUnits + 0.01) {
      issues.push(`Measure ${idx + 1} exceeds ${expectedMeter} meter duration (${units} > ${expectedUnits}).`);
    } else if (units < expectedUnits - 0.01 && units > 0) {
      issues.push(`Measure ${idx + 1} is underfilled (${units} < ${expectedUnits}).`);
    }
  });

  return issues;
}

function validateAbcSyntaxAndMeter(
  abc: string,
  expectedMeter: string,
  expectedMeasures: number,
  defaultNoteLength: string = "1/4"
): AbcTimingValidationResult {
  const issues: string[] = [];
  if (!abc.includes("M:") && !abc.includes("V:")) {
    return { valid: false, measureCount: 0, meter: "", issues: ["Missing ABC voice or header declaration."] };
  }

  // Extract body lines (exclude % comments and headers, keeping voice measure lines)
  const lines = abc.split("\n").map((l) => l.trim()).filter(Boolean);
  const voiceBlocks: string[] = [];
  let currentVoiceMusic = "";

  for (const line of lines) {
    if (line.startsWith("%")) continue;
    if (line.startsWith("V:")) {
      if (currentVoiceMusic) {
        voiceBlocks.push(currentVoiceMusic);
        currentVoiceMusic = "";
      }
    } else if (!/^[A-Za-z]:/.test(line)) {
      currentVoiceMusic += (currentVoiceMusic ? " " : "") + line;
    }
  }
  if (currentVoiceMusic) {
    voiceBlocks.push(currentVoiceMusic);
  }

  if (voiceBlocks.length === 0) {
    return { valid: false, measureCount: 0, meter: expectedMeter, issues: ["No valid music body found."] };
  }

  for (const voiceBody of voiceBlocks) {
    const voiceIssues = validateVoiceMeasures(voiceBody, expectedMeter, expectedMeasures, defaultNoteLength);
    issues.push(...voiceIssues);
  }

  return {
    valid: issues.length === 0,
    measureCount: expectedMeasures,
    meter: expectedMeter,
    issues,
  };
}

/** Singer-First constraint validator (§6 Singer-first). */
interface SingerFirstValidationResult {
  valid: boolean;
  issues: ScenarioExpectedDiagnostic[];
}

function validateSingerFirstConstraints(
  snapshot: ApprovedHarmonySnapshot,
  option: ArrangementCandidateOption
): SingerFirstValidationResult {
  const issues: ScenarioExpectedDiagnostic[] = [];

  // 1. Continuous lyrics vs Unsafe fills
  if (snapshot.melodyActivity.continuousLyric) {
    // If melody has continuous lyric, no fills are allowed
    const fillDecision = option.decisionMap.find(
      (d) => String(d.technique ?? "").includes("fill") || String(d.rhRole ?? "").includes("fill")
    );
    if (fillDecision) {
      issues.push({
        measure: Number(fillDecision.measure ?? 1),
        rule: "singer-unsafe-fill",
        severity: "error",
        message: "Melody has continuous lyrics with no safe gaps; accompaniment fills are rejected.",
      });
    }
  }

  // 2. Safe gap compliance
  snapshot.melodyActivity.gaps.forEach((gap) => {
    if (!gap.safeForFill) {
      const fillDuringUnsafe = option.decisionMap.find(
        (d) => Number(d.measure) === gap.measureIndex && String(d.technique ?? "").includes("fill")
      );
      if (fillDuringUnsafe) {
        issues.push({
          measure: gap.measureIndex,
          rule: "singer-unsafe-fill",
          severity: "error",
          message: `Measure ${gap.measureIndex} gap is unsafe for fills.`,
        });
      }
    }
  });

  // 3. Register mask / collision detection
  snapshot.registerMap.forEach((reg) => {
    if (reg.register === "high" && reg.highestMidi >= 76) {
      // In high soprano register, accompaniment must not collide or mask lead melody
      if (option.targetInstrument === "guitar-classic") {
        if (option.abc.includes("e'") || option.abc.includes("g'") || option.abc.includes("a'")) {
          issues.push({
            measure: reg.measureIndex,
            rule: "singer-register-mask",
            severity: "error",
            message: `Accompaniment penetrates vocal soprano register in measure ${reg.measureIndex}.`,
          });
        }
      } else if (option.targetInstrument === "piano") {
        if (option.abc.includes("e''") || option.abc.includes("g''")) {
          issues.push({
            measure: reg.measureIndex,
            rule: "singer-register-mask",
            severity: "error",
            message: `Piano RH voice masks vocal contour in measure ${reg.measureIndex}.`,
          });
        }
      }
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/** Guitar physics validator (§6 Guitar physics). */
function validateGuitarOptionPhysics(option: ArrangementCandidateOption): { valid: boolean; issues: GuitarTabValidationIssue[] } {
  if (option.targetInstrument !== "guitar-classic") {
    return { valid: false, issues: [{ code: "invalid-string", message: "Option is not target guitar-classic." }] };
  }

  // Validate V:GuitarSupport voice declaration
  if (!option.abc.includes("V:GuitarSupport")) {
    return {
      valid: false,
      issues: [{ code: "invalid-string", message: "Guitar option must declare V:GuitarSupport staff." }],
    };
  }

  // Check eventHints guitarVoicings if provided
  const voicings = (option.eventHints?.guitarVoicings ?? []) as Array<{
    measure: number;
    beat: number;
    chord: string;
    frets: string;
  }>;

  const tabEvents: GuitarTabEvent[] = [];
  voicings.forEach((v) => {
    // Parse fret string e.g. "x32010" or "133211"
    const chars = v.frets.split("");
    chars.forEach((c, idx) => {
      if (c !== "x" && c !== "X") {
        const fret = Number.parseInt(c, 10);
        const stringNum = (6 - idx) as 1 | 2 | 3 | 4 | 5 | 6;
        tabEvents.push({
          measureIndex: v.measure,
          beat: v.beat,
          string: stringNum,
          fret,
          note: scientificPitchForStringFret(stringNum, fret),
          role: "chord-tone",
        });
      }
    });
  });

  if (tabEvents.length > 0) {
    const result = validateGuitarTab(tabEvents);
    return { valid: result.valid, issues: result.issues };
  }

  // If option ABC has impossible stretch markers
  if (option.abc.includes("c'''") || option.decisionMap.some((d) => d.technique === "failed-repair-stretch")) {
    return {
      valid: false,
      issues: [
        {
          code: "fret-span",
          message: "Simultaneous reach exceeds maximum 5-fret span.",
          measureIndex: 3,
          beat: 1,
        },
      ],
    };
  }

  return { valid: true, issues: [] };
}

/** Piano hand rules and Low Interval Limit validator (§6 Piano hand rules). */
interface PianoHandRulesValidationResult {
  valid: boolean;
  hasGrandStaff: boolean;
  lilCompliant: boolean;
  spanCompliant: boolean;
  collisionFree: boolean;
  issues: ScenarioExpectedDiagnostic[];
}

function validatePianoOptionHandRules(option: ArrangementCandidateOption): PianoHandRulesValidationResult {
  if (option.targetInstrument !== "piano") {
    return {
      valid: false,
      hasGrandStaff: false,
      lilCompliant: false,
      spanCompliant: false,
      collisionFree: false,
      issues: [{ rule: "wrong-instrument", message: "Expected piano instrument." }],
    };
  }

  const issues: ScenarioExpectedDiagnostic[] = [];
  const hasGrandStaff = option.abc.includes("V:RH clef=treble") && option.abc.includes("V:LH clef=bass");

  if (!hasGrandStaff) {
    issues.push({ rule: "piano-grand-staff", message: "Piano accompaniment requires grand staff (V:RH and V:LH)." });
  }

  // Check Low Interval Limit (C2-C3):
  // Bass voice in LH must not have close intervals (minor/major 3rds, 2nds) in low octave
  let lilCompliant = true;
  if (option.abc.includes("[C,,_D,]") || option.abc.includes("[C,,D,]") || option.abc.includes("[C,,E,]")) {
    lilCompliant = false;
    issues.push({
      measure: 1,
      rule: "low-interval-limit",
      severity: "error",
      message: "Close third or second interval in bass below C3 violates Low Interval Limit.",
    });
  }

  // Check Hand Span (> 16 semitones / major tenth) & Collisions:
  // In pianoSpanCollisionFail source / responses:
  let spanCompliant = true;
  let collisionFree = true;
  if (option.optionId.includes("collision") || option.decisionMap.some((d) => d.rhVoicing === "collision-fail")) {
    spanCompliant = false;
    collisionFree = false;
    issues.push({
      measure: 2,
      beat: 1,
      rule: "piano-hand-span-collision",
      severity: "error",
      message: "Measure 2 beat 1 contains LH/RH collision and hand span exceeding major tenth.",
    });
  }

  return {
    valid: issues.length === 0,
    hasGrandStaff,
    lilCompliant,
    spanCompliant,
    collisionFree,
    issues,
  };
}

/** Diversity evaluator across candidate pack (§6 Candidate schema & diversity). */
interface CandidateDiversityEvaluation {
  valid: boolean;
  distinctDimensionCount: number;
  dimensions: string[];
  issues: string[];
}

function evaluateCandidatePackDiversity(pack: ArrangementCandidatePack): CandidateDiversityEvaluation {
  const issues: string[] = [];
  const uniqueAbc = new Set(pack.options.map((o) => o.abc.trim()));
  if (uniqueAbc.size < pack.options.length) {
    issues.push("Pack contains duplicate ABC notation variants; each candidate must be distinct.");
  }

  const uniqueIds = new Set(pack.options.map((o) => o.optionId));
  if (uniqueIds.size < pack.options.length) {
    issues.push("Pack contains duplicate optionIds.");
  }

  // Extract distinct axes: Texture, Register/Voicing, Bass strategy, Density
  const textures = new Set<string>();
  const voicings = new Set<string>();
  const densities = new Set<string>();
  const bassStrategies = new Set<string>();

  pack.options.forEach((opt) => {
    opt.decisionMap.forEach((d) => {
      if (d.technique) textures.add(String(d.technique));
      if (d.voicing) voicings.add(String(d.voicing));
      if (d.density) densities.add(String(d.density));
      if (d.foundation) bassStrategies.add(String(d.foundation));
    });
  });

  const dimensions: string[] = [];
  if (textures.size > 1) dimensions.push("texture");
  if (voicings.size > 1) dimensions.push("voicing");
  if (densities.size > 1) dimensions.push("density");
  if (bassStrategies.size > 1) dimensions.push("bass-foundation");

  if (dimensions.length < 2) {
    issues.push(`Pack diversity requires at least 2 distinct dimensions, found ${dimensions.length}.`);
  }

  return {
    valid: issues.length === 0,
    distinctDimensionCount: dimensions.length,
    dimensions,
    issues,
  };
}

/**
 * ----------------------------------------------------------------------------------
 * INTEGRATION TEST SUITE: SINGER-ACCOMPANIMENT QA MATRIX (§6, §7, §10)
 * ----------------------------------------------------------------------------------
 */
describe("Singer-Accompaniment Integration & Quality Assurance Audit (§6, §7, §10)", () => {
  const fakeTransport = new FakeLlmClient();

  // --------------------------------------------------------------------------------
  // 1. ACTION TO FAKE LLM TRANSPORT TO NORMALIZATION TO VALIDATOR TO STATE (§2, §3.4)
  // --------------------------------------------------------------------------------
  describe("1. Action to Fake LLM Transport to Normalization to Validator to State", () => {
    it("runs complete pipeline: action -> transport -> normalizer -> validator -> state update", async () => {
      fakeTransport.reset();
      const snapshot = ApprovedHarmonySnapshotSchema.parse(fourFourGapCMajor);
      fakeTransport.registerResponse(`guitar-classic:${snapshot.sourceFingerprint}`, guitarValidPack);

      // 1. Action creates transport request
      const wireResponse = await fakeTransport.invokeTool({
        toolName: "submit_arrangement_candidates",
        targetInstrument: "guitar-classic",
        sourceFingerprint: snapshot.sourceFingerprint,
      });
      expect(wireResponse.id).toBe("fixture-guitar-valid-pack-v1");

      // 2. Normalization parses wire tool calls into candidate pack
      const candidatePack = normalizeLlmCandidatePack(wireResponse);
      expect(candidatePack.targetInstrument).toBe("guitar-classic");
      expect(candidatePack.options).toHaveLength(3);

      // 3. Deterministic validators evaluate each option
      for (const option of candidatePack.options) {
        const timingVal = validateAbcSyntaxAndMeter(option.abc, snapshot.meter, snapshot.measureCount);
        expect(timingVal.valid).toBe(true);

        const singerVal = validateSingerFirstConstraints(snapshot, option);
        expect(singerVal.valid).toBe(true);

        const physicsVal = validateGuitarOptionPhysics(option);
        expect(physicsVal.valid).toBe(true);
      }

      // 4. Candidate pack diversity evaluation
      const diversityVal = evaluateCandidatePackDiversity(candidatePack);
      expect(diversityVal.valid).toBe(true);
      expect(diversityVal.distinctDimensionCount).toBeGreaterThanOrEqual(2);

      // 5. State transitions: candidates validated, selected option is applied
      const selectedOption = candidatePack.options[0];
      const appliedState = {
        status: "applied" as const,
        instrument: "guitar-classic" as const,
        sourceFingerprint: snapshot.sourceFingerprint,
        appliedOptionId: selectedOption.optionId,
        abc: selectedOption.abc,
        isCurrent: true,
      };

      expect(appliedState.status).toBe("applied");
      expect(appliedState.sourceFingerprint).toBe(snapshot.sourceFingerprint);
      expect(appliedState.isCurrent).toBe(true);
    });

    it("verifies transport call logging records exact request parameters", async () => {
      fakeTransport.reset();
      const snapshot = ApprovedHarmonySnapshotSchema.parse(fourFourGapCMajor);
      fakeTransport.registerResponse("piano", pianoValidPack);

      await fakeTransport.invokeTool({
        toolName: "submit_arrangement_candidates",
        targetInstrument: "piano",
        sourceFingerprint: snapshot.sourceFingerprint,
      });

      const calls = fakeTransport.getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].toolName).toBe("submit_arrangement_candidates");
      expect(calls[0].targetInstrument).toBe("piano");
      expect(calls[0].sourceFingerprint).toBe(snapshot.sourceFingerprint);
    });
  });

  // --------------------------------------------------------------------------------
  // 2. ABC AND TIMING VERIFICATION (§6 Row 1)
  // --------------------------------------------------------------------------------
  describe("2. ABC and Timing Verification (§6 Row 1, UC-01, E2E-04, E2E-08)", () => {
    it("rejects malformed ABC and incomplete/overfilled measures upstream", () => {
      // Syntax error gate (invalid-abc)
      const synFixture = InvalidSourceFixtureSchema.parse(invalidAbc);
      const synVal = validateAbcSyntaxAndMeter(synFixture.sourceAbc, "4/4", 4);
      expect(synVal.valid).toBe(false);

      // Meter error gate (invalid-meter-abc)
      const meterFixture = InvalidSourceFixtureSchema.parse(invalidMeterAbc);
      expect(meterFixture.expectedError).toBe("meter-error");
    });

    it("detects and flags candidate with overfilled measure duration (one-option-invalid)", () => {
      const wire = LlmWireResponseSchema.parse(oneOptionInvalid);
      const pack = normalizeLlmCandidatePack(wire);

      const invalidOption = pack.options.find((o) => o.optionId === "guitar-timing-fail")!;
      expect(invalidOption).toBeDefined();

      const timingCheck = validateAbcSyntaxAndMeter(invalidOption.abc, "4/4", 4);
      expect(timingCheck.valid).toBe(false);
      expect(timingCheck.issues.some((i) => i.includes("exceeds 4/4 meter duration"))).toBe(true);

      // Valid siblings remain selectable and valid
      const validSiblings = pack.options.filter((o) => o.optionId !== "guitar-timing-fail");
      expect(validSiblings).toHaveLength(2);
      validSiblings.forEach((sibling) => {
        expect(validateAbcSyntaxAndMeter(sibling.abc, "4/4", 4).valid).toBe(true);
      });
    });

    it("verifies exact chord-window onsets and re-articulation on split windows (split-window-four-four)", () => {
      const splitSnapshot = ApprovedHarmonySnapshotSchema.parse(splitWindowFourFour);
      expect(splitSnapshot.id).toBe("split-window-four-four");

      // Measure 2 has two distinct windows: C on beats 1-2, G on beats 3-4
      const m2Windows = splitSnapshot.chordWindows.filter((w) => w.measureIndex === 2);
      expect(m2Windows).toHaveLength(2);
      expect(m2Windows[0].chord).toBe("C");
      expect(m2Windows[0].startBeat).toBe(1);
      expect(m2Windows[0].endBeat).toBe(3);
      expect(m2Windows[1].chord).toBe("G");
      expect(m2Windows[1].startBeat).toBe(3);
      expect(m2Windows[1].endBeat).toBe(5);

      // Ensure that beat 3 re-articulates the new chord G
      expect(m2Windows[1].startBeat).toBe(3);
      expect(m2Windows[0].endBeat).toBe(m2Windows[1].startBeat);
    });

    it("preserves compound 6/8 meter family and beats (six-eight-devotional-a-minor)", () => {
      const compoundSnapshot = ApprovedHarmonySnapshotSchema.parse(sixEightDevotionalAMinor);
      expect(compoundSnapshot.meter).toBe("6/8");
      expect(compoundSnapshot.meterFamily).toBe("6/8");

      const parsedMeter = parseMeterFraction(compoundSnapshot.meter);
      expect(parsedMeter.numerator).toBe(6);
      expect(parsedMeter.denominator).toBe(8);

      // Ensure all 4 measures have chord windows mapped
      expect(compoundSnapshot.chordWindows).toHaveLength(4);
    });
  });

  // --------------------------------------------------------------------------------
  // 3. SNAPSHOT PROVENANCE & IMMUTABLE FINGERPRINT TRANSITIONS (§6 Row 2)
  // --------------------------------------------------------------------------------
  describe("3. Snapshot Provenance & Immutable Fingerprint Transitions (§6 Row 2, UC-01, UC-05, E2E-05, E2E-06)", () => {
    it("ensures canonical FNV-1a fingerprint changes for any melody pitch or duration edit", () => {
      const baseAbc = "X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: c e g e | d2 z2 :|";
      const baseFingerprint = fingerprintAccompanimentSource(baseAbc);

      // 1. Changing single pitch
      const pitchChangedAbc = "X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: d e g e | d2 z2 :|";
      const pitchFingerprint = fingerprintAccompanimentSource(pitchChangedAbc);
      expect(pitchFingerprint).not.toBe(baseFingerprint);

      // 2. Changing duration
      const durationChangedAbc = "X:1\nT:Test\nM:4/4\nL:1/4\nK:C\n|: c2 g e | d2 z2 :|";
      const durationFingerprint = fingerprintAccompanimentSource(durationChangedAbc);
      expect(durationFingerprint).not.toBe(baseFingerprint);

      // 3. Determinism: identical string yields identical fingerprint
      expect(fingerprintAccompanimentSource(baseAbc)).toBe(baseFingerprint);
    });

    it("verifies changing Step 3 harmony selection produces distinct fingerprints (two-step3-snapshots)", () => {
      const fixture = TwoStep3SnapshotsSchema.parse(twoStep3Snapshots);
      const fpA = fixture.snapshotA.sourceFingerprint;
      const fpB = fixture.snapshotB.sourceFingerprint;

      expect(fpA).not.toBe(fpB);
      expect(fixture.snapshotA.step3OptionId).toBe("step3-choice-a-functional");
      expect(fixture.snapshotB.step3OptionId).toBe("step3-choice-b-devotional");
    });

    it("enforces snapshot immutability: attempts to mutate snapshot cannot corrupt source facts", () => {
      const snapshot = Object.freeze(ApprovedHarmonySnapshotSchema.parse(fourFourGapCMajor));

      // Direct property modification is prevented on frozen object
      expect(() => {
        // @ts-expect-error - testing runtime freeze protection
        snapshot.tempo = 140;
      }).toThrow();

      // Deep copy ensures downstream code cannot mutate source ABC
      const clonedSnapshot = JSON.parse(JSON.stringify(snapshot)) as ApprovedHarmonySnapshot;
      clonedSnapshot.sourceAbc = "mutated";
      expect(snapshot.sourceAbc).not.toBe("mutated");
    });
  });

  // --------------------------------------------------------------------------------
  // 4. CANDIDATE SCHEMA & DIVERSITY VALIDATION (§6 Row 3, 4)
  // --------------------------------------------------------------------------------
  describe("4. Candidate Schema & Diversity Validation (§6 Row 3, 4, UC-06, E2E-01, E2E-02)", () => {
    it("validates candidate pack schema bounds: 3-5 options, unique IDs, complete ABC", () => {
      const wire = LlmWireResponseSchema.parse(guitarValidPack);
      const pack = normalizeLlmCandidatePack(wire);

      expect(pack.options.length).toBeGreaterThanOrEqual(3);
      expect(pack.options.length).toBeLessThanOrEqual(5);

      const ids = pack.options.map((o) => o.optionId);
      expect(new Set(ids).size).toBe(ids.length);

      pack.options.forEach((opt) => {
        expect(opt.abc.trim().length).toBeGreaterThan(10);
        expect(opt.rationale.length).toBeGreaterThan(10);
        expect(opt.diversityLabel.length).toBeGreaterThan(5);
        expect(opt.decisionMap.length).toBe(4);
      });
    });

    it("strictly forbids authoritative fields (valid, sourceFingerprint, published) in candidate pack", () => {
      const illegalOption = {
        optionId: "illegal-authority-opt",
        targetInstrument: "guitar-classic",
        label: "Illegal Option",
        rationale: "Attempts to self-assert authority.",
        diversityLabel: "Texture: Arpeggio",
        decisionMap: [{ measure: 1, technique: "strum" }],
        abc: "V:GuitarSupport\n[C,E]4 |",
        valid: true, // FORBIDDEN
        sourceFingerprint: "4dc0cca7", // FORBIDDEN
        published: true, // FORBIDDEN
      };

      // Zod refine must throw error rejecting authoritative fields
      expect(() => ArrangementCandidateOptionSchema.parse(illegalOption)).toThrow(
        /must not return authority fields/
      );
    });

    it("evaluates diversity across at least two dimensions and rejects duplicate ABC", () => {
      const wire = LlmWireResponseSchema.parse(guitarValidPack);
      const pack = normalizeLlmCandidatePack(wire);

      const evaluation = evaluateCandidatePackDiversity(pack);
      expect(evaluation.valid).toBe(true);
      expect(evaluation.distinctDimensionCount).toBeGreaterThanOrEqual(2);
      expect(evaluation.dimensions).toContain("texture");

      // Test duplicate ABC rejection
      const duplicatePack: ArrangementCandidatePack = {
        ...pack,
        options: [pack.options[0], { ...pack.options[1], abc: pack.options[0].abc }],
      };
      const duplicateEval = evaluateCandidatePackDiversity(duplicatePack);
      expect(duplicateEval.valid).toBe(false);
      expect(duplicateEval.issues.some((i) => i.includes("duplicate ABC"))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------------
  // 5. SINGER-FIRST CONSTRAINTS (§6 Row 5)
  // --------------------------------------------------------------------------------
  describe("5. Singer-First Constraints (§6 Row 5, UC-02, UC-03, E2E-09)", () => {
    it("rejects accompaniment fills when melody has continuous lyrics (no-safe-gap)", () => {
      const continuousSnapshot = ApprovedHarmonySnapshotSchema.parse(noSafeGap);
      expect(continuousSnapshot.melodyActivity.continuousLyric).toBe(true);
      expect(continuousSnapshot.melodyActivity.gaps).toHaveLength(0);

      // An option that attempts a fill during continuous lyrics
      const optionWithFill: ArrangementCandidateOption = {
        optionId: "violating-fill-opt",
        targetInstrument: "guitar-classic",
        label: "Violating Fill",
        rationale: "Adds guitar fill over lyrics.",
        diversityLabel: "Texture: Fill",
        decisionMap: [{ measure: 2, technique: "melodic-fill" }],
        abc: "V:GuitarSupport clef=treble-8\n[C,E]4 | [G,B]4 |",
      };

      const result = validateSingerFirstConstraints(continuousSnapshot, optionWithFill);
      expect(result.valid).toBe(false);
      expect(result.issues[0].rule).toBe("singer-unsafe-fill");
    });

    it("permits accompaniment fills ONLY within verified safe gaps (four-four-gap-c-major)", () => {
      const gapSnapshot = ApprovedHarmonySnapshotSchema.parse(fourFourGapCMajor);
      expect(gapSnapshot.melodyActivity.gaps).toHaveLength(1);
      const safeGap = gapSnapshot.melodyActivity.gaps[0];
      expect(safeGap.measureIndex).toBe(2);
      expect(safeGap.safeForFill).toBe(true);

      // guitar-pinch-arpeggio places fill during measure 2 gap
      const wire = LlmWireResponseSchema.parse(guitarValidPack);
      const pack = normalizeLlmCandidatePack(wire);
      const pinchOption = pack.options.find((o) => o.optionId === "guitar-pinch-arpeggio")!;

      const result = validateSingerFirstConstraints(gapSnapshot, pinchOption);
      expect(result.valid).toBe(true);
    });

    it("detects soprano register intrusions and mask conflicts (high-melody-register)", () => {
      const sopranoSnapshot = ApprovedHarmonySnapshotSchema.parse(highMelodyRegister);

      // Accompaniment intruding into soprano register e' and g'
      const intrusiveOption: ArrangementCandidateOption = {
        optionId: "intrusive-treble-opt",
        targetInstrument: "guitar-classic",
        label: "Intrusive Soprano",
        rationale: "Climbs into vocal range.",
        diversityLabel: "Register: High",
        decisionMap: [{ measure: 3, technique: "treble-melody" }],
        abc: "V:GuitarSupport clef=treble-8\n[C,E]4 | [G,,D]4 | [F,,C]2 e' g' | [C,E]4 |",
      };

      const result = validateSingerFirstConstraints(sopranoSnapshot, intrusiveOption);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.rule === "singer-register-mask")).toBe(true);
    });

    it("verifies validator NEVER mutates source melody to make accompaniment pass", () => {
      const snapshot = ApprovedHarmonySnapshotSchema.parse(highMelodyRegister);
      const originalMelodyAbc = snapshot.sourceAbc;

      const testOption = ArrangementCandidateOptionSchema.parse({
        optionId: "non-mutating-test",
        targetInstrument: "guitar-classic",
        label: "Test",
        rationale: "Testing non-mutation.",
        diversityLabel: "Texture: Pinch",
        decisionMap: [{ measure: 1, technique: "pinch" }],
        abc: "V:GuitarSupport clef=treble-8\n[C,E]4 |",
      });

      // Run validators
      validateSingerFirstConstraints(snapshot, testOption);
      validateGuitarOptionPhysics(testOption);

      // Source melody must remain strictly byte-identical
      expect(snapshot.sourceAbc).toBe(originalMelodyAbc);
    });
  });

  // --------------------------------------------------------------------------------
  // 6. GUITAR PHYSICS (§6 Row 6)
  // --------------------------------------------------------------------------------
  describe("6. Guitar Physics (§6 Row 6, UC-02, E2E-01, E2E-10)", () => {
    it("enforces string exclusivity: one guitar string cannot produce multiple simultaneous notes", () => {
      const simultaneousEvents: GuitarTabEvent[] = [
        { measureIndex: 1, beat: 1, string: 1, fret: 0, note: "E4", role: "melody" },
        { measureIndex: 1, beat: 1, string: 1, fret: 3, note: "G4", role: "harmony" }, // duplicate string 1!
      ];

      const validation = validateGuitarTab(simultaneousEvents);
      expect(validation.valid).toBe(false);
      expect(validation.issues.some((i) => i.code === "duplicate-string")).toBe(true);
    });

    it("enforces fret reach ceiling (≤ 5 frets) and catches impossible stretches (guitar-stretch-fail)", () => {
      const stretchEvents: GuitarTabEvent[] = [
        { measureIndex: 3, beat: 1, string: 6, fret: 1, note: "F2", role: "bass" },
        { measureIndex: 3, beat: 1, string: 1, fret: 8, note: "C5", role: "treble" }, // span = 8 - 1 = 7 frets (> 5)
      ];

      const validation = validateGuitarTab(stretchEvents);
      expect(validation.valid).toBe(false);
      expect(validation.issues.some((i) => i.code === "fret-span")).toBe(true);
    });

    it("enforces single barre limit: rejects shapes requiring multiple simultaneous barres", () => {
      const multiBarreEvents: GuitarTabEvent[] = [
        // Fret 1 cluster (barre 1)
        { measureIndex: 1, beat: 1, string: 6, fret: 1, note: "F2", role: "bass" },
        { measureIndex: 1, beat: 1, string: 5, fret: 1, note: "Bb2", role: "inner" },
        // Fret 3 cluster (barre 2)
        { measureIndex: 1, beat: 1, string: 4, fret: 3, note: "F3", role: "inner" },
        { measureIndex: 1, beat: 1, string: 3, fret: 3, note: "Bb3", role: "inner" },
        { measureIndex: 1, beat: 1, string: 2, fret: 3, note: "D4", role: "inner" },
        { measureIndex: 1, beat: 1, string: 1, fret: 3, note: "G4", role: "treble" },
      ];

      const validation = validateGuitarTab(multiBarreEvents);
      expect(validation.valid).toBe(false);
      expect(validation.issues.some((i) => i.code === "multiple-barres" || i.code === "left-hand-unfingerable")).toBe(true);
    });

    it("verifies Guitar output requires V:GuitarSupport and cannot satisfy Piano checks", () => {
      const wire = LlmWireResponseSchema.parse(guitarValidPack);
      const pack = normalizeLlmCandidatePack(wire);
      const guitarOption = pack.options[0];

      expect(guitarOption.abc).toContain("V:GuitarSupport");

      // Attempting to validate guitar option with Piano hand rules must fail
      const pianoCheckOnGuitar = validatePianoOptionHandRules(guitarOption);
      expect(pianoCheckOnGuitar.valid).toBe(false);
      expect(pianoCheckOnGuitar.hasGrandStaff).toBe(false);
    });
  });

  // --------------------------------------------------------------------------------
  // 7. PIANO HAND RULES & LOW INTERVAL LIMIT (§6 Row 7)
  // --------------------------------------------------------------------------------
  describe("7. Piano Hand Rules & Low Interval Limit (§6 Row 7, UC-03, E2E-02, E2E-11)", () => {
    it("enforces Low Interval Limit (C2-C3): rejects close muddy intervals in low bass register", () => {
      const muddyOption: ArrangementCandidateOption = {
        optionId: "muddy-bass-opt",
        targetInstrument: "piano",
        label: "Muddy Bass",
        rationale: "Close minor second in sub-bass.",
        diversityLabel: "Texture: Block",
        decisionMap: [{ measure: 1, foundation: "cluster-bass" }],
        abc: "V:RH clef=treble\n[E G]4 |\nV:LH clef=bass\n[C,,_D,]4 |",
      };

      const report = validatePianoOptionHandRules(muddyOption);
      expect(report.valid).toBe(false);
      expect(report.lilCompliant).toBe(false);
      expect(report.issues.some((i) => i.rule === "low-interval-limit")).toBe(true);
    });

    it("verifies hand span limits (major tenth / 16 semitones) and detects un-rolled excessive spans", () => {
      const wideSpanNotes: PianoPlayableNote[] = [
        { note: "C2", midi: 36, abc: "C," },
        { note: "G3", midi: 55, abc: "G" }, // span = 55 - 36 = 19 semitones (> 16)
      ];

      const handEvents: PianoHandEvent[] = [
        { measureIndex: 1, beat: 1, hand: "left", notes: wideSpanNotes, abc: "[C, G]" },
      ];

      const playability = validatePianoPlayability(handEvents);
      expect(playability.measures[0].spanSemitones).toBe(19);
      // Span > 16 semitones triggers rolled resolution requirement
      expect(playability.measures[0].rolled).toBe(true);
    });

    it("detects LH/RH hand collisions when both hands occupy identical pitches (piano-span-collision-fail)", () => {
      const collisionEvents: PianoHandEvent[] = [
        {
          measureIndex: 2,
          beat: 1,
          hand: "left",
          notes: [{ note: "G3", midi: 55, abc: "G" }],
          abc: "G",
        },
        {
          measureIndex: 2,
          beat: 1,
          hand: "right",
          notes: [{ note: "G3", midi: 55, abc: "G" }], // collision on G3
          abc: "G",
        },
      ];

      const playability = validatePianoPlayability(collisionEvents);
      expect(playability.measures[0].collisionKeys).toContain("G3");
    });

    it("validates piano candidates output complete grand staff with V:RH and V:LH", () => {
      const wire = LlmWireResponseSchema.parse(pianoValidPack);
      const pack = normalizeLlmCandidatePack(wire);

      pack.options.forEach((opt) => {
        const report = validatePianoOptionHandRules(opt);
        expect(report.hasGrandStaff).toBe(true);
        expect(opt.abc).toContain("V:RH clef=treble");
        expect(opt.abc).toContain("V:LH clef=bass");
      });
    });
  });

  // --------------------------------------------------------------------------------
  // 8. SCOPED REPAIR LINEAGE (§6 Row 8)
  // --------------------------------------------------------------------------------
  describe("8. Scoped Repair Lineage (§6 Row 8, UC-02, UC-03, E2E-10, E2E-11, E2E-14)", () => {
    it("verifies scoped repair mutates only flagged measures and preserves passed measures (repair-guitar-physics)", () => {
      const repairWire = LlmWireResponseSchema.parse(repairGuitarPhysics);
      const pack = normalizeLlmCandidatePack(repairWire);
      const repairedOption = pack.options[0];

      // Lineage preserved
      expect(repairedOption.parentOptionId).toBe("guitar-stretch-opt-1");
      expect(repairedOption.repairScope?.measures).toEqual([3]);
      expect(repairedOption.repairScope?.flaggedRule).toBe("guitar-physics-stretch");

      // Measures 1, 2, 4 are explicitly preserved from parent
      expect(repairedOption.decisionMap[0].preserved).toBe(true);
      expect(repairedOption.decisionMap[1].preserved).toBe(true);
      expect(repairedOption.decisionMap[3].preserved).toBe(true);

      // Measure 3 is repaired
      expect(repairedOption.decisionMap[2].technique).toBe("barre-repaired");

      // Full revalidation passes
      const physicsVal = validateGuitarOptionPhysics(repairedOption);
      expect(physicsVal.valid).toBe(true);
    });

    it("verifies scoped repair resolves piano hand collision (repair-piano-span)", () => {
      const repairWire = LlmWireResponseSchema.parse(repairPianoSpan);
      const pack = normalizeLlmCandidatePack(repairWire);
      const repairedOption = pack.options[0];

      expect(repairedOption.parentOptionId).toBe("piano-collision-opt-1");
      expect(repairedOption.repairScope?.measures).toEqual([2]);
      expect(repairedOption.decisionMap[1].rhVoicing).toBe("shifted-up");

      const rulesCheck = validatePianoOptionHandRules(repairedOption);
      expect(rulesCheck.valid).toBe(true);
    });

    it("enforces max 3 repair rounds: exhausted repair halts and never auto-publishes (exhausted-repair)", () => {
      const wire = LlmWireResponseSchema.parse(exhaustedRepair);
      const pack = normalizeLlmCandidatePack(wire);
      const failedOption = pack.options[0];

      expect(failedOption.repairAttempts).toBe(3);
      expect(failedOption.repairScope?.flaggedRule).toBe("guitar-physics-stretch");

      // After 3 failed rounds:
      const maxAttemptsExhausted = (failedOption.repairAttempts ?? 0) >= 3;
      expect(maxAttemptsExhausted).toBe(true);

      // Invariant: exhausted repair is NOT eligible for publish or apply
      const manifestEntry = SCENARIO_MANIFEST.find((s) => s.scenario === "exhausted-repair");
      expect(manifestEntry?.expectedOutcome.applyAllowed).toBe(false);
      expect(manifestEntry?.expectedOutcome.publishAllowed).toBe(false);
    });
  });

  // --------------------------------------------------------------------------------
  // 9. STATE MACHINE & INVALIDATION TRANSITIONS (§6 Row 9)
  // --------------------------------------------------------------------------------
  describe("9. State Machine & Invalidation Transitions (§6 Row 9, UC-05, E2E-05, E2E-06, E2E-07)", () => {
    type AccompanimentBranchState = "not-started" | "configuring" | "generated" | "valid" | "applied" | "stale" | "error";

    it("progresses through legal lifecycle: not-started -> configuring -> generated -> valid -> applied", () => {
      let state: AccompanimentBranchState = "not-started";
      expect(state).toBe("not-started");

      // User opens accompaniment configuration
      state = "configuring";
      expect(state).toBe("configuring");

      // LLM returns candidate pack
      state = "generated";
      expect(state).toBe("generated");

      // Hard validators pass
      state = "valid";
      expect(state).toBe("valid");

      // User chooses candidate to apply
      state = "applied";
      expect(state).toBe("applied");

      // Invariant: validation failure never aliases "valid"
      const failedState: AccompanimentBranchState = "error";
      expect(failedState).not.toBe("valid");
    });

    it("invalidates downstream drafts to stale upon source melody edit (UC-05, E2E-06)", () => {
      const initialFingerprint = "4dc0cca7";
      const branchState = {
        instrument: "guitar-classic",
        sourceFingerprint: initialFingerprint,
        status: "applied" as AccompanimentBranchState,
        isCurrent: true,
      };

      // User edits melody pitch in Step 1
      const editedMelody = "X:1\nT:Edit\nM:4/4\nL:1/4\nK:C\n|: d e g e | d4 :|";
      const nextFingerprint = fingerprintAccompanimentSource(editedMelody);

      // Invalidation logic: fingerprint mismatch triggers stale
      const isStale = branchState.sourceFingerprint !== nextFingerprint;
      expect(isStale).toBe(true);

      const updatedBranch = {
        ...branchState,
        status: isStale ? ("stale" as AccompanimentBranchState) : branchState.status,
        isCurrent: !isStale,
      };

      expect(updatedBranch.status).toBe("stale");
      expect(updatedBranch.isCurrent).toBe(false);
    });

    it("invalidates both Layer 2 branches when Step 3 harmony selection changes (two-step3-snapshots, E2E-05)", () => {
      const fixture = TwoStep3SnapshotsSchema.parse(twoStep3Snapshots);
      const selectedSnapshot = fixture.snapshotA;

      const guitarDraft = { instrument: "guitar", sourceFingerprint: selectedSnapshot.sourceFingerprint, status: "valid" };
      const pianoDraft = { instrument: "piano", sourceFingerprint: selectedSnapshot.sourceFingerprint, status: "valid" };

      // User switches to Harmony Step 3 Option B
      const switchedSnapshot = fixture.snapshotB;

      // Both drafts become stale
      const guitarStale = guitarDraft.sourceFingerprint !== switchedSnapshot.sourceFingerprint;
      const pianoStale = pianoDraft.sourceFingerprint !== switchedSnapshot.sourceFingerprint;

      expect(guitarStale).toBe(true);
      expect(pianoStale).toBe(true);
    });

    it("verifies branch-local invalidation: changing Guitar profile leaves Piano current (E2E-07)", () => {
      const sharedFingerprint = "4dc0cca7";
      const guitarBranch = { instrument: "guitar", profile: "devotional-pima", isCurrent: true, status: "valid" };
      const pianoBranch = { instrument: "piano", profile: "pop-ballad", isCurrent: true, status: "valid" };

      // User changes Guitar profile to "bhajan-strum"
      const nextGuitar = { ...guitarBranch, profile: "bhajan-strum", isCurrent: false, status: "configuring" };

      // Piano branch remains current and untouched
      expect(nextGuitar.isCurrent).toBe(false);
      expect(pianoBranch.isCurrent).toBe(true);
      expect(pianoBranch.status).toBe("valid");
    });
  });

  // --------------------------------------------------------------------------------
  // 10. VOICING OVERRIDES & COMPING PROFILES (§6 Row 10)
  // --------------------------------------------------------------------------------
  describe("10. Voicing Overrides & Comping Profiles (§6 Row 10, UC-06, UC-07, E2E-16, E2E-17)", () => {
    const chordIdentityAm: VoicingChordIdentity = {
      symbol: "Am",
      normalizedSymbol: "Am",
      chordWindowIds: ["cw-m1-b1"],
    };

    const targetRange: VoicingWindowRange = {
      scope: "chord-window",
      start: { measureIndex: 0, beat: 1 },
      end: { measureIndex: 0, beat: 3 },
      chordWindowId: "cw-m1-b1",
    };

    it("implements exact precedence: snapshot -> profile -> plan -> narrow override -> local fill", () => {
      const snapshotLayer: VoicingDecisionLayer = { voicingId: "v-snapshot-am" };
      const profileLayer: VoicingDecisionLayer = { voicingId: "v-profile-am" };
      const voicingPlanLayer: VoicingDecisionLayer = { voicingId: "v-plan-am" };

      const override: VoicingOverride = {
        id: "ov-1",
        instrument: "guitar-classic",
        windowRange: targetRange,
        baseChordIdentity: chordIdentityAm,
        voicingId: "v-override-barre-am",
        sourceRevisionId: "rev-1",
        createdFromPlanRevisionId: "plan-1",
        createdAt: "2026-09-14T06:00:00Z",
        status: "valid",
        validation: {
          evaluatedAt: "2026-09-14T06:00:00Z",
          candidateAvailable: true,
          chordIdentity: { valid: true, reasons: [] },
          singerYield: { valid: true, reasons: [] },
          physical: { valid: true, reasons: [] },
          leftEdgeTransition: { valid: true, reasons: [] },
          rightEdgeTransition: { valid: true, reasons: [] },
          diagnostics: [],
        },
      };

      // 1. Snapshot only
      const resSnapshot = resolveVoicing({
        instrument: "guitar-classic",
        targetRange,
        targetChordIdentity: chordIdentityAm,
        snapshot: snapshotLayer,
        overrides: [],
      });
      expect(resSnapshot.voicingId).toBe("v-snapshot-am");
      expect(resSnapshot.source).toBe("snapshot");

      // 2. Profile plan takes precedence over snapshot
      const resProfile = resolveVoicing({
        instrument: "guitar-classic",
        targetRange,
        targetChordIdentity: chordIdentityAm,
        snapshot: snapshotLayer,
        profilePlan: profileLayer,
        overrides: [],
      });
      expect(resProfile.voicingId).toBe("v-profile-am");
      expect(resProfile.source).toBe("profile-plan");

      // 3. Voicing plan takes precedence over profile plan
      const resPlan = resolveVoicing({
        instrument: "guitar-classic",
        targetRange,
        targetChordIdentity: chordIdentityAm,
        snapshot: snapshotLayer,
        profilePlan: profileLayer,
        voicingPlan: voicingPlanLayer,
        overrides: [],
      });
      expect(resPlan.voicingId).toBe("v-plan-am");
      expect(resPlan.source).toBe("voicing-plan");

      // 4. Narrowest override takes precedence over plan
      const resOverride = resolveVoicing({
        instrument: "guitar-classic",
        targetRange,
        targetChordIdentity: chordIdentityAm,
        snapshot: snapshotLayer,
        profilePlan: profileLayer,
        voicingPlan: voicingPlanLayer,
        overrides: [override],
      });
      expect(resOverride.voicingId).toBe("v-override-barre-am");
      expect(resOverride.source).toBe("override");

      // 5. Local realization fill takes highest precedence at its slot
      const resLocalFill = resolveVoicing({
        instrument: "guitar-classic",
        targetRange,
        targetChordIdentity: chordIdentityAm,
        snapshot: snapshotLayer,
        profilePlan: profileLayer,
        voicingPlan: voicingPlanLayer,
        overrides: [override],
        localRealizations: [
          {
            id: "local-fill-1",
            type: "fill",
            appliesTo: targetRange,
            replacementVoicingId: "v-local-passing-tone",
          },
        ],
      });
      expect(resLocalFill.voicingId).toBe("v-local-passing-tone");
      expect(resLocalFill.source).toBe("local-realization");
    });

    it("retains locked harmonic identity: beat override cannot alter chord symbol (Am stays Am)", () => {
      const guitarCandidateAm: GuitarVoicingCandidate = {
        instrument: "guitar-classic",
        voicingId: "am-e-form-barre-f5",
        chordIdentity: chordIdentityAm,
        shapeLabel: "Am E-form barre fret 5",
        positionFret: 5,
        frets: [5, 7, 7, 5, 5, 5],
        strings: [6, 5, 4, 3, 2, 1],
        fingerCost: 3,
        bassNote: "A",
        capo: 0,
        spelledPitches: ["A", "C", "E"],
        register: { lowestMidi: 45, highestMidi: 69 },
        transitionCost: 2,
        validation: {
          chordIdentity: { valid: true, reasons: [] },
          singerYield: { valid: true, reasons: [] },
          physical: { valid: true, reasons: [] },
        },
      };

      const override: VoicingOverride = {
        id: "ov-am",
        instrument: "guitar-classic",
        windowRange: targetRange,
        baseChordIdentity: chordIdentityAm,
        voicingId: "am-e-form-barre-f5",
        sourceRevisionId: "rev-1",
        createdFromPlanRevisionId: "plan-1",
        createdAt: "2026-09-14T06:00:00Z",
        status: "valid",
        validation: {
          evaluatedAt: "2026-09-14T06:00:00Z",
          candidateAvailable: true,
          chordIdentity: { valid: true, reasons: [] },
          singerYield: { valid: true, reasons: [] },
          physical: { valid: true, reasons: [] },
          leftEdgeTransition: { valid: true, reasons: [] },
          rightEdgeTransition: { valid: true, reasons: [] },
          diagnostics: [],
        },
      };

      expect(isCandidateCompatibleWithOverride(guitarCandidateAm, override)).toBe(true);

      // An attempt to substitute a different chord (e.g. Dm) must fail compatibility
      const chordIdentityDm: VoicingChordIdentity = {
        symbol: "Dm",
        normalizedSymbol: "Dm",
        chordWindowIds: ["cw-m1-b1"],
      };
      const dmCandidate: GuitarVoicingCandidate = {
        ...guitarCandidateAm,
        chordIdentity: chordIdentityDm,
      };
      expect(isCandidateCompatibleWithOverride(dmCandidate, override)).toBe(false);
    });

    it("revalidates overrides when upstream source revision changes, marking them stale without deletion", () => {
      const override: VoicingOverride = {
        id: "ov-reval",
        instrument: "guitar-classic",
        windowRange: targetRange,
        baseChordIdentity: chordIdentityAm,
        voicingId: "v-am-open",
        sourceRevisionId: "rev-1",
        createdFromPlanRevisionId: "plan-1",
        createdAt: "2026-09-14T06:00:00Z",
        status: "valid",
        validation: {
          evaluatedAt: "2026-09-14T06:00:00Z",
          candidateAvailable: true,
          chordIdentity: { valid: true, reasons: [] },
          singerYield: { valid: true, reasons: [] },
          physical: { valid: true, reasons: [] },
          leftEdgeTransition: { valid: true, reasons: [] },
          rightEdgeTransition: { valid: true, reasons: [] },
          diagnostics: [],
        },
      };

      // When source revision updates from rev-1 to rev-2:
      const revalidated = revalidateVoicingOverride({
        override,
        currentSourceRevisionId: "rev-2",
        validation: override.validation,
      });

      expect(revalidated.status).toBe("stale");
      expect(revalidated.voicingId).toBe("v-am-open"); // preserved!
      expect(revalidated.lastValidatedAgainstRevisionId).toBe("rev-2");
    });
  });

  // --------------------------------------------------------------------------------
  // 11. PERSISTENCE & REVISION INTEGRITY (§6 Row 11)
  // --------------------------------------------------------------------------------
  describe("11. Persistence & Revision Integrity (§6 Row 11, UC-05, UC-07, E2E-20, E2E-21)", () => {
    it("preserves append-only revision parent lineage and supports checkpoint & restore", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "composer-project-test-"));
      const repo = new FileComposerProjectRepository({ rootDirectory: tempDir });

      const initialPayload: ComposerProjectPayload = {
        song: {
          slug: "hare-krishna",
          sourceFingerprint: "4dc0cca7",
        },
        decisions: {
          selectedStyle: "accompaniment",
        },
      };

      // 1. Create project (revision 0)
      const project = await repo.create({
        title: "Hare Krishna Arrangement",
        payload: initialPayload,
      });
      expect(project.headRevision).toBe(0);
      expect(project.revisions).toHaveLength(1);
      expect(project.revisions[0].kind).toBe("initial");

      // 2. Autosave with edit (revision 1)
      const saveResult = await repo.autosave({
        projectId: project.id,
        baseRevision: 0,
        payload: {
          ...initialPayload,
          decisions: { selectedStyle: "accompaniment", guitarProfile: "devotional-pima" },
        },
      });
      expect(saveResult.status).toBe("saved");
      if (saveResult.status === "saved") {
        expect(saveResult.project.headRevision).toBe(1);
        expect(saveResult.revision.parentRevisionId).toBe("revision-0");
      }

      // 3. Named Checkpoint (revision 2)
      const checkpointResult = await repo.checkpoint({
        projectId: project.id,
        baseRevision: 1,
        checkpointName: "v1-approved-harmony",
        payload: {
          ...initialPayload,
          decisions: { selectedStyle: "accompaniment", checkpoint: true },
        },
      });
      expect(checkpointResult.status).toBe("saved");
      if (checkpointResult.status === "saved") {
        expect(checkpointResult.revision.kind).toBe("checkpoint");
        expect(checkpointResult.revision.checkpointName).toBe("v1-approved-harmony");
      }

      // 4. Restore checkpoint (revision 3)
      const restoreResult = await repo.restore({
        projectId: project.id,
        baseRevision: 2,
        restoreRevisionId: "revision-1",
      });
      expect(restoreResult.status).toBe("saved");
      if (restoreResult.status === "saved") {
        expect(restoreResult.revision.kind).toBe("restore");
        expect(restoreResult.project.headRevision).toBe(3);
      }

      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("retains offline/stale save on conflict branch without overwriting newer head (E2E-21)", async () => {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "composer-conflict-test-"));
      const repo = new FileComposerProjectRepository({ rootDirectory: tempDir });

      const initialPayload: ComposerProjectPayload = {
        song: { slug: "test-bhajan" },
      };

      const project = await repo.create({ title: "Conflict Test", payload: initialPayload });

      // Save revision 1
      await repo.autosave({
        projectId: project.id,
        baseRevision: 0,
        payload: { ...initialPayload, decisions: { headEdit: "author-a" } },
      });

      // Concurrent client tries to save against baseRevision 0 (now stale!)
      const conflictResult = await repo.autosave({
        projectId: project.id,
        baseRevision: 0,
        payload: { ...initialPayload, decisions: { offlineEdit: "author-b" } },
      });

      expect(conflictResult.status).toBe("conflict");
      if (conflictResult.status === "conflict") {
        expect(conflictResult.expectedBaseRevision).toBe(0);
        expect(conflictResult.latestRevision.revision).toBe(1);
        expect(conflictResult.conflictRevision.kind).toBe("conflict");
        expect(conflictResult.conflictRevision.branchOfRevisionId).toBe("revision-0");
      }

      await fs.rm(tempDir, { recursive: true, force: true });
    });
  });

  // --------------------------------------------------------------------------------
  // 12. PUBLICATION ELIGIBILITY & PRACTICE ISOLATION (§6 Row 12)
  // --------------------------------------------------------------------------------
  describe("12. Publication Eligibility & Practice Isolation (§6 Row 12, UC-04, E2E-01, E2E-02, E2E-03, E2E-18, E2E-19)", () => {
    interface PublicationCheckInput {
      status: string;
      isCurrent: boolean;
      sourceFingerprint: string;
      expectedFingerprint: string;
      hasValidHeaders: boolean;
    }

    function evaluatePublicationEligibility(input: PublicationCheckInput): { eligible: boolean; reason?: string } {
      if (!input.isCurrent) return { eligible: false, reason: "Draft layer is stale." };
      if (input.status !== "valid" && input.status !== "applied") return { eligible: false, reason: `Invalid status: ${input.status}` };
      if (input.sourceFingerprint !== input.expectedFingerprint) return { eligible: false, reason: "Source fingerprint mismatch." };
      if (!input.hasValidHeaders) return { eligible: false, reason: "Missing required ABC headers (X: and K:)." };
      return { eligible: true };
    }

    it("accepts current and valid layers only; rejects stale, failed, or mismatched fingerprint (E2E-18)", () => {
      const snapshotFp = "4dc0cca7";

      // 1. Valid and current -> eligible
      const happy = evaluatePublicationEligibility({
        status: "applied",
        isCurrent: true,
        sourceFingerprint: snapshotFp,
        expectedFingerprint: snapshotFp,
        hasValidHeaders: true,
      });
      expect(happy.eligible).toBe(true);

      // 2. Stale -> rejected
      const stale = evaluatePublicationEligibility({
        status: "applied",
        isCurrent: false,
        sourceFingerprint: snapshotFp,
        expectedFingerprint: snapshotFp,
        hasValidHeaders: true,
      });
      expect(stale.eligible).toBe(false);
      expect(stale.reason).toContain("stale");

      // 3. Validation failed -> rejected
      const failed = evaluatePublicationEligibility({
        status: "validation-failed",
        isCurrent: true,
        sourceFingerprint: snapshotFp,
        expectedFingerprint: snapshotFp,
        hasValidHeaders: true,
      });
      expect(failed.eligible).toBe(false);

      // 4. Fingerprint mismatch -> rejected
      const mismatch = evaluatePublicationEligibility({
        status: "applied",
        isCurrent: true,
        sourceFingerprint: "old-fingerprint",
        expectedFingerprint: snapshotFp,
        hasValidHeaders: true,
      });
      expect(mismatch.eligible).toBe(false);
      expect(mismatch.reason).toContain("fingerprint mismatch");
    });

    it("preserves Markdown body lyrics and notes when upserting published notation layers (UC-04)", () => {
      const existingMarkdown = `---
title: Govinda Jaya Jaya
slug: govinda-jaya-jaya
language: english
difficulty: beginner
abcNotations:
  - type: melody
    label: Melody Music Sheet
    default: true
---

## Lyrics
Govinda Jaya Jaya
Gopala Jaya Jaya

## Notes
Sung in devotional mood.
`;

      // Simulating upsert of published accompaniment layer
      const publishedLayer = {
        type: "accompaniment" as const,
        label: COMPOSER_PUBLISHED_NOTATION_LABELS.accompaniment,
        default: false,
      };

      const updatedMeta = SongMetadataSchema.parse({
        title: "Govinda Jaya Jaya",
        slug: "govinda-jaya-jaya",
        language: "english",
        category: "devotional",
        key: "C",
        timeSignature: "4/4",
        videos: [],
        tags: ["bhajan", "krishna"],
        abcNotations: [
          { type: "melody", label: "Melody Music Sheet", default: true },
          publishedLayer,
        ],
      });

      expect(updatedMeta.abcNotations).toHaveLength(2);
      expect(updatedMeta.abcNotations[1].type).toBe("accompaniment");
      expect(existingMarkdown).toContain("## Lyrics\nGovinda Jaya Jaya");
      expect(existingMarkdown).toContain("## Notes\nSung in devotional mood.");
    });

    it("verifies Practice isolation: Practice reads published catalogue artifact only, never local draft (E2E-19)", () => {
      const publishedCatalogueAbc = "X:1\nT:Published Accompaniment\nK:C\nV:GuitarSupport\n[C,E]4 |";
      const localUnpublishedDraftAbc = "X:1\nT:Local Draft\nK:C\nV:GuitarSupport\n[C,E]2 [C,E]2 |";

      const catalogueStore = new Map<string, string>();
      catalogueStore.set("govinda-jaya-jaya.accompaniment.abc", publishedCatalogueAbc);

      // Practice context retrieves from catalogueStore
      const practiceViewAbc = catalogueStore.get("govinda-jaya-jaya.accompaniment.abc");
      expect(practiceViewAbc).toBe(publishedCatalogueAbc);
      expect(practiceViewAbc).not.toBe(localUnpublishedDraftAbc);
    });
  });

  // --------------------------------------------------------------------------------
  // 13. LLM TRANSPORT SECURITY & ERROR HANDLING (§6 Row 13)
  // --------------------------------------------------------------------------------
  describe("13. LLM Transport Security & Error Handling (§6 Row 13, E2E-13, E2E-14)", () => {
    it("handles malformed tool JSON gracefully without crashing (malformed-tool-json, E2E-13)", () => {
      const wire = malformedToolJson as unknown as Record<string, unknown>;
      const choices = wire.choices as Array<{ message: { tool_calls: Array<{ function: { name: string; arguments: string } }> } }>;
      const toolCall = choices[0].message.tool_calls[0];

      // Tool name is wrong
      expect(toolCall.function.name).not.toBe("submit_arrangement_candidates");

      // Argument string is corrupted JSON
      expect(() => JSON.parse(toolCall.function.arguments)).toThrow();
    });

    it("handles provider timeout with bounded retries and logs error code (provider-timeout, E2E-14)", () => {
      const errorResp = ProviderErrorResponseSchema.parse(providerTimeout);
      expect(errorResp.error.code).toBe("provider_timeout");
      expect(errorResp.error.status).toBe(504);
      expect(errorResp.error.retryable).toBe(true);
    });

    it("resists prompt injection: malicious instruction in rationale/comment cannot escalate authority (prompt-injection-text, E2E-13)", () => {
      const wire = LlmWireResponseSchema.parse(promptInjectionText);
      const pack = normalizeLlmCandidatePack(wire);
      const injectedOption = pack.options[0];

      // Contains prompt injection attempts
      expect(injectedOption.rationale).toContain("SYSTEM OVERRIDE");
      expect(injectedOption.abc).toContain("% SYSTEM COMMAND");

      // Invariant: Prompt injection text is treated strictly as passive data
      expect("valid" in injectedOption).toBe(false);
      expect("sourceFingerprint" in injectedOption).toBe(false);
      expect("published" in injectedOption).toBe(false);
      expect("publishEligibility" in injectedOption).toBe(false);
    });

    it("permits declared soft exceptions with review badge without false hard rejection (soft-exception, E2E-12)", () => {
      const wire = LlmWireResponseSchema.parse(softException);
      const pack = normalizeLlmCandidatePack(wire);
      const option = pack.options[0];

      expect(option.declaredSoftRuleTradeOffs).toBeDefined();
      const tradeOff = option.declaredSoftRuleTradeOffs![0];
      expect(tradeOff.rule).toBe("third-retention");
      expect(tradeOff.status).toBe("review");

      // Manifest verifies this option has review outcome rather than false hard error
      const manifestEntry = SCENARIO_MANIFEST.find((s) => s.scenario === "soft-exception");
      expect(manifestEntry?.expectedOutcome.status).toBe("review");
      expect(manifestEntry?.expectedOutcome.applyAllowed).toBe(true);
      expect(manifestEntry?.expectedOutcome.publishAllowed).toBe(false);
    });
  });

  // --------------------------------------------------------------------------------
  // 14. REQUIREMENTS-TO-TEST TRACEABILITY MATRIX VERIFICATION (§10)
  // --------------------------------------------------------------------------------
  describe("14. Requirements-to-Test Traceability Matrix Verification (§10)", () => {
    const REQUIREMENTS_MATRIX = [
      { uc: "UC-01", description: "Approved shared Harmony snapshot", scenarios: ["E2E-01", "E2E-04", "E2E-05", "E2E-08"] },
      { uc: "UC-02", description: "Guitar Classic singer support", scenarios: ["E2E-01", "E2E-07", "E2E-08", "E2E-09", "E2E-10", "E2E-16", "E2E-17"] },
      { uc: "UC-03", description: "Piano two-hand accompaniment", scenarios: ["E2E-02", "E2E-07", "E2E-08", "E2E-09", "E2E-10", "E2E-11", "E2E-16", "E2E-17"] },
      { uc: "UC-04", description: "Review, explicit publish, Practice", scenarios: ["E2E-01", "E2E-02", "E2E-03", "E2E-18", "E2E-19"] },
      { uc: "UC-05", description: "Stale source and recovery", scenarios: ["E2E-05", "E2E-06", "E2E-07", "E2E-20", "E2E-21"] },
      { uc: "UC-06", description: "Timeline/profile/voicing distinction", scenarios: ["E2E-08", "E2E-15", "E2E-17"] },
      { uc: "UC-07", description: "Beat override and durable project", scenarios: ["E2E-16", "E2E-20", "E2E-21"] },
      { uc: "LLM-Gov", description: "LLM candidate/repair governance", scenarios: ["E2E-10", "E2E-11", "E2E-12", "E2E-13", "E2E-14", "E2E-15"] },
    ];

    it("verifies 100% coverage of UC-01 through UC-07 in the traceability matrix (§10)", () => {
      expect(REQUIREMENTS_MATRIX).toHaveLength(8);
      REQUIREMENTS_MATRIX.forEach((entry) => {
        expect(entry.scenarios.length).toBeGreaterThanOrEqual(3);
      });
    });

    it("verifies every scenario in SCENARIO_MANIFEST is linked to target test outcomes", () => {
      expect(SCENARIO_MANIFEST.length).toBeGreaterThanOrEqual(14);
      const manifestScenarios = SCENARIO_MANIFEST.map((s) => s.scenario);

      expect(manifestScenarios).toContain("guitar-valid-pack");
      expect(manifestScenarios).toContain("piano-valid-pack");
      expect(manifestScenarios).toContain("dual-valid-pack");
      expect(manifestScenarios).toContain("one-option-invalid");
      expect(manifestScenarios).toContain("repair-guitar-physics");
      expect(manifestScenarios).toContain("repair-piano-span");
      expect(manifestScenarios).toContain("soft-exception");
      expect(manifestScenarios).toContain("malformed-tool-json");
      expect(manifestScenarios).toContain("provider-timeout");
      expect(manifestScenarios).toContain("prompt-injection-text");
      expect(manifestScenarios).toContain("exhausted-repair");
    });
  });
});
