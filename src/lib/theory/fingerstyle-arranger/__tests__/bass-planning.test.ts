import { describe, expect, it } from "vitest";
import {
  analyzeBassPitchCandidates,
  analyzeBassPositions,
  materializeBassFoundation,
  validateBassPitchSelection,
} from "../bass-planning";
import type { TimeSliceMeasure } from "../time-slice";

function makeMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: { key: "Em", comping_style: "PIMA", voicing_plan: "Open Em" },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: index === 0 || index === 8 ? (index === 0 ? "⬤" as const : "●" as const) : null,
      melody: index === 0
        ? { pitch: "E4", state: "attack" as const }
        : index < 4
          ? { pitch: "E4", state: "sustain" as const }
          : { pitch: null, state: "rest" as const },
      lyric: null,
    })),
  };
}

describe("bass planning", () => {
  it("excludes reserved fill positions and materializes a candidate-selected bass", () => {
    const measures = [makeMeasure()];
    const positions = analyzeBassPositions({ measures, sourceFingerprint: "source", reservedFillSlotIds: ["fr-m1-s9"] });
    expect(positions.positions.map(position => position.id)).toEqual(["bp-m1-s1"]);

    const pitches = analyzeBassPitchCandidates({
      positions: positions.positions, positionSetId: positions.setId, sourceFingerprint: "source", skillLevel: "beginner",
    });
    const root = pitches.candidates.find(candidate => candidate.pitch === "E2" && candidate.role === "root");
    expect(root).toBeDefined();
    const validated = validateBassPitchSelection(pitches, ["bp-m1-s1"], {
      setId: pitches.setId, sourceFingerprint: "source", candidateIds: [root!.id],
    });
    expect(validated.valid).toBe(true);

    const materialized = materializeBassFoundation(measures, validated.selected, "beginner", 5);
    expect(materialized[0].grid[0].tablature).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "melody", string: 1, fret: 0 }),
      expect.objectContaining({ role: "root", string: 6, fret: 0 }),
    ]));
  });

  it("does not offer non-harmonic annotations as bass positions", () => {
    const measure = makeMeasure();
    measure.grid[0].chord = "^Chorus";

    const positions = analyzeBassPositions({ measures: [measure], sourceFingerprint: "source", reservedFillSlotIds: [] });
    expect(positions.positions.map(position => position.id)).not.toContain("bp-m1-s1");

    const pitches = analyzeBassPitchCandidates({
      positions: positions.positions,
      positionSetId: positions.setId,
      sourceFingerprint: "source",
      skillLevel: "beginner",
    });
    expect(positions.positions.every(position => pitches.candidates.some(candidate => candidate.positionId === position.id))).toBe(true);
  });

  it("sustains co-onset bass for the source melody duration", () => {
    const measures = [makeMeasure()];
    const positions = analyzeBassPositions({ measures, sourceFingerprint: "source", reservedFillSlotIds: [] });
    const pitches = analyzeBassPitchCandidates({
      positions: positions.positions,
      positionSetId: positions.setId,
      sourceFingerprint: "source",
      skillLevel: "beginner",
    });
    const rootAtMelodyAttack = pitches.candidates.find(candidate => (
      candidate.positionId === "bp-m1-s1" && candidate.pitch === "E2" && candidate.role === "root"
    ));
    const rootDuringRest = pitches.candidates.find(candidate => (
      candidate.positionId === "bp-m1-s9" && candidate.pitch === "E2" && candidate.role === "root"
    ));

    expect(rootAtMelodyAttack).toBeDefined();
    expect(rootDuringRest).toBeDefined();

    const materialized = materializeBassFoundation(
      measures,
      [rootAtMelodyAttack!, rootDuringRest!],
      "beginner",
      5,
    );

    expect(materialized[0].grid[0].tablature).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "melody", durationSteps: 4 }),
      expect.objectContaining({ role: "root", durationSteps: 4 }),
    ]));
    expect(materialized[0].grid[8].tablature).toEqual([
      expect.objectContaining({ role: "root", durationSteps: 1 }),
    ]);
  });

  it("filters bass candidates that cannot share the authoritative high melody grip", () => {
    const measure = makeMeasure();
    measure.grid[0].chord = "C";
    measure.grid[0].melody = { pitch: "E5", state: "attack" };
    const positions = analyzeBassPositions({ measures: [measure], sourceFingerprint: "source", reservedFillSlotIds: [] });

    const pitches = analyzeBassPitchCandidates({
      positions: positions.positions,
      positionSetId: positions.setId,
      sourceFingerprint: "source",
      skillLevel: "beginner",
      measures: [measure],
      maxMelodyFret: 12,
    });

    expect(pitches.candidates.filter(candidate => candidate.positionId === "bp-m1-s1")).toEqual([]);
    expect(pitches.unavailablePositionIds).toContain("bp-m1-s1");
    const validated = validateBassPitchSelection(pitches, ["bp-m1-s1"], {
      setId: pitches.setId,
      sourceFingerprint: "source",
      candidateIds: [],
    });
    expect(validated.valid).toBe(true);
  });

  it("clears stale fills while rebuilding the pre-fill foundation", () => {
    const measureFour = { ...makeMeasure(), measure: 4 };
    const measureFive = { ...makeMeasure(), measure: 5 };
    measureFour.grid[3].tablature = [{ string: 3, fret: 2, finger: "i", role: "fill" }];
    measureFive.grid[5].tablature = [{ string: 2, fret: 3, finger: "m", role: "fill" }];

    const positions = analyzeBassPositions({
      measures: [measureFour, measureFive],
      sourceFingerprint: "source",
      reservedFillSlotIds: [],
    });
    const pitches = analyzeBassPitchCandidates({
      positions: positions.positions,
      positionSetId: positions.setId,
      sourceFingerprint: "source",
      skillLevel: "beginner",
    });
    const selected = pitches.candidates.filter(candidate => (
      candidate.positionId === "bp-m4-s1" || candidate.positionId === "bp-m5-s1"
    ) && candidate.role === "root" && candidate.fret === 0);

    const materialized = materializeBassFoundation(
      [measureFour, measureFive],
      selected,
      "beginner",
      5,
    );

    expect(materialized[0].grid[0].tablature).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "melody" }),
      expect.objectContaining({ role: "root" }),
    ]));
    expect(materialized[0].grid[3].tablature).toEqual([]);
    expect(materialized[1].grid[5].tablature).toEqual([]);
    expect(materialized.flatMap(measure => measure.grid).flatMap(step => step.tablature ?? []))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ role: "fill" })]));
  });
});
