import { describe, expect, it } from "vitest";
import {
  ensureGuitarStringForcing,
  prepareGuitarStringForcingForAbcjs,
} from "../guitar-string-forcing";

describe("ensureGuitarStringForcing", () => {
  it("returns unchanged ABC when no Guitar voice is present", () => {
    const abc = `X: 1
T: Test
M: 4/4
L: 1/8
K: C
V:Melody clef=treble name="Melody"
[V:Melody] C D E F | G A B c |`;

    expect(ensureGuitarStringForcing(abc)).toBe(abc);
  });

  it("returns unchanged ABC when Guitar notes already have !N! decorations", () => {
    const abc = `X: 1
T: Test
M: 4/4
L: 1/8
K: Em
V:Guitar clef=treble-8 name="Guitar"
%%MIDI program 24
[V:Guitar] [!1!e!2!B!3!G!6!E,]/2 !3!G/2 |`;

    expect(ensureGuitarStringForcing(abc)).toBe(abc);
  });

  it("adds string-forcing to bare notes in Guitar voice", () => {
    const abc = `X: 1
T: Test
M: 4/4
L: 1/8
K: Em
V:Guitar clef=treble-8 name="Guitar"
%%MIDI program 24
[V:Guitar] e/2 G/2 B/2 E,/2 |`;

    const result = ensureGuitarStringForcing(abc);

    // All notes should have !N! decorations
    expect(result).toMatch(/![1-6]!e\/2/);
    expect(result).toMatch(/![1-6]!G\/2/);
    expect(result).toMatch(/![1-6]!B\/2/);
    expect(result).toMatch(/![1-6]!E,\/2/);
  });

  it("adds string-forcing to chord groups [notes]", () => {
    const abc = `X: 1
T: Test
M: 4/4
L: 1/8
K: Em
V:Guitar clef=treble-8 name="Guitar"
%%MIDI program 24
[V:Guitar] [eBGE,]/2 |`;

    const result = ensureGuitarStringForcing(abc);

    // The chord should have !N! decorations inside [...]
    expect(result).toContain("!");
    expect(result).not.toContain("[eBGE,]"); // Original bare chord should be gone
  });

  it("preserves chord symbols in double quotes", () => {
    const abc = `X: 1
T: Test
M: 4/4
L: 1/8
K: Em
V:Guitar clef=treble-8 name="Guitar"
%%MIDI program 24
[V:Guitar] "Em"[eBGE,]/2 G/2 |`;

    const result = ensureGuitarStringForcing(abc);

    // Chord symbol "Em" should be preserved exactly — no !N! inside
    expect(result).toContain('"Em"');
    expect(result).not.toContain('"!');
  });

  it("preserves rests", () => {
    const abc = `X: 1
T: Test
M: 4/4
L: 1/8
K: Em
V:Guitar clef=treble-8 name="Guitar"
%%MIDI program 24
[V:Guitar] z2 e/2 z/2 |`;

    const result = ensureGuitarStringForcing(abc);

    // Rests should be unchanged
    expect(result).toContain("z2");
    expect(result).toContain("z/2");
  });

  it("does not modify Melody voice", () => {
    const abc = `X: 1
T: Test
M: 4/4
L: 1/8
K: Em
%%score (Melody Guitar)
V:Melody clef=treble name="Melody"
V:Guitar clef=treble-8 name="Guitar"
[V:Melody] E F G A | B c d e |
[V:Guitar] [eBGE,]/2 G/2 B/2 E,/2 |`;

    const result = ensureGuitarStringForcing(abc);

    // Melody line should be unchanged
    expect(result).toContain("[V:Melody] E F G A | B c d e |");
    // Guitar line should have !N! decorations
    const guitarLine = result.split("\n").find(l => l.includes("[V:Guitar]"));
    expect(guitarLine).toContain("!");
  });

  it("handles the user's exact failing ABC — preserves chord symbols", () => {
    const abc = `X: 1
T: Hari Bol - Voice-led Combined Accompaniment
M: 4/4
L: 1/8
Q: 1/4=65
K: Em
%%score (Guitar)
%%vocalspace 10
%%botmargin 80
V:Guitar clef=treble-8 name="Guitar" stem=up
%%MIDI program 24
[V:Guitar] "Em"[eBGE,]/2 G/2 [eE,]/2 B/2 [eGE,]/2 E/2 [BE,]/2 G/2 "D"[eD]/2 A/2 [eD]/2 d/2 [eAD]/2 A/2 [BD]/2 A/2`;

    const result = ensureGuitarStringForcing(abc);

    // Chord symbols "Em" and "D" must be preserved exactly
    expect(result).toContain('"Em"');
    expect(result).toContain('"D"');
    // No !N! should appear inside chord symbols
    expect(result).not.toMatch(/"![1-6]!/);

    // Guitar notes should have string-forcing
    const guitarLine = result.split("\n").find(l => l.includes("[V:Guitar]"));
    expect(guitarLine).toBeDefined();
    expect(guitarLine).toContain("!");
  });

  it("is idempotent — running twice produces the same result", () => {
    const abc = `X: 1
T: Test
M: 4/4
L: 1/8
K: Em
V:Guitar clef=treble-8 name="Guitar"
%%MIDI program 24
[V:Guitar] "Em"[eBGE,]/2 G/2 |`;

    const first = ensureGuitarStringForcing(abc);
    const second = ensureGuitarStringForcing(first);

    expect(second).toBe(first);
  });
});

describe("prepareGuitarStringForcingForAbcjs", () => {
  it("wraps only forced single Guitar notes as one-note chords", () => {
    const abc = `X:1
M:4/4
L:1/8
K:G
%%score (Melody) (Guitar)
V:Melody
V:Guitar clef=treble-8
[V:Melody] !2!e G |
[V:Guitar] | [!2!B!3!G!6!E,] !2!e !3!G !2!B4 !3!B |`;

    expect(prepareGuitarStringForcingForAbcjs(abc)).toContain(
      "[V:Guitar] | [!2!B!3!G!6!E,] [!2!e] [!3!G] [!2!B]4 [!3!B] |",
    );
    expect(prepareGuitarStringForcingForAbcjs(abc)).toContain("[V:Melody] !2!e G |");
  });
});
