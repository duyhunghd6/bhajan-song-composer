import { describe, expect, it } from "vitest";
import { runSourceTimeGridConversionDiagnostic } from "../melody-time-grid-round-trip";
import { parseImportedTimeGridDocumentCompact } from "../timegrid-document-codec";

const SOURCE_ABC = [
  "X:1",
  "T:Ganesha canonical TimeGrid fixture",
  "L:1/8",
  "M:4/4",
  "Q:1/2=100",
  "K:Em",
  "%%score (Melody) (Guitar)",
  "% Source comments and spacing are part of raw source identity.",
  "V:Melody name=\"Melody\"",
  "V:Guitar clef=treble-8 name=\"Guitar\"",
  "[V:Melody] | B, |: \"Em\" E2 E2 F2 G2 |",
  "w: Ga- | ne- sha Ga- ne- |",
  "[V:Melody] [1 \"Am\" A2 G2 F2 E2 :|",
  "w: Jay jay Shri Ga- |",
  "[V:Guitar] | E,8 | E,8 |",
].join("\r\n");

describe("source ABC to canonical TimeGrid diagnostic", () => {
  it("preserves the complete imported source byte-for-byte while compiling TimeGrid", () => {
    const result = runSourceTimeGridConversionDiagnostic(SOURCE_ABC);

    expect(result.document.source.rawAbc).toBe(SOURCE_ABC);
    expect(result.reEmittedSourceAbc).toBe(SOURCE_ABC);
    expect(result.sourceExactMatch).toBe(true);
    expect(result.reEmittedSourceAbc).toContain("%%score (Melody) (Guitar)\r\n");
    expect(result.reEmittedSourceAbc).toContain("w: Ga-");
    expect(result.reEmittedSourceAbc).toContain("[V:Guitar] | E,8 |");
    expect(result.document.measures).toHaveLength(3);
    expect(result.document.measures.map(measure => measure.lineIndex)).toEqual([0, 0, 1]);
    expect(result.document.measures[1].barline).toMatchObject({ repeatStart: true, repeatEnd: false, volta: null });
    expect(result.document.measures[2].barline).toMatchObject({ repeatStart: false, repeatEnd: true, volta: "1" });
    const timeGridDocument = JSON.parse(result.timeGridDocument);
    expect(timeGridDocument.format).toBe("timegrid-document:v3");
    expect(timeGridDocument.style).toBeDefined();
    expect(timeGridDocument.measures[0]).not.toHaveProperty("style");
    expect(parseImportedTimeGridDocumentCompact(result.timeGridDocument)).toEqual(result.document);
  });

  it("creates meter-aware physical melody events and validates generated Guitar ABC", () => {
    const result = runSourceTimeGridConversionDiagnostic(SOURCE_ABC);

    expect(result.document.measures.every(measure => measure.grid.length === 16)).toBe(true);
    expect(result.mappings).toContainEqual(expect.objectContaining({
      measure: 2,
      stepIndex: 0,
      pitch: "E4",
      string: 1,
      fret: 0,
      durationSteps: 4,
    }));
    expect(result.unmappableAttacks).toEqual([]);
    expect(result.physicsValidation.every(validation => validation.valid)).toBe(true);
    expect(result.generatedGuitarAbc).toContain('V:Guitar clef=treble-8');
    expect(result.generatedGuitarAbc).toContain("!1!");
    expect(result.generatedGuitarAbc.split("\n").slice(2)).toHaveLength(2);
    expect(result.generatedGuitarAbc).toContain("|:");
    expect(result.generatedGuitarAbc).toContain("[1 ");
    expect(result.generatedGuitarAbc).toContain(":|");
    expect(result.generatedGuitarValidation.valid).toBe(true);
    expect(result.standaloneGeneratedGuitarAbc).not.toBe(SOURCE_ABC);
  });

  it("reports a melody outside the diagnostic guitar range without altering raw source identity", () => {
    const source = `X:1
T:Range check
M:4/4
L:1/8
K:C
[V:Melody] | c''8 |`;
    const result = runSourceTimeGridConversionDiagnostic(source);

    expect(result.sourceExactMatch).toBe(true);
    expect(result.reEmittedSourceAbc).toBe(source);
    expect(result.unmappableAttacks).toEqual([
      expect.objectContaining({ measure: 1, stepIndex: 0, pitch: "C7" }),
    ]);
    expect(result.generatedGuitarValidation.valid).toBe(true);
  });
});
