import { describe, expect, it } from "vitest";
import { buildAbcDurationContext } from "../../abc-duration";
import { getKeyAccidentalsFromAbc } from "../../abc-key-signature";
import { convertTimeSliceMeasureToAbc, type TimeSliceMeasure } from "../time-slice";
import { findDuplicateTabStrings, projectTabEvents, renderAsciiGuitarTab } from "../toon-utils";

const sourceAbc = "M:4/4\nL:1/8\nK:Em\nE E |";

function makeMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: { key: "Em", comping_style: "PIMA", voicing_plan: "Open Em" },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: index === 0 ? "⬤" as const : null,
      melody: { pitch: index === 0 ? "E4" : null, state: index === 0 ? "attack" as const : "rest" as const },
      lyric: null,
      tablature: index === 0
        ? [
            { string: 6 as const, fret: 0, finger: "p" as const, role: "root" as const },
            { string: 4 as const, fret: 0, finger: "i" as const, role: "fifth" as const },
            { string: 1 as const, fret: 0, finger: "a" as const, role: "melody" as const },
          ]
        : undefined,
    })),
  };
}

describe("heuristic physical tab parity", () => {
  it("uses the same string/fret events for ASCII-GuitarTab and forced ABC", () => {
    const measure = makeMeasure();
    const events = projectTabEvents(measure.grid);
    const abc = convertTimeSliceMeasureToAbc(
      measure,
      buildAbcDurationContext(sourceAbc),
      getKeyAccidentalsFromAbc(sourceAbc),
      true,
    );

    expect(abc).toContain("!1!e");
    expect(abc).toContain("!4!D");
    expect(abc).toContain("!6!E,");
    expect(renderAsciiGuitarTab(measure.grid)).toContain("e|-0");
    expect(events.map(event => [event.step, event.string, event.fret])).toEqual([
      [1, 6, 0],
      [1, 4, 0],
      [1, 1, 0],
    ]);
  });

  it("exposes duplicate physical strings instead of silently treating them as parity", () => {
    const measure = makeMeasure();
    measure.grid[0].tablature!.push({ string: 1, fret: 0, finger: "m", role: "fill" });

    expect(findDuplicateTabStrings(measure.grid)).toEqual([{ step: 1, string: 1 }]);
  });
});
