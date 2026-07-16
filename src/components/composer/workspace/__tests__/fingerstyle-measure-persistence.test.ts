import { describe, expect, it } from "vitest";
import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import {
  buildGeneratedGuitarAbc,
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

function withGaneshaTablature(measure: TimeSliceMeasure): TimeSliceMeasure {
  const attacks = new Map<number, NonNullable<TimeSliceMeasure["grid"][number]["tablature"]>>([
    [0, [
      { string: 6, fret: 0, finger: "p", role: "bass" },
      { string: 3, fret: 0, finger: "i", role: "fill" },
      { string: 2, fret: 0, finger: "m", role: "melody" },
    ]],
    [2, [{ string: 2, fret: 5, finger: "m", role: "melody" }]],
    [4, [{ string: 3, fret: 0, finger: "i", role: "fill" }]],
    [6, [{ string: 2, fret: 0, finger: "m", role: "melody" }]],
    [14, [{ string: 3, fret: 4, finger: "i", role: "melody" }]],
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
      { string: 2, fret: 5, finger: "m", role: "melody" },
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

  it("rebuilds the exact forced Ganesha Guitar voice", () => {
    const sourceAbc = `X:1\nT:Ganesha\nM:4/4\nL:1/8\nK:G\n| [eBGE,] e G B4 B |`;
    const generated = buildGeneratedGuitarAbc(
      [withGaneshaTablature(makeMeasure("[eBGE,] e G B4 B"))],
      sourceAbc,
    );

    expect(generated).toContain(
      "[!2!B!3!G-!6!E,-]/2 [!3!G-!6!E,-]/2 [!2!e-!3!G!6!E,-] [!2!e!3!G-!6!E,-] [!2!B-!3!G!6!E,-]4 [!2!B!3!B!6!E,]",
    );
  });
});
