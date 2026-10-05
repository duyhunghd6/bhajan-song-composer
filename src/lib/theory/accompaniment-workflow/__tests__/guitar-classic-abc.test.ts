import { describe, expect, it } from "vitest";

import { convertGuitarClassicEventsToAbc } from "../guitar-classic-abc";

const sourceAbc = `X:1
T:Guitar Classic Support
M:4/4
L:1/8
K:Em
[V:Melody] | E2 F2 G2 A2 | B4 A4 |`;

describe("convertGuitarClassicEventsToAbc", () => {
  it("renders selected physical events as a measure-aligned standard-notation support voice", () => {
    const result = convertGuitarClassicEventsToAbc(sourceAbc, [
      { measureIndex: 1, step: 1, durationSteps: 4, beat: 1, note: "E2", string: 6, fret: 0, role: "root" },
      { measureIndex: 1, step: 5, durationSteps: 4, beat: 2, note: "B2", string: 5, fret: 2, role: "fifth" },
      { measureIndex: 1, step: 9, durationSteps: 4, beat: 3, note: "G3", string: 3, fret: 0, role: "harmony" },
      { measureIndex: 2, step: 1, durationSteps: 8, beat: 1, note: "B2", string: 5, fret: 2, role: "bass" },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.renderedEventCount).toBe(4);
    expect(result.abc).toContain('V:GuitarSupport clef=treble-8 name="Guitar Support"');
    expect(result.abc).toContain("%%MIDI program 25");
    expect(result.abc).toContain("!6!E2 !5!B2 !3!g2 z2");
    expect(result.abc).toContain("!5!B4");
    expect(result.abc).toContain("!6!");
  });

  it("migrates an unambiguous legacy measure and derives timing from beats", () => {
    const result = convertGuitarClassicEventsToAbc(sourceAbc, [
      { measureIndex: 2, beat: 1, note: "E2", string: 6, fret: 0, role: "root" },
      { measureIndex: 2, beat: 1.5, note: "B2", string: 5, fret: 2, role: "fifth" },
      { measureIndex: 2, beat: 2, note: "G3", string: 3, fret: 0, role: "harmony" },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.abc).toContain("| z8 | !6!E !5!B !3!g6 |");
  });

  it("keeps ambiguous legacy human measure labels one-based", () => {
    const result = convertGuitarClassicEventsToAbc(sourceAbc, [
      { measureIndex: 1, beat: 1, note: "E2", string: 6, fret: 0, role: "root" },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.abc).toContain("| !6!E8 | z8 |");
  });
});
