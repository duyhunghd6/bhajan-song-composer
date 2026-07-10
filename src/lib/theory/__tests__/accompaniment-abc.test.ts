import { describe, expect, it } from "vitest";
import { buildAccompanimentAbc } from "../accompaniment-abc";
import { buildAbcDurationContext, measureDurationUnits, splitAbcMeasureSegments } from "../abc-duration";
import { addStrongBeatIconsToAbcNotation } from "../abc-beat-annotations";
import { generatePianoAccompaniment } from "../piano-accompaniment";
import { generateFingerstyleLine } from "../fingerstyle-arranger";

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
  const legacyMatch = abc.match(new RegExp(`V:${voiceName}[^\\n]*\\n([\\s\\S]*?)(?=\\nV:|$)`));
  const legacyLines = legacyMatch?.[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean) ?? [];
  const directiveLines = legacyLines.filter((line) => line.startsWith("%%"));
  const inlineLines = abc.split("\n").flatMap((line) => {
    const inlineVoice = line.match(new RegExp(`^\\[V:${voiceName}\\]\\s*(.*)$`));
    return inlineVoice ? [inlineVoice[1].trim()] : [];
  });

  if (inlineLines.length > 0) {
    return [...directiveLines, ...inlineLines].join("\n").trim();
  }

  return legacyLines.join("\n").trim();
}

function getVoiceMusicBody(abc: string, voiceName: string): string {
  return getVoiceBody(abc, voiceName)
    .split("\n")
    .filter((line) => !line.trim().startsWith("%"))
    .join("\n");
}

