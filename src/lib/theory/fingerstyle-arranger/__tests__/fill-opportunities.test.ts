import { describe, expect, it } from "vitest";

import {
  FILL_COMPOSITION_FORMAT_VERSION,
  FILL_SELECTION_FORMAT_VERSION,
  allowsMelodySustainFill,
  analyzeFillOpportunities,
  encodeFillComposition,
  encodeFillSelection,
  mergeAcceptedFills,
  normalizeFillPolicy,
  paginateFillOpportunities,
  parseFillCompositionToon,
  parseFillSelectionToon,
  scoreFillOpportunity,
  validateFillComposition,
  validateFillSelection,
  type FillAtomicCandidate,
  type FillBoundaryEvidence,
  type FillComposition,
  type FillSelection,
} from "../fill-opportunities";
import type { TimeSliceGridStep, TimeSliceMeasure } from "../time-slice";

function gridStep(
  step: number,
  melody: TimeSliceGridStep["melody"],
  options: Partial<TimeSliceGridStep> = {},
): TimeSliceGridStep {
  return {
    step,
    chord: "Em",
    weight: step === 1 ? "⬤" : step === 5 ? "●" : null,
    melody,
    lyric: step === 1 ? "Ja-" : step === 5 ? "go" : null,
    tablature: [],
    ...options,
  };
}

function sourceMeasure(): TimeSliceMeasure {
  return {
    measure: 3,
    lineIndex: 1,
    style_profile: {
      key: "Em",
      comping_style: "Sparse devotional PIMA",
      voicing_plan: "Open Em shape",
      fill_density: "few",
    },
    grid: [
      gridStep(1, { pitch: "E4", state: "attack" }, {
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      }),
      gridStep(2, { pitch: "E4", state: "sustain" }),
      gridStep(3, { pitch: "E4", state: "sustain" }),
      gridStep(4, { pitch: "E4", state: "sustain" }),
      gridStep(5, { pitch: "E4", state: "attack" }, {
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      }),
      gridStep(6, { pitch: null, state: "rest" }),
      gridStep(7, { pitch: null, state: "rest" }),
      gridStep(8, { pitch: null, state: "rest" }),
    ],
    barline: {
      repeatStart: false,
      repeatEnd: false,
      volta: null,
    },
  };
}

function analysis(densityMode = "few") {
  return analyzeFillOpportunities({
    measures: [sourceMeasure()],
    sourceFingerprint: "source-123",
    skillLevel: "beginner",
    densityMode,
    nextLineMeasures: [{
      ...sourceMeasure(),
      measure: 4,
      lineIndex: 2,
      grid: [
        gridStep(1, { pitch: "B3", state: "attack" }, {
          tablature: [{ string: 2, fret: 0, finger: "m", role: "melody" }],
        }),
      ],
    }],
  });
}

function boundary(overrides: Partial<FillBoundaryEvidence> = {}): FillBoundaryEvidence {
  return {
    lineEnd: false,
    trailingRestSteps: 0,
    lyricTerminal: false,
    repeatBoundary: false,
    cadenceHint: "continuation",
    nextMelodyDistanceSteps: 4,
    confidence: "low",
    ...overrides,
  };
}

function candidate(overrides: Partial<FillAtomicCandidate> = {}): FillAtomicCandidate {
  return {
    id: "c-1",
    windowId: "w-1",
    measure: 1,
    step: 2,
    pitch: "B3",
    midi: 59,
    harmonicRole: "fifth",
    string: 2,
    fret: 0,
    suggestedFinger: "m",
    maxDurationSteps: 2,
    incomingHandCost: 0,
    outgoingHandCost: 0,
    totalHandCost: 0,
    score: 90,
    conditions: [],
    ...overrides,
  };
}

describe("fill opportunity policy", () => {
  it("defaults to beginner with skill-derived few density", () => {
    expect(normalizeFillPolicy()).toEqual({
      skillLevel: "beginner",
      densityMode: "auto",
      resolvedDensity: "few",
      densitySource: "skill-level",
    });
    expect(normalizeFillPolicy({ skillLevel: "advanced" }).resolvedDensity).toBe("many");
  });

  it("normalizes explicit and legacy density values", () => {
    expect(normalizeFillPolicy({ densityMode: "normal" }).densitySource).toBe("explicit");
    expect(normalizeFillPolicy({ densityMode: "none" })).toMatchObject({
      densityMode: "none",
      resolvedDensity: "off",
      densitySource: "explicit",
    });
    expect(normalizeFillPolicy({ densityMode: "all" }).resolvedDensity).toBe("many");
    expect(normalizeFillPolicy({ densityMode: "unexpected" }).densityMode).toBe("auto");
  });

  it("requires an explicit normal-or-many mode to decorate held melody", () => {
    expect(allowsMelodySustainFill(normalizeFillPolicy({ skillLevel: "advanced" }))).toBe(false);
    expect(allowsMelodySustainFill(normalizeFillPolicy({ densityMode: "few" }))).toBe(false);
    expect(allowsMelodySustainFill(normalizeFillPolicy({ densityMode: "normal" }))).toBe(true);
    expect(allowsMelodySustainFill(normalizeFillPolicy({ densityMode: "many" }))).toBe(true);
  });
});

