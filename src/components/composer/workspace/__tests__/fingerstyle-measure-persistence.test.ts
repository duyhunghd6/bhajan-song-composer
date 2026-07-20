import { describe, expect, it } from "vitest";
import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import type { FingerstyleFillGenerationSummary, FingerstyleLineGenerationRun } from "@/app/actions/fingerstyle-line-arranger";
import type { FillBoundaryEvidence, FillOpportunityScoreBreakdown } from "@/lib/theory/fingerstyle-arranger/fill-opportunities";
import type { GuitarStringNumber } from "@/lib/theory/fingerstyle-compressor";
import {
  buildGeneratedGuitarAbc,
  restoreFingerstyleGenerationRuns,
  restorePersistedTablature,
  serializeFingerstyleMeasures,
} from "../fingerstyle-measure-persistence";

function makeMeasure(sourceMelody: string): TimeSliceMeasure {
  return {
    measure: 5,
    lineIndex: 0,
    style_profile: {
      key: "G",
      comping_style: "PIMA",
      voicing_plan: "Open Em",
    },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: index === 0 ? "⬤" as const : null,
      melody: {
        pitch: index === 0 ? "B3" : null,
        state: index === 0 ? "attack" as const : "rest" as const,
      },
      lyric: null,
    })),
    source_abc: {
      melody: sourceMelody,
      lyric: "",
      beatWeight: "",
    },
  };
}

function withCrossMeasureContinuity(measure: TimeSliceMeasure, lineIndex: number): TimeSliceMeasure {
  return {
    ...measure,
    lineIndex,
    grid: measure.grid.map((step, index) => ({
      ...step,
      tablature: index === 0
        ? [{ string: 1, fret: 0, finger: null, role: "imported" as const, durationSteps: 16 }]
        : undefined,
    })),
  };
}

function withGaneshaTablature(measure: TimeSliceMeasure): TimeSliceMeasure {
  const attacks = new Map<number, NonNullable<TimeSliceMeasure["grid"][number]["tablature"]>>([
    [0, [
      { string: 6, fret: 0, finger: "p", role: "bass", durationSteps: 16 },
      { string: 3, fret: 0, finger: "i", role: "fill", durationSteps: 4 },
      { string: 2, fret: 0, finger: "m", role: "melody", durationSteps: 1 },
    ]],
    [2, [{ string: 2, fret: 5, finger: "m", role: "melody", durationSteps: 4 }]],
    [4, [{ string: 3, fret: 0, finger: "i", role: "fill", durationSteps: 10 }]],
    [6, [{ string: 2, fret: 0, finger: "m", role: "melody", durationSteps: 10 }]],
    [14, [{ string: 3, fret: 4, finger: "i", role: "melody", durationSteps: 2 }]],
  ]);
  return {
    ...measure,
    grid: measure.grid.map((step, index) => ({
      ...step,
      tablature: attacks.get(index),
    })),
  };
}

