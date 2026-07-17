import { describe, expect, it } from "vitest";
import {
  formatImportedTimeGridDocumentCompact,
  formatImportedTimeGridDocumentCompactPresentation,
  parseImportedTimeGridDocumentCompact,
  TimeGridDocumentCodecError,
  type ImportedTimeGridDocument,
} from "../timegrid-document-codec";

const DOCUMENT: ImportedTimeGridDocument = {
  version: 1,
  source: {
    rawAbc: "X:1\r\n%%score (Melody) (Guitar)\r\n% preserved comment\r\nM:3/4\r\nK:Em\r\n[V:Melody] |: [1 E2 F2 G2 :|\r\n[V:Guitar] z6",
  },
  measures: [{
    measure: 1,
    lineIndex: 0,
    pickupDurationUnits: 2,
    sourceDurationUnits: 6,
    barline: { repeatStart: true, repeatEnd: true, volta: "1,3" },
    visualTablature: "e|--0--|",
    style_profile: {
      key: "Em",
      comping_style: "PIMA",
      voicing_plan: "open position",
      fill_density: "few",
    },
    source_abc: { melody: "E2 F2 G2", lyric: "Ga- ne- sha", beatWeight: "⬤ * *" },
    grid: [
      {
        step: 1,
        chord: "Em",
        weight: "⬤",
        melody: { pitch: "E4", state: "attack" },
        lyric: "Ga-",
        tablature: [
          { string: 1, fret: 0, finger: "a", role: "melody", durationSteps: 2, fillWindowId: "window-1", fillCandidateId: "candidate-1" },
          { string: 2, fret: 0, finger: "m", role: "harmony" },
          { string: 3, fret: 0, finger: "i", role: "fill" },
          { string: 4, fret: 2, finger: "p", role: "fifth" },
          { string: 5, fret: 2, finger: "p", role: "root" },
          { string: 6, fret: 0, finger: "p", role: "bass" },
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
        weight: "*",
        melody: { pitch: null, state: "rest" },
        lyric: null,
      },
    ],
  }],
};

describe("compact TimeGrid document codec", () => {
  it("round-trips every canonical field deterministically", () => {
    const first = formatImportedTimeGridDocumentCompact(DOCUMENT);
    const second = formatImportedTimeGridDocumentCompact(DOCUMENT);

    expect(first).toBe(second);
    expect(parseImportedTimeGridDocumentCompact(first)).toEqual(DOCUMENT);
    expect(parseImportedTimeGridDocumentCompact(first).source.rawAbc).toBe(DOCUMENT.source.rawAbc);
    expect(JSON.parse(first).format).toBe("timegrid-document:v3");
  });

  it("uses one root style and literal melody states", () => {
    const repeated: ImportedTimeGridDocument = {
      ...DOCUMENT,
      measures: [
        DOCUMENT.measures[0],
        { ...DOCUMENT.measures[0], measure: 2, lineIndex: 1 },
      ],
    };
    const payload = formatImportedTimeGridDocumentCompact(repeated);
    const wire = JSON.parse(payload) as { style: unknown; measures: Array<{ style?: unknown; grid: Array<{ melody: { state: string } }> }> };

    expect(wire.style).toBeDefined();
    expect(wire.measures.every(measure => measure.style === undefined)).toBe(true);
    expect(wire.measures[0].grid.map(step => step.melody.state)).toEqual(["attack", "sustain", "rest"]);
    expect(parseImportedTimeGridDocumentCompact(payload)).toEqual(repeated);
  });

  it("keeps v3 for noncanonical measure identities", () => {
    const irregular: ImportedTimeGridDocument = {
      ...DOCUMENT,
      measures: [{ ...DOCUMENT.measures[0], measure: 9 }],
    };
    const payload = formatImportedTimeGridDocumentCompact(irregular);

    expect(JSON.parse(payload).format).toBe("timegrid-document:v3");
    expect(parseImportedTimeGridDocumentCompact(payload)).toEqual(irregular);
  });

  it("formats one parseable readable v3 document", () => {
    const document: ImportedTimeGridDocument = {
      ...DOCUMENT,
      measures: DOCUMENT.measures.map(measure => ({
        ...measure,
        grid: Array.from({ length: 8 }, (_, index) => ({
          ...measure.grid[index % measure.grid.length],
          step: index + 1,
        })),
      })),
    };
    const output = formatImportedTimeGridDocumentCompactPresentation(document);

    const gridItemLines = output.split("\n").filter(line => line.includes('"step":'));

    expect(output).toBe(formatImportedTimeGridDocumentCompact(document));
    expect(JSON.parse(output).format).toBe("timegrid-document:v3");
    expect(gridItemLines).toHaveLength(8);
    expect(gridItemLines[0]).toContain('"tab":[');
    expect(gridItemLines.every(line => {
      JSON.parse(line.trim().replace(/,$/, ""));
      return true;
    })).toBe(true);
    expect(parseImportedTimeGridDocumentCompact(output)).toEqual(document);
    expect(parseImportedTimeGridDocumentCompact(output).source.rawAbc).toBe(document.source.rawAbc);
  });

  it("rejects dangling cross-measure continuity records", () => {
    const wire = JSON.parse(formatImportedTimeGridDocumentCompact(DOCUMENT)) as {
      measures: Array<Record<string, unknown>>;
    };
    wire.measures[0].guitarTiesToNext = [1];
    wire.measures[0].guitarSlursToNext = [{ startStep: 1, endStep: 1 }];

    expect(() => parseImportedTimeGridDocumentCompact(JSON.stringify(wire)))
      .toThrow(TimeGridDocumentCodecError);
  });

  it.each([
    "not json",
    '{"f":"timegrid-document:v2","a":"X:1","m":[]}',
    '{"f":"timegrid-document:v1","a":"X:1","m":[[1]]}',
    '{"f":"timegrid-document:v1","a":"X:1","m":[[1,0,["C","x","y",null],null,null,null,null,null,[[1,"C",null,null,"rest",null,[[1,0,"p","bass",0,null,null]]]]]]}',
    '{"f":"timegrid-document:v1","a":"X:1","m":[[1,0,["C","x","y",null],null,null,null,null,null,[[1,"C",null,null,"rest",null,[[1,0,"p","bass",null,null,null],[1,2,"p","root",null,null,null]]]]]]}',
  ])("rejects malformed compact payloads: %s", payload => {
    expect(() => parseImportedTimeGridDocumentCompact(payload)).toThrow(TimeGridDocumentCodecError);
  });
});
