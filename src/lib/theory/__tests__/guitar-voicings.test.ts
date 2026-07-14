import { describe, expect, it } from "vitest";
import { getGuitarVoicings, generateAlgorithmicVoicings, query_guitar_voicings } from "../guitar-voicings";

describe("Guitar Voicings Generator", () => {
  it("generates algorithmic voicings for a standard chord", () => {
    const voicings = generateAlgorithmicVoicings("Cmaj7");
    expect(voicings).toBeDefined();
    expect(voicings.length).toBeGreaterThan(0);
    
    // Each voicing should have 6 strings with numbers or 'X'
    for (const v of voicings) {
      expect(v.frets).toHaveLength(6);
      expect(v.frets.every(f => f === "X" || typeof f === "number")).toBe(true);
      
      // Should have fingers and barre properties mapped
      expect(v.fingers).toBeDefined();
      expect(v.fingers).toHaveLength(6);
    }
  });

  it("handles complex chords that are not in the static database by falling back to algorithmic voicings", () => {
    // Cmaj7#11 is not in the static chords-db, but should be generated algorithmically
    const voicings = getGuitarVoicings("Cmaj7#11");
    expect(voicings).toBeDefined();
    expect(voicings.length).toBeGreaterThan(0);
    
    // Check that we got at least one playable voicing
    const firstVoicing = voicings[0];
    expect(firstVoicing.frets).toHaveLength(6);
    expect(firstVoicing.isPrimary).toBe(true);
  });

  it("returns playable query matches sorted by fret span and capped at 15", () => {
    const matches = query_guitar_voicings("C", "E4");

    expect(matches.length).toBeLessThanOrEqual(15);
    expect(matches.every((match) => {
      const fretted = match.frets.filter((f): f is number => typeof f === "number" && f > 0);
      const span = fretted.length >= 2 ? Math.max(...fretted) - Math.min(...fretted) : 0;
      return span === match.fretDistance && span <= 3;
    })).toBe(true);
    expect(matches.every((match, index) => index === 0 || (matches[index - 1].fretDistance ?? 0) <= (match.fretDistance ?? 0))).toBe(true);
    expect(matches.every((match) => match.melody?.string && match.melody.fret >= 0)).toBe(true);
  });

  it("combines database voicings with unique algorithmic voicings", () => {
    // C major is definitely in the static database
    const voicings = getGuitarVoicings("C");
    expect(voicings).toBeDefined();
    
    // chords-db has exactly 4 positions for C major
    // So getGuitarVoicings should return at least 4 shapes
    expect(voicings.length).toBeGreaterThanOrEqual(4);
    
    // The first one should be primary
    expect(voicings[0].isPrimary).toBe(true);
  });
});
