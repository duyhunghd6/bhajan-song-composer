import { describe, it, expect } from "vitest";
import { generateFingerstyleArrangement, generateFingerstyleLine } from "../fingerstyle-arranger";
import { validateGuitarTab } from "../guitar-tab-validation";
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
      melodyNotes: ["E", "E", "G", "A"],
    });
    // abc now includes inner voice chord fills (3rd, 5th, root) at weak-beat subdivisions
    expect(arrangement.measures[0].abc).toContain("!6!E,");
    expect(arrangement.measures[0].abc).toContain("!5!B,");
    expect(arrangement.measures[0].abc).toContain("!1!e");
    expect(arrangement.measures[0].abc).toContain("!1!g");
    expect(arrangement.abc).toContain('V:Guitar clef=treble-8 name="Layer 2 Guitar Fingerstyle"\n%%MIDI program 24');
    expect(arrangement.abc).toContain("% @fingerstyle-section intro");
    expect(arrangement.abc).toContain("% @fingerstyle-section interlude");
    expect(arrangement.abc).toContain("% @fingerstyle-section outro");
  });

  it("derives chord-timed fingerstyle bass from workflow-applied chord annotations", () => {
    const chordAnnotatedAbc = `X:1
T:Workflow Chord Timing
M:4/4
L:1/8
K:Em
| "Em"E2 E2 G2 A2 | "D"B4 B2 A2 | "C"G2 A2 B2 G2 | "B7"E8 |`;

    const arrangement = generateFingerstyleArrangement(chordAnnotatedAbc);

    expect(arrangement.measures.map((measure) => measure.chord)).toEqual(["Em", "D", "C", "B7"]);
    expect(arrangement.measures).toEqual(expect.arrayContaining([
      expect.objectContaining({ measureIndex: 0, chord: "Em", bassNotes: ["E,", "B,"], melodyNotes: ["E", "E", "G", "A"] }),
      expect.objectContaining({ measureIndex: 1, chord: "D", bassNotes: ["D,", "A,"], melodyNotes: ["B", "B", "A"] }),
      expect.objectContaining({ measureIndex: 2, chord: "C", bassNotes: ["C,", "G,"], melodyNotes: ["G", "A", "B", "G"] }),
      expect.objectContaining({ measureIndex: 3, chord: "B7", bassNotes: ["B,", "^F,"], melodyNotes: ["E"] }),
    ]));
    // abc now includes chord fill events — verify bass anchors and melody still present
    expect(arrangement.measures[3].abc).toContain("!5!B,");
    expect(arrangement.measures[3].abc).toContain("!1!e");

    expect(arrangement.downwardCompression.outerVoiceMap).toEqual(expect.arrayContaining([
      expect.objectContaining({
        measureIndex: 3,
        chord: "B7",
        bassRoute: expect.arrayContaining([
          expect.objectContaining({ beat: 1, note: "B", role: "bass", string: 5, fret: 2 }),
          expect.objectContaining({ beat: 3, note: "B", role: "bass", string: 5, fret: 2 }),
        ]),
        melodyRoute: expect.arrayContaining([
          expect.objectContaining({ beat: 1, note: "E", role: "melody", string: 1, fret: 0 }),
        ]),
      }),
    ]));

    expect(arrangement.outputContract.artifacts.guitarTabEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ measureIndex: 0, beat: 1, role: "bass", note: "E2", string: 6, fret: 0 }),
      expect.objectContaining({ measureIndex: 0, beat: 1, role: "melody", note: "E4", string: 1, fret: 0 }),
      expect.objectContaining({ measureIndex: 1, beat: 1, role: "bass", note: "D3", string: 4, fret: 0 }),
      expect.objectContaining({ measureIndex: 1, beat: 1, role: "melody", note: "B4", string: 1, fret: 7 }),
      expect.objectContaining({ measureIndex: 2, beat: 1, role: "bass", note: "C3", string: 5, fret: 3 }),
      expect.objectContaining({ measureIndex: 3, beat: 1, role: "bass", note: "B2", string: 5, fret: 2 }),
    ]));
    expect(validateGuitarTab(arrangement.outputContract.artifacts.guitarTabEvents, { requireScientificPitch: true }).valid).toBe(true);
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
        expect.objectContaining({ beat: 3, role: "melody", pickingFinger: "i", technique: "syncopation" }),
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
          frettingFingerCount: 2,
          pickingFingerCount: 3,
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
        expect.objectContaining({ measureIndex: 0, beat: 2, technique: "guide-tone", role: "melody" }),
        expect.objectContaining({ measureIndex: 0, beat: 3, technique: "thumb-clock", role: "fifth" }),
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
      formPlan: {
        sections: expect.arrayContaining([
          expect.objectContaining({ kind: "intro", label: "Intro" }),
          expect.objectContaining({ kind: "body", label: "Melody Body" }),
          expect.objectContaining({ kind: "interlude", label: "Interlude" }),
          expect.objectContaining({ kind: "outro", label: "Outro" }),
        ]),
      },
      guitarTabEvents: expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, role: "bass", string: 6, fret: 0 }),
        expect.objectContaining({ measureIndex: 0, role: "melody" }),
      ]),
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

  it("emits octave-aware tab events that pass strict one-guitar validation", () => {
    const arrangement = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"]);
    const events = arrangement.outputContract.artifacts.guitarTabEvents;

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ note: "E2", string: 6, fret: 0, sourceEventId: expect.any(String) }),
      expect.objectContaining({ note: "E4", string: 1, fret: 0, sourceEventId: expect.any(String) }),
    ]));
    expect(validateGuitarTab(events, { requireScientificPitch: true }).valid).toBe(true);
  });

  it("exposes a line-only helper for direct ABC output", () => {
    const line = generateFingerstyleLine(sampleAbc, ["Em", "Bm", "G", "Em"]);

    expect(line.startsWith('V:Guitar clef=treble-8 name="Layer 2 Guitar Fingerstyle"')).toBe(true);
    // With chord fills, the pattern is denser; verify key markers are present
    expect(line).toContain("!6!E,");
    expect(line).toContain("!5!B,");
    expect(line).toContain("% @fingerstyle-section body");
  });

  it("serializes physical melody pitches in concert pitch with key-aware naturals", () => {
    const abc = `X:1
T:Physical Pitch Serialization
M:4/4
L:1/8
K:Em
| B,2 =F2 |`;
    const arrangement = generateFingerstyleArrangement(abc, ["Em"]);

    expect(arrangement.measures[0].abc).toContain("!2!B");
    expect(arrangement.measures[0].abc).toContain("!1!=f");
    expect(arrangement.measures[0].abc).not.toContain("!2!B,");
  });

  it("preserves rests and rest-only measures in the guitar body timeline", () => {
    const restedAbc = `X:1
T:Rests
M:4/4
L:1/8
K:Em
| z8 | z4 E4 |`;
    const arrangement = generateFingerstyleArrangement(restedAbc, ["Em", "Em"]);

    expect(arrangement.measures).toHaveLength(2);
    expect(arrangement.measures[0].melodyNotes).toEqual([]);
    // With chord fills, bass anchors are still present; abc is denser
    expect(arrangement.measures[1].abc).toContain("!6!E,");
    expect(arrangement.measures[1].abc).toContain("!5!B,");
    expect(arrangement.measures[1].abc).toContain("!1!e");
  });

  it("extracts only the Melody inline voice for solo fingerstyle input", () => {
    const inlineAbc = `X:1
T:Inline Voices
M:4/4
L:1/8
K:Em
[V:Melody] E2 z2 G4 |
[V:Piano] C8 |`;
    const arrangement = generateFingerstyleArrangement(inlineAbc, ["Em"]);

    expect(arrangement.measures[0].melodyNotes).toEqual(["E", "G"]);
    expect(arrangement.measures[0].abc).not.toContain("C");
  });

  it("uses complete validated workflow tab events as the selected canonical tab mapping", () => {
    const base = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"]);
    const selectedEvents = base.outputContract.artifacts.guitarTabEvents.map((event) =>
      event.measureIndex === 0 && event.beat === 1 && event.role === "melody"
        ? { ...event, string: 2 as const, fret: 5, note: "E4" }
        : event
    );
    const arrangement = generateFingerstyleArrangement(sampleAbc, ["Em", "Bm", "G", "Em"], {
      workflowOptionData: {
        pickingProfile: "strict-pima",
        bassStrategy: "selected validated map",
        guitarTab: { profileId: "guitar-classic", events: selectedEvents },
      },
    });

    expect(arrangement.outputContract.artifacts.appliedWorkflowOption).toMatchObject({
      bassStrategy: "selected validated map",
      usedCanonicalGuitarTabEvents: true,
    });
    expect(arrangement.outputContract.artifacts.guitarTabEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ measureIndex: 0, beat: 1, role: "melody", string: 2, fret: 5, note: "E4" })])
    );
  });
});
