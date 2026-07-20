import { describe, it, expect } from "vitest";
import { buildAbcDurationContext } from "../../abc-duration";
import { getKeyAccidentalsFromAbc, abcNoteToMidiWithKey } from "../../abc-key-signature";
import { convertTimeSliceMeasureToAbc, type TimeSliceMeasure } from "../time-slice";
import {
  validateGuitarAbcAgainstAsciiGuitarTab,
} from "../abc-ascii-guitartab-validation";

const BASE_ABC = `X:1\nT:Debug\nM:4/4\nL:1/8\nK:Em\n`;

describe("debug validation octave", () => {
  it("trace validation for string 6 fret 0", () => {
    const measure: TimeSliceMeasure = {
      measure: 1,
      lineIndex: 0,
      style_profile: { key: "Em", comping_style: "PIMA", voicing_plan: "Open Em" },
      grid: Array.from({ length: 16 }, (_, index) => ({
        step: index + 1,
        chord: "Em",
        weight: index === 0 ? "⬤" as const : null,
        melody: index === 0
          ? { pitch: "E4", state: "attack" as const }
          : { pitch: null, state: "rest" as const },
        lyric: null,
        tablature: index === 0
          ? [
              { string: 6 as const, fret: 0, finger: "p" as const, role: "bass" as const, durationSteps: 4 },
              { string: 1 as const, fret: 0, finger: "a" as const, role: "melody" as const },
            ]
          : index === 4
            ? [{ string: 3 as const, fret: 4, finger: "i" as const, role: "fill" as const, durationSteps: 2 }]
            : [],
      })),
    };

    const body = convertTimeSliceMeasureToAbc(
      measure,
      buildAbcDurationContext(BASE_ABC),
      getKeyAccidentalsFromAbc(BASE_ABC),
      true,
    );
    console.log("Generated body:", JSON.stringify(body));

    // Manually check what abcNoteToMidiWithKey returns for E,
    const midiEcomma = abcNoteToMidiWithKey("E,");
    const midiE = abcNoteToMidiWithKey("E");
    const midie = abcNoteToMidiWithKey("e");
    console.log("abcNoteToMidiWithKey('E,'):", midiEcomma);
    console.log("abcNoteToMidiWithKey('E'):", midiE);
    console.log("abcNoteToMidiWithKey('e'):", midie);
    console.log("abcNoteToMidiWithKey('E,') - 12:", midiEcomma! - 12);

    const result = validateGuitarAbcAgainstAsciiGuitarTab({
      abc: body,
      measures: [measure],
      durationContext: buildAbcDurationContext(BASE_ABC),
      keyAccidentals: getKeyAccidentalsFromAbc(BASE_ABC),
    });

    console.log("Validation result:", JSON.stringify(result, null, 2));
    expect(result.valid).toBe(true);
  });
});
