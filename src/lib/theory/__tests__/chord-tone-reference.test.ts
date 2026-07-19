import { describe, it, expect } from "vitest";
import {
  buildChordToneReferenceTable,
  validateGuitarVoiceChordTones,
} from "../chord-tone-reference";

// ---------------------------------------------------------------------------
// Test ABC fixtures
// ---------------------------------------------------------------------------

const GANESHA_ABC = `X:1
T:Ganesha Bhajan
M:4/4
L:1/8
K:G
V:Melody clef=treble-8
[V:Melody] "Em"E2 B2 G2 B2 | "Am"A2 c2 E2 A2 | "D"F2 A2 d2 F2 | "C"G2 E2 C2 E2 |
`;

const MULTI_CHORD_ABC = `X:1
T:Test Split Chord
M:4/4
L:1/8
K:G
V:Melody clef=treble-8
[V:Melody] "Em"E2 B2 "Am"A2 c2 | "B7"^D2 F2 B,2 D2 |
`;

const SIMPLE_C_ABC = `X:1
T:Simple C
M:4/4
L:1/8
K:C
"C"C2 E2 G2 C2 | "Am"A2 C2 E2 A2 | "F"F2 A2 C2 F2 | "G"G2 B2 D2 G2 |
`;

// ---------------------------------------------------------------------------
// buildChordToneReferenceTable
// ---------------------------------------------------------------------------

describe("buildChordToneReferenceTable", () => {
  it("extracts unique chords in order of first appearance", () => {
    const result = buildChordToneReferenceTable(GANESHA_ABC);
    const chordNames = result.references.map((r) => r.chordName);
    expect(chordNames).toEqual(["Em", "Am", "D", "C"]);
  });

  it("resolves Em chord tones correctly", () => {
    const result = buildChordToneReferenceTable(GANESHA_ABC);
    const emRef = result.references.find((r) => r.chordName === "Em");
    expect(emRef).toBeDefined();
    // Em = E, G, B
    expect(emRef!.notes).toEqual(expect.arrayContaining(["E", "G", "B"]));
    expect(emRef!.notes).toHaveLength(3);
  });

  it("resolves Am chord tones correctly", () => {
    const result = buildChordToneReferenceTable(GANESHA_ABC);
    const amRef = result.references.find((r) => r.chordName === "Am");
    expect(amRef).toBeDefined();
    // Am = A, C, E
    expect(amRef!.notes).toEqual(expect.arrayContaining(["A", "C", "E"]));
    expect(amRef!.notes).toHaveLength(3);
  });

  it("resolves D major chord tones correctly", () => {
    const result = buildChordToneReferenceTable(GANESHA_ABC);
    const dRef = result.references.find((r) => r.chordName === "D");
    expect(dRef).toBeDefined();
    // D = D, F#, A
    expect(dRef!.notes).toEqual(expect.arrayContaining(["D", "F#", "A"]));
    expect(dRef!.notes).toHaveLength(3);
  });

  it("handles key signature for Em/K:G — G is natural, F is F# by default", () => {
    const result = buildChordToneReferenceTable(GANESHA_ABC);
    const emRef = result.references.find((r) => r.chordName === "Em");
    expect(emRef).toBeDefined();
    // Under K:G, G is natural — no accidental. The ABC token for G4 is just "G"
    expect(emRef!.abcTokens).toContain("G");
    // G should NOT need a sharp accidental
    expect(emRef!.abcTokens).not.toContain("^G");
  });

  it("under K:G, D major's F# does not need accidental (F is sharped by key sig)", () => {
    const result = buildChordToneReferenceTable(GANESHA_ABC);
    const dRef = result.references.find((r) => r.chordName === "D");
    expect(dRef).toBeDefined();
    // Under K:G, F is F# by default, so F# ABC token should not have ^
    expect(dRef!.abcTokens).toContain("F");  // F in octave 4 represents F# under K:G
    expect(dRef!.abcTokens).not.toContain("^F"); // Should not need explicit sharp
  });

  it("generates per-measure chord mapping", () => {
    const result = buildChordToneReferenceTable(GANESHA_ABC);
    expect(result.measureChords.length).toBeGreaterThanOrEqual(4);
    expect(result.measureChords[0]).toEqual(["Em"]);
    expect(result.measureChords[1]).toEqual(["Am"]);
    expect(result.measureChords[2]).toEqual(["D"]);
    expect(result.measureChords[3]).toEqual(["C"]);
  });

  it("handles split-chord measures", () => {
    const result = buildChordToneReferenceTable(MULTI_CHORD_ABC);
    // First measure has two chords
    expect(result.measureChords[0]).toEqual(["Em", "Am"]);
  });

  it("generates non-empty promptText", () => {
    const result = buildChordToneReferenceTable(GANESHA_ABC);
    expect(result.promptText).toBeTruthy();
    expect(result.promptText).toContain("Chord-Tone Reference Table");
    expect(result.promptText).toContain("Em");
    expect(result.promptText).toContain("Am");
    expect(result.promptText).toContain("CHORD-TONE ENFORCEMENT");
  });

  it("returns empty promptText when no chords are present", () => {
    const noChordAbc = `X:1\nT:No Chords\nM:4/4\nL:1/8\nK:C\nCDEF GABc |\n`;
    const result = buildChordToneReferenceTable(noChordAbc);
    expect(result.references).toHaveLength(0);
    expect(result.promptText).toBe("");
  });

  it("handles K:C with no accidentals", () => {
    const result = buildChordToneReferenceTable(SIMPLE_C_ABC);
    const cRef = result.references.find((r) => r.chordName === "C");
    expect(cRef).toBeDefined();
    expect(cRef!.notes).toEqual(expect.arrayContaining(["C", "E", "G"]));
    // Under K:C, all naturals — no accidentals needed
    expect(cRef!.abcTokens).toContain("C");
    expect(cRef!.abcTokens).toContain("E");
    expect(cRef!.abcTokens).toContain("G");
  });

  it("resolves B7 chord tones (dominant 7th)", () => {
    const result = buildChordToneReferenceTable(MULTI_CHORD_ABC);
    const b7Ref = result.references.find((r) => r.chordName === "B7");
    expect(b7Ref).toBeDefined();
    // B7 = B, D#, F#, A
    expect(b7Ref!.notes).toEqual(expect.arrayContaining(["B"]));
    expect(b7Ref!.notes.length).toBeGreaterThanOrEqual(3); // At least B, D#, F#
  });
});

