import { describe, it, expect } from "vitest";
import { generateHarmonizationStage, generateProgression } from "../harmonizer";

describe("Auto-Harmonizer", () => {
  const sampleAbc = `X:1
T:Namostute
M:4/4
L:1/8
Q:1/4=120
K:Em
|: E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 :|`;

  it("generates a valid chord progression matching the melody", () => {
    const progression = generateProgression(sampleAbc);

    // Should have 4 chords corresponding to the 4 measures
    expect(progression).toHaveLength(4);

    // Chords should be diatonic to Em: Em, F#dim, G, Am, Bm, C, D
    const validChords = ["Em", "F#dim", "G", "Am", "Bm", "C", "D"];
    progression.forEach((chord) => {
      expect(validChords).toContain(chord);
    });

    // The first and last chords should be the tonic (Em)
    expect(progression[0]).toBe("Em");
    expect(progression[3]).toBe("Em");
  });

  it("annotates harmonization decisions with key, scale, strong beats, chord function, and cadence role", () => {
    const harmonization = generateHarmonizationStage(sampleAbc);

    expect(harmonization.key).toBe("E");
    expect(harmonization.scale).toBe("natural minor");
    expect(harmonization.measures).toHaveLength(4);
    expect(harmonization.measures[0]).toMatchObject({
      measureIndex: 0,
      strongBeatNotes: ["E", "G"],
      chord: {
        degree: 1,
        name: "Em",
        notes: ["E", "G", "B"],
        romanNumeral: "i",
        function: "tonic",
        diatonic: true,
      },
      cadenceRole: "opening-tonic",
    });
    expect(harmonization.measures[1].chord).toMatchObject({
      name: "Bm",
      romanNumeral: "v",
      function: "dominant",
      diatonic: true,
    });
    expect(harmonization.measures[3].cadenceRole).toBe("final-tonic-resolution");
    expect(harmonization.progression).toEqual(["Em", "Bm", "G", "Em"]);
  });
});
