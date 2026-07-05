import { describe, expect, it } from "vitest";
import { generateAccompanimentStage } from "../accompaniment-stage";
import { generateDjembeArrangement } from "../djembe-arranger";
import { generateEnsembleIntegrationHandshake } from "../ensemble-expander";

const sampleAbc = `X:1
T:Djembe Interlock Sample
M:4/4
L:1/8
Q:1/4=120
K:Em
| E2 G2 z4 | B4 z2 A2 |`;

describe("Djembe rhythmic interlock", () => {
  it("locks bass strokes to Layer 2 bass transients with velocity metadata", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });
    const handshake = generateEnsembleIntegrationHandshake(sampleAbc, { accompaniment });

    const arrangement = generateDjembeArrangement(sampleAbc, { accompaniment, handshake });

    expect(arrangement.eventMap.filter((event) => event.stroke === "bass")).toEqual([
      {
        measureIndex: 0,
        beat: 1,
        startMs: 0,
        durationMs: 125,
        stroke: "bass",
        velocity: 96,
        source: "layer2-bass-transient",
      },
      {
        measureIndex: 1,
        beat: 1,
        startMs: 2000,
        durationMs: 125,
        stroke: "bass",
        velocity: 96,
        source: "layer2-bass-transient",
      },
    ]);
    expect(arrangement.validation.bassStrokesFollowLayer2Bass).toBe(true);
    expect(arrangement.validation.velocityMetadataAssigned).toBe(true);
    expect(arrangement.abc).toContain('V:Djembe clef=perc name="Layer 3 Djembe Interlock"\n%%MIDI channel 10');
    expect(arrangement.abc).toContain("| E _E D _E z _E D z | E _E D _E z _E D z |");
  });

  it("weaves mid-tones into unused subdivisions and suppresses duplicate backbeat transients", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm"],
      compingPattern: "arpeggio",
    });
    const handshake = generateEnsembleIntegrationHandshake(sampleAbc, { accompaniment });

    const arrangement = generateDjembeArrangement(sampleAbc, { accompaniment, handshake });

    expect(arrangement.eventMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 1.5, startMs: 250, stroke: "mid-tone", velocity: 58, source: "unused-subdivision" }),
        expect.objectContaining({ measureIndex: 0, beat: 2, startMs: 500, stroke: "slap", velocity: 88, source: "backbeat" }),
        expect.objectContaining({ measureIndex: 0, beat: 4, startMs: 1500, stroke: "slap", velocity: 88, source: "backbeat" }),
      ])
    );
    const transientKeys = arrangement.eventMap.map((event) => `${event.measureIndex}:${event.startMs}`);
    expect(new Set(transientKeys).size).toBe(transientKeys.length);

    const conflictArrangement = generateDjembeArrangement(sampleAbc, {
      accompaniment,
      handshake: {
        ...handshake,
        bassMap: [{ measureIndex: 0, beat: 2, startMs: 500, note: "E", sourceLayer: 2 }],
      },
    });

    expect(conflictArrangement.eventMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 2, startMs: 500, stroke: "bass" }),
      ])
    );
    expect(conflictArrangement.eventMap).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ measureIndex: 0, beat: 2, startMs: 500, stroke: "slap" }),
      ])
    );
    expect(conflictArrangement.transientConflictReport).toEqual([
      {
        measureIndex: 0,
        beat: 2,
        startMs: 500,
        skippedStroke: "slap",
        reason: "Skipped slap because a bass stroke already owns this transient",
      },
    ]);
    expect(conflictArrangement.validation.transientConflictsAvoided).toBe(true);
  });
});
