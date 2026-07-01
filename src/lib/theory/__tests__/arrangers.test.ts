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

  it("builds inspectable upward construction source layers before guitar reduction", () => {
    const arrangement = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(arrangement.upwardConstruction.layers.map((layer) => layer.id)).toEqual([
      "melody",
      "harmonization",
      "accompaniment",
      "bassline",
      "rhythm-percussion",
      "counter-melody",
    ]);
    expect(arrangement.upwardConstruction.layers[0]).toMatchObject({
      id: "melody",
      layer: { number: 1, name: "Melody", instrument: "voice" },
      measures: expect.arrayContaining([{ measureIndex: 0, notes: ["E", "E", "G", "A"] }]),
    });
    expect(arrangement.upwardConstruction.layers[1]).toMatchObject({
      id: "harmonization",
      progression: ["Em", "Bm", "G", "Em"],
      measures: expect.arrayContaining([{ measureIndex: 0, chord: "Em", cadenceRole: "opening-tonic" }]),
    });
    expect(arrangement.upwardConstruction.layers[2]).toMatchObject({
      id: "accompaniment",
      layer: { number: 2, name: "Accompaniment", instrument: "piano" },
      measures: expect.arrayContaining([expect.objectContaining({ measureIndex: 0, chord: "Em", bassNote: "E" })]),
    });
    expect(arrangement.upwardConstruction.layers[3]).toMatchObject({
      id: "bassline",
      measures: expect.arrayContaining([{ measureIndex: 0, chord: "Em", bassMap: [{ beat: 1, note: "E" }] }]),
    });
    expect(arrangement.upwardConstruction.layers[4]).toMatchObject({
      id: "rhythm-percussion",
      measures: expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, chord: "Em", drums: { kickBeats: [1, 3], snareBeats: [2, 4], bassKickAlignment: [{ beat: 1, bassNote: "E", kick: true }] } }),
      ]),
    });
    expect(arrangement.upwardConstruction.layers[5]).toMatchObject({
      id: "counter-melody",
      measures: expect.arrayContaining([
        expect.objectContaining({
          counterMelodies: expect.arrayContaining([expect.objectContaining({ source: "melody-sustain" })]),
        }),
      ]),
    });
    expect(arrangement.upwardConstruction.validation).toEqual({
      melodyReady: true,
      harmonizationReady: true,
      accompanimentReady: true,
      basslineReady: true,
      rhythmPercussionReady: true,
      counterMelodyUsesMelodicGaps: true,
    });
  });

  it("compresses source layers into routed outer voices and weak-beat guide tones", () => {
    const arrangement = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(arrangement.downwardCompression.outerVoiceMap[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      melodyRoute: expect.arrayContaining([expect.objectContaining({ beat: 1, note: "E", string: 1 })]),
      bassRoute: expect.arrayContaining([expect.objectContaining({ beat: 1, note: "E", string: 6 })]),
      beatOnePairing: { valid: true, fretStretch: 0, maxFretStretch: 5 },
    });
    expect(arrangement.downwardCompression.innerVoiceReduction[0]).toMatchObject({
      measureIndex: 0,
      prunedTones: [expect.objectContaining({ note: "B", role: "fifth" })],
      guideTones: [expect.objectContaining({ note: "G", role: "third", beat: 2 })],
    });
    expect(arrangement.downwardCompression.fallbackSuggestions).toEqual([]);
  });

  it("maps routed notes onto strict PIMA picking and playable fretting assignments", () => {
    const arrangement = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(arrangement.downwardCompression.physicalHandMapping[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      profile: { id: "strict-pima", posture: "floating" },
      events: expect.arrayContaining([
        expect.objectContaining({ beat: 1, role: "bass", string: 6, pickingFinger: "p", frettingFinger: null }),
        expect.objectContaining({ beat: 1, role: "melody", string: 1, pickingFinger: "a", frettingFinger: null }),
        expect.objectContaining({ beat: 2, role: "third", string: 3, pickingFinger: "i", frettingFinger: null }),
      ]),
      validation: {
        frettingPlayable: true,
        pickingPlayable: true,
        strictPima: true,
      },
    });
    expect(arrangement.downwardCompression.validation).toMatchObject({
      frettingAssignmentsPlayable: true,
      pickingAssignmentsPlayable: true,
      strictPimaPicking: true,
    });
  });

  it("can render a Folk/Travis hand map with thumb clock, syncopation, and string slaps", () => {
    const arrangement = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"], {
      pickingProfile: "folk-travis",
    });

    expect(arrangement.downwardCompression.physicalHandMapping[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      profile: { id: "folk-travis", posture: "anchored" },
      events: expect.arrayContaining([
        expect.objectContaining({ beat: 1, role: "bass", pickingFinger: "p", technique: "thumb-clock" }),
        expect.objectContaining({ beat: 2, role: "bass", pickingFinger: "p", technique: "thumb-clock" }),
        expect.objectContaining({ beat: 2, role: "percussion", pickingFinger: "p", technique: "string-slap" }),
        expect.objectContaining({ beat: 2.5, role: "melody", pickingFinger: "i", technique: "syncopation" }),
        expect.objectContaining({ beat: 4, role: "percussion", pickingFinger: "p", technique: "string-slap" }),
      ]),
      validation: {
        frettingPlayable: true,
        pickingPlayable: true,
        strictPima: false,
      },
    });
    expect(arrangement.downwardCompression.validation).toMatchObject({
      thumbClockContinuous: true,
      stringSlapsOnBackbeat: true,
    });
  });

  it("routes Beat 1 melody to an available treble open string before declaring fallback", () => {
    const highStretchAbc = `X:1
T:Open B Melody
M:4/4
L:1/8
K:Em
| B2 E2 G2 A2 |`;
    const arrangement = generateFingerstyleArrangement(highStretchAbc, ["Em"]);

    expect(arrangement.downwardCompression.outerVoiceMap[0]).toMatchObject({
      melodyRoute: expect.arrayContaining([expect.objectContaining({ beat: 1, note: "B", string: 2, fret: 0 })]),
      beatOnePairing: { valid: true, fretStretch: 0, maxFretStretch: 5 },
    });
    expect(arrangement.downwardCompression.fallbackSuggestions).toEqual([]);
  });

  it("proposes open-string transposition fallbacks when high-register Beat 1 pairings exceed the fret span", () => {
    const stretchedAbc = `X:1
T:High D Over C Bass
M:4/4
L:1/8
K:C
| d2 E2 G2 A2 |`;
    const arrangement = generateFingerstyleArrangement(stretchedAbc, ["C"]);

    expect(arrangement.downwardCompression.outerVoiceMap[0]).toMatchObject({
      melodyRoute: expect.arrayContaining([expect.objectContaining({ beat: 1, note: "D", string: 1, fret: 10 })]),
      bassRoute: expect.arrayContaining([expect.objectContaining({ beat: 1, note: "C", string: 5, fret: 3 })]),
      beatOnePairing: { valid: false, fretStretch: 7, maxFretStretch: 5 },
    });
    expect(arrangement.downwardCompression.fallbackSuggestions).toEqual([
      expect.objectContaining({
        measureIndex: 0,
        chord: "C",
        suggestedKeys: ["E", "A", "D"],
      }),
    ]);
  });

  it("surfaces playability failures and fallback suggestions through the output contract", () => {
    const stretchedAbc = `X:1
T:High D Over C Bass
M:4/4
L:1/8
K:C
| d2 E2 G2 A2 |`;
    const arrangement = generateFingerstyleArrangement(stretchedAbc, ["C"]);

    expect(arrangement.outputContract.playabilityReport).toMatchObject({
      valid: false,
      measures: [
        expect.objectContaining({
          measureIndex: 0,
          simultaneousMelodyBassFeasible: false,
          failedConstraints: expect.arrayContaining(["fret-span"]),
        }),
      ],
    });
    expect(arrangement.outputContract.fallbackSuggestions).toEqual([
      expect.objectContaining({ measureIndex: 0, chord: "C", suggestedKeys: ["E", "A", "D"] }),
    ]);
  });

  it("exports a complete fingerstyle output contract for Composer and visual integrations", () => {
    const arrangement = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"], {
      pickingProfile: "folk-travis",
    });

    expect(arrangement.outputContract.sourceLayers.map((layer) => layer.id)).toEqual([
      "melody",
      "harmonization",
      "accompaniment",
      "bassline",
      "rhythm-percussion",
      "counter-melody",
    ]);
    expect(arrangement.outputContract.outerVoiceMap[0]).toMatchObject({
      measureIndex: 0,
      melodyRoute: expect.arrayContaining([expect.objectContaining({ beat: 1, string: 1 })]),
      bassRoute: expect.arrayContaining([expect.objectContaining({ beat: 1, string: 6 })]),
    });
    expect(arrangement.outputContract.playabilityReport).toMatchObject({
      valid: true,
      measures: expect.arrayContaining([
        expect.objectContaining({
          measureIndex: 0,
          simultaneousMelodyBassFeasible: true,
          frettingFingerCount: 1,
          pickingFingerCount: 1,
          failedConstraints: [],
        }),
      ]),
    });
    expect(arrangement.outputContract.fallbackSuggestions).toEqual([]);
    expect(arrangement.outputContract.innerVoiceReduction[0]).toMatchObject({
      prunedTones: [expect.objectContaining({ role: "fifth" })],
      guideTones: [expect.objectContaining({ role: "third", beat: 2 })],
    });
    expect(arrangement.outputContract.rhythmicEventMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 1, technique: "thumb-clock", pickingFinger: "p" }),
        expect.objectContaining({ measureIndex: 0, beat: 2, technique: "string-slap", role: "percussion" }),
        expect.objectContaining({ measureIndex: 0, beat: 2.5, technique: "syncopation", role: "melody" }),
      ])
    );
    expect(arrangement.outputContract.profileMetadata).toMatchObject({
      id: "folk-travis",
      posture: "anchored",
      pickingAssignments: { 6: "p", 5: "p", 4: "p", 3: "i", 2: "m", 1: "a" },
    });
    expect(arrangement.outputContract.artifacts).toMatchObject({
      finalAbc: arrangement.abc,
      tablature: {
        measures: expect.arrayContaining([
          expect.objectContaining({
            measureIndex: 0,
            positions: expect.arrayContaining([expect.objectContaining({ beat: 1, string: 6, fret: 0 })]),
          }),
        ]),
      },
      fretboardHighlightEvents: expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 1, string: 6, fret: 0 }),
      ]),
      handOverlayEvents: expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 1, hand: "picking", finger: "p", technique: "thumb-clock" }),
      ]),
    });
  });

  it("exposes a line-only helper for direct ABC output", () => {
    const line = generateFingerstyleLine(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(line.startsWith("V:Guitar clef=treble-8")).toBe(true);
    expect(line).toContain("E,2 E2 B,2 E2");
  });
});
