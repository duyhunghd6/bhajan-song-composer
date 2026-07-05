import { describe, expect, it } from "vitest";
import { generateAccompanimentStage } from "../accompaniment-stage";
import { generateEnsembleExpansionOutput } from "../ensemble-output-contract";

const sampleAbc = `X:1
T:Ensemble Output Contract Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 G2 z4 | B4 z2 A2 |`;

describe("Ensemble expansion output contract", () => {
  it("exports the handshake, event maps, yield decisions, conflict report, ABC layers, playback/MIDI events, and visual activity metadata", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });

    const output = generateEnsembleExpansionOutput(sampleAbc, { accompaniment });

    expect(output.handshake.layerPrerequisites).toEqual({ layer1Melody: true, layer2Foundation: true });
    expect(output.eventMaps.djembe).toEqual(output.djembe.eventMap);
    expect(output.eventMaps.flute).toEqual(output.orchestral.fluteSupportMap);
    expect(output.eventMaps.violin).toEqual(output.orchestral.violinSupportMap);
    expect(output.yieldDecisions).toEqual(output.orchestral.yieldDecisions);
    expect(output.conflictReport).toEqual(output.conflicts.report);
    expect(output.layerHierarchy).toEqual([
      {
        layer: 1,
        role: "primary-melody",
        instruments: ["voice"],
        priority: 1,
        conflictPolicy: "preserve-primary-melody",
      },
      {
        layer: 2,
        role: "accompaniment-foundation",
        instruments: ["piano"],
        priority: 2,
        conflictPolicy: "preserve-rhythmic-and-harmonic-foundation",
      },
      {
        layer: 3,
        role: "ensemble-support",
        instruments: ["djembe", "flute", "violin"],
        priority: 3,
        conflictPolicy: "flatten-melodic-runs-before-removing-percussion-fills",
      },
    ]);
    expect(output.abcLayers).toMatchObject({
      layer3Djembe: expect.stringContaining("V:Djembe"),
      layer3Flute: expect.stringContaining("V:Flute"),
      layer3Violin: expect.stringContaining("V:Violin"),
    });
    expect(output.abcLayers.combined).toContain(output.abcLayers.layer3Djembe);
    expect(output.playbackEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrument: "djembe", source: "layer2-bass-transient", startMs: 0, midi: 36 }),
      expect.objectContaining({ instrument: "flute", source: "layer1-active" }),
      expect.objectContaining({ instrument: "violin", source: "layer1-active" }),
    ]));
    expect(output.playbackSyncGroups[0]).toMatchObject({
      measureIndex: 0,
      beat: 1,
      startMs: 0,
      instruments: ["djembe", "flute", "violin"],
    });
    expect(output.playbackSyncGroups[0].events).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrument: "djembe", startMs: 0 }),
      expect.objectContaining({ instrument: "flute", startMs: 0 }),
      expect.objectContaining({ instrument: "violin", startMs: 0 }),
    ]));
    expect(output.playbackSyncGroups[0].visualActivity).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrument: "djembe", startMs: 0, active: true }),
      expect.objectContaining({ instrument: "flute", startMs: 0, active: true }),
      expect.objectContaining({ instrument: "violin", startMs: 0, active: true }),
    ]));
    expect(output.midiControlEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ instrument: "violin", controller: 11, purpose: "bow-expression-swell-start" }),
      expect.objectContaining({ instrument: "violin", controller: 1, purpose: "delayed-vibrato" }),
    ]));
    expect(output.visualActivity).toEqual(expect.arrayContaining([
      expect.objectContaining({ layer: 3, instrument: "djembe", active: true, label: "Djembe bass" }),
      expect.objectContaining({ layer: 3, instrument: "flute", active: true, label: "Flute background" }),
      expect.objectContaining({ layer: 3, instrument: "violin", active: true, label: "Violin background" }),
    ]));
    expect(output.validation).toEqual({
      handshakeReady: true,
      eventMapsReady: true,
      abcLayersReady: true,
      playbackEventsReady: true,
      midiControlEventsReady: true,
      visualActivityReady: true,
      layerHierarchyReady: true,
      playbackSyncGroupsReady: true,
    });
  });

  it("uses an ensemble generation plan to reduce Djembe density and suppress Violin expression controls", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });

    const defaultOutput = generateEnsembleExpansionOutput(sampleAbc, { accompaniment });
    const sparseOutput = generateEnsembleExpansionOutput(sampleAbc, {
      accompaniment,
      plan: {
        djembe: {
          grooveProfile: "sparse",
          density: "minimal",
          bassSync: true,
          backbeatSlaps: false,
          fillPolicy: "none",
        },
        flute: {
          role: "halo",
          fillDensity: "minimal",
          preferredRegister: "C5-C6",
          breathEveryMeasures: 4,
          yieldWhenMelodyActive: true,
        },
        violin: {
          role: "harmonic-bed",
          registerStrategy: "below-melody",
          doubleStopPolicy: "single-note",
          expressionProfile: "plain",
          yieldWhenMelodyActive: true,
        },
      },
    });

    expect(sparseOutput.eventMaps.djembe.length).toBeLessThan(defaultOutput.eventMaps.djembe.length);
    expect(sparseOutput.eventMaps.djembe.every((event) => event.stroke === "bass")).toBe(true);
    expect(sparseOutput.midiControlEvents).toEqual([]);
    expect(sparseOutput.abcLayers.layer3Djembe).toContain("V:Djembe");
    expect(sparseOutput.abcLayers.layer3Flute).toContain("V:Flute");
    expect(sparseOutput.abcLayers.layer3Violin).toContain("V:Violin");
  });
});
