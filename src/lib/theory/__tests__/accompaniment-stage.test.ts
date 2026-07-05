import { describe, it, expect } from "vitest";
import { generateAccompanimentStage } from "../accompaniment-stage";
import { sampleAbc } from "./arranger-fixtures";

describe("Accompaniment stage", () => {
  it("generates an inspectable layer-2 piano accompaniment with bass extraction and comping metadata", () => {
    const stage = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm", "G", "Em"],
      compingPattern: "arpeggio",
    });

    expect(stage.layer).toEqual({ number: 2, name: "Accompaniment", instrument: "piano" });
    expect(stage.measures).toHaveLength(4);
    expect(stage.measures[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      bassNote: "E",
      inversion: "root",
      compingPattern: "arpeggio",
      abc: "E,,2 B,,2 G,2 B,,2",
    });
    expect(stage.measures[0].voiceLeading.semitoneDistance).toBe(0);
    expect(stage.abc).toContain("V:Accompaniment clef=bass name=\"Layer 2 Piano Accompaniment\"");
    expect(stage.abc).toContain("| E,,2 B,,2 G,2 B,,2 |");
  });

  it("uses the harmonized progression when no progression is supplied", () => {
    const stage = generateAccompanimentStage(sampleAbc);

    expect(stage.layer).toEqual({ number: 2, name: "Accompaniment", instrument: "piano" });
    expect(stage.measures).toHaveLength(4);
    expect(stage.measures.map((measure) => measure.chord)).toEqual(["Em", "Bm", "G", "Em"]);
    expect(stage.abc).toContain("V:Accompaniment clef=bass name=\"Layer 2 Piano Accompaniment\"");
  });

  it("smooths piano bass movement by selecting chord inversions", () => {
    const stage = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "C", "G", "Em"],
      compingPattern: "arpeggio",
    });

    expect(stage.measures[1]).toMatchObject({
      chord: "C",
      bassNote: "E",
      inversion: "first",
      voiceLeading: {
        previousBassNote: "E",
        semitoneDistance: 0,
      },
      abc: "E,,2 G,,2 E,2 G,,2",
    });
  });

  it("exposes stable tones and shortest upper-voice movement between chords", () => {
    const stage = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["C", "G", "C", "G"],
      compingPattern: "block",
    });

    expect(stage.measures[1].voiceLeading).toMatchObject({
      previousBassNote: "C",
      semitoneDistance: 1,
      stableNotes: ["G"],
      voiceMovements: [
        { from: "C", to: "B", semitoneDistance: 1 },
        { from: "E", to: "D", semitoneDistance: 2 },
      ],
    });
  });

  it("generates rhythm-guitar syncopation with inspectable strum events", () => {
    const stage = generateAccompanimentStage(sampleAbc, {
      instrument: "rhythm-guitar",
      progression: ["Em", "Bm", "G", "Em"],
      compingPattern: "syncopation",
    });

    expect(stage.layer.instrument).toBe("rhythm-guitar");
    expect(stage.abc).toContain("V:Accompaniment clef=treble-8 name=\"Layer 2 Rhythm Guitar Accompaniment\"");
    expect(stage.measures[0]).toMatchObject({
      chord: "Em",
      bassNote: "E",
      compingPattern: "syncopation",
      abc: "[EGB]2 z2 [EGB]2 [EGB]2",
      strums: [
        { beat: 1, direction: "down", role: "bass-emphasis" },
        { beat: 2, direction: "rest", role: "syncopated-space" },
        { beat: 3, direction: "up", role: "off-beat-chord" },
        { beat: 4, direction: "down", role: "backbeat-chord" },
      ],
    });
  });

  it("validates accompaniment comes after harmonization", () => {
    expect(() => generateAccompanimentStage(sampleAbc, { progression: [] })).toThrow(
      "Accompaniment stage requires at least one harmonized chord"
    );
  });
});