function getBeatLyricLines(abc: string): string[] {
  return abc.split("\n").filter((line) => /^w:\s*[|*⬤●•·\s]+$/.test(line.trim()));
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

    const leftHandBars = splitAbcMeasureSegments(getVoiceMusicBody(accompaniment.abc, "PianoLH"));
    expect(leftHandBars.length).toBeGreaterThan(0);
    expect(leftHandBars.every((bar) => measureDurationUnits(bar) === 3)).toBe(true);

    const rightHandBars = splitAbcMeasureSegments(getVoiceMusicBody(accompaniment.abc, "PianoRH"));
    expect(rightHandBars.length).toBe(leftHandBars.length);
    expect(rightHandBars.every((bar) => measureDurationUnits(bar) === 3)).toBe(true);

    const compingBars = splitAbcMeasureSegments(getVoiceMusicBody(accompaniment.abc, "PianoCompingLH"));
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
    expect(result.abc).toContain('V:Melody name="Melody"');
    expect(result.abc).toContain("w: Hap-py birth-day to you!");

    const pianoBody = getVoiceBody(result.abc, "PianoLH");
    expect(splitAbcMeasureSegments(pianoBody)[0]).toBe("z");

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
%%MIDI program 24
| E,2 B,2 E2 G2 | A,2 E2 A2 c2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: shortGuitar,
      layerVisibility: {},
    });

    expect(result.voiceNames).toEqual(["Guitar"]);
    expect(result.visibleVoiceNames).toEqual(["Guitar"]);
    expect(result.abc).toContain('V:Melody name="Melody"');
    expect(result.abc).toContain('V:Guitar clef=treble-8 name="Guitar" stem=down\n%%MIDI program 24');

    const melodyBars = splitAbcMeasureSegments(getVoiceMusicBody(result.abc, "Melody"));
    const guitarBars = splitAbcMeasureSegments(getVoiceMusicBody(result.abc, "Guitar"));

    expect(guitarBars).toHaveLength(melodyBars.length);
    expect(guitarBars.every((bar) => measureDurationUnits(bar) === 8)).toBe(true);
  });

  it("renames an exact Guitar Left Hand source voice to Harmonium without touching generic Guitar", () => {
    const melodyAbc = `X:1
T:Harmonium Retarget Test
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 |`;
    const guitarLeftHand = `V:GuitarLeftHand clef=treble name="Guitar Left Hand"
%%MIDI program 24
| E2 B2 E2 G2 | B2 E2 G2 B2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: guitarLeftHand,
      layerVisibility: {},
    });

    expect(result.voiceNames).toEqual(["Harmonium"]);
    expect(result.visibleVoiceNames).toEqual(["Harmonium"]);
    expect(result.abc).toContain('V:Harmonium clef=treble name="Indian Harmonium"\n%%MIDI program 20');
    expect(result.abc).not.toContain("Guitar Left Hand");
    expect(result.abc).not.toContain("%%MIDI program 24");
  });

  it("repairs malformed workflow voice ids before building the playback ABC", () => {
    const malformedWorkflowAbc = `X:1
T:Hari Bol Broken Workflow
M:4/4
L:1/8
%%score (Melody) (Melody]) (GuitarClassic])
K:Em
V:Melody] | "Em"E E2 F (GB) A G | "D"(FE) DF "Em"E4 |
V:GuitarClassic] | E,2 B,2 E2 G2 | D,2 A,2 E,2 B,2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: malformedWorkflowAbc,
      layerVisibility: {},
    });

    expect(result.voiceNames).toEqual(["Guitar"]);
    expect(result.visibleVoiceNames).toEqual(["Guitar"]);
    expect(result.abc).toContain("%%score (Melody) (Guitar)");
    expect(result.abc).toContain("[V:Melody] | \"Em\"E E2 F (GB) A G | \"D\"(FE) DF \"Em\"E4 |");
    expect(result.abc).toContain("[V:Guitar] | E,2 B,2 E2 G2 | D,2 A,2 E,2 B,2 |");
    expect(result.abc).not.toContain("Melody])");
    expect(result.abc).not.toContain("GuitarClassic])");
    expect(result.abc).not.toMatch(/^V:Melody\]/m);
    expect(result.abc).not.toMatch(/^V:GuitarClassic\]/m);
  });

  it("keeps similarly named Guitar LH Accompaniment sources as guitar", () => {
    const melodyAbc = `X:1
T:Guitar LH Non-target Test
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 |`;
    const guitarLhAccompaniment = `V:GuitarLH clef=treble-8 name="Guitar LH Accompaniment"
%%MIDI program 25
| E,2 B,2 E2 G2 | B,2 E2 G2 B2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: guitarLhAccompaniment,
      layerVisibility: {},
    });

    expect(result.voiceNames).toEqual(["GuitarLH"]);
    expect(result.abc).toContain('V:GuitarLH clef=treble-8 name="Guitar"\n%%MIDI program 24');
    expect(result.abc).not.toContain("V:Harmonium");
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

    const melodyBars = splitAbcMeasureSegments(getVoiceMusicBody(result.abc, "Melody"));
    const guitarBars = splitAbcMeasureSegments(getVoiceMusicBody(result.abc, "Guitar"));

    expect(melodyBars).toHaveLength(3);
    expect(guitarBars).toHaveLength(3);
    expect(guitarBars.every((bar) => measureDurationUnits(bar) === 6)).toBe(true);
  });

  it("preserves Melody body systems while adding Guitar Fingerstyle intro, interlude, outro systems with Melody rests", () => {
    const melodyAbc = `X:1
T:Fingerstyle Form Test
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 |
| G2 A2 B2 G2 | E8 |`;
    const fingerstyle = generateFingerstyleLine(melodyAbc, ["Em", "Bm", "G", "Em"]);

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: fingerstyle,
      layerVisibility: {},
    });

    expect(result.abc).toContain("%%score (Melody) (Guitar)");
    expect(result.abc).toContain("% Intro: Guitar Fingerstyle form section with Melody rests.");
    expect(result.abc).toContain("% Interlude: Guitar Fingerstyle form section with Melody rests.");
    expect(result.abc).toContain("% Outro: Guitar Fingerstyle form section with Melody rests.");
    expect(result.abc).toContain("[V:Melody] | E2 E2 G2 A2 | B4 B2 A2 |");
    expect(result.abc).toContain("[V:Melody] | G2 A2 B2 G2 | E8 |");
    expect(result.abc).toMatch(/% Intro:[\s\S]*\[V:Melody\] \| z8 \|[\s\S]*\[V:Guitar\] \|/);
  });

  it("merges extra Layer 3 ensemble voice sources into the score after final apply", () => {
    const melodyAbc = `X:1
T:Layer 3 Merge Test
M:4/4
L:1/8
K:Em
| E2 G2 z4 | B4 z2 A2 |`;
    const djembe = `V:Djembe clef=perc name="Layer 3 Djembe Interlock"
%%MIDI channel 10
| E z _E z D z _E z | E z _E z D z _E z |`;
    const flute = `V:Flute name="Layer 3 Flute Support"
%%MIDI program 73
| g2 z2 z4 | b2 z2 a2 z2 |`;
    const violin = `V:Violin name="Layer 3 Violin Support"
%%MIDI program 40
| E2 z2 E2 z2 | B,2 z2 A,2 z2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      extraVoiceSources: [djembe, flute, violin],
      layerVisibility: {},
    });

    expect(result.abc).toContain('V:Djembe clef=perc name="Djembe"\n%%MIDI channel 10');
    expect(result.abc).toContain('V:Flute name="Flute"\n%%MIDI program 73');
    expect(result.abc).toContain('V:Violin name="Violin"\n%%MIDI program 40');
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
"Em""_⬤"E2 E2 "_●"G2 A2 | B4 B2 A2 |
w: ⬤ • ● • | ⬤ ● • |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      layerVisibility: {},
    });

    expect(result.abc).not.toContain('"_⬤"');
    expect(result.abc).not.toContain('"_●"');
    expect(result.abc).not.toContain('"_•"');
    expect(getBeatLyricLines(result.abc)).toHaveLength(0);
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

    expect(result.abc).toContain('"Em"E2 E2 "G"G2 A2');
    expect(result.abc).not.toContain('"_⬤"');
    expect(result.abc).not.toContain('"_●"');
    expect(result.abc).not.toContain('"_•"');
    expect(getBeatLyricLines(result.abc)).toEqual(["w: ⬤ • ● • | ⬤ ● • |"]);
  });

  it("computes Strong Beats option directives through the local ABC icon algorithm", () => {
    const melodyAbc = `X:1
T:Strong Beats Local Tool Test
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 |`;

    const result = addStrongBeatIconsToAbcNotation({
      abcNotation: melodyAbc,
      emphasis: "primary-strong-beats",
    });

    expect(result.valid).toBe(true);
    expect(result.strongBeatDirectives).toEqual([
      { measureIndex: 0, beats: [{ beatTime: 1, weight: "strong" }, { beatTime: 3, weight: "medium" }] },
      { measureIndex: 1, beats: [{ beatTime: 1, weight: "strong" }, { beatTime: 3, weight: "medium" }] },
    ]);
    expect(result.abcNotation).toContain("w: ⬤ * ● * | ⬤ ● * |");
    expect(result.abcNotation).not.toContain('"_⬤"');
    expect(result.abcNotation).not.toContain('"_●"');
    expect(result.abcNotation).not.toContain('"_•"');
  });

  it("adds Strong Beats annotations without changing the Melody music line count", () => {
    const melodyAbc = `X:1
T:Strong Beats Line Count Test
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 |
w: Ha-ri Bol Ha-ri Bol
| G2 A2 B2 G2 | E8 |
w: Krish-na Krish-na`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      layerVisibility: { __strong_beats__: true },
    });

    const musicLines = result.abc.split("\n").filter((line) => line.trim().startsWith("|"));

    expect(musicLines).toHaveLength(2);
    expect(getBeatLyricLines(result.abc)).toHaveLength(2);
    expect(result.abc).toContain("w: ⬤ • ● • | ⬤ ● • |");
  });

  it("groups Melody lyrics, Strong Beats, and instruments by staff-system sentence", () => {
    const melodyAbc = `X:1
T:Strong Beats Staff-System Grouping Test
M:4/4
L:1/8
K:Em
| E2 E2 G2 A2 | B4 B2 A2 |
w: Ha-ri Bol Ha-ri Bol
| G2 A2 B2 G2 | E8 |
w: Krish-na Krish-na`;
    const guitarAbc = `V:Guitar clef=treble-8
%%MIDI program 24
| E,2 B,2 E2 G2 | B,2 E2 G2 B2 | G,2 D2 G2 B2 | E,8 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: guitarAbc,
      layerVisibility: { __strong_beats__: true },
    });
    const lines = result.abc.split("\n");
    const system1Index = lines.findIndex((line) => line.startsWith("% Staff system 1"));
    const system2Index = lines.findIndex((line) => line.startsWith("% Staff system 2"));

    expect(system1Index).toBeGreaterThan(-1);
    expect(system2Index).toBeGreaterThan(system1Index);
    expect(lines.slice(system1Index, system2Index)).toEqual([
      "% Staff system 1: Melody and visible instruments share this measure range.",
      "[V:Melody] | E2 E2 G2 A2 | B4 B2 A2 |",
      "w: Ha-ri Bol Ha-ri Bol",
      "w: ⬤ • ● • | ⬤ ● • |",
      "[V:Guitar] | E,2 B,2 E2 G2 | B,2 E2 G2 B2 |",
    ]);
    expect(lines.slice(system2Index)).toEqual([
      "% Staff system 2: Melody and visible instruments share this measure range.",
      "[V:Melody] | G2 A2 B2 G2 | E8 |",
      "w: Krish-na Krish-na",
      "w: ⬤ • ● • | ⬤ |",
      "[V:Guitar] | G,2 D2 G2 B2 | E,8 |",
    ]);
    expect(result.abc).not.toContain('"_⬤"');
    expect(result.abc).not.toContain('"_●"');
    expect(result.abc).not.toContain('"_•"');
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

    expect(result.abc).toContain("E2 E2 G2 A2");
    expect(result.abc).toContain("w: ⬤ • ● • |");
    expect(result.abc).not.toContain('"_⬤"');
    expect(result.abc).not.toContain('"_●"');
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

    expect(getBeatLyricLines(threeFour.abc)).toEqual(["w: ⬤ • • |"]);
    expect(getBeatLyricLines(sixEight.abc)).toEqual(["w: ⬤ • • ● • • |"]);
    expect(threeFour.abc).not.toContain('"_⬤"');
    expect(sixEight.abc).not.toContain('"_⬤"');
  });

  it("keeps lyrics and chords on melody staff even when melody is unchecked (silent) and no instruments present", () => {
    const melodyAbc = `X:1
T:Melody Silence Test
M:4/4
L:1/8
K:Em
"Em"E2 E2 "G"G2 A2 |
w: Ha-ri Bol _ |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      layerVisibility: {
        Melody: false,
        Lyrics: true,
        ChordProgression: true,
        __melody__: false,
        __chords__: true,
      },
    });

    expect(result.abc).toContain('"Em"z2 z2 "G"z2 z2 |');
    expect(result.abc).toContain("w: Ha-ri Bol _ |");
  });

  it("promotes Guitar as primary voice with lyrics and chords when Melody is unchecked", () => {
    const melodyAbc = `X:1
T:Guitar Promotion Test
M:4/4
L:1/8
K:Em
"Em"E2 E2 "G"G2 A2 | "D"B4 B2 A2 |
w: Ha-ri Bol Ha-ri Bol`;
    const guitarAbc = `V:Guitar clef=treble-8
%%MIDI program 24
| E,2 B,2 E2 G2 | D,2 A,2 D2 F2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: guitarAbc,
      layerVisibility: {
        Melody: false,
        Guitar: true,
        Lyrics: true,
        ChordProgression: true,
        __melody__: false,
        __chords__: true,
      },
    });

    // Melody voice should NOT be in the output
    expect(result.abc).not.toContain("V:Melody");
    expect(result.abc).not.toContain("[V:Melody]");

    // Guitar should be the primary voice in the score
    expect(result.abc).toContain("%%score (Guitar)");
    expect(result.abc).not.toContain("(Melody)");

    // Guitar should carry chord symbols overlaid from melody at correct beat positions
    expect(result.abc).toMatch(/\[V:Guitar\].*"Em"/);
    expect(result.abc).toMatch(/\[V:Guitar\].*"D"/);
    // No double chords at the same position (like "D""Em")
    const guitarLines = result.abc.split("\n").filter(l => l.startsWith("[V:Guitar]"));
    for (const gl of guitarLines) {
      expect(gl).not.toMatch(/"[^"]+""[^"]+"/);
    }

    // Lyrics should be attached after the Guitar voice line
    expect(result.abc).toContain("w: Ha-ri Bol Ha-ri Bol");

    // The lyric line should come after the [V:Guitar] line, not before
    const lines = result.abc.split("\n");
    const guitarLine = lines.findIndex(l => l.startsWith("[V:Guitar]"));
    const lyricLine = lines.findIndex(l => l.startsWith("w: Ha-ri"));
    expect(guitarLine).toBeGreaterThan(-1);
    expect(lyricLine).toBeGreaterThan(guitarLine);
  });

  it("promotes Guitar as primary voice with strong beats when Melody is unchecked", () => {
    const melodyAbc = `X:1
T:Guitar Promotion Beats Test
M:4/4
L:1/8
K:Em
"Em"E2 E2 "G"G2 A2 | "D"B4 B2 A2 |`;
    const guitarAbc = `V:Guitar clef=treble-8
%%MIDI program 24
| E,2 B,2 E2 G2 | D,2 A,2 D2 F2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: guitarAbc,
      layerVisibility: {
        Melody: false,
        Guitar: true,
        __melody__: false,
        __chords__: true,
        __strong_beats__: true,
      },
    });

    // Strong beat lyric lines should be present (attached to Guitar)
    expect(getBeatLyricLines(result.abc).length).toBeGreaterThan(0);

    // Guitar should be in the score, Melody should not
    expect(result.abc).toContain("%%score (Guitar)");
    expect(result.abc).not.toContain("(Melody)");
  });

  it("promotes first visible instrument when Melody is unchecked with multiple instruments", () => {
    const melodyAbc = `X:1
T:Multi Instrument Promotion Test
M:4/4
L:1/8
K:Em
"Em"E2 E2 "G"G2 A2 |
w: Ha-ri Bol _ |`;
    const guitarAbc = `V:Guitar clef=treble-8
%%MIDI program 24
| E,2 B,2 E2 G2 |`;
    const pianoAbc = `V:Piano clef=treble name="Piano"
%%MIDI program 0
| E2 G2 B2 E2 |`;

    const result = buildAccompanimentAbc({
      baseAbc: melodyAbc,
      generatedGuitar: guitarAbc,
      generatedPiano: pianoAbc,
      layerVisibility: {
        Melody: false,
        Guitar: true,
        Piano: true,
        Lyrics: true,
        __melody__: false,
        __chords__: true,
      },
    });

    // Guitar is the first visible instrument and should be promoted
    expect(result.abc).toContain("%%score (Guitar) (Piano)");
    expect(result.abc).not.toContain("(Melody)");
    expect(result.abc).not.toContain("V:Melody");

    // Lyrics should appear after Guitar, not after Piano
    const lines = result.abc.split("\n");
    const guitarLine = lines.findIndex(l => l.startsWith("[V:Guitar]"));
    const lyricLine = lines.findIndex(l => l.startsWith("w: Ha-ri"));
    const pianoLine = lines.findIndex(l => l.startsWith("[V:Piano]"));
    expect(lyricLine).toBeGreaterThan(guitarLine);
    expect(lyricLine).toBeLessThan(pianoLine);
  });
});
