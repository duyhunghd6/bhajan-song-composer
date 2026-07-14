import { describe, expect, it } from "vitest";

import { analyzeAuthoritativeMelodyPlayability } from "../source-playability";
import type { TimeSliceMeasure } from "../time-slice";

function measure(pitch: string): TimeSliceMeasure {
  return {
    measure: 4,
    lineIndex: 0,
    style_profile: {
      key: "G",
      comping_style: "Sparse PIMA",
      voicing_plan: "Open position",
      fill_density: "few",
    },
    grid: [{
      step: 1,
      chord: "Am",
      weight: "⬤",
      melody: { pitch, state: "attack" },
      lyric: "Jay",
    }],
  };
}

describe("authoritative melody playability", () => {
  it("labels Ganesha B4 as a melody-only beginner exception", () => {
    const analysis = analyzeAuthoritativeMelodyPlayability([measure("B4")], "beginner");

    expect(analysis).toMatchObject({
      playable: true,
      accompanimentMaxFret: 5,
      melodyMaxFret: 7,
    });
    expect(analysis.exceptions).toEqual([
      expect.objectContaining({
        measure: 4,
        step: 1,
        pitch: "B4",
        preferredPosition: { string: 1, fret: 7 },
      }),
    ]);
  });

  it("keeps open-position melody inside the selected skill limit", () => {
    const analysis = analyzeAuthoritativeMelodyPlayability([measure("E4")], "beginner");

    expect(analysis.playable).toBe(true);
    expect(analysis.exceptions).toHaveLength(0);
    expect(analysis.melodyMaxFret).toBe(5);
  });

  it("reports malformed and physically unreachable source pitches", () => {
    const malformed = analyzeAuthoritativeMelodyPlayability([measure("not-a-note")], "beginner");
    const unreachable = analyzeAuthoritativeMelodyPlayability([measure("C7")], "beginner");

    expect(malformed.playable).toBe(false);
    expect(malformed.issues[0]?.message).toContain("not valid scientific pitch notation");
    expect(unreachable.playable).toBe(false);
    expect(unreachable.issues[0]?.message).toContain("outside the classical guitar range");
  });
});
