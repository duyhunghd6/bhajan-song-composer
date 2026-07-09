import { describe, expect, it } from "vitest";
import { getGuitarVoicings, generateAlgorithmicVoicings } from "../guitar-voicings";

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
