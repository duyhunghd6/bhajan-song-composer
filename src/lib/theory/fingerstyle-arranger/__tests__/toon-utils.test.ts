import { describe, expect, it } from "vitest";
import type { TimeSliceMeasure } from "../time-slice";
import { formatLineAsToon, formatMeasureAsToon } from "../toon-utils";

const measure: TimeSliceMeasure = {
  measure: 1,
  lineIndex: 0,
  style_profile: {
    key: "Em",
    comping_style: "Sparse PIMA",
    voicing_plan: "Open anchors",
    fill_density: "few",
  },
  grid: [{
    step: 1,
    chord: "Em",
    weight: "⬤",
    melody: { pitch: "E4", state: "attack" },
    lyric: "Ja-",
    tablature: [
      { string: 6, fret: 0, finger: "p", role: "bass" },
      { string: 1, fret: 0, finger: "a", role: "melody" },
    ],
  }],
};

describe("fingerstyle TOON formatting", () => {
  it("keeps tablature in the default editable format", () => {
    const toon = formatMeasureAsToon(measure);

    expect(toon).toContain("{step, chord, weight, melody.pitch, melody.state, lyric, tablature}");
    expect(toon).toContain('"string":6');
    expect(toon).toContain('"role":"melody"');
  });

  it("omits the tablature column for compact model source context", () => {
    const toon = formatMeasureAsToon(measure, { tablature: "omit" });

    expect(toon).toContain("{step, chord, weight, melody.pitch, melody.state, lyric}");
    expect(toon).not.toContain("tablature");
    expect(toon).not.toContain('"string"');
    expect(toon).toContain('1, "Em", "⬤", "E4", "attack", "Ja-"');
  });

  it("forwards omit mode through every measure in a line", () => {
    const toon = formatLineAsToon([measure, { ...measure, measure: 2 }], { tablature: "omit" });

    expect(toon.match(/\{step, chord, weight, melody\.pitch, melody\.state, lyric\}/g)).toHaveLength(2);
    expect(toon).not.toContain("tablature");
  });
});
