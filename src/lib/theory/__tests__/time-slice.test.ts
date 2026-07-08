import { describe, it, expect } from "vitest";
import {
  getLyricSyllablesForMeasure,
  extractDurationTokensWithTies,
  extractMelodyMeasureTimelineWithTies,
  convertAbcToTimeSliceGrid,
  midiToScientificPitch,
  abcNoteToMidi,
} from "../fingerstyle-arranger/time-slice";

describe("Time-Slice conversion", () => {
  describe("abcNoteToMidi & midiToScientificPitch", () => {
    it("converts ABC notes to midi values", () => {
      expect(abcNoteToMidi("E")).toBe(64);
      expect(abcNoteToMidi("E,")).toBe(52);
      expect(abcNoteToMidi("e")).toBe(76);
      expect(abcNoteToMidi("c")).toBe(72);
      expect(abcNoteToMidi("c'")).toBe(84);
      expect(abcNoteToMidi("^F")).toBe(66);
      expect(abcNoteToMidi("_G")).toBe(66);
    });

    it("converts midi values to scientific pitches", () => {
      expect(midiToScientificPitch(60)).toBe("C4");
      expect(midiToScientificPitch(64)).toBe("E4");
      expect(midiToScientificPitch(40)).toBe("E2");
      expect(midiToScientificPitch(76)).toBe("E5");
    });
  });

  describe("getLyricSyllablesForMeasure", () => {
    it("splits words by hyphens and keeps hyphens", () => {
      expect(getLyricSyllablesForMeasure("Ha-ri Bol")).toEqual(["Ha-", "ri", "Bol"]);
      expect(getLyricSyllablesForMeasure("Mu-kun-da")).toEqual(["Mu-", "kun-", "da"]);
      expect(getLyricSyllablesForMeasure("Go- _ vin-da")).toEqual(["Go-", "_", "vin-", "da"]);
    });
  });

  describe("extractDurationTokensWithTies & extractMelodyMeasureTimelineWithTies", () => {
    it("detects and merges ties correctly", () => {
      const abcWithTies = "E2- E G4";
      const tokens = extractDurationTokensWithTies(abcWithTies);
      expect(tokens).toEqual([
        { token: "E2", durationUnits: 2, hasTie: true },
        { token: "E", durationUnits: 1, hasTie: false },
        { token: "G4", durationUnits: 4, hasTie: false },
      ]);

      const timeline = extractMelodyMeasureTimelineWithTies(abcWithTies);
      // E2- and E are merged to a duration of 3
      expect(timeline).toEqual([
        { kind: "note", token: "E2", durationUnits: 3, onsetUnits: 0 },
        { kind: "note", token: "G4", durationUnits: 4, onsetUnits: 3 },
      ]);
    });
  });

  describe("convertAbcToTimeSliceGrid", () => {
    it("converts ABC Notation and chords into a quantized step grid", () => {
      const abc = `X:1
T:Hari Bol
M:4/4
L:1/8
K:Em
[V:Melody] | E2 E2 G2 A2 |
w: Ha-ri Bol _`;

      const grid = convertAbcToTimeSliceGrid(abc, ["Em"]);

      // In 4/4 time with L:1/8, unitsPerBeat = 2, stepsPerBeat = 4, 16 steps total
      expect(grid).toHaveLength(16);

      // Verify Beat 1 (step 1-4, E2)
      expect(grid[0]).toMatchObject({
        step: 1,
        beat: 1.00,
        chord: "Em",
        melody: { pitch: "E4", state: "attack" },
        lyric: "Ha-",
      });
      expect(grid[1]).toMatchObject({
        step: 2,
        beat: 1.25,
        melody: { pitch: "E4", state: "sustain" },
        lyric: null,
      });

      // Verify Beat 2 (step 5-8, E2)
      expect(grid[4]).toMatchObject({
        step: 5,
        beat: 2.00,
        melody: { pitch: "E4", state: "attack" },
        lyric: "ri",
      });

      // Verify Beat 3 (step 9-12, G2)
      expect(grid[8]).toMatchObject({
        step: 9,
        beat: 3.00,
        melody: { pitch: "G4", state: "attack" },
        lyric: "Bol",
      });

      // Verify Beat 4 (step 13-16, A2)
      expect(grid[12]).toMatchObject({
        step: 13,
        beat: 4.00,
        melody: { pitch: "A4", state: "attack" },
        lyric: null, // melisma _
      });
    });

    it("parses strong beat annotations and falls back to metric weights", () => {
      const abc = `X:1
T:Hari Bol
M:4/4
L:1/8
K:Em
[V:Melody] | E2 E2 G2 A2 |
w: Ha-ri Bol _
w: ⬤ * ● *`;

      const grid = convertAbcToTimeSliceGrid(abc, ["Em"]);

      expect(grid).toHaveLength(16);

      // Beat 1.0 (step 1) note attack E has ⬤ in weight line -> strong
      expect(grid[0]).toMatchObject({
        step: 1,
        beat: 1.0,
        beatWeight: "strong",
      });

      // Beat 1.25 (step 2) sustain -> falls back to metric default (null for offbeats)
      expect(grid[1]).toMatchObject({
        step: 2,
        beat: 1.25,
        beatWeight: null,
      });

      // Beat 2.0 (step 5) note attack E has * in weight line -> soft
      expect(grid[4]).toMatchObject({
        step: 5,
        beat: 2.0,
        beatWeight: "soft",
      });

      // Beat 3.0 (step 9) note attack G has ● in weight line -> medium
      expect(grid[8]).toMatchObject({
        step: 9,
        beat: 3.0,
        beatWeight: "medium",
      });

      // Beat 4.0 (step 13) has fallback metric default since note attack has * in weight line -> soft
      expect(grid[12]).toMatchObject({
        step: 13,
        beat: 4.00,
        beatWeight: "soft",
      });
    });
  });
});
