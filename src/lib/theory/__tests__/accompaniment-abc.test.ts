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

    expect(result.voiceNames).toEqual(["PianoLH"]);
    expect(result.visibleVoiceNames).toEqual(["PianoLH"]);
    expect(result.abc).toContain('V:Melody name="Original Melody"');
    expect(result.abc).toContain("w: Hap-py birth-day to you!");

    const pianoBody = getVoiceBody(result.abc, "PianoLH");
    expect(pianoBody.startsWith("z | ")).toBe(true);

    const bars = splitAbcMeasureSegments(pianoBody);
    expect(bars).toHaveLength(9);
    expect(measureDurationUnits(bars[0])).toBe(1);
    expect(bars.slice(1).every((bar) => measureDurationUnits(bar) === 3)).toBe(true);
  });

  it("aligns Layer 2 Guitar Accompaniment measures one-to-one with the Melody line", () => {
    const melodyAbc = `X:1
T:Aligned Guitar Test
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 |`;
    const shortGuitar = `V:Guitar clef=treble-8
| E,2 B,2 E2 G2 | A,2 E2 A2 c2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: shortGuitar,
      layerVisibility: {},
    });

    expect(result.voiceNames).toEqual(["Guitar"]);
    expect(result.visibleVoiceNames).toEqual(["Guitar"]);
    expect(result.abc).toContain('V:Melody name="Original Melody"');
    expect(result.abc).toContain('V:Guitar clef=treble-8 name="Layer 2 Guitar Accompaniment"');

    const melodyBars = splitAbcMeasureSegments(getVoiceBody(result.abc, "Melody"));
    const guitarBars = splitAbcMeasureSegments(getVoiceBody(result.abc, "Guitar"));

    expect(guitarBars).toHaveLength(melodyBars.length);
    expect(guitarBars.every((bar) => measureDurationUnits(bar) === 8)).toBe(true);
  });

  it("truncates extra guitar measures so Layer 2 Guitar stays visually aligned with Melody", () => {
    const melodyAbc = `X:1
T:Aligned Guitar Truncation Test
M:3/4
L:1/8
K:C
| C2 E2 G2 | A2 G2 F2 | E6 |`;
    const longGuitar = `V:Guitar clef=treble-8
| C,2 G,2 C2 | F,2 C2 F2 | G,2 D2 G2 | C,2 G2 C2 | F,2 C2 F2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: longGuitar,
      layerVisibility: {},
    });

    const melodyBars = splitAbcMeasureSegments(getVoiceBody(result.abc, "Melody"));
    const guitarBars = splitAbcMeasureSegments(getVoiceBody(result.abc, "Guitar"));

    expect(melodyBars).toHaveLength(3);
    expect(guitarBars).toHaveLength(3);
    expect(guitarBars.every((bar) => measureDurationUnits(bar) === 6)).toBe(true);
  });

  it("merges extra Layer 3 ensemble voice sources into the score after final apply", () => {
    const melodyAbc = `X:1
T:Layer 3 Merge Test
M:4/4
L:1/8
K:Em
| E2 G2 z4 | B4 z2 A2 |`;
    const djembe = `V:Djembe clef=perc name="Layer 3 Djembe Interlock"
| C, z G z c z G z | C, z G z c z G z |`;
    const flute = `V:Flute name="Layer 3 Flute Support"
| g2 z2 z4 | b2 z2 a2 z2 |`;
    const violin = `V:Violin name="Layer 3 Violin Support"
| E2 z2 E2 z2 | B,2 z2 A,2 z2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      extraVoiceSources: [djembe, flute, violin],
      layerVisibility: {},
    });

    expect(result.abc).toContain("V:Djembe");
    expect(result.abc).toContain("V:Flute");
    expect(result.abc).toContain("V:Violin");
    expect(result.voiceNames).toEqual(["Djembe", "Flute", "Violin"]);
    expect(result.visibleVoiceNames).toEqual(["Djembe", "Flute", "Violin"]);
    expect(getVoiceBody(result.abc, "Djembe")).toBeTruthy();
    expect(getVoiceBody(result.abc, "Flute")).toBeTruthy();
    expect(getVoiceBody(result.abc, "Violin")).toBeTruthy();
  });

  it("hides extra ensemble voices through layer visibility without removing other layers", () => {
    const melodyAbc = `X:1
T:Layer 3 Visibility Test
M:4/4
L:1/8
K:Em
| E2 G2 z4 | B4 z2 A2 |`;
    const djembe = `V:Djembe clef=perc name="Layer 3 Djembe Interlock"
| C, z G z c z G z | C, z G z c z G z |`;
    const flute = `V:Flute name="Layer 3 Flute Support"
| g2 z2 z4 | b2 z2 a2 z2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      extraVoiceSources: [djembe, flute],
      layerVisibility: { Flute: false },
    });

    expect(result.voiceNames).toEqual(["Djembe", "Flute"]);
    expect(result.abc).toContain("V:Djembe");
    expect(result.abc).not.toContain("V:Flute");
    expect(result.visibleVoiceNames).toEqual(["Djembe"]);
  });

  it("keeps Strong Beats off by default and strips pre-existing beat markers", () => {
    const melodyAbc = `X:1
T:Strong Beats Off Test
M:4/4
L:1/8
K:Em
"Em""_⬤"E2 E2 "_●"G2 A2 | B4 B2 A2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      layerVisibility: {},
    });

    expect(result.abc).not.toContain('"_⬤"');
    expect(result.abc).not.toContain('"_●"');
    expect(result.abc).not.toContain('"_•"');
  });

  it("adds 4/4 Strong, Medium, and Soft beat markers when the Strong Beats layer is visible", () => {
    const melodyAbc = `X:1
T:Strong Beats 4/4 Test
M:4/4
L:1/8
K:Em
"Em"E2 E2 "G"G2 A2 | B4 B2 A2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      layerVisibility: { __strong_beats__: true },
    });

    expect(result.abc).toContain('"Em""_⬤"E2');
    expect(result.abc).toContain('"_•"E2');
    expect(result.abc).toContain('"G""_●"G2');
    expect(result.abc).toContain('"_•"A2');
  });

  it("keeps beat markers when chords are hidden but removes chord symbols", () => {
    const melodyAbc = `X:1
T:Strong Beats Chord Toggle Test
M:4/4
L:1/8
K:Em
"Em"E2 E2 "G"G2 A2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      layerVisibility: { __strong_beats__: true, __chords__: false },
    });

    expect(result.abc).toContain('"_⬤"E2');
    expect(result.abc).toContain('"_●"G2');
    expect(result.abc).not.toContain('"Em"');
    expect(result.abc).not.toContain('"G"');
  });

  it("adds meter-specific beat markers for 3/4 and 6/8", () => {
    const threeFour = buildAccompanimentAbc({
      baseAbc: `X:1
T:Strong Beats 3/4 Test
M:3/4
L:1/8
K:G
| d2 c2 B2 |`,
      layerVisibility: { __strong_beats__: true },
    });
    const sixEight = buildAccompanimentAbc({
      baseAbc: `X:1
T:Strong Beats 6/8 Test
M:6/8
L:1/8
K:Am
| A B c d e f |`,
      layerVisibility: { __strong_beats__: true },
    });

    expect(threeFour.abc).toContain('"_⬤"d2');
    expect(threeFour.abc).toContain('"_•"c2');
    expect(threeFour.abc).toContain('"_•"B2');
    expect(sixEight.abc).toContain('"_⬤"A');
    expect(sixEight.abc).toContain('"_●"d');
    expect(sixEight.abc.match(/"_•"/g)).toHaveLength(4);
  });
});
