import { describe, expect, it } from "vitest";
import { generateAccompanimentStage } from "../accompaniment-stage";
import { generateEnsembleIntegrationHandshake } from "../ensemble-expander";
import { generateOrchestralSupport, validateViolinDoubleStop } from "../orchestral-arranger";

const sampleAbc = `X:1
T:Orchestral Support Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 G2 z4 | B4 z2 A2 |`;

describe("Orchestral melodic support", () => {
  it("keeps Flute and Violin in quiet background holds while the melody is active", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });
    const handshake = generateEnsembleIntegrationHandshake(sampleAbc, { accompaniment });

    const support = generateOrchestralSupport(sampleAbc, { accompaniment, handshake });

    const firstDecision = support.yieldDecisions.find((decision) => decision.measureIndex === 0 && decision.beat === 1);
    expect(firstDecision).toMatchObject({
      layer1Active: true,
      fluteMode: "background",
      violinMode: "background",
      reason: "Layer 1 melody active; auxiliary melodic instruments yield into sustained chord tones",
    });

    const fluteBackground = support.fluteSupportMap.find((event) => event.measureIndex === 0 && event.beat === 1);
    expect(fluteBackground).toMatchObject({
      instrument: "flute",
      role: "flute-halo",
      mode: "background",
      source: "layer1-active",
      velocity: 64,
    });
    expect(fluteBackground?.midiNote).toBeGreaterThanOrEqual(72);
    expect(fluteBackground?.midiNote).toBeLessThanOrEqual(84);

    const violinBackground = support.violinSupportMap.find((event) => event.measureIndex === 0 && event.beat === 1);
    expect(violinBackground).toMatchObject({
      instrument: "violin",
      role: "violin-bed",
      mode: "background",
      source: "layer1-active",
      velocity: 64,
    });
    expect(violinBackground?.midiNote).toBeGreaterThanOrEqual(55);
    expect(violinBackground?.midiNote).toBeLessThanOrEqual(76);
  });

  it("adds Flute breath rests with a pre-breath velocity dip", () => {
    const longMelodyAbc = `X:1
T:Flute Breath Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 G2 B2 A2 | G2 F2 E2 D2 | E2 G2 z4 | B4 z2 A2 |`;
    const accompaniment = generateAccompanimentStage(longMelodyAbc, {
      instrument: "piano",
      progression: ["Em", "G", "Em", "Bm"],
      compingPattern: "arpeggio",
    });
    const handshake = generateEnsembleIntegrationHandshake(longMelodyAbc, { accompaniment });

    const support = generateOrchestralSupport(longMelodyAbc, { accompaniment, handshake });

    expect(support.fluteBreathMap).toContainEqual(expect.objectContaining({
      instrument: "flute",
      measureIndex: 1,
      beat: 4.75,
      durationMs: 125,
      reason: "Periodic 16th-note breath after two measures of continuous Flute support",
    }));
    const dippedEvent = support.fluteSupportMap.find((event) => event.measureIndex === 1 && event.beat === 4);
    expect(dippedEvent).toMatchObject({ velocity: 52, preBreathVelocityDip: true });
  });

  it("adds Violin CC11 swells and delayed vibrato to sustained support", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });
    const handshake = generateEnsembleIntegrationHandshake(sampleAbc, { accompaniment });

    const support = generateOrchestralSupport(sampleAbc, { accompaniment, handshake });

    const firstViolinControls = support.violinExpressionMap.filter((event) =>
      event.measureIndex === 0 && event.beat === 1
    );
    expect(firstViolinControls).toEqual([
      expect.objectContaining({ controller: 11, value: 54, startMs: 0, purpose: "bow-expression-swell-start" }),
      expect.objectContaining({ controller: 11, value: 76, startMs: 250, purpose: "bow-expression-swell-crest" }),
      expect.objectContaining({ controller: 1, value: 42, startMs: 300, purpose: "delayed-vibrato" }),
    ]);
  });

  it("validates Violin double-stops and drops the lower note when the span is unplayable", () => {
    expect(validateViolinDoubleStop([60, 67])).toEqual({
      playable: true,
      acceptedNotes: [60, 67],
      droppedNotes: [],
      reason: "Playable two-note Violin double-stop span",
    });

    expect(validateViolinDoubleStop([55, 67])).toEqual({
      playable: false,
      acceptedNotes: [67],
      droppedNotes: [{ midiNote: 55, reason: "Dropped lower note because 12 semitones exceeds playable Violin double-stop span" }],
      reason: "Unplayable Violin double-stop span reduced to upper note",
    });

    expect(validateViolinDoubleStop([55, 59, 64])).toEqual({
      playable: false,
      acceptedNotes: [59, 64],
      droppedNotes: [{ midiNote: 55, reason: "Dropped lower note because Violin double-stops cannot exceed two simultaneous notes" }],
      reason: "Reduced Violin voicing to two-note double-stop",
    });
  });

  it("plays short counter-melody fills only inside melodic Fill Zones", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });
    const handshake = generateEnsembleIntegrationHandshake(sampleAbc, { accompaniment });

    const support = generateOrchestralSupport(sampleAbc, { accompaniment, handshake });

    const fluteFills = support.fluteSupportMap.filter((event) => event.mode === "fill");
    const violinFills = support.violinSupportMap.filter((event) => event.mode === "fill");
    expect(fluteFills).toEqual([
      expect.objectContaining({ instrument: "flute", source: "melodic-gap", measureIndex: 0, beat: 3 }),
      expect.objectContaining({ instrument: "flute", source: "melodic-gap", measureIndex: 1, beat: 1 }),
    ]);
    expect(violinFills).toEqual([
      expect.objectContaining({ instrument: "violin", source: "melodic-gap", measureIndex: 0, beat: 3 }),
      expect.objectContaining({ instrument: "violin", source: "melodic-gap", measureIndex: 1, beat: 1 }),
    ]);

    expect(support.fluteSupportMap.filter((event) => event.mode === "fill" && event.beat === 4)).toEqual([]);
    expect(support.violinSupportMap.filter((event) => event.mode === "fill" && event.measureIndex === 1 && event.beat === 4)).toEqual([]);
    expect(support.yieldDecisions).toContainEqual(expect.objectContaining({
      measureIndex: 0,
      beat: 3,
      layer1Active: false,
      fluteMode: "fill",
      violinMode: "fill",
      reason: "Melodic Fill Zone available; auxiliary instruments may answer the singer with short counter-melodies",
    }));
  });
});
