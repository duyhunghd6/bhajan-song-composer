import { describe, it, expect } from "vitest";
import { generateFingerstyleArrangement, generateFingerstyleLine } from "../fingerstyle-arranger";
import { sampleAbc } from "./arranger-fixtures";

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
    expect(arrangement.abc).toContain("V:Guitar clef=treble-8\n%%MIDI program 24");
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
      pickingAssignments: {
        6: ["p"],
        5: ["p"],
        4: ["p"],
        3: ["i", "m"],
        2: ["i", "m"],
        1: ["i", "m"],
      },
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
      noteMarkerEvents: expect.arrayContaining([
        expect.objectContaining({
          measureIndex: 0,
          beat: 1,
          hand: "right",
          sourceHand: "picking",
          fingerNumber: 1,
          musicalFingering: "p",
          technique: "thumb-clock",
        }),
      ]),
    });
  });

  it("exposes a line-only helper for direct ABC output", () => {
    const line = generateFingerstyleLine(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(line.startsWith("V:Guitar clef=treble-8")).toBe(true);
    expect(line).toContain("E,2 E2 B,2 E2");
  });
});