describe("fingerstyle measure persistence", () => {
  it("restores tablature while refreshing source-derived measure fields", () => {
    const fresh = makeMeasure("current melody");
    const persisted = withGaneshaTablature(makeMeasure("stale melody"));
    const saved = serializeFingerstyleMeasures([persisted], "current-source");

    const [restored] = restorePersistedTablature(saved, [fresh], "current-source");

    expect(restored.source_abc?.melody).toBe("current melody");
    expect(restored.grid[2].tablature).toEqual([
      { string: 2, fret: 5, finger: "m", role: "melody", durationSteps: 4 },
    ]);
  });

  it("rejects versioned data from a different source", () => {
    const fresh = makeMeasure("current melody");
    const saved = serializeFingerstyleMeasures(
      [withGaneshaTablature(makeMeasure("stale melody"))],
      "old-source",
    );

    const [restored] = restorePersistedTablature(saved, [fresh], "current-source");

    expect(restored).toBe(fresh);
    expect(restored.grid[2].tablature).toBeUndefined();
  });

  it("rejects legacy same-count measures when their source ABC differs", () => {
    const fresh = makeMeasure("current melody");
    const saved = JSON.stringify([withGaneshaTablature(makeMeasure("stale melody"))]);

    const [restored] = restorePersistedTablature(saved, [fresh], "current-source");

    expect(restored).toBe(fresh);
    expect(restored.grid[2].tablature).toBeUndefined();
  });

  it("falls back to fresh measures for malformed browser storage", () => {
    const fresh = makeMeasure("current melody");

    expect(restorePersistedTablature("{not-json", [fresh], "current-source")).toEqual([fresh]);
  });

  it("rejects invalid tablature events before overlaying them", () => {
    const fresh = makeMeasure("current melody");
    const persisted = withGaneshaTablature(makeMeasure("stale melody"));
    const saved = serializeFingerstyleMeasures([{
      ...persisted,
      grid: persisted.grid.map((step, index) => index === 0 ? {
        ...step,
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "bass" },
          { string: 6, fret: 3, finger: "i", role: "harmony" },
        ],
      } : step),
    }], "current-source");

    expect(restorePersistedTablature(saved, [fresh], "current-source")).toEqual([fresh]);
  });

  it("restores validated adjacent-bar Guitar continuity and imported events", () => {
    const fresh = [makeMeasure("current one"), { ...makeMeasure("current two"), measure: 6, lineIndex: 1 }];
    const first = {
      ...withCrossMeasureContinuity(makeMeasure("stale one"), 0),
      guitarSlurs: [{ startStep: 1, endStep: 16 }],
      guitarTiesToNext: [1 as const],
      guitarSlursToNext: [{ startStep: 1, endStep: 16 }],
    };
    const second = { ...withCrossMeasureContinuity(makeMeasure("stale two"), 1), measure: 6 };

    const restored = restorePersistedTablature(
      serializeFingerstyleMeasures([first, second], "current-source"),
      fresh,
      "current-source",
    );

    expect(restored[0].guitarSlurs).toEqual([{ startStep: 1, endStep: 16 }]);
    expect(restored[0].guitarTiesToNext).toEqual([1]);
    expect(restored[0].guitarSlursToNext).toEqual([{ startStep: 1, endStep: 16 }]);
    expect(restored[0].grid[0].tablature?.[0]?.role).toBe("imported");
    expect(restored[0].source_abc?.melody).toBe("current one");
  });

  it("rejects dangling or mismatched persisted Guitar continuity", () => {
    const fresh = [makeMeasure("current one"), { ...makeMeasure("current two"), measure: 6 }];
    const first = {
      ...withCrossMeasureContinuity(makeMeasure("stale one"), 0),
      guitarTiesToNext: [1 as const],
    };
    const mismatchedSecond = {
      ...withCrossMeasureContinuity(makeMeasure("stale two"), 0),
      measure: 6,
      grid: withCrossMeasureContinuity(makeMeasure("stale two"), 0).grid.map((step, index) => (
        index === 0 ? { ...step, tablature: [{ string: 1 as const, fret: 1, finger: null, role: "imported" as const, durationSteps: 16 }] } : step
      )),
    };

    expect(restorePersistedTablature(
      serializeFingerstyleMeasures([first, mismatchedSecond], "current-source"),
      fresh,
      "current-source",
    )).toEqual(fresh);
  });

  it("rebuilds the exact forced Ganesha Guitar voice", () => {
    const sourceAbc = `X:1\nT:Ganesha\nM:4/4\nL:1/8\nK:G\n| [eBGE,] e G B4 B |`;
    const generated = buildGeneratedGuitarAbc(
      [withGaneshaTablature(makeMeasure("[eBGE,] e G B4 B"))],
      sourceAbc,
    );

    expect(generated).toContain(
      "[!2!b!3!g-!6!E-]/2 [!3!g-!6!E-]/2 [!2!e'-!3!g!6!E-] [!2!e'!3!g-!6!E-] [!2!b-!3!g!6!E-]4 [!2!b!3!b!6!E]",
    );
  });

  it("prunes non-essential fields from lineGenerationRunsByLine and restores successfully", () => {
    const fresh = makeMeasure("melody");
    fresh.lineIndex = 0;
    fresh.measure = 5;

    const mockRun = {
      version: 1 as const,
      id: "run-abc",
      sourceFingerprint: "source-abc",
      lineIndex: 0,
      measureNumbers: [5],
      policy: {
        skillLevel: "beginner" as const,
        densityMode: "auto" as const,
        resolvedDensity: "normal" as const,
        densitySource: "skill-level" as const,
      },
      foundation: [fresh],
      opportunityAnalysis: {
        version: "fill-opportunities:v1" as const,
        opportunitySetId: "opp-set-123",
        sourceFingerprint: "source-abc",
        policy: {
          skillLevel: "beginner" as const,
          densityMode: "auto" as const,
          resolvedDensity: "normal" as const,
          densitySource: "skill-level" as const,
        },
        budget: {
          targetWindows: 2,
          maxWindows: 2,
          maxWindowsPerMeasure: 1,
          maxNotesPerWindow: 2,
        },
        evaluatedStepCount: 16,
        evaluatedPlacementCount: 5,
        rejectionCounts: {} as Record<string, number>,
        windows: [
          {
            id: "w1",
            measure: 5,
            lineIndex: 0,
            startStep: 1,
            endStep: 4,
            capacitySteps: 4,
            activeChord: "Em",
            key: "G",
            melodyContext: "rest" as const,
            protectedStrings: [1, 2],
            boundaryEvidence: { lineEnd: false } as unknown as FillBoundaryEvidence,
            score: 10,
            scoreBreakdown: {} as unknown as FillOpportunityScoreBreakdown,
            candidateIds: ["c1"],
            flags: ["test"],
          },
        ],
        candidates: [
          {
            id: "c1",
            windowId: "w1",
            measure: 5,
            step: 1,
            pitch: "G3",
            midi: 55,
            harmonicRole: "root" as const,
            string: 3 as GuitarStringNumber,
            fret: 0,
            suggestedFinger: "i" as const,
            maxDurationSteps: 4,
            incomingHandCost: 1,
            outgoingHandCost: 2,
            totalHandCost: 3,
            score: 5,
            conditions: ["legal"],
          },
        ],
      },
      options: [
        {
          id: "opt1",
          ordinal: 1,
          selection: {
            version: "fill-selection:v1" as const,
            opportunitySetId: "opp-set-123",
            sourceFingerprint: "source-abc",
            decisions: [{ windowId: "w1", decision: "use" as const, reason: "good fill" }],
          },
          composition: {
            version: "fills:v1" as const,
            opportunitySetId: "opp-set-123",
            sourceFingerprint: "source-abc",
            entries: [{ candidateId: "c1", durationSteps: 4, finger: "i" as const }],
          },
          fillSummary: {} as unknown as FingerstyleFillGenerationSummary,
          justification: { positions: [], notes: [] },
        },
      ],
      selectedOptionId: "opt1",
    };

    const savedJson = serializeFingerstyleMeasures([fresh], "source-abc", { 0: mockRun as unknown as FingerstyleLineGenerationRun });

    const parsed = JSON.parse(savedJson);

    // Verify non-essential fields are pruned from the stored JSON
    const storedRun = parsed.lineGenerationRunsByLine["0"];
    expect(storedRun).toBeDefined();

    // Check windows fields that should be stripped:
    expect(storedRun.opportunityAnalysis.windows[0].activeChord).toBeUndefined();
    expect(storedRun.opportunityAnalysis.windows[0].protectedStrings).toBeUndefined();
    expect(storedRun.opportunityAnalysis.windows[0].score).toBeUndefined();

    // Check candidates fields that should be stripped:
    expect(storedRun.opportunityAnalysis.candidates[0].pitch).toBeUndefined();
    expect(storedRun.opportunityAnalysis.candidates[0].suggestedFinger).toBeUndefined();
    expect(storedRun.opportunityAnalysis.candidates[0].conditions).toBeUndefined();

    // Verify they still have essential fields:
    expect(storedRun.opportunityAnalysis.windows[0].id).toBe("w1");
    expect(storedRun.opportunityAnalysis.candidates[0].id).toBe("c1");
    expect(storedRun.opportunityAnalysis.candidates[0].midi).toBe(55);

    // Verify restore works completely:
    const restoredRuns = restoreFingerstyleGenerationRuns(savedJson, [fresh], "source-abc");
    expect(restoredRuns[0]).toBeDefined();
    expect(restoredRuns[0].selectedOptionId).toBe("opt1");
    expect(restoredRuns[0].opportunityAnalysis.windows[0].id).toBe("w1");
    expect(restoredRuns[0].opportunityAnalysis.candidates[0].id).toBe("c1");
  });

  it("removes superseded option runs while preserving the latest canonical tablature", () => {
    const fresh = withGaneshaTablature(makeMeasure("current melody"));
    const saved = serializeFingerstyleMeasures([fresh], "current-source", {});

    expect(restoreFingerstyleGenerationRuns(saved, [makeMeasure("current melody")], "current-source")).toEqual({});
    const [restored] = restorePersistedTablature(saved, [makeMeasure("current melody")], "current-source");
    expect(restored.grid[0].tablature?.some(event => event.role === "bass")).toBe(true);
  });

  it("drops a run whose storage key does not match its line index", () => {
    const fresh = makeMeasure("current melody");
    const saved = serializeFingerstyleMeasures([fresh], "current-source");
    const payload = JSON.parse(saved);
    payload.lineGenerationRunsByLine = {
      1: {
        version: 1,
        id: "mismatched",
        sourceFingerprint: "current-source",
        lineIndex: 0,
        measureNumbers: [5],
        policy: {},
        foundation: [fresh],
        opportunityAnalysis: { opportunitySetId: "set", windows: [], candidates: [] },
        options: [{
          id: "option-1",
          ordinal: 1,
          selection: { sourceFingerprint: "current-source", opportunitySetId: "set", decisions: [] },
          composition: { sourceFingerprint: "current-source", opportunitySetId: "set", entries: [] },
        }],
        selectedOptionId: "option-1",
      },
    };

    expect(restoreFingerstyleGenerationRuns(JSON.stringify(payload), [fresh], "current-source")).toEqual({});
  });
});
