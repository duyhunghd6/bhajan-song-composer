import { describe, expect, it } from "vitest";
import { buildAccompanimentAbc } from "../accompaniment-abc";
import { buildAbcDurationContext, measureDurationUnits, splitAbcMeasureSegments } from "../abc-duration";
import { generatePianoAccompaniment } from "../piano-accompaniment";

const HAPPY_BIRTHDAY_ABC = `X: 1
T: Happy Birthday To You
C: Traditional
M: 3/4
L: 1/4
K: G
D/2D/2 | E D G | F2 D/2D/2 | E D A | G2 D/2D/2 |
w: Hap-py birth-day to you! Hap-py birth-day to you! Hap-py
d B G | F E c/2c/2 | B G A | G2 |]
w: birth-day dear [Name] _ Hap-py birth-day to you!`;

function getVoiceBody(abc: string, voiceName: string): string {
  const match = abc.match(new RegExp(`V:${voiceName}[^\\n]*\\n([\\s\\S]*?)(?=\\nV:|$)`));
  return match?.[1].trim() ?? "";
}

describe("accompaniment ABC alignment", () => {
  it("builds duration context from Happy Birthday's 3/4 L:1/4 meter", () => {
    expect(buildAbcDurationContext(HAPPY_BIRTHDAY_ABC)).toMatchObject({
      unitsPerBeat: 1,
      fullMeasureUnits: 3,
    });
  });

  it("generates piano accompaniment measures that match 3/4 L:1/4", () => {
    const accompaniment = generatePianoAccompaniment(HAPPY_BIRTHDAY_ABC, { compingProfile: "pop-ballad" });

    expect(accompaniment.abc).not.toContain("G,,2 D,,2 G,2");

    const leftHandBars = splitAbcMeasureSegments(getVoiceBody(accompaniment.abc, "PianoLH"));
    expect(leftHandBars.length).toBeGreaterThan(0);
    expect(leftHandBars.every((bar) => measureDurationUnits(bar) === 3)).toBe(true);

    const rightHandBars = splitAbcMeasureSegments(getVoiceBody(accompaniment.abc, "PianoRH"));
    expect(rightHandBars.length).toBe(leftHandBars.length);
    expect(rightHandBars.every((bar) => measureDurationUnits(bar) === 3)).toBe(true);

    const compingBars = splitAbcMeasureSegments(getVoiceBody(accompaniment.abc, "PianoCompingLH"));
    expect(compingBars.length).toBe(leftHandBars.length);
    expect(compingBars.every((bar) => measureDurationUnits(bar) === 3)).toBe(true);
  });

  it("prepends a pickup rest and aligns accompaniment full measures without counting lyrics", () => {
    const generated = `V:PianoLH clef=bass name="Layer 2 Piano Left Hand"
| G,, D,, G, | G,, D,, G, | D,, A,, D, | G,, D,, G, | G,, D,, G, | G,, D,, G, | G,, D,, G, | G,, D,, G, | G,, D,, G, |`;

    const result = buildAccompanimentAbc({
      baseAbc: HAPPY_BIRTHDAY_ABC,
      generatedAccompaniment: generated,
      layerVisibility: {},
    });

    expect(result.abc).toContain('%%score (Melody) (PianoLH)');
    expect(result.abc).toContain('V:Melody name="Original Melody"');
    expect(result.abc).toContain("w: Hap-py birth-day to you!");

    const pianoBody = getVoiceBody(result.abc, "PianoLH");
    expect(pianoBody.startsWith("z | ")).toBe(true);

    const bars = splitAbcMeasureSegments(pianoBody);
    expect(bars).toHaveLength(9);
    expect(measureDurationUnits(bars[0])).toBe(1);
    expect(bars.slice(1).every((bar) => measureDurationUnits(bar) === 3)).toBe(true);
  });
});