describe("fill opportunity scoring", () => {
  it("rewards longer silence and inexpensive hand continuity", () => {
    const shortExpensive = scoreFillOpportunity({
      capacitySteps: 1,
      melodyContext: "sustain",
      startWeight: "●",
      boundaryEvidence: boundary(),
      candidates: [candidate({ totalHandCost: 9 })],
      nextMelodyMidi: 60,
      stepsUntilNextMelodyAttack: 3,
    });
    const longCheap = scoreFillOpportunity({
      capacitySteps: 4,
      melodyContext: "rest",
      startWeight: null,
      boundaryEvidence: boundary({ trailingRestSteps: 4 }),
      candidates: [candidate()],
      nextMelodyMidi: 60,
      stepsUntilNextMelodyAttack: 5,
    });

    expect(longCheap.score).toBeGreaterThan(shortExpensive.score);
    expect(longCheap.breakdown.silenceCapacity).toBe(25);
    expect(longCheap.breakdown.handContinuity).toBe(20);
  });

  it("balances line-transfer value with tonic-cadence restraint", () => {
    const transfer = scoreFillOpportunity({
      capacitySteps: 3,
      melodyContext: "rest",
      startWeight: null,
      boundaryEvidence: boundary({ lineEnd: true, confidence: "high" }),
      candidates: [candidate()],
      nextMelodyMidi: 60,
      stepsUntilNextMelodyAttack: 4,
    });
    const closedCadence = scoreFillOpportunity({
      capacitySteps: 3,
      melodyContext: "rest",
      startWeight: null,
      boundaryEvidence: boundary({ lineEnd: true, confidence: "high", cadenceHint: "tonic-arrival" }),
      candidates: [candidate()],
      nextMelodyMidi: 60,
      stepsUntilNextMelodyAttack: 4,
    });

    expect(transfer.breakdown.phraseTransfer).toBe(20);
    expect(closedCadence.breakdown.cadenceRestraint).toBe(15);
    expect(closedCadence.score).toBeLessThan(transfer.score);
  });
});

