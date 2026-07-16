import { describe, expect, it } from "vitest";

import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import {
  createFingerstyleLineGenerationCoordinator,
  mergeGeneratedFingerstyleLineMeasures,
  replaceGeneratedFingerstyleLineMeasures,
} from "../fingerstyle-line-measures";

function measure(number: number, lineIndex: number, marker: string): TimeSliceMeasure {
  return {
    measure: number,
    lineIndex,
    style_profile: { key: "Em", comping_style: marker, voicing_plan: marker },
    grid: [{
      step: 1,
      chord: "Em",
      weight: "⬤",
      melody: { pitch: "E4", state: "attack" },
      lyric: "Hari",
    }],
  };
}

function generatedMeasure(number: number, lineIndex: number): TimeSliceMeasure {
  const generated = measure(number, lineIndex, "generated");
  generated.grid[0].tablature = [{ string: 6, fret: 0, finger: "p", role: "bass", durationSteps: 1 }];
  return generated;
}

describe("mergeGeneratedFingerstyleLineMeasures", () => {
  it("merges generated tablature without changing source-owned fields or sibling lines", () => {
    const lineOne = measure(1, 0, "source-line-one");
    const lineTwo = measure(2, 1, "source-line-two");
    const result = mergeGeneratedFingerstyleLineMeasures(
      [lineOne, lineTwo],
      0,
      [generatedMeasure(1, 0)],
    );

    expect(result).not.toBeNull();
    expect(result?.[0].style_profile.comping_style).toBe("source-line-one");
    expect(result?.[0].grid[0].tablature).toEqual([
      { string: 6, fret: 0, finger: "p", role: "bass", durationSteps: 1 },
    ]);
    expect(result?.[1]).toBe(lineTwo);
  });

  it("rejects missing, unknown, or source-drifting returned measures", () => {
    const existing = measure(1, 0, "source");
    const unknown = generatedMeasure(99, 0);
    const drifted = generatedMeasure(1, 0);
    drifted.grid[0].melody = { pitch: "F4", state: "attack" };

    expect(mergeGeneratedFingerstyleLineMeasures([existing], 0, [unknown])).toBeNull();
    expect(mergeGeneratedFingerstyleLineMeasures([existing], 0, [drifted])).toBeNull();
    expect(replaceGeneratedFingerstyleLineMeasures([existing], [unknown])).toEqual([existing]);
  });
});

describe("createFingerstyleLineGenerationCoordinator", () => {
  it("allows independent lines to finish in either order but rejects duplicate claims", () => {
    const coordinator = createFingerstyleLineGenerationCoordinator();
    const first = coordinator.claim(0);
    const second = coordinator.claim(1);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(coordinator.claim(0)).toBeNull();
    expect(coordinator.canApply(second!)).toBe(true);
    coordinator.markLineApplied(1);
    coordinator.release(second!);
    expect(coordinator.canApply(first!)).toBe(true);
  });

  it("rejects results after the same line changes or the document is replaced", () => {
    const coordinator = createFingerstyleLineGenerationCoordinator();
    const first = coordinator.claim(0)!;

    coordinator.markLineApplied(0);
    expect(coordinator.canApply(first)).toBe(false);

    const second = coordinator.claim(1)!;
    coordinator.invalidateDocument();
    expect(coordinator.canApply(second)).toBe(false);
    expect(coordinator.activeLineIndexes()).toEqual([]);
  });
});
