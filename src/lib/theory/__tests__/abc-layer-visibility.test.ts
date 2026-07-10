import { describe, expect, it } from "vitest";

import {
  ABC_LAYER_IDS,
  applyAbcLayerVisibility,
  applyAbcLayerVolumes,
  extractAbcLayerVisibilityItems,
  extractAbcVoiceIds,
  getVisibleAbcVoiceIds,
  normalizeAbcLayerVisibility,
  cleanAbcForExport,
} from "../abc-layer-visibility";

const singleVoiceAbc = `X:1
T:Single Voice
M:4/4
L:1/4
K:C
"C"C D E F |
w: Ha-ri Bol _ |
W: Unaligned lyric`;

const multiVoiceAbc = `X:1
T:Multi Voice
M:4/4
L:1/4
%%score (Melody GuitarClassic) (Piano)
V:Melody name="Melody"
V:GuitarClassic clef=treble-8
K:C
[V:Melody] "C"C D E F |
w: Ha-ri Bol _ |
w: ⬤ * ● * |
[V:GuitarClassic] C, G, E, G, |
[V:Piano] [CEG]2 [FAC]2 |`;

describe("ABC layer visibility", () => {
  it("derives baseline layers for single-voice ABC", () => {
    const items = extractAbcLayerVisibilityItems(singleVoiceAbc);

    expect(items.map((item) => item.id)).toEqual([
      ABC_LAYER_IDS.chordProgression,
      ABC_LAYER_IDS.lyrics,
      "Melody",
      ABC_LAYER_IDS.tab,
    ]);
  });

  it("extracts voices from score, declarations, and inline voice markers", () => {
    expect(extractAbcVoiceIds(multiVoiceAbc)).toEqual(["Melody", "Guitar", "Piano"]);
  });

  it("normalizes legacy visibility keys", () => {
    expect(normalizeAbcLayerVisibility({
      __melody__: false,
      __chords__: false,
      __strong_beats__: false,
      __guitar_tab__: true,
      harmony: false,
    })).toEqual({
      Melody: false,
      ChordProgression: false,
      StrongBeats: false,
      TAB: true,
    });
  });

  it("strips chord progression symbols when the chord layer is hidden", () => {
    const filtered = applyAbcLayerVisibility(singleVoiceAbc, { ChordProgression: false });

    expect(filtered).not.toContain('"C"');
    expect(filtered).toContain("C D E F");
  });

  it("removes normal lyrics while preserving strong-beat rows when strong beats stay visible", () => {
    const filtered = applyAbcLayerVisibility(multiVoiceAbc, { Lyrics: false, StrongBeats: true });

    expect(filtered).not.toContain("Ha-ri Bol");
    expect(filtered).toContain("w: ⬤ * ● * |");
  });

  it("removes strong-beat rows independently from normal lyrics", () => {
    const filtered = applyAbcLayerVisibility(multiVoiceAbc, { StrongBeats: false });

    expect(filtered).toContain("Ha-ri Bol");
    expect(filtered).not.toContain("⬤");
  });

  it("removes hidden voices from declarations, body lines, and score references", () => {
    const filtered = applyAbcLayerVisibility(multiVoiceAbc, { Guitar: false });

    expect(filtered).not.toContain("V:Guitar");
    expect(filtered).not.toContain("[V:Guitar");
    expect(filtered).not.toContain("GuitarClassic");
    expect(filtered).toContain("%%score (Melody) (Piano)");
    expect(filtered).toContain("[V:Piano]");
  });

  it("does not change ABC text when only TAB visibility changes", () => {
    expect(applyAbcLayerVisibility(multiVoiceAbc, { TAB: true })).toBe(applyAbcLayerVisibility(multiVoiceAbc, { TAB: false }));
  });

  it("reports visible voices after applying visibility", () => {
    expect(getVisibleAbcVoiceIds(multiVoiceAbc, { Piano: false })).toEqual(["Melody", "Guitar"]);
  });

  it("preserves Melody as MIDI program 52 and applies persistent 5-percent-step volume values", () => {
    const filtered = applyAbcLayerVisibility(multiVoiceAbc, {});
    const withVolumes = filtered.replace("V:Melody name=\"Melody\"", "V:Melody name=\"Melody\"\n%%MIDI program 1");
    const result = applyAbcLayerVolumes(withVolumes, {
      Melody: 50,
      Guitar: 75,
      ChordProgression: 25,
    });

    expect(result).toContain("V:Melody name=\"Melody\"\n%%MIDI program 52\n%%MIDI beat 64 64 64 1");
    expect(result).toContain("V:Guitar clef=treble-8\n%%MIDI beat 95 95 95 1");
    expect(result).toContain("%%MIDI chordvol 32");
    expect(result).toContain("%%MIDI bassvol 32");
    expect(result).not.toContain("%%MIDI vol ");
    expect(result).not.toContain("%%MIDI program 1");
  });

  it("keeps Melody voice body lines if Melody is hidden but Lyrics or Chords are visible", () => {
    const abc = `X:1
T:Test
K:C
C D E F |
w: Ha-ri Bol _ |`;

    // Both melody and lyrics false -> Melody staff is completely hidden
    const hidden = applyAbcLayerVisibility(abc, { Melody: false, Lyrics: false, ChordProgression: false });
    expect(hidden).not.toContain("C D E F");
    expect(hidden).not.toContain("Ha-ri Bol");

    // Melody false but Lyrics true -> Melody staff is kept to show lyrics
    const withLyrics = applyAbcLayerVisibility(abc, { Melody: false, Lyrics: true, ChordProgression: false });
    expect(withLyrics).toContain("C D E F");
    expect(withLyrics).toContain("w: Ha-ri Bol");
  });
});

describe("cleanAbcForExport", () => {
  it("removes string-forcing decorations from chord notes and individual notes", () => {
    const abc = `[V:Guitar] | [!1!e!2!B!3!G!4!E!5!B,!6!E,]/2 E/2 e/2 G/2 | [!1!=f!3!A] [!3!A] | !1!b !6!B |`;
    const expected = `[V:Guitar] | [eBGEB,E,]/2 E/2 e/2 G/2 | [=fA] [A] | b B |`;
    expect(cleanAbcForExport(abc)).toBe(expected);
  });

  it("removes strong beat lyric lines containing bullet patterns", () => {
    const abc = `[V:Melody] | E E (EB,) E E (EB,) |
w: Ha-ri Bol _ Ha-ri Bol _ |
w: ⬤ * • * ● * • * |
[V:Guitar] | [!1!e!2!B!3!G]/2 E/2 |`;
    const expected = `[V:Melody] | E E (EB,) E E (EB,) |
w: Ha-ri Bol _ Ha-ri Bol _ |
[V:Guitar] | [eBG]/2 E/2 |`;
    expect(cleanAbcForExport(abc)).toBe(expected);
  });

  it("returns empty string if input is null or empty", () => {
    expect(cleanAbcForExport("")).toBe("");
  });

  it("normalizes clef=treble-8 to clef=treble for universal viewer portability", () => {
    const abc = `V:Guitar clef=treble-8 name="Guitar"\n[V:Guitar] !1!e/2 |`;
    const result = cleanAbcForExport(abc);
    expect(result).toContain("clef=treble ");
    expect(result).not.toContain("clef=treble-8");
    expect(result).not.toContain("!1!");
  });
});
