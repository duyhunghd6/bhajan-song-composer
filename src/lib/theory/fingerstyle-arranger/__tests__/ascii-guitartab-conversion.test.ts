import { describe, expect, it } from "vitest";
import { prepareAbcjsRenderInput } from "@/components/music-sheet/abcjs-playback/render-input";
import { buildAbcDurationContext } from "../../abc-duration";
import { getKeyAccidentalsFromAbc } from "../../abc-key-signature";
import { validateGuitarAbcAgainstAsciiGuitarTab } from "../abc-ascii-guitartab-validation";
import {
  convertAsciiGuitarTabToForcedAbc,
  parseAsciiGuitarTab,
} from "../ascii-guitartab-conversion";

const SOURCE_ABC = `X:1
T:Ganesha, Ganesha — Voice-leading Option 1 Sparse Bass
L:1/8
M:4/4
Q:1/2=120
K:G
%%score (Melody) (Guitar)
%%vocalspace 10
%%botmargin 80
V:Melody name="Melody" stem=up
V:Guitar clef=treble-8 name="Guitar" stem=down
%%MIDI program 24
% Staff system 1: Melody and visible instruments share this measure range.
[V:Melody] | B, | : "Em" E E2 F GF E B, | "Em" E E2 F GF E2 | "Am" B2 A2 G2 A2 | "Em" E E3- E2 z B, |
w: Ga- | ne- sha Ga- ne- * sha Ga- | ne- sha Ga- ne- * sha | Jay jay Shri Ga- | ne- sha! _ Ga
w: | ⬤ | ⬤ * * ● * • * | ⬤ * * ● * • | ⬤ • ● • | ⬤ * ● * |`;

const ASCII_FIXTURE = `Measures 1–5
e|-------------------------------------------------|-0-----0-----------2-----3-----2-----0-----------|-0-----0-----------2-----3-----2-----0-----------|-7-----------5-----------3-----------5-----------|-0-----0-----------2-----3-----2-----0-----------|
B|-0-----------------------------------------------|-------------------------------------------0-----|-------------------------------------------------|----------------------------------------5--------|-------------------------------------------0-----|
G|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|----------0--------------------------------------|
D|-------------------------------------------------|-------------------------------------2-----------|-------------------------------------2-----------|-------------2-----------------------2-----------|-------------------------------------------------|
A|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|-0-----------------------0-----------------------|-------------------------------------------------|
E|-------------------------------------------------|-0-----------------------0-----------------------|-0-----------------------0-----------------------|-------------------------------------------------|-0-----------------------------------------------|`;

function convert() {
  return convertAsciiGuitarTabToForcedAbc({
    sourceAbc: SOURCE_ABC,
    asciiGuitarTab: ASCII_FIXTURE,
    chords: ["C", "Em", "Em", "Am", "Em"],
  });
}

describe("ASCII-GuitarTab conversion", () => {
  it("transfers source durations only when the physical string stays un-re-attacked", () => {
    const result = convert();
    const imported = result.measures.flatMap(measure => measure.grid.flatMap(step => step.tablature ?? []));
    const tabAt = (measureIndex: number, stepIndex: number, string: number) => (
      result.measures[measureIndex].grid[stepIndex].tablature?.find(tab => tab.string === string)
    );

    expect(imported).not.toHaveLength(0);
    expect(tabAt(4, 0, 1)?.durationSteps).toBe(2);
    expect(tabAt(4, 2, 1)?.durationSteps).toBe(1);
    expect(tabAt(4, 14, 2)?.durationSteps).toBe(2);
    expect(result.sourceMelodyDurationTransfer.preservedCount).toBeGreaterThanOrEqual(2);
    expect(result.sourceMelodyDurationTransfer.blockedCount).toBe(1);
    expect(result.sourceMelodyDurationTransfer.transfers).toContainEqual(expect.objectContaining({
      measure: 5,
      stepIndex: 2,
      requestedDurationSteps: 10,
      appliedDurationSteps: 1,
      blockedByStepIndices: [6, 8, 10],
    }));
    expect(result.roundTripAscii).toBe(result.normalizedInputAscii);
    expect(result.validation.valid).toBe(true);
    expect(result.validation.checkedMeasures).toBe(5);
    expect(result.validation.mismatchCount).toBe(0);
    expect(result.forcedGuitarBody).toMatch(/!([1-6])!/);
    expect(result.forcedAbc).toContain("%%score (Guitar)");
    expect(result.forcedAbc).not.toContain("%%vocalspace");
    expect(prepareAbcjsRenderInput({ abcString: result.forcedAbc, tablatureEnabled: true })).toBe(result.forcedAbc);
  });

  it("rejects an ASCII attack extended beyond its one-sixteenth cell", () => {
    const result = convert();
    const expectedPhysicalEvents = result.measures.flatMap(measure => measure.grid.flatMap((step, stepIndex) =>
      (step.tablature ?? []).map(tab => ({
        measure: measure.measure,
        stepIndex,
        durationSteps: tab.durationSteps ?? 1,
        string: tab.string,
        fret: tab.fret,
      })),
    ));
    const extendedAbc = result.forcedGuitarBody.replace("!6!E]/2", "!6!E]");
    const validation = validateGuitarAbcAgainstAsciiGuitarTab({
      abc: extendedAbc,
      measures: result.measures,
      durationContext: buildAbcDurationContext(SOURCE_ABC),
      keyAccidentals: getKeyAccidentalsFromAbc(SOURCE_ABC),
      expectedPhysicalEvents,
    });

    expect(validation.valid).toBe(false);
    expect(validation.mismatches.some(mismatch => mismatch.kind === "duration-mismatch")).toBe(true);
  });

  it("confirms exact physical matches for source melody attacks", () => {
    const result = convert();

    expect(result.sourceMelodyAlignment.matchedAttackCount).toBeGreaterThan(0);
    expect(result.sourceMelodyAlignment.aligned).toBe(true);
    expect(result.sourceMelodyAlignment.mismatchCount).toBe(0);
  });

  it("is byte-for-byte deterministic", () => {
    expect(convert().forcedAbc).toBe(convert().forcedAbc);
  });

  it("rejects malformed row widths and invalid frets", () => {
    expect(() => parseAsciiGuitarTab(ASCII_FIXTURE.replace("-0-----0", "-0----0"))).toThrow(/49 characters wide/);
    expect(() => parseAsciiGuitarTab(ASCII_FIXTURE.replace("-0-----0", "-x-----0"))).toThrow(/Invalid fret/);
  });

  it("rejects missing string rows", () => {
    const missingRow = ASCII_FIXTURE.replace(/\nG\|[^\n]+/, "");
    expect(() => parseAsciiGuitarTab(missingRow)).toThrow(/six string rows/);
  });
});
