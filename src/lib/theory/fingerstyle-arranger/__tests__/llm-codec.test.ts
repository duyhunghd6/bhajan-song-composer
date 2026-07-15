import { describe, expect, it } from "vitest";
import type { GuitarVoicingQueryMatch } from "../../guitar-voicings";
import type { TimeSliceMeasure } from "../time-slice";
import {
  applyFingerstyleTablatureToon,
  formatFingerstyleTablatureAsToon,
  formatGuitarVoicingsAsToon,
} from "../llm-codec";

function sourceMeasure(measure = 3): TimeSliceMeasure {
  return {
    measure,
    lineIndex: 1,
    style_profile: {
      key: "Em",
      comping_style: "Sparse PIMA",
      voicing_plan: "Open anchors",
      fill_density: "few",
    },
    pickupDurationUnits: 8,
    source_abc: { melody: "E2 F2", lyric: "Ja-go", beatWeight: "⬤ *" },
    grid: [
      {
        step: 1,
        chord: "Em",
        weight: "⬤",
        melody: { pitch: "E4", state: "attack" },
        lyric: "Ja-",
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "bass" },
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      },
      {
        step: 2,
        chord: "Em",
        weight: null,
        melody: { pitch: "E4", state: "sustain" },
        lyric: null,
        tablature: [],
      },
      {
        step: 3,
        chord: "Em",
        weight: null,
        melody: { pitch: null, state: "rest" },
        lyric: null,
        tablature: [{ string: 3, fret: 0, finger: null, role: "fill" }],
      },
    ],
  };
}

describe("fingerstyle LLM codec", () => {
  it("formats guitar voicings as a compact readable table", () => {
    const matches: GuitarVoicingQueryMatch[] = [
      {
        bass: { string: 6, fret: 10 },
        melody: { string: 1, fret: 10 },
        fretDistance: 1,
        available_inner_strings: [5, 4, 3, 2],
        frets: [10, 0, 0, 11, 10, 10],
        barre: { fret: 10, fromString: 6, toString: 1 },
      },
      {
        bass: { string: 5, fret: 0 },
        melody: { string: 1, fret: 10 },
        fretDistance: 1,
        available_inner_strings: [4, 3],
        frets: ["X", 0, 0, 11, "X", 10],
      },
    ];

    const toon = formatGuitarVoicingsAsToon(matches);

    expect(toon).toBe([
      "voicings:v1 rows=2",
      "{rank,span,frets_6_to_1,bass,melody,inner,barre}",
      "1,1,10/0/0/11/10/10,6/10,1/10,5/4/3/2,10/6-1",
      "2,1,X/0/0/11/X/10,5/0,1/10,4/3,-",
    ].join("\n"));
    expect(toon).not.toContain('"available_inner_strings"');
    expect(toon.length).toBeLessThan(JSON.stringify(matches).length * 0.55);
  });

  it("round-trips tablature while preserving server-owned metadata", () => {
    const arranged = sourceMeasure();
    const source = {
      ...arranged,
      grid: arranged.grid.map((step) => ({ ...step, tablature: undefined })),
    };
    const sourceMelody = source.grid.map(step => ({
      step: step.step,
      chord: step.chord,
      weight: step.weight,
      melody: step.melody,
      lyric: step.lyric,
    }));

    const toon = formatFingerstyleTablatureAsToon([arranged]);
    const decoded = applyFingerstyleTablatureToon(toon, [source]);

    expect(toon).toBe([
      "tablature:v1",
      "{measure,step,string,fret,finger,role}",
      "3,1,6,0,p,bass",
      "3,1,1,0,a,melody",
      "3,3,3,0,-,fill",
    ].join("\n"));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    expect(decoded.measures[0]).toMatchObject({
      measure: arranged.measure,
      lineIndex: arranged.lineIndex,
      style_profile: arranged.style_profile,
      pickupDurationUnits: arranged.pickupDurationUnits,
      source_abc: arranged.source_abc,
    });
    expect(decoded.measures[0].grid.map((step) => ({
      step: step.step,
      chord: step.chord,
      weight: step.weight,
      melody: step.melody,
      lyric: step.lyric,
      tablature: step.tablature,
    }))).toEqual(arranged.grid.map((step) => ({
      step: step.step,
      chord: step.chord,
      weight: step.weight,
      melody: step.melody,
      lyric: step.lyric,
      tablature: step.tablature,
    })));
    expect(decoded.measures[0].grid.map(step => ({
      step: step.step,
      chord: step.chord,
      weight: step.weight,
      melody: step.melody,
      lyric: step.lyric,
    }))).toEqual(sourceMelody);
    expect(toon.length).toBeLessThan(220);
  });

  it("supports a header-only table as an empty complete replacement", () => {
    const source = sourceMeasure();
    const decoded = applyFingerstyleTablatureToon(
      "tablature:v1\n{measure,step,string,fret,finger,role}",
      [source],
    );

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.measures[0].grid.every((step) => step.tablature?.length === 0)).toBe(true);
    }
  });

  it.each([
    ["wrong version", "tablature:v2\n{measure,step,string,fret,finger,role}", "format-version"],
    ["wrong header", "tablature:v1\n{measure,step,string,fret,role}", "format-header"],
    ["wrong column count", "tablature:v1\n{measure,step,string,fret,finger,role}\n3,1,6,0,p", "column-count"],
    ["unknown measure", "tablature:v1\n{measure,step,string,fret,finger,role}\n9,1,6,0,p,bass", "unknown-measure"],
    ["unknown step", "tablature:v1\n{measure,step,string,fret,finger,role}\n3,99,6,0,p,bass", "unknown-step"],
    ["invalid string", "tablature:v1\n{measure,step,string,fret,finger,role}\n3,1,7,0,p,bass", "string-number"],
    ["negative fret", "tablature:v1\n{measure,step,string,fret,finger,role}\n3,1,6,-1,p,bass", "fret-number"],
    ["invalid finger", "tablature:v1\n{measure,step,string,fret,finger,role}\n3,1,6,0,x,bass", "finger"],
    ["invalid role", "tablature:v1\n{measure,step,string,fret,finger,role}\n3,1,6,0,p,chord", "role"],
    [
      "duplicate string",
      "tablature:v1\n{measure,step,string,fret,finger,role}\n3,1,6,0,p,bass\n3,1,6,2,i,fifth",
      "duplicate-string",
    ],
  ])("rejects %s", (_label, toon, expectedCode) => {
    const decoded = applyFingerstyleTablatureToon(toon, [sourceMeasure()]);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error.code).toBe(expectedCode);
  });
});