describe("fill opportunity analysis", () => {
  it("keeps sparse fills in phrase-ending rests and protects held melody", () => {
    const first = analysis();
    const second = analysis();

    expect(first).toEqual(second);
    expect(first.evaluatedStepCount).toBe(8);
    expect(first.evaluatedPlacementCount).toBeGreaterThan(0);
    expect(first.windows.map(window => [window.startStep, window.endStep])).toEqual([[6, 8]]);
    expect(first.windows.find(window => window.startStep === 6)?.boundaryEvidence).toMatchObject({
      lineEnd: true,
      nextMelodyDistanceSteps: 1,
    });
    expect(first.candidates.length).toBeGreaterThan(0);
    expect(first.candidates.every(item => item.step >= 6)).toBe(true);
    expect(first.candidates.every(item => item.string >= 1 && item.string <= 4)).toBe(true);
    expect(first.candidates.every(item => item.fret <= 5)).toBe(true);
    expect(first.candidates.every(item => item.id.startsWith("c-m3-s"))).toBe(true);
    expect(first.rejectionCounts["melody-attack"]).toBe(2);
    expect(first.rejectionCounts["protected-melody-sustain"]).toBe(3);
  });

  it("allows explicit dense profiles to evaluate held-melody windows", () => {
    const dense = analysis("normal");

    expect(dense.windows.map(window => [window.startStep, window.endStep])).toEqual(expect.arrayContaining([
      [2, 4],
      [6, 8],
    ]));
    const sustainCandidates = dense.candidates.filter(item => item.step >= 2 && item.step <= 4);
    expect(sustainCandidates).not.toHaveLength(0);
    expect(sustainCandidates.every(item => item.string !== 1)).toBe(true);
    expect(dense.rejectionCounts["protected-melody-sustain"]).toBe(0);
  });

  it("binds the opportunity set to the frozen foundation, not only source metadata", () => {
    const original = analysis();
    const changedFoundation = sourceMeasure();
    const firstEvent = changedFoundation.grid[0].tablature?.[0];
    if (firstEvent) firstEvent.fret = 2;
    const changed = analyzeFillOpportunities({
      measures: [changedFoundation],
      sourceFingerprint: "source-123",
      skillLevel: "beginner",
      densityMode: "few",
    });

    expect(changed.opportunitySetId).not.toBe(original.opportunitySetId);
  });

  it("uses the following measure chord at an internal boundary and keeps next-line fallback at line end", () => {
    const first = sourceMeasure();
    first.measure = 1;
    first.lineIndex = 0;
    first.grid = first.grid.map((step, index) => index === 0
      ? step
      : { ...step, melody: { pitch: null, state: "rest" }, tablature: [] });
    const second = sourceMeasure();
    second.measure = 2;
    second.lineIndex = 0;
    second.grid = second.grid.map((step, index) => index === 0
      ? {
          ...step,
          chord: "Am",
          melody: { pitch: "G4", state: "attack" },
          tablature: [
            { string: 6 as const, fret: 0, finger: "p" as const, role: "root" as const },
            { string: 1 as const, fret: 3, finger: "a" as const, role: "melody" as const },
          ],
        }
      : { ...step, chord: "Am" });
    const nextLine = sourceMeasure();
    nextLine.measure = 3;
    nextLine.lineIndex = 1;
    nextLine.grid = nextLine.grid.map(step => ({ ...step, chord: "C#" }));

    const result = analyzeFillOpportunities({
      measures: [first, second],
      sourceFingerprint: "boundary-context",
      nextLineMeasures: [nextLine],
    });

    const internalBoundaryCandidates = result.candidates.filter(candidate => candidate.measure === 1 && candidate.step === 8);
    expect(internalBoundaryCandidates.length).toBeGreaterThan(0);
    expect(internalBoundaryCandidates.some(candidate => candidate.conditions.includes("common-tone-next-chord"))).toBe(true);

    const lineBoundaryCandidates = result.candidates.filter(candidate => candidate.measure === 2 && candidate.step === 8);
    expect(lineBoundaryCandidates.length).toBeGreaterThan(0);
    expect(lineBoundaryCandidates.some(candidate => candidate.conditions.includes("common-tone-next-chord"))).toBe(false);
  });

  it("does not allow a fill duration to cross its measure-local opportunity window", () => {
    const result = analysis();
    const chosenWindow = result.windows.find(window => window.startStep === 6);
    expect(chosenWindow).toBeDefined();
    if (!chosenWindow) return;
    const chosenCandidate = result.candidates.find(candidate => candidate.windowId === chosenWindow.id);
    expect(chosenCandidate).toBeDefined();
    if (!chosenCandidate) return;

    const selection: FillSelection = {
      version: FILL_SELECTION_FORMAT_VERSION,
      opportunitySetId: result.opportunitySetId,
      sourceFingerprint: result.sourceFingerprint,
      decisions: result.windows.map(window => ({
        windowId: window.id,
        decision: window.id === chosenWindow.id ? "use" : "skip",
        reason: "Boundary duration regression",
      })),
    };
    const composition: FillComposition = {
      version: FILL_COMPOSITION_FORMAT_VERSION,
      opportunitySetId: result.opportunitySetId,
      sourceFingerprint: result.sourceFingerprint,
      entries: [{
        candidateId: chosenCandidate.id,
        durationSteps: chosenWindow.endStep - chosenCandidate.step + 2,
        finger: chosenCandidate.suggestedFinger,
      }],
    };

    const validated = validateFillComposition(result, selection, composition);
    expect(validated.valid).toBe(false);
    expect(validated.message).toContain("duration");
  });

  it("does not treat pickup padding as a legal window", () => {
    const pickup = sourceMeasure();
    pickup.pickupDurationUnits = 2;
    pickup.grid = pickup.grid.map((step, index) => index < 2
      ? step
      : { ...step, melody: { pitch: null, state: "rest" }, tablature: [] });
    const result = analyzeFillOpportunities({
      measures: [pickup],
      sourceFingerprint: "pickup",
    });

    expect(result.windows.every(window => window.endStep <= 2)).toBe(true);
    expect(result.rejectionCounts["pickup-padding"]).toBe(6);
  });
});

