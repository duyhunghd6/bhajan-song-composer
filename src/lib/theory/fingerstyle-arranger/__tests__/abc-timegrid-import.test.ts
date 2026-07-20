import { describe, expect, it } from "vitest";

import { buildAbcDurationContext } from "../../abc-duration";
import { getKeyAccidentalsFromAbc } from "../../abc-key-signature";
import {
  importAbcNotationToTimeGrid,
  reEmitImportedSourceAbc,
} from "../abc-timegrid-import";
import { convertTimeSliceMeasureToAbc } from "../time-slice";
import { buildGeneratedGuitarAbc } from "../guitar-abc-output";
import {
  formatImportedTimeGridDocumentCompact,
  parseImportedTimeGridDocumentCompact,
} from "../timegrid-document-codec";

const ABC = `X:1
L:1/8
M:4/4
K:Em
V:Melody
V:Guitar clef=treble-8
[V:Melody] | "Em" E E3- E2 z B, |
[V:Guitar] | [!1!e'!6!E] [!1!e']3/2- [!1!e'-!3!g]/2 [!1!e']3 [!3!g]/2 z/2 [!2!b] |`;

const SLURRED_ABC = `X:1
L:1/8
M:4/4
K:Em
V:Melody
V:Guitar clef=treble-8
[V:Melody] | E2 F2 z4 |
[V:Guitar] | (!1!e' !1!f') z6 |`;

describe("ABC to TimeGrid Guitar importer", () => {
  it("preserves source bytes while retaining per-string chord-member tie continuity", () => {
    const result = importAbcNotationToTimeGrid(ABC);

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.document).toBeDefined();
    const document = result.document!;
    expect(reEmitImportedSourceAbc(document)).toBe(ABC);

    const firstMeasure = document.measures[0];
    expect(firstMeasure.grid[0].tablature).toEqual(expect.arrayContaining([
      expect.objectContaining({ string: 1, fret: 0, role: "imported", durationSteps: 2 }),
      expect.objectContaining({ string: 6, fret: 0, role: "imported", durationSteps: 2 }),
    ]));
    expect(firstMeasure.grid[2].tablature).toEqual([
      expect.objectContaining({ string: 1, fret: 0, role: "imported", durationSteps: 10 }),
    ]);
    expect(firstMeasure.grid[5].tablature).toEqual([
      expect.objectContaining({ string: 3, fret: 0, role: "imported", durationSteps: 1 }),
    ]);
    expect(firstMeasure.grid[12].tablature).toEqual([
      expect.objectContaining({ string: 3, fret: 0, role: "imported", durationSteps: 1 }),
    ]);
    expect(firstMeasure.grid[14].tablature).toEqual([
      expect.objectContaining({ string: 2, fret: 0, role: "imported", durationSteps: 2 }),
    ]);

    expect(convertTimeSliceMeasureToAbc(
      firstMeasure,
      buildAbcDurationContext(ABC),
      getKeyAccidentalsFromAbc(ABC),
      true,
    )).toBe("[!1!e'!6!E] !1!e'3/2- [!1!e'-!3!g]/2 !1!e'3 !3!g/2 z/2 !2!b");
  });

  it("persists normalized Guitar slurs through TimeGrid JSON and rendering", () => {
    const result = importAbcNotationToTimeGrid(SLURRED_ABC);
    const document = result.document!;

    expect(document.measures[0].guitarSlurs).toEqual([{ startStep: 1, endStep: 4 }]);
    const restored = parseImportedTimeGridDocumentCompact(
      formatImportedTimeGridDocumentCompact(document),
    );
    expect(restored.measures[0].guitarSlurs).toEqual([{ startStep: 1, endStep: 4 }]);
    expect(convertTimeSliceMeasureToAbc(
      restored.measures[0],
      buildAbcDurationContext(SLURRED_ABC),
      getKeyAccidentalsFromAbc(SLURRED_ABC),
      true,
    )).toBe("(!1!e' !1!f') z6");
  });

  it("retains explicit cross-measure ties and slurs without inferring equal pitches", () => {
    const source = `X:1
L:1/8
M:4/4
K:C
V:Melody
V:Guitar clef=treble-8
[V:Melody] | E8 | E8 |
[V:Guitar] | (!1!e'8- | !1!e'8) |`;
    const result = importAbcNotationToTimeGrid(source);
    const document = result.document!;

    expect(result.diagnostics).toEqual([]);
    expect(document.measures[0].guitarTiesToNext).toEqual([1]);
    expect(document.measures[0].guitarSlursToNext).toEqual([{ startStep: 1, endStep: 16 }]);
    expect(document.measures[1].grid[0].tablature).toEqual(expect.arrayContaining([
      expect.objectContaining({ string: 1, fret: 0, durationSteps: 16 }),
    ]));
    expect(buildGeneratedGuitarAbc(document.measures, source)).toContain("(!1!e'8- | !1!e'8)");
    const restored = parseImportedTimeGridDocumentCompact(
      formatImportedTimeGridDocumentCompact(document),
    );
    expect(restored.measures[0].guitarTiesToNext).toEqual([1]);
    expect(restored.measures[0].guitarSlursToNext).toEqual([{ startStep: 1, endStep: 16 }]);
    document.measures[1].lineIndex = 1;
    expect(buildGeneratedGuitarAbc(document.measures, source)).toContain("| (!1!e'8- |\n| !1!e'8) |");

    const untied = importAbcNotationToTimeGrid(source.replace("e'8-", "e'8"));
    expect(untied.document?.measures[0].guitarTiesToNext).toBeUndefined();
  });

  it("retains a normalized document and reports non-grid timing approximations", () => {
    const result = importAbcNotationToTimeGrid(ABC.replace("[!1!e'!6!E]", "[!1!e'!6!E]2/3"));

    expect(result.valid).toBe(true);
    expect(result.document).toBeDefined();
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      message: expect.stringContaining("rounded to TimeGrid"),
    }));
  });
});
