import { describe, expect, it } from "vitest";
import { generateAccompanimentStage } from "../accompaniment-stage";
import { generateDjembeArrangement } from "../djembe-arranger";
import { generateEnsembleIntegrationHandshake } from "../ensemble-expander";
import { generateOrchestralSupport } from "../orchestral-arranger";
import { resolveEnsembleConflicts } from "../ensemble-conflicts";

const sampleAbc = `X:1
T:Conflict Resolution Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 G2 z4 | B4 z2 A2 |`;

describe("Ensemble conflict resolution", () => {
  it("preserves Layer 1 melody by flattening Flute and Violin runs before removing percussion", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });
    const handshake = generateEnsembleIntegrationHandshake(sampleAbc, { accompaniment });
    const djembe = generateDjembeArrangement(sampleAbc, { accompaniment, handshake });
    const orchestral = generateOrchestralSupport(sampleAbc, { accompaniment, handshake });
    const fluteRun = {
      ...orchestral.fluteSupportMap[0],
      mode: "fill" as const,
      source: "melodic-gap" as const,
      note: "G5",
      midiNote: 79,
      velocity: 80,
    };
    const violinRun = {
      ...orchestral.violinSupportMap[0],
      mode: "fill" as const,
      source: "melodic-gap" as const,
      note: "B4",
      midiNote: 71,
      velocity: 80,
    };

    const resolved = resolveEnsembleConflicts({
      handshake,
      djembe,
      orchestral: {
        ...orchestral,
        fluteSupportMap: [fluteRun],
        violinSupportMap: [violinRun],
      },
    });

    expect(resolved.report).toEqual([
      {
        measureIndex: 0,
        beat: 1,
        startMs: 0,
        layer1Preserved: true,
        actions: [
          "flattened-flute-run",
          "flattened-violin-run",
        ],
        overloadResolved: true,
      },
    ]);
    expect(resolved.orchestral.fluteSupportMap[0]).toMatchObject({
      mode: "background",
      source: "layer1-active",
      note: "G5",
      velocity: 64,
    });
    expect(resolved.orchestral.violinSupportMap[0]).toMatchObject({
      mode: "background",
      source: "layer1-active",
      note: "B4",
      velocity: 64,
    });
    expect(resolved.djembe.eventMap).toEqual(djembe.eventMap);
  });

  it("updates yield decisions when conflict resolution flattens melodic fills", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });
    const handshake = generateEnsembleIntegrationHandshake(sampleAbc, { accompaniment });
    const djembe = generateDjembeArrangement(sampleAbc, { accompaniment, handshake });
    const orchestral = generateOrchestralSupport(sampleAbc, { accompaniment, handshake });
    const fluteRun = {
      ...orchestral.fluteSupportMap[0],
      mode: "fill" as const,
      source: "melodic-gap" as const,
    };
    const violinRun = {
      ...orchestral.violinSupportMap[0],
      mode: "fill" as const,
      source: "melodic-gap" as const,
    };

    const resolved = resolveEnsembleConflicts({
      handshake,
      djembe,
      orchestral: {
        ...orchestral,
        fluteSupportMap: [fluteRun],
        violinSupportMap: [violinRun],
        yieldDecisions: [{
          measureIndex: 0,
          beat: 1,
          startMs: 0,
          layer1Active: true,
          fluteMode: "fill",
          violinMode: "fill",
          reason: "Melodic Fill Zone available; auxiliary instruments may answer the singer with short counter-melodies",
        }],
      },
    });

    expect(resolved.orchestral.yieldDecisions).toEqual([
      {
        measureIndex: 0,
        beat: 1,
        startMs: 0,
        layer1Active: true,
        fluteMode: "background",
        violinMode: "background",
        reason: "Density overload during Layer 1 melody; Flute and Violin yields were flattened to sustained background tones",
      },
    ]);
  });

  it("removes Djembe fills only when overload remains after melodic runs are flattened", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });
    const handshake = generateEnsembleIntegrationHandshake(sampleAbc, { accompaniment });
    const djembe = generateDjembeArrangement(sampleAbc, { accompaniment, handshake });
    const busyHandshake = {
      ...handshake,
      rhythmicDensityGrid: handshake.rhythmicDensityGrid.map((slice) =>
        slice.measureIndex === 0 && slice.beat === 1
          ? { ...slice, activeLayerCount: 4, density: "busy" as const }
          : slice
      ),
    };
    const baseStroke = djembe.eventMap.find((event) =>
      event.measureIndex === 0 && event.beat === 1 && event.stroke === "bass"
    )!;
    const fillStroke = {
      ...baseStroke,
      stroke: "slap" as const,
      velocity: 88,
      source: "backbeat" as const,
    };

    const resolved = resolveEnsembleConflicts({
      handshake: busyHandshake,
      djembe: {
        ...djembe,
        eventMap: [baseStroke, fillStroke],
      },
      orchestral: {
        fluteSupportMap: [],
        violinSupportMap: [],
        fluteBreathMap: [],
        violinExpressionMap: [],
        yieldDecisions: [],
      },
    });

    expect(resolved.report).toEqual([
      {
        measureIndex: 0,
        beat: 1,
        startMs: 0,
        layer1Preserved: true,
        actions: ["removed-djembe-fill"],
        overloadResolved: true,
      },
    ]);
    expect(resolved.djembe.eventMap).toEqual([baseStroke]);
  });
});