describe("compact fill contracts and validation", () => {
  it("paginates without silently dropping records and round-trips selection", () => {
    const result = analysis("normal");
    const firstPage = paginateFillOpportunities(result, { maxRows: 2 });
    const secondPage = paginateFillOpportunities(result, { cursor: firstPage.nextCursor, maxRows: 2 });

    expect(firstPage.candidateCount).toBe(0);
    expect(firstPage.nextCursor).toBe(2);
    expect(secondPage.cursor).toBe(2);
    expect(secondPage.candidateCount).toBe(2);
    expect(firstPage.toon).toContain("fill-opportunities:v1");
    expect(firstPage.toon).toContain(result.opportunitySetId);

    const selection: FillSelection = {
      version: FILL_SELECTION_FORMAT_VERSION,
      opportunitySetId: result.opportunitySetId,
      sourceFingerprint: result.sourceFingerprint,
      decisions: result.windows.map((window, index) => ({
        windowId: window.id,
        decision: index === 0 ? "use" : "skip",
        reason: index === 0 ? "Best phrase bridge, low hand cost" : "Lower score",
      })),
    };
    expect(parseFillSelectionToon(encodeFillSelection(selection))).toEqual({
      valid: true,
      errors: [],
      value: selection,
    });
    expect(validateFillSelection(result, selection).valid).toBe(true);
  });

  it("rejects malformed headers and unexpected compact-contract rows", () => {
    const malformedSelection = [
      FILL_SELECTION_FORMAT_VERSION,
      "set,set-1",
      "source,source-1",
      "decisions: [wrong-header]",
      "comment,this row is not legal",
    ].join("\n");
    const malformedComposition = [
      FILL_COMPOSITION_FORMAT_VERSION,
      "source,source-1",
      "set,set-1",
      "notes: [N,candidate,durationSteps,finger]",
    ].join("\n");

    expect(parseFillSelectionToon(malformedSelection).valid).toBe(false);
    expect(parseFillCompositionToon(malformedComposition).valid).toBe(false);
  });

  it("validates candidate ownership and deterministically merges duration/provenance", () => {
    const result = analysis();
    const chosenWindow = result.windows[0];
    const chosenCandidate = result.candidates.find(item => (
      item.windowId === chosenWindow.id && item.harmonicRole !== "scale-approach"
    ));
    expect(chosenCandidate).toBeDefined();
    if (!chosenCandidate) return;

    const selection: FillSelection = {
      version: FILL_SELECTION_FORMAT_VERSION,
      opportunitySetId: result.opportunitySetId,
      sourceFingerprint: result.sourceFingerprint,
      decisions: result.windows.map(window => ({
        windowId: window.id,
        decision: window.id === chosenWindow.id ? "use" : "skip",
        reason: "Test decision",
      })),
    };
    const composition: FillComposition = {
      version: FILL_COMPOSITION_FORMAT_VERSION,
      opportunitySetId: result.opportunitySetId,
      sourceFingerprint: result.sourceFingerprint,
      entries: [{ candidateId: chosenCandidate.id, durationSteps: 1, finger: chosenCandidate.suggestedFinger }],
    };
    const parsed = parseFillCompositionToon(encodeFillComposition(composition));
    expect(parsed).toEqual({ valid: true, errors: [], value: composition });

    const validated = validateFillComposition(result, selection, composition);
    expect(validated.valid).toBe(true);
    const merged = mergeAcceptedFills([sourceMeasure()], result, validated);
    const mergedEvent = merged[0].grid
      .flatMap(step => step.tablature ?? [])
      .find(event => event.fillCandidateId === chosenCandidate.id);
    expect(mergedEvent).toMatchObject({
      role: "fill",
      durationSteps: 1,
      fillWindowId: chosenWindow.id,
      fillCandidateId: chosenCandidate.id,
    });
    expect(sourceMeasure().grid.flatMap(step => step.tablature ?? []).some(event => event.fillCandidateId)).toBe(false);
  });

  it("rejects stale bindings, duplicate candidates, and notes in skipped windows", () => {
    const result = analysis();
    const candidate = result.candidates[0];
    const selection: FillSelection = {
      version: FILL_SELECTION_FORMAT_VERSION,
      opportunitySetId: result.opportunitySetId,
      sourceFingerprint: result.sourceFingerprint,
      decisions: result.windows.map(window => ({ windowId: window.id, decision: "skip", reason: "rest" })),
    };
    const composition: FillComposition = {
      version: FILL_COMPOSITION_FORMAT_VERSION,
      opportunitySetId: "stale-set",
      sourceFingerprint: result.sourceFingerprint,
      entries: [
        { candidateId: candidate.id, durationSteps: 1, finger: "i" },
        { candidateId: candidate.id, durationSteps: 1, finger: "m" },
      ],
    };

    const validated = validateFillComposition(result, selection, composition);
    expect(validated.valid).toBe(false);
    expect(validated.message).toContain("stale");
    expect(validated.message).toContain("used only once");
    expect(validated.message).toContain("not selected");
  });
});
