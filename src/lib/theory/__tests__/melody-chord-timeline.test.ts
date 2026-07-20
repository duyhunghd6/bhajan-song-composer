import { describe, expect, it } from "vitest";
import {
  assignActiveChordsToMelodyNotes,
  extractInlineChordEventsByMelodyMeasure,
} from "../fingerstyle-arranger/melody-chord-timeline";

const headers = `X:1
T:Chord timeline
M:4/4
L:1/4
K:C`;

describe("melody chord timeline", () => {
  it("maps each attack to the most recent inline chord and carries it forward", () => {
    const assignments = assignActiveChordsToMelodyNotes(
      `${headers}
[V:Melody] "C"C D "G"G A | B c d e |`,
    );

    expect(assignments.map(({ chord, chordSource }) => ({ chord, chordSource }))).toEqual([
      { chord: "C", chordSource: "inline" },
      { chord: "C", chordSource: "inline" },
      { chord: "G", chordSource: "inline" },
      { chord: "G", chordSource: "inline" },
      { chord: "G", chordSource: "carried" },
      { chord: "G", chordSource: "carried" },
      { chord: "G", chordSource: "carried" },
      { chord: "G", chordSource: "carried" },
    ]);
  });

  it("preserves chordless measures and aligns fallback progression by source measure", () => {
    const abc = `${headers}
[V:Melody] C D E F | G A B c | d e f g |`;

    expect(extractInlineChordEventsByMelodyMeasure(abc)).toEqual([[], [], []]);
    expect(assignActiveChordsToMelodyNotes(abc, ["C", "Dm", "G"]).filter((note) => note.onsetUnits === 0)).toMatchObject([
      { measureIndex: 0, chord: "C", chordSource: "progression-fallback" },
      { measureIndex: 1, chord: "Dm", chordSource: "progression-fallback" },
      { measureIndex: 2, chord: "G", chordSource: "progression-fallback" },
    ]);
  });

  it("lets inline onset-zero chords override the fallback and ignores non-harmonic quotes", () => {
    const assignments = assignActiveChordsToMelodyNotes(
      `${headers}
[V:Melody] "^Chorus" "Em"E F G A |`,
      ["C"],
    );

    expect(assignments[0]).toMatchObject({ chord: "Em", chordSource: "inline" });
    expect(assignments.every((note) => note.chord === "Em")).toBe(true);
  });

  it("reports no chord without inline or fallback harmony", () => {
    const assignments = assignActiveChordsToMelodyNotes(`${headers}
[V:Melody] C D E F |`);
    expect(assignments.every((note) => note.chord === null && note.chordSource === "none")).toBe(true);
  });

  it("keeps a tied note on its attack chord when a later chord begins", () => {
    const assignments = assignActiveChordsToMelodyNotes(
      `${headers}
[V:Melody] "C"C2- "G"C2 D E |`,
    );

    expect(assignments).toMatchObject([
      { token: "C2", onsetUnits: 0, durationUnits: 4, chord: "C" },
      { token: "D", onsetUnits: 4, chord: "G" },
      { token: "E", onsetUnits: 5, chord: "G" },
    ]);
  });

  it("does not treat lyric chord brackets as inline chord events", () => {
    const assignments = assignActiveChordsToMelodyNotes(
      `${headers}
[V:Melody] C D E F |
w: [Em]Ha-ri Bol`,
    );

    expect(assignments.every((note) => note.chord === null)).toBe(true);
  });
});
