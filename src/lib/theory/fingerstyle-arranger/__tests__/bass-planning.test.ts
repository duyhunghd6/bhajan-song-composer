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
      melody: { pitch: index === 0 ? "E4" : null, state: index === 0 ? "attack" as const : "rest" as const },
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
});
