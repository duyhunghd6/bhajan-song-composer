import { describe, expect, it } from "vitest";
import {
  abcNoteToMidiWithKey,
  getKeySignatureAccidentals,
  getKeyAccidentalsFromAbc,
} from "../abc-key-signature";

describe("abcNoteToMidiWithKey", () => {
  describe("basic notes without key signature", () => {
    it("parses middle C (C5 in ABC lowercase convention)", () => {
      expect(abcNoteToMidiWithKey("c")).toBe(72); // C5
    });
    it("parses uppercase C (C4)", () => {
      expect(abcNoteToMidiWithKey("C")).toBe(60); // C4
    });
    it("parses octave marks", () => {
      expect(abcNoteToMidiWithKey("c'")).toBe(84); // C6
      expect(abcNoteToMidiWithKey("C,")).toBe(48); // C3
    });
  });

  describe("explicit single accidentals", () => {
    it("parses sharp ^C", () => {
      expect(abcNoteToMidiWithKey("^C")).toBe(61); // C#4
    });
    it("parses flat _B", () => {
      expect(abcNoteToMidiWithKey("_B")).toBe(70); // Bb4
    });
    it("parses natural =F in K:G (overrides F#)", () => {
      const keyG = getKeySignatureAccidentals("G");
      expect(abcNoteToMidiWithKey("=F", keyG)).toBe(65); // F4 natural
    });
  });

  describe("enharmonic edge cases (the ^e bug)", () => {
    it("parses ^e (E-sharp = F, MIDI 77) in any key", () => {
      expect(abcNoteToMidiWithKey("^e")).toBe(77); // E#5 = F5
    });
    it("parses ^E (E-sharp = F, MIDI 65) in any key", () => {
      expect(abcNoteToMidiWithKey("^E")).toBe(65); // E#4 = F4
    });
    it("parses ^B (B-sharp = C in next octave)", () => {
      // B4 = MIDI 71, B#4 = one semitone up = MIDI 72 (= C5)
      expect(abcNoteToMidiWithKey("^B")).toBe(72);
    });
    it("parses ^b (B-sharp lowercase = C in next octave)", () => {
      // b5 = MIDI 83, B#5 = one semitone up = MIDI 84 (= C6)
      expect(abcNoteToMidiWithKey("^b")).toBe(84);
    });
    it("parses _F (F-flat = E)", () => {
      expect(abcNoteToMidiWithKey("_F")).toBe(64); // Fb4 = E4
    });
    it("parses _f (F-flat lowercase = E)", () => {
      expect(abcNoteToMidiWithKey("_f")).toBe(76); // Fb5 = E5
    });
    it("parses _C (C-flat = B in previous octave)", () => {
      expect(abcNoteToMidiWithKey("_C")).toBe(59); // Cb4 = B3 = MIDI 59
    });
    it("parses _c (C-flat lowercase = B in previous octave)", () => {
      expect(abcNoteToMidiWithKey("_c")).toBe(71); // Cb5 = B4 = MIDI 71
    });
  });

  describe("double accidentals", () => {
    it("parses ^^C (C double-sharp = D)", () => {
      expect(abcNoteToMidiWithKey("^^C")).toBe(62); // C##4 = D4
    });
    it("parses __D (D double-flat = C)", () => {
      expect(abcNoteToMidiWithKey("__D")).toBe(60); // Dbb4 = C4
    });
    it("parses ^^B (B double-sharp = C# in next octave)", () => {
      // B4 = MIDI 71, +2 = 73 (C#5)
      expect(abcNoteToMidiWithKey("^^B")).toBe(73);
    });
    it("parses __C (C double-flat = Bb in previous octave)", () => {
      // C4 = MIDI 60, -2 = 58 (Bb3)
      expect(abcNoteToMidiWithKey("__C")).toBe(58);
    });
  });

  describe("key signature application", () => {
    it("applies F# from K:G to bare F", () => {
      const keyG = getKeySignatureAccidentals("G");
      expect(abcNoteToMidiWithKey("F", keyG)).toBe(66); // F#4
    });
    it("applies F# from K:Em to bare F", () => {
      const keyEm = getKeySignatureAccidentals("Em");
      expect(abcNoteToMidiWithKey("F", keyEm)).toBe(66); // F#4
    });
    it("natural cancels key signature sharp", () => {
      const keyG = getKeySignatureAccidentals("G");
      expect(abcNoteToMidiWithKey("=F", keyG)).toBe(65); // F natural
    });
    it("bare E in K:G is unaffected (no accidental on E)", () => {
      const keyG = getKeySignatureAccidentals("G");
      expect(abcNoteToMidiWithKey("e", keyG)).toBe(76); // E5
    });
  });

  describe("the exact user scenario: K:G with ^e4 and =e2", () => {
    it("^e should resolve to F5 (MIDI 77)", () => {
      const keyG = getKeySignatureAccidentals("G");
      expect(abcNoteToMidiWithKey("^e", keyG)).toBe(77);
    });
    it("=e should resolve to E5 (MIDI 76)", () => {
      const keyG = getKeySignatureAccidentals("G");
      expect(abcNoteToMidiWithKey("=e", keyG)).toBe(76);
    });
  });
});

describe("getKeyAccidentalsFromAbc", () => {
  it("extracts K:G accidentals from full ABC", () => {
    const abc = `X:1\nL:1/8\nM:3/4\nK:G\n[V:Melody] | c4 |`;
    const accidentals = getKeyAccidentalsFromAbc(abc);
    expect(accidentals.get("F")).toBe("^");
    expect(accidentals.size).toBe(1);
  });
});
