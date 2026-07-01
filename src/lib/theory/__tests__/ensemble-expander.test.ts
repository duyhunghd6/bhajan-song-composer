import { describe, expect, it } from "vitest";
import { generateAccompanimentStage } from "../accompaniment-stage";
import { generateEnsembleIntegrationHandshake } from "../ensemble-expander";

const sampleAbc = `X:1
T:Ensemble Handshake Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 G2 z4 | B4 z2 A2 |`;

describe("Ensemble integration handshake", () => {
  it("requires established Layer 1 melody and Layer 2 accompaniment before deriving ensemble maps", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });

    const handshake = generateEnsembleIntegrationHandshake(sampleAbc, { accompaniment });

    expect(handshake.layerPrerequisites).toEqual({ layer1Melody: true, layer2Foundation: true });
    expect(handshake.rhythmicDensityGrid).toEqual([
      { measureIndex: 0, beat: 1, startMs: 0, durationMs: 500, layer1Active: true, layer2Active: true, activeLayerCount: 2, density: "supporting" },
      { measureIndex: 0, beat: 2, startMs: 500, durationMs: 500, layer1Active: true, layer2Active: true, activeLayerCount: 2, density: "supporting" },
      { measureIndex: 0, beat: 3, startMs: 1000, durationMs: 500, layer1Active: false, layer2Active: true, activeLayerCount: 1, density: "open" },
      { measureIndex: 0, beat: 4, startMs: 1500, durationMs: 500, layer1Active: false, layer2Active: true, activeLayerCount: 1, density: "open" },
      { measureIndex: 1, beat: 1, startMs: 2000, durationMs: 500, layer1Active: true, layer2Active: true, activeLayerCount: 2, density: "supporting" },
      { measureIndex: 1, beat: 2, startMs: 2500, durationMs: 500, layer1Active: true, layer2Active: true, activeLayerCount: 2, density: "supporting" },
      { measureIndex: 1, beat: 3, startMs: 3000, durationMs: 500, layer1Active: false, layer2Active: true, activeLayerCount: 1, density: "open" },
      { measureIndex: 1, beat: 4, startMs: 3500, durationMs: 500, layer1Active: true, layer2Active: true, activeLayerCount: 2, density: "supporting" },
    ]);
    expect(handshake.bassMap).toEqual([
      { measureIndex: 0, beat: 1, startMs: 0, note: "E", sourceLayer: 2 },
      { measureIndex: 1, beat: 1, startMs: 2000, note: "D", sourceLayer: 2 },
    ]);
    expect(handshake.melodicGapArray).toEqual([
      { measureIndex: 0, beat: 3, startMs: 1000, durationBeats: 2, durationMs: 1000, type: "rest" },
      { measureIndex: 1, beat: 1, startMs: 2000, durationBeats: 2, durationMs: 1000, type: "sustain" },
    ]);
  });

  it("rejects ensemble expansion when the Layer 1 melody has not been established", () => {
    const restOnlyAbc = sampleAbc.replace("| E2 G2 z4 | B4 z2 A2 |", "| z8 | z8 |");
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });

    expect(() => generateEnsembleIntegrationHandshake(restOnlyAbc, { accompaniment })).toThrow(
      "Ensemble integration handshake requires Layer 1 melody and Layer 2 accompaniment foundation"
    );
  });
});
