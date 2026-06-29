import { describe, it, expect } from "vitest";
import { parseAbcHeader, detectKeyFromNotes, analyzeMelody } from "../melody-analyzer";

describe("Melody Analyzer", () => {
  const sampleAbc = `X:1
T:Namostute
M:4/4
L:1/8
Q:1/4=120
K:Em
|: E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 :|`;

  it("extracts key and time signature from ABC headers", () => {
    const header = parseAbcHeader(sampleAbc);
    expect(header.key).toBe("Em");
    expect(header.timeSignature).toBe("4/4");
  });

  it("detects key from notes and final note resolution", () => {
    // E minor notes: E, F#, G, A, B, C, D
    const notes = ["E", "G", "A", "B", "B", "A", "G", "A", "B", "G", "E"];
    const detected = detectKeyFromNotes(notes, "E");
    expect(detected.root).toBe("E");
    expect(detected.scaleName).toBe("natural minor");
  });

  it("analyzes melody and extracts strong-beat notes per measure", () => {
    const analysis = analyzeMelody(sampleAbc);
    expect(analysis.key).toBe("Em");
    expect(analysis.timeSignature).toBe("4/4");
    expect(analysis.measures).toHaveLength(4);

    // Measure 1: | E2 E2 G2 A2 |
    // Notes: E2 (starts at 0, length 2), E2 (starts at 2, length 2), G2 (starts at 4, length 2), A2 (starts at 6, length 2)
    // Strong beats in 4/4 are at beat 0 (beat 1) and beat 2 (beat 3).
    // In terms of quarter notes, eighth note duration:
    // E2 is 2 eighth notes long = 1 quarter note.
    // So note 1 (E) is at time 0 (beat 0) -> strong beat!
    // Note 2 (E) is at time 1 (beat 1).
    // Note 3 (G) is at time 2 (beat 2) -> strong beat!
    // Note 4 (A) is at time 3 (beat 3).
    // Strong beat notes in measure 1 should be ["E", "G"]!
    expect(analysis.measures[0].strongBeatNotes).toContain("E");
    expect(analysis.measures[0].strongBeatNotes).toContain("G");

    // Measure 2: | B4 B2 A2 |
    // Note 1 (B4) is at time 0 (beat 0) -> strong beat!
    // Note 2 (B2) is at time 2 (beat 2) -> strong beat!
    expect(analysis.measures[1].strongBeatNotes).toContain("B");

    // Measure 4: | E8 |
    // Note 1 (E8) is at time 0 (beat 0) -> strong beat!
    expect(analysis.measures[3].strongBeatNotes).toEqual(["E"]);
  });
});
