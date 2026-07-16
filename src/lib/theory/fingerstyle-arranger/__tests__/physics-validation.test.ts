import { describe, expect, it } from "vitest";

import { validateFingerstylePhysicsDetailed } from "../physics-validation";
import type { TimeSliceGridStep } from "../time-slice";

function step(
  number: number,
  tablature: NonNullable<TimeSliceGridStep["tablature"]>,
): TimeSliceGridStep {
  return {
    step: number,
    chord: "Em",
    weight: null,
    melody: { pitch: null, state: "rest" },
    lyric: null,
    tablature,
  };
}

describe("fingerstyle physical validation policy", () => {
  it("uses skill-specific fret limits when the caller supplies a generation policy", () => {
    const grid = [step(1, [{ string: 2, fret: 7, finger: "m", role: "harmony" }])];

    expect(validateFingerstylePhysicsDetailed(grid, { skillLevel: "beginner" }).issues)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: "fret-limit-exceeded" })]));
    expect(validateFingerstylePhysicsDetailed(grid, { skillLevel: "intermediate" }).issues)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ code: "fret-limit-exceeded" })]));
  });

  it("allows an exact authoritative melody exception without relaxing accompaniment frets", () => {
    const melodyStep = step(1, [{ string: 1, fret: 7, finger: "a", role: "melody" }]);
    melodyStep.weight = "⬤";
    melodyStep.melody = { pitch: "B4", state: "attack" };

    expect(validateFingerstylePhysicsDetailed([melodyStep], {
      skillLevel: "beginner",
      maxMelodyFret: 7,
    }).valid).toBe(true);

    const harmonyStep = step(1, [{ string: 1, fret: 7, finger: "a", role: "harmony" }]);
    expect(validateFingerstylePhysicsDetailed([harmonyStep], {
      skillLevel: "beginner",
      maxMelodyFret: 7,
    }).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "fret-limit-exceeded" }),
    ]));
  });

  it("validates sounding durations rather than only simultaneous attacks", () => {
    const grid = [
      step(1, [{ string: 2, fret: 0, finger: "m", role: "fill", durationSteps: 2 }]),
      step(2, [{ string: 2, fret: 1, finger: "m", role: "harmony" }]),
    ];
    const result = validateFingerstylePhysicsDetailed(grid, { skillLevel: "beginner" });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "sounding-string-collision" }),
    ]));
  });

  it("rejects durations that extend outside the measure grid", () => {
    const result = validateFingerstylePhysicsDetailed([
      step(1, [{ string: 3, fret: 0, finger: "i", role: "fill", durationSteps: 2 }]),
    ]);

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "duration-out-of-range" }),
    ]));
  });

  it("counts only true fills against none density and treats root/fifth as bass foundation", () => {
    const root = step(1, [{ string: 6, fret: 0, finger: "p", role: "root" }]);
    const fifth = step(2, [{ string: 5, fret: 2, finger: "p", role: "fifth" }]);
    const foundation = validateFingerstylePhysicsDetailed([root, fifth], { fillDensity: "none" });
    expect(foundation.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "fill-density-none-exceeded" }),
    ]));
    expect(foundation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "bass-on-unweighted-step" }),
    ]));

    const fill = validateFingerstylePhysicsDetailed([
      step(1, [{ string: 3, fret: 0, finger: "i", role: "fill" }]),
    ], { fillDensity: "none" });
    expect(fill.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "fill-density-none-exceeded" }),
    ]));
  });
});
