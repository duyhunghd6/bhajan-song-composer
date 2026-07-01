import { describe, it, expect } from "vitest";
import { generateAccompanimentStage } from "../accompaniment-stage";
import { generateFingerstyleArrangement, generateFingerstyleLine } from "../fingerstyle-arranger";
import { generatePianoAccompaniment } from "../piano-accompaniment";
import { generatePianoBassArrangement, generatePianoBassLine } from "../piano-arranger";

const sampleAbc = `X:1
T:Namostute
M:4/4
L:1/8
Q:1/4=120
K:Em
|: E2 E2 G2 A2 | B4 B2 A2 | G2 A2 B2 G2 | E8 :|`;

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

describe("Piano accompaniment contract", () => {
  it("anchors harmonic framework bass events in C2-C3 while rejecting muddy low intervals", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em", "Bm", "G", "Em"],
      bassFoundation: "1-5-8",
    });

    expect(accompaniment.sourceAnalysis).toMatchObject({
      key: "Em",
      timeSignature: "4/4",
      cadencePoints: [{ measureIndex: 3, beat: 4, type: "phrase-ending" }],
    });
    expect(accompaniment.harmonicFramework[0]).toMatchObject({
      chord: "Em",
      targetMelodyNote: "E",
      targetBeat: 1,
      melodyRole: "root",
    });
    expect(accompaniment.leftHandBassMap[0]).toMatchObject({
      chord: "Em",
      root: "E",
      foundation: "1-5-8",
      events: [
        { note: "E", register: "C2-C3", role: "root" },
        { note: "B", register: "C2-C3", role: "fifth" },
        { note: "E", register: "C2-C3", role: "octave" },
      ],
      lowIntervalLimit: { valid: true, rejectedIntervals: [] },
    });
    expect(accompaniment.abc).toContain("V:PianoLH clef=bass");
    expect(accompaniment.abc).toContain("E,,2 B,,2 E,2 B,,2");
  });

  it("uses melody-derived harmonization cadence roles when no progression is supplied", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc);

    expect(accompaniment.harmonicFramework.map((measure) => measure.chord)).toEqual(["Em", "Bm", "G", "Em"]);
    expect(accompaniment.harmonicFramework[0]).toMatchObject({ cadenceRole: "opening-tonic" });
    expect(accompaniment.harmonicFramework[3]).toMatchObject({ cadenceRole: "final-tonic-resolution" });
  });

  it("falls back to root-only bass anchors when a requested foundation would duplicate a missing chord tone", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em"],
      bassFoundation: "root",
    });

    expect(accompaniment.leftHandBassMap[0]).toMatchObject({
      foundation: "root",
      events: [{ note: "E", role: "root", register: "C2-C3" }],
      lowIntervalLimit: { valid: true, rejectedIntervals: [] },
      abc: "E,,2 E,,2 E,,2 E,,2",
    });
  });
});

describe("Piano arranger", () => {
  it("generates bass-clef root-fifth patterns for every chord measure", () => {
    const arrangement = generatePianoBassArrangement(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(arrangement.key).toBe("Em");
    expect(arrangement.timeSignature).toBe("4/4");
    expect(arrangement.measures).toHaveLength(4);
    expect(arrangement.measures[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      notes: ["E,,", "B,,", "E,", "B,,"],
      abc: "E,,2 B,,2 E,2 B,,2",
    });
    expect(arrangement.abc).toContain("V:Bass clef=bass");
    expect(arrangement.abc).toContain("| E,,2 B,,2 E,2 B,,2 |");
  });

  it("exposes a line-only helper for direct ABC output", () => {
    const line = generatePianoBassLine(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(line.startsWith("V:Bass clef=bass")).toBe(true);
    expect(line).toContain("B,,2");
  });
});

describe("Guitar fingerstyle arranger", () => {
  it("interleaves chord bass notes with melody notes", () => {
    const arrangement = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(arrangement.key).toBe("Em");
    expect(arrangement.measures).toHaveLength(4);
    expect(arrangement.measures[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      bassNotes: ["E,", "B,"],
      melodyNotes: ["E", "E"],
      abc: "E,2 E2 B,2 E2",
    });
    expect(arrangement.abc).toContain("V:Guitar clef=treble-8");
  });

  it("exposes a line-only helper for direct ABC output", () => {
    const line = generateFingerstyleLine(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(line.startsWith("V:Guitar clef=treble-8")).toBe(true);
    expect(line).toContain("E,2 E2 B,2 E2");
  });
});
