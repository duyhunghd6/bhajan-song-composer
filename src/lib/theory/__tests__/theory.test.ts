import { describe, it, expect } from "vitest";
import { getScaleNotes, getRagaMapping } from "../scales";
import { getDiatonicChords } from "../chords";

describe("Music Theory Engine - Scales", () => {
  it("generates correct notes for C Major (Bilawal)", () => {
    const notes = getScaleNotes("C", "major");
    expect(notes).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
  });

  it("generates correct notes for A Natural Minor", () => {
    const notes = getScaleNotes("A", "natural minor");
    expect(notes).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  it("generates correct notes for E Bhairav (Double Harmonic Major)", () => {
    const notes = getScaleNotes("E", "Bhairav");
    // E + [0, 1, 4, 5, 7, 8, 11]
    // E, F, G#, A, B, C, D#
    expect(notes).toEqual(["E", "F", "G#", "A", "B", "C", "D#"]);
  });

  it("returns correct Western equivalent name for Ragas", () => {
    const yaman = getRagaMapping("Yaman");
    expect(yaman?.westernEquivalent.toLowerCase()).toBe("lydian mode");

    const kafi = getRagaMapping("Kafi");
    expect(kafi?.westernEquivalent.toLowerCase()).toBe("dorian mode");
  });
});

describe("Music Theory Engine - Chords", () => {
  it("generates correct diatonic triads for C Major", () => {
    const chords = getDiatonicChords("C", "major");
    expect(chords).toHaveLength(7);
    expect(chords[0].chordName).toBe("C");
    expect(chords[1].chordName).toBe("Dm");
    expect(chords[2].chordName).toBe("Em");
    expect(chords[3].chordName).toBe("F");
    expect(chords[4].chordName).toBe("G");
    expect(chords[5].chordName).toBe("Am");
    expect(chords[6].chordName).toBe("Bdim");
  });

  it("generates correct diatonic triads for A Natural Minor", () => {
    const chords = getDiatonicChords("A", "natural minor");
    expect(chords).toHaveLength(7);
    expect(chords[0].chordName).toBe("Am");
    expect(chords[1].chordName).toBe("Bdim");
    expect(chords[2].chordName).toBe("C");
    expect(chords[3].chordName).toBe("Dm");
    expect(chords[4].chordName).toBe("Em");
    expect(chords[5].chordName).toBe("F");
    expect(chords[6].chordName).toBe("G");
  });
});
