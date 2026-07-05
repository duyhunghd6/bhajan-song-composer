import { describe, it, expect } from "vitest";
import { generatePianoAccompaniment } from "../piano-accompaniment";
import { sampleAbc } from "./arranger-fixtures";

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

  it("places right-hand guide tones below the melody to avoid masking", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em"],
    });

    expect(accompaniment.rightHandVoicingMap[0]).toMatchObject({
      chord: "Em",
      targetMelodyNote: "E",
      guideTones: ["G"],
      melodyMaskingAvoided: true,
      tones: [
        expect.objectContaining({ note: "G", role: "third", register: "C3-C5", masksMelody: false }),
        expect.objectContaining({ note: "B", role: "fifth", register: "C3-C5", masksMelody: false }),
      ],
    });
    expect(accompaniment.rightHandVoicingMap[0].abc).toBe("[G,B,]8");
    expect(accompaniment.abc).toContain("V:PianoRH clef=treble");
  });

  it("retains common tones and chooses shortest-path right-hand movement", () => {
    const neutralMelodyAbc = `X:1
T:Neutral Melody
M:4/4
L:1/8
K:C
| A2 E2 G2 A2 | A2 E2 G2 A2 |`;
    const accompaniment = generatePianoAccompaniment(neutralMelodyAbc, {
      progression: ["C", "G"],
    });

    expect(accompaniment.rightHandVoicingMap[1]).toMatchObject({
      chord: "G",
      commonTones: ["G"],
      totalSemitoneMovement: 2,
      tones: expect.arrayContaining([
        expect.objectContaining({ note: "G", retainedFromPrevious: true, semitoneMovement: 0 }),
        expect.objectContaining({ note: "D", semitoneMovement: 2 }),
      ]),
    });
  });

  it("generates a Pop/Ballad 1-5-10 arpeggiation comping profile", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em"],
      compingProfile: "pop-ballad",
    });

    expect(accompaniment.compingProfileMap[0]).toMatchObject({
      profileId: "pop-ballad",
      style: "Pop/Ballad",
      rhythmicFeel: "1-5-10 arpeggiation",
      leftHandAbc: "E,,2 B,,2 G,2 B,,2",
      events: [
        { beat: 1, hand: "left", role: "root", notes: ["E"] },
        { beat: 2, hand: "left", role: "fifth", notes: ["B"] },
        { beat: 3, hand: "left", role: "tenth", notes: ["G"] },
        { beat: 4, hand: "left", role: "fifth", notes: ["B"] },
      ],
    });
    expect(accompaniment.abc).toContain("V:PianoCompingLH clef=bass name=\"Pop/Ballad 1-5-10\"");
  });

  it("generates a Rock/R&B staccato octave and syncopated off-beat comping profile", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em"],
      compingProfile: "rock-rnb",
    });

    expect(accompaniment.compingProfileMap[0]).toMatchObject({
      profileId: "rock-rnb",
      style: "Rock/R&B",
      rhythmicFeel: "staccato octave off-beat comping",
      leftHandAbc: "[E,,E,]2 z2 [E,,E,]2 z2",
      rightHandAbc: "z2 [G,B,]2 z2 [G,B,]2",
      events: [
        { beat: 1, hand: "left", role: "octave", notes: ["E", "E"], articulation: "staccato" },
        { beat: 2, hand: "right", role: "off-beat-chord", notes: ["G", "B"], articulation: "syncopated" },
        { beat: 3, hand: "left", role: "octave", notes: ["E", "E"], articulation: "staccato" },
        { beat: 4, hand: "right", role: "off-beat-chord", notes: ["G", "B"], articulation: "syncopated" },
      ],
    });
    expect(accompaniment.abc).toContain("V:PianoCompingRH clef=treble name=\"Rock/R&B Off-beats\"");
  });

  it("generates a Classical/Folk Alberti-bass comping profile", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em"],
      compingProfile: "classical-folk",
    });

    expect(accompaniment.compingProfileMap[0]).toMatchObject({
      profileId: "classical-folk",
      style: "Classical/Folk",
      rhythmicFeel: "Alberti bass",
      leftHandAbc: "E,,2 B,,2 G,2 B,,2",
      events: [
        { beat: 1, hand: "left", role: "root", notes: ["E"], articulation: "legato" },
        { beat: 2, hand: "left", role: "fifth", notes: ["B"], articulation: "legato" },
        { beat: 3, hand: "left", role: "alberti-third", notes: ["G"], articulation: "legato" },
        { beat: 4, hand: "left", role: "fifth", notes: ["B"], articulation: "legato" },
      ],
    });
    expect(accompaniment.abc).toContain("V:PianoCompingLH clef=bass name=\"Classical/Folk Alberti Bass\"");
  });

  it("detects melody rests as safe gap-fill windows and yields before melody resumes", () => {
    const gapMelodyAbc = `X:1
T:Gap Melody
M:4/4
L:1/8
K:Em
| E2 z2 z2 B2 |`;
    const accompaniment = generatePianoAccompaniment(gapMelodyAbc, {
      progression: ["Em"],
    });

    expect(accompaniment.gapFillMap[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      gap: { startBeat: 2, endBeat: 4, durationBeats: 2, safe: true, resumedBy: "B" },
      events: [
        { beat: 2, role: "passing-fill", notes: ["G"], yieldsToMelodyAt: 4 },
        { beat: 3, role: "passing-fill", notes: ["B"], yieldsToMelodyAt: 4 },
      ],
      abc: "z2 G,2 B,2 z2",
    });
    expect(accompaniment.abc).toContain("V:PianoGapFill clef=treble name=\"Safe Gap Fills\"");
  });

  it("ignores short melody breaks and fills the first safe gap later in the measure", () => {
    const gapMelodyAbc = `X:1
T:Later Gap Melody
M:4/4
L:1/8
K:Em
| E z B2 z2 z2 |`;
    const accompaniment = generatePianoAccompaniment(gapMelodyAbc, {
      progression: ["Em"],
    });

    expect(accompaniment.gapFillMap[0]).toMatchObject({
      gap: { startBeat: 3, endBeat: 5, durationBeats: 2, safe: true, resumedBy: null },
      events: [
        { beat: 3, role: "passing-fill", notes: ["G"], yieldsToMelodyAt: null },
        { beat: 4, role: "passing-fill", notes: ["B"], yieldsToMelodyAt: null },
      ],
      abc: "z2 z2 G,2 B,2",
    });
  });

  it("emits sustain pedal down and flush metadata at chord changes", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em", "Bm", "Bm", "Em"],
    });

    expect(accompaniment.pedalAutomation).toMatchObject({
      controller: { midiControlChange: 64, downValue: 127, upValue: 0 },
      events: [
        { measureIndex: 0, beat: 1, chord: "Em", type: "pedal-down", value: 127 },
        { measureIndex: 1, beat: 1, chord: "Bm", type: "pedal-flush", value: 0, previousChord: "Em" },
        { measureIndex: 1, beat: 1, chord: "Bm", type: "pedal-down", value: 127 },
        { measureIndex: 3, beat: 1, chord: "Em", type: "pedal-flush", value: 0, previousChord: "Bm" },
        { measureIndex: 3, beat: 1, chord: "Em", type: "pedal-down", value: 127 },
        { measureIndex: 3, beat: 4, chord: "Em", type: "pedal-up", value: 0 },
      ],
    });
  });

  it("exports UI-ready pedal event metadata synchronized with sustain automation", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em", "Bm", "Bm", "Em"],
    });

    expect(accompaniment.pedalEventMetadata).toEqual([
      { measureIndex: 0, beat: 1, chord: "Em", controller: "sustain", midiControlChange: 64, state: "down", value: 127, label: "Pedal Down" },
      { measureIndex: 1, beat: 1, chord: "Bm", controller: "sustain", midiControlChange: 64, state: "flush", value: 0, previousChord: "Em", label: "Pedal Flush" },
      { measureIndex: 1, beat: 1, chord: "Bm", controller: "sustain", midiControlChange: 64, state: "down", value: 127, label: "Pedal Down" },
      { measureIndex: 3, beat: 1, chord: "Em", controller: "sustain", midiControlChange: 64, state: "flush", value: 0, previousChord: "Bm", label: "Pedal Flush" },
      { measureIndex: 3, beat: 1, chord: "Em", controller: "sustain", midiControlChange: 64, state: "down", value: 127, label: "Pedal Down" },
      { measureIndex: 3, beat: 4, chord: "Em", controller: "sustain", midiControlChange: 64, state: "up", value: 0, label: "Pedal Up" },
    ]);
  });

  it("exposes physical validation and playback events synchronized with grand-staff ABC", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em"],
    });

    expect(accompaniment.physicalValidation.valid).toBe(true);
    expect(accompaniment.physicalValidation.measures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 1, hand: "left", spanSemitones: 12, rolled: false, collisionKeys: [] }),
        expect.objectContaining({ measureIndex: 0, beat: 1, hand: "right", spanSemitones: 4, rolled: false, collisionKeys: [] }),
      ])
    );
    expect(accompaniment.playbackEvents).toBe(accompaniment.physicalValidation.playbackEvents);
    expect(accompaniment.playbackEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 1, hand: "left", articulation: "block", midi: [40, 47, 52], abc: "E,,2 B,,2 E,2 B,,2" }),
        expect.objectContaining({ measureIndex: 0, beat: 1, hand: "right", articulation: "block", midi: [55, 59], abc: "[G,B,]8" }),
      ])
    );
    expect(accompaniment.abc).toContain("E,,2 B,,2 E,2 B,,2");
    expect(accompaniment.abc).toContain("[G,B,]8");
  });

  it("treats long held melody notes as fill windows after the attack", () => {
    const heldMelodyAbc = `X:1
T:Held Melody
M:4/4
L:1/8
K:Em
| E6 B2 |`;
    const accompaniment = generatePianoAccompaniment(heldMelodyAbc, {
      progression: ["Em"],
    });

    expect(accompaniment.gapFillMap[0]).toMatchObject({
      gap: { startBeat: 2, endBeat: 4, durationBeats: 2, safe: true, resumedBy: "B" },
      events: [
        { beat: 2, role: "passing-fill", notes: ["G"], yieldsToMelodyAt: 4 },
        { beat: 3, role: "passing-fill", notes: ["B"], yieldsToMelodyAt: 4 },
      ],
    });
  });

  it("exports a UI-ready piano output contract with grand-staff ABC, highlights, and fingering metadata", () => {
    const accompaniment = generatePianoAccompaniment(sampleAbc, {
      progression: ["Em"],
    });

    expect(accompaniment.grandStaffAbc).toContain("V:PianoLH clef=bass");
    expect(accompaniment.grandStaffAbc).toContain("V:PianoRH clef=treble");
    expect(accompaniment.abc).toBe(accompaniment.grandStaffAbc);
    expect(accompaniment.pianoKeyHighlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 1, hand: "left", note: "E2", midi: 40, finger: 5, role: "root" }),
        expect.objectContaining({ measureIndex: 0, beat: 1, hand: "left", note: "E3", midi: 52, finger: 1, role: "octave" }),
        expect.objectContaining({ measureIndex: 0, beat: 1, hand: "right", note: "G3", midi: 55, finger: 1, role: "third" }),
      ])
    );
    expect(accompaniment.fingeringMetadata[0]).toMatchObject({
      measureIndex: 0,
      beat: 1,
      hand: "left",
      source: "left-hand-bass",
      notes: [
        { note: "E2", midi: 40, finger: 5, role: "root" },
        { note: "B2", midi: 47, finger: 2, role: "fifth" },
        { note: "E3", midi: 52, finger: 1, role: "octave" },
      ],
    });
  });
});

