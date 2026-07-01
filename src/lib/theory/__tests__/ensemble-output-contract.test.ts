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
    });
  });
});