// ---------------------------------------------------------------------------
// validateGuitarVoiceChordTones
// ---------------------------------------------------------------------------

describe("validateGuitarVoiceChordTones", () => {
  it("returns valid for correct Em arpeggio", () => {
    const abc = `X:1
T:Test
M:4/4
L:1/8
K:G
V:Melody clef=treble-8
V:Guitar clef=treble-8
[V:Melody] "Em"E2 B2 G2 B2 |
[V:Guitar] E,2 G,2 B,2 E2 |
`;
    const result = validateGuitarVoiceChordTones(abc);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("detects ^G (G#) as wrong note in Em chord under K:G", () => {
    const abc = `X:1
T:Test
M:4/4
L:1/8
K:G
V:Melody clef=treble-8
V:Guitar clef=treble-8
[V:Melody] "Em"E2 B2 G2 B2 |
[V:Guitar] E,2 ^G,2 B,2 E2 |
`;
    const result = validateGuitarVoiceChordTones(abc);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    // Should mention the ^G note
    expect(result.issues[0]).toContain("^G");
  });

  it("detects wrong chord tone when using Am notes over Em chord", () => {
    const abc = `X:1
T:Test
M:4/4
L:1/8
K:G
V:Melody clef=treble-8
V:Guitar clef=treble-8
[V:Melody] "Em"E2 B2 G2 B2 |
[V:Guitar] A,2 c2 E2 A2 |
`;
    const result = validateGuitarVoiceChordTones(abc);
    expect(result.valid).toBe(false);
    // A and C are not in Em (E, G, B)
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("returns valid when no Guitar voice is present", () => {
    const abc = `X:1
T:Test
M:4/4
L:1/8
K:G
V:Melody clef=treble-8
[V:Melody] "Em"E2 B2 G2 B2 |
`;
    const result = validateGuitarVoiceChordTones(abc);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("validates correct Am arpeggio against Am chord", () => {
    const abc = `X:1
T:Test
M:4/4
L:1/8
K:G
V:Melody clef=treble-8
V:Guitar clef=treble-8
[V:Melody] "Am"A2 c2 E2 A2 |
[V:Guitar] A,2 c2 E2 A,2 |
`;
    const result = validateGuitarVoiceChordTones(abc);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("validates correct D major arpeggio under K:G (F is F# by default)", () => {
    const abc = `X:1
T:Test
M:4/4
L:1/8
K:G
V:Melody clef=treble-8
V:Guitar clef=treble-8
[V:Melody] "D"F2 A2 d2 F2 |
[V:Guitar] D,2 F2 A2 d2 |
`;
    // Under K:G, bare F = F#, which is in D major (D, F#, A)
    const result = validateGuitarVoiceChordTones(abc);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("flags =F (F natural) as wrong note in D major under K:G", () => {
    const abc = `X:1
T:Test
M:4/4
L:1/8
K:G
V:Melody clef=treble-8
V:Guitar clef=treble-8
[V:Melody] "D"F2 A2 d2 F2 |
[V:Guitar] D,2 =F2 A2 d2 |
`;
    // =F is F natural (pitch class 5), but D major wants F# (pitch class 6)
    const result = validateGuitarVoiceChordTones(abc);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});
