import { describe, expect, it } from "vitest";

import {
  ApprovedHarmonySnapshotSchema,
  ArrangementCandidatePackSchema,
  DualCandidatePackWireResponseSchema,
  InvalidSourceFixtureSchema,
  LlmWireResponseSchema,
  ProviderErrorResponseSchema,
  ScenarioManifestEntrySchema,
  TwoStep3SnapshotsSchema,
} from "../singer-accompaniment-contracts";
import { fingerprintAccompanimentSource } from "../accompaniment-workflow";

// Canonical Sources
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

// Dummy Responses
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

// Manifest
import { SCENARIO_MANIFEST } from "../../../../e2e/fixtures/singer-accompaniment/manifest";
import { generateTestProjectId } from "../../../../e2e/helpers/singer-accompaniment";

describe("Singer-Accompaniment Fixtures and Contracts (§3.1, §3.2, §3.3)", () => {
  describe("Canonical Sources and ApprovedHarmonySnapshots (§3.1)", () => {
    it("validates four-four-gap-c-major snapshot schema and fingerprint", () => {
      const parsed = ApprovedHarmonySnapshotSchema.parse(fourFourGapCMajor);
      expect(parsed.id).toBe("four-four-gap-c-major");
      expect(parsed.meter).toBe("4/4");
      expect(parsed.meterFamily).toBe("4/4");
      expect(parsed.measureCount).toBe(4);
      expect(parsed.sourceFingerprint).toBe(fingerprintAccompanimentSource(parsed.sourceAbc));

      // Gap verification: M2 has a safe gap of 2 beats
      expect(parsed.melodyActivity.gaps).toHaveLength(1);
      expect(parsed.melodyActivity.gaps[0].measureIndex).toBe(2);
      expect(parsed.melodyActivity.gaps[0].durationBeats).toBe(2);
      expect(parsed.melodyActivity.gaps[0].safeForFill).toBe(true);

      // Phrases: exactly 2 phrases with cadences
      expect(parsed.phrases).toHaveLength(2);
      expect(parsed.phrases[0].cadenceType).toBe("half");
      expect(parsed.phrases[1].cadenceType).toBe("authentic");
    });

    it("validates six-eight-devotional-a-minor snapshot schema and compound meter facts", () => {
      const parsed = ApprovedHarmonySnapshotSchema.parse(sixEightDevotionalAMinor);
      expect(parsed.id).toBe("six-eight-devotional-a-minor");
      expect(parsed.meter).toBe("6/8");
      expect(parsed.meterFamily).toBe("6/8");
      expect(parsed.key).toBe("Am");
      expect(parsed.sourceFingerprint).toBe(fingerprintAccompanimentSource(parsed.sourceAbc));
      expect(parsed.chordWindows).toHaveLength(4);
      expect(parsed.registerMap[0].register).toBe("low");
    });

    it("validates split-window-four-four chord windows and subdivisions", () => {
      const parsed = ApprovedHarmonySnapshotSchema.parse(splitWindowFourFour);
      expect(parsed.id).toBe("split-window-four-four");
      expect(parsed.sourceFingerprint).toBe(fingerprintAccompanimentSource(parsed.sourceAbc));

      // Measure 2 has 2 distinct chord windows (split bar)
      const m2Windows = parsed.chordWindows.filter((w) => w.measureIndex === 2);
      expect(m2Windows).toHaveLength(2);
      expect(m2Windows[0].chord).toBe("C");
      expect(m2Windows[0].startBeat).toBe(1);
      expect(m2Windows[0].endBeat).toBe(3);
      expect(m2Windows[1].chord).toBe("G");
      expect(m2Windows[1].startBeat).toBe(3);
      expect(m2Windows[1].endBeat).toBe(5);

      // Measure 3 also has 2 windows
      const m3Windows = parsed.chordWindows.filter((w) => w.measureIndex === 3);
      expect(m3Windows).toHaveLength(2);
      expect(m3Windows[0].chord).toBe("F");
      expect(m3Windows[1].chord).toBe("G");
    });

    it("validates high-melody-register occupies soprano range", () => {
      const parsed = ApprovedHarmonySnapshotSchema.parse(highMelodyRegister);
      expect(parsed.id).toBe("high-melody-register");
      expect(parsed.registerMap.every((r) => r.register === "high")).toBe(true);
      expect(parsed.registerMap[2].highestMidi).toBeGreaterThanOrEqual(76); // e5
    });

    it("validates no-safe-gap enforces continuous lyrics without fills", () => {
      const parsed = ApprovedHarmonySnapshotSchema.parse(noSafeGap);
      expect(parsed.id).toBe("no-safe-gap");
      expect(parsed.melodyActivity.continuousLyric).toBe(true);
      expect(parsed.melodyActivity.gaps).toHaveLength(0);
      expect(parsed.melodyActivity.activeOnsetsCount).toBeGreaterThanOrEqual(20);
    });

    it("validates guitar-stretch-fail source snapshot structure", () => {
      const parsed = ApprovedHarmonySnapshotSchema.parse(guitarStretchFail);
      expect(parsed.id).toBe("guitar-stretch-fail");
      expect(parsed.sourceFingerprint).toBe(fingerprintAccompanimentSource(parsed.sourceAbc));
      expect(parsed.chordWindows).toHaveLength(4);
    });

    it("validates piano-span-collision-fail source snapshot structure", () => {
      const parsed = ApprovedHarmonySnapshotSchema.parse(pianoSpanCollisionFail);
      expect(parsed.id).toBe("piano-span-collision-fail");
      expect(parsed.sourceFingerprint).toBe(fingerprintAccompanimentSource(parsed.sourceAbc));
      expect(parsed.chordWindows).toHaveLength(4);
    });

    it("validates invalid-meter-abc upstream error schema", () => {
      const parsed = InvalidSourceFixtureSchema.parse(invalidMeterAbc);
      expect(parsed.id).toBe("invalid-meter-abc");
      expect(parsed.expectedError).toBe("meter-error");
      expect(parsed.sourceAbc).toContain("M:4/4");
    });

    it("validates invalid-abc syntax error schema", () => {
      const parsed = InvalidSourceFixtureSchema.parse(invalidAbc);
      expect(parsed.id).toBe("invalid-abc");
      expect(parsed.expectedError).toBe("syntax-error");
    });

    it("validates two-step3-snapshots has distinct fingerprints for downstream invalidation", () => {
      const parsed = TwoStep3SnapshotsSchema.parse(twoStep3Snapshots);
      expect(parsed.id).toBe("two-step3-snapshots");
      expect(parsed.snapshotA.sourceFingerprint).toBe(
        fingerprintAccompanimentSource(parsed.snapshotA.sourceAbc)
      );
      expect(parsed.snapshotB.sourceFingerprint).toBe(
        fingerprintAccompanimentSource(parsed.snapshotB.sourceAbc)
      );
      // Invariant: Changing Step 3 selection produces different fingerprints
      expect(parsed.snapshotA.sourceFingerprint).not.toBe(parsed.snapshotB.sourceFingerprint);
      expect(parsed.snapshotA.step3OptionId).toBe("step3-choice-a-functional");
      expect(parsed.snapshotB.step3OptionId).toBe("step3-choice-b-devotional");
    });
  });

  describe("Deterministic LLM Candidate Response Packs (§3.2, §3.3)", () => {
    it("validates guitar-valid-pack has 3 diverse options and no authority fields", () => {
      const wire = LlmWireResponseSchema.parse(guitarValidPack);
      const toolCall = wire.choices[0].message.tool_calls[0];
      expect(toolCall.function.name).toBe("submit_arrangement_candidates");

      const pack = ArrangementCandidatePackSchema.parse(JSON.parse(toolCall.function.arguments));
      expect(pack.targetInstrument).toBe("guitar-classic");
      expect(pack.options).toHaveLength(3);

      // Verify at least 2 diversity dimensions across pack (texture, bass, density)
      const techniques = pack.options.map((opt) => opt.decisionMap[0].technique);
      const uniqueTechniques = new Set(techniques);
      expect(uniqueTechniques.size).toBeGreaterThanOrEqual(2);

      // Verify each option provides complete ABC
      pack.options.forEach((opt) => {
        expect(opt.abc).toContain("V:GuitarSupport");
        // Invariant: Candidate pack must return no authority fields
        expect("valid" in opt).toBe(false);
        expect("sourceFingerprint" in opt).toBe(false);
        expect("published" in opt).toBe(false);
      });
    });

    it("validates piano-valid-pack has 3 grand-staff options with pedal hints", () => {
      const wire = LlmWireResponseSchema.parse(pianoValidPack);
      const toolCall = wire.choices[0].message.tool_calls[0];
      expect(toolCall.function.name).toBe("submit_arrangement_candidates");

      const pack = ArrangementCandidatePackSchema.parse(JSON.parse(toolCall.function.arguments));
      expect(pack.targetInstrument).toBe("piano");
      expect(pack.options).toHaveLength(3);

      pack.options.forEach((opt) => {
        expect(opt.abc).toContain("V:RH clef=treble");
        expect(opt.abc).toContain("V:LH clef=bass");
        expect("valid" in opt).toBe(false);
        expect("sourceFingerprint" in opt).toBe(false);
      });
    });

    it("validates dual-valid-pack contains independent Guitar and Piano packs", () => {
      const dual = DualCandidatePackWireResponseSchema.parse(dualValidPack);

      const guitarPack = ArrangementCandidatePackSchema.parse(
        JSON.parse(dual.guitar.choices[0].message.tool_calls[0].function.arguments)
      );
      expect(guitarPack.targetInstrument).toBe("guitar-classic");
      expect(guitarPack.options).toHaveLength(3);

      const pianoPack = ArrangementCandidatePackSchema.parse(
        JSON.parse(dual.piano.choices[0].message.tool_calls[0].function.arguments)
      );
      expect(pianoPack.targetInstrument).toBe("piano");
      expect(pianoPack.options).toHaveLength(3);
    });

    it("validates one-option-invalid has structured failure and usable siblings", () => {
      const wire = LlmWireResponseSchema.parse(oneOptionInvalid);
      const pack = ArrangementCandidatePackSchema.parse(
        JSON.parse(wire.choices[0].message.tool_calls[0].function.arguments)
      );
      expect(pack.options).toHaveLength(3);

      const invalidOption = pack.options.find((opt) => opt.optionId === "guitar-timing-fail");
      expect(invalidOption).toBeDefined();
      expect(invalidOption!.decisionMap[1].technique).toBe("arpeggio-overfilled");

      const validSiblings = pack.options.filter((opt) => opt.optionId !== "guitar-timing-fail");
      expect(validSiblings).toHaveLength(2);
    });

    it("validates repair-guitar-physics scopes repair to M3 and retains lineage", () => {
      const wire = LlmWireResponseSchema.parse(repairGuitarPhysics);
      const pack = ArrangementCandidatePackSchema.parse(
        JSON.parse(wire.choices[0].message.tool_calls[0].function.arguments)
      );

      const repaired = pack.options[0];
      expect(repaired.parentOptionId).toBe("guitar-stretch-opt-1");
      expect(repaired.repairScope?.measures).toEqual([3]);
      expect(repaired.repairScope?.flaggedRule).toBe("guitar-physics-stretch");

      // Passed measures 1, 2, 4 are preserved
      expect(repaired.decisionMap[0].preserved).toBe(true);
      expect(repaired.decisionMap[1].preserved).toBe(true);
      expect(repaired.decisionMap[3].preserved).toBe(true);
      expect(repaired.decisionMap[2].technique).toBe("barre-repaired");
    });

    it("validates repair-piano-span resolves collision and retains lineage", () => {
      const wire = LlmWireResponseSchema.parse(repairPianoSpan);
      const pack = ArrangementCandidatePackSchema.parse(
        JSON.parse(wire.choices[0].message.tool_calls[0].function.arguments)
      );

      const repaired = pack.options[0];
      expect(repaired.parentOptionId).toBe("piano-collision-opt-1");
      expect(repaired.repairScope?.measures).toEqual([2]);
      expect(repaired.repairScope?.flaggedRule).toBe("piano-hand-span-collision");
      expect(repaired.decisionMap[1].rhVoicing).toBe("shifted-up");
    });

    it("validates soft-exception declares review badge without false hard failure", () => {
      const wire = LlmWireResponseSchema.parse(softException);
      const pack = ArrangementCandidatePackSchema.parse(
        JSON.parse(wire.choices[0].message.tool_calls[0].function.arguments)
      );

      const optionWithException = pack.options[0];
      expect(optionWithException.declaredSoftRuleTradeOffs).toBeDefined();
      expect(optionWithException.declaredSoftRuleTradeOffs![0].rule).toBe("third-retention");
      expect(optionWithException.declaredSoftRuleTradeOffs![0].status).toBe("review");
    });

    it("verifies malformed-tool-json fails valid candidate schema parsing", () => {
      const wire = malformedToolJson as unknown as Record<string, unknown>;
      const choices = wire.choices as Array<{ message: { tool_calls: Array<{ function: { name: string; arguments: string } }> } }>;
      const toolCall = choices[0].message.tool_calls[0];

      // Wrong tool name
      expect(toolCall.function.name).not.toBe("submit_arrangement_candidates");

      // Malformed JSON arguments
      expect(() => JSON.parse(toolCall.function.arguments)).toThrow();
    });

    it("validates provider-timeout matches error response schema", () => {
      const parsed = ProviderErrorResponseSchema.parse(providerTimeout);
      expect(parsed.error.code).toBe("provider_timeout");
      expect(parsed.error.status).toBe(504);
      expect(parsed.error.retryable).toBe(true);
    });

    it("verifies prompt-injection-text is treated as passive text and cannot escalate authority", () => {
      const wire = LlmWireResponseSchema.parse(promptInjectionText);
      const pack = ArrangementCandidatePackSchema.parse(
        JSON.parse(wire.choices[0].message.tool_calls[0].function.arguments)
      );

      const injectedOption = pack.options[0];
      expect(injectedOption.rationale).toContain("SYSTEM OVERRIDE");
      expect(injectedOption.abc).toContain("% SYSTEM COMMAND");

      // Assert that malicious payload contains NO authorized state mutation
      expect("valid" in injectedOption).toBe(false);
      expect("sourceFingerprint" in injectedOption).toBe(false);
      expect("published" in injectedOption).toBe(false);
      expect("publishEligibility" in injectedOption).toBe(false);
    });

    it("validates exhausted-repair flags repeated failure after max rounds", () => {
      const wire = LlmWireResponseSchema.parse(exhaustedRepair);
      const pack = ArrangementCandidatePackSchema.parse(
        JSON.parse(wire.choices[0].message.tool_calls[0].function.arguments)
      );

      const option = pack.options[0];
      expect(option.repairAttempts).toBe(3);
      expect(option.repairScope?.flaggedRule).toBe("guitar-physics-stretch");
      expect(option.decisionMap[2].technique).toBe("failed-repair-stretch");
    });
  });

  describe("Fixture Manifest (§3.3)", () => {
    it("validates every manifest entry against ScenarioManifestEntrySchema", () => {
      expect(SCENARIO_MANIFEST.length).toBeGreaterThanOrEqual(14);
      SCENARIO_MANIFEST.forEach((entry) => {
        const parsed = ScenarioManifestEntrySchema.parse(entry);
        expect(parsed.scenario).toBeDefined();
        expect(parsed.expectedOutcome.summary).toBeDefined();
      });
    });

    it("verifies expected application and publication permissions across scenarios", () => {
      const happyGuitar = SCENARIO_MANIFEST.find((s) => s.scenario === "guitar-valid-pack");
      expect(happyGuitar?.expectedOutcome.applyAllowed).toBe(true);
      expect(happyGuitar?.expectedOutcome.publishAllowed).toBe(true);

      const timeout = SCENARIO_MANIFEST.find((s) => s.scenario === "provider-timeout");
      expect(timeout?.expectedOutcome.applyAllowed).toBe(false);
      expect(timeout?.expectedOutcome.publishAllowed).toBe(false);

      const exhausted = SCENARIO_MANIFEST.find((s) => s.scenario === "exhausted-repair");
      expect(exhausted?.expectedOutcome.applyAllowed).toBe(false);
      expect(exhausted?.expectedOutcome.publishAllowed).toBe(false);

      const softReview = SCENARIO_MANIFEST.find((s) => s.scenario === "soft-exception");
      expect(softReview?.expectedOutcome.applyAllowed).toBe(true);
      expect(softReview?.expectedOutcome.publishAllowed).toBe(false); // requires review
    });
  });

  describe("Playwright Helper Utilities (§2, §3.4)", () => {
    it("generates unique namespaced test project IDs", () => {
      const id1 = generateTestProjectId();
      const id2 = generateTestProjectId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test-singer-accompaniment-\d+-[a-z0-9]+$/);
    });

    it("generates namespaced test project IDs with custom prefix", () => {
      const id = generateTestProjectId("e2e-isolated");
      expect(id).toMatch(/^e2e-isolated-\d+-[a-z0-9]+$/);
    });
  });
});

