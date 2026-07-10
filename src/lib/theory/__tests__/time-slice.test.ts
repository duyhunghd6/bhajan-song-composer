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
import { getKeySignatureAccidentals, abcNoteToMidiWithKey } from "../abc-key-signature";

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

describe("Key Signature Accidentals", () => {
  describe("getKeySignatureAccidentals", () => {
    it("returns F# for K:Em (1 sharp)", () => {
      const acc = getKeySignatureAccidentals("Em");
      expect(acc.size).toBe(1);
      expect(acc.get("F")).toBe("^");
    });

    it("returns F# for K:G (1 sharp — relative major of Em)", () => {
      const acc = getKeySignatureAccidentals("G");
      expect(acc.size).toBe(1);
      expect(acc.get("F")).toBe("^");
    });

    it("returns F# C# for K:D (2 sharps)", () => {
      const acc = getKeySignatureAccidentals("D");
      expect(acc.size).toBe(2);
      expect(acc.get("F")).toBe("^");
      expect(acc.get("C")).toBe("^");
    });

    it("returns Bb for K:F (1 flat)", () => {
      const acc = getKeySignatureAccidentals("F");
      expect(acc.size).toBe(1);
      expect(acc.get("B")).toBe("_");
    });

    it("returns empty map for K:C (no accidentals)", () => {
      const acc = getKeySignatureAccidentals("C");
      expect(acc.size).toBe(0);
    });

    it("handles minor key variants", () => {
      const accEmin = getKeySignatureAccidentals("Emin");
      expect(accEmin.get("F")).toBe("^");

      const accEminor = getKeySignatureAccidentals("Eminor");
      expect(accEminor.get("F")).toBe("^");
    });
  });

  describe("abcNoteToMidiWithKey — key-aware conversion", () => {
    const emAccidentals = getKeySignatureAccidentals("Em");

    it("applies key signature: bare F in Em → F# (MIDI 66)", () => {
      expect(abcNoteToMidiWithKey("F", emAccidentals)).toBe(66);
    });

    it("explicit natural overrides key: =F in Em → F natural (MIDI 65)", () => {
      expect(abcNoteToMidiWithKey("=F", emAccidentals)).toBe(65);
    });

    it("explicit sharp matches key: ^F in Em → F# (MIDI 66)", () => {
      expect(abcNoteToMidiWithKey("^F", emAccidentals)).toBe(66);
    });

    it("non-accidental note is unaffected: C in Em → C natural (MIDI 60)", () => {
      expect(abcNoteToMidiWithKey("C", emAccidentals)).toBe(60);
    });

    it("lowercase note with key signature: f in Em → F#5 (MIDI 78)", () => {
      expect(abcNoteToMidiWithKey("f", emAccidentals)).toBe(78);
    });

    it("works without key accidentals (backward compatible)", () => {
      expect(abcNoteToMidiWithKey("F")).toBe(65);
      expect(abcNoteToMidiWithKey("^F")).toBe(66);
    });
  });

  describe("abcNoteToMidi wrapper — key-aware via optional param", () => {
    const emAccidentals = getKeySignatureAccidentals("Em");

    it("F in Em → F# (MIDI 66) via wrapper", () => {
      expect(abcNoteToMidi("F", emAccidentals)).toBe(66);
    });

    it("backward compatible: F without key → F natural (MIDI 65)", () => {
      expect(abcNoteToMidi("F")).toBe(65);
    });
  });

  describe("convertAbcToTimeSliceGrid — key-aware pitch display", () => {
    it("displays F as F#4 in K:Em", () => {
      const abc = `X:1
T:Test
M:4/4
L:1/8
K:Em
[V:Melody] | F2 E2 G2 A2 |`;

      const measures = convertAbcToTimeSliceGrid(abc, ["Em"]);
      expect(measures).toHaveLength(1);

      // Beat 1 should be F#4, not F4
      expect(measures[0].grid[0].melody.pitch).toBe("F#4");
    });

    it("displays =F as F4 (natural override) in K:Em", () => {
      const abc = `X:1
T:Test
M:4/4
L:1/8
K:Em
[V:Melody] | =F2 E2 G2 A2 |`;

      const measures = convertAbcToTimeSliceGrid(abc, ["Em"]);
      expect(measures).toHaveLength(1);

      // Beat 1 should be F4 (natural), not F#4
      expect(measures[0].grid[0].melody.pitch).toBe("F4");
    });
  });
});
