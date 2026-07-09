import { describe, it, expect } from "vitest";
import {
  getLyricSyllablesForMeasure,
  extractDurationTokensWithTies,
  extractMelodyMeasureTimelineWithTies,
  convertAbcToTimeSliceGrid,
  midiToScientificPitch,
  abcNoteToMidi,
  extractChordsFromMeasure,
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

      const measures = convertAbcToTimeSliceGrid(abc, ["Em"]);

      expect(measures).toHaveLength(1);
      expect(measures[0].measure).toBe(1);
      expect(measures[0].style_profile).toEqual({
        key: "Em",
        comping_style: "PIMA devotional fingerstyle. Sparse fills.",
        voicing_plan: "Open-position Em and D shapes. Thumbed E/B and D/A anchors.",
      });

      const steps = measures[0].grid;
      expect(steps).toHaveLength(16);

      // Verify Beat 1 (step 1-4, E2)
      expect(steps[0]).toMatchObject({
        step: 1,
        chord: "Em",
        melody: { pitch: "E4", state: "attack" },
        lyric: "Ha-",
      });
      expect(steps[1]).toMatchObject({
        step: 2,
        melody: { pitch: "E4", state: "sustain" },
        lyric: null,
      });

      // Verify Beat 2 (step 5-8, E2)
      expect(steps[4]).toMatchObject({
        step: 5,
        melody: { pitch: "E4", state: "attack" },
        lyric: "ri",
      });

      // Verify Beat 3 (step 9-12, G2)
      expect(steps[8]).toMatchObject({
        step: 9,
        melody: { pitch: "G4", state: "attack" },
        lyric: "Bol",
      });

      // Verify Beat 4 (step 13-16, A2)
      expect(steps[12]).toMatchObject({
        step: 13,
        melody: { pitch: "A4", state: "attack" },
        lyric: "_", // melisma _ is preserved
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

      const measures = convertAbcToTimeSliceGrid(abc, ["Em"]);

      expect(measures).toHaveLength(1);
      const steps = measures[0].grid;
      expect(steps).toHaveLength(16);

      // Beat 1.0 (step 1) note attack E has ⬤ in weight line -> strong
      expect(steps[0]).toMatchObject({
        step: 1,
        weight: "⬤",
      });

      // Beat 1.25 (step 2) sustain -> falls back to metric default (null for offbeats)
      expect(steps[1]).toMatchObject({
        step: 2,
        weight: null,
      });

      // Beat 2.0 (step 5) note attack E has * in weight line -> soft
      expect(steps[4]).toMatchObject({
        step: 5,
        weight: "*",
      });

      // Beat 3.0 (step 9) note attack G has ● in weight line -> medium
      expect(steps[8]).toMatchObject({
        step: 9,
        weight: "●",
      });

      // Beat 4.0 (step 13) has fallback metric default since note attack has * in weight line -> soft
      expect(steps[12]).toMatchObject({
        step: 13,
        weight: "*",
      });
    });

    it("respects optional comping_style and voicing_plan options", () => {
      const abc = `X:1\nT:Hari Bol\nM:4/4\nL:1/8\nK:Em\n[V:Melody] | E2 E2 G2 A2 |`;
      const measures = convertAbcToTimeSliceGrid(abc, ["Em"], {
        comping_style: "Folk Travis picking",
        voicing_plan: "Open-position Em/D transitions with walking bass",
      });

      expect(measures).toHaveLength(1);
      expect(measures[0].style_profile).toEqual({
        key: "Em",
        comping_style: "Folk Travis picking",
        voicing_plan: "Open-position Em/D transitions with walking bass",
      });
    });
  });

  describe("extractChordsFromMeasure", () => {
    it("extracts inline chords and their correct onset offsets", () => {
      const chords = extractChordsFromMeasure('"Em"E E (EB,) "D"E E (EB,)');
      expect(chords).toEqual([
        { chord: "Em", onsetUnits: 0 },
        { chord: "D", onsetUnits: 4 },
      ]);
    });
  });
});
