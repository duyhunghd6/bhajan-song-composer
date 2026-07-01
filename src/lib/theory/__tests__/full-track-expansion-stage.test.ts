import { describe, expect, it } from "vitest";
import { generateAccompanimentStage } from "../accompaniment-stage";
import { generateFullTrackExpansionStage } from "../full-track-expansion-stage";

const sampleAbc = `X:1
T:Full Track Sample
M:4/4
L:1/8
Q:1/4=96
K:Em
| E2 G2 z2 B2 | B4 z2 A2 | G2 A2 B2 G2 | E8 |`;

describe("Full-track expansion stage", () => {
  it("generates layer-3 drum guidance that locks kick hits to the layer-2 bass map", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm", "G", "Em"],
      compingPattern: "arpeggio",
    });

    const stage = generateFullTrackExpansionStage(sampleAbc, { accompaniment });

    expect(stage.layer).toEqual({
      number: 3,
      name: "Drums & Additional Instruments",
      instrument: "full-track-expansion",
    });
    expect(stage.measures).toHaveLength(4);
    expect(stage.measures[0]).toMatchObject({
      measureIndex: 0,
      chord: "Em",
      bassMap: [{ beat: 1, note: "E" }],
      drums: {
        kickBeats: [1, 3],
        snareBeats: [2, 4],
        bassKickAlignment: [{ beat: 1, bassNote: "E", kick: true }],
      },
    });
    expect(stage.validation.bassKickAligned).toBe(true);
    expect(stage.abc).toContain("V:Drums perc name=\"Layer 3 Drum Guidance\"");
  });

  it("documents complementary frequency ranges for the full-track instrument families", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "rhythm-guitar",
      progression: ["Em", "Bm", "G", "Em"],
      compingPattern: "syncopation",
    });

    const stage = generateFullTrackExpansionStage(sampleAbc, { accompaniment });

    expect(stage.frequencyPlan).toEqual([
      { family: "bass", range: "low", role: "Layer 2 bass anchors and kick drum fundamentals" },
      { family: "accompaniment", range: "mid", role: "Rhythm guitar chord body" },
      { family: "melody", range: "high-mid", role: "Primary vocal or lead melody" },
      { family: "counter-melody", range: "upper-mid", role: "Secondary fills during melodic gaps" },
      { family: "cymbals", range: "high", role: "Hi-hat and cymbal timekeeping above the melody" },
    ]);
    expect(stage.validation.frequencyRangesAssigned).toBe(true);
  });

  it("places counter-melodies and fills only in melody rests or sustained-note gaps", () => {
    const accompaniment = generateAccompanimentStage(sampleAbc, {
      instrument: "piano",
      progression: ["Em", "Bm", "G", "Em"],
      compingPattern: "arpeggio",
    });

    const stage = generateFullTrackExpansionStage(sampleAbc, { accompaniment });

    expect(stage.measures[0]).toMatchObject({
      melodicGaps: [{ beat: 3, type: "rest", duration: 1 }],
      counterMelodies: [
        {
          beat: 3,
          instrument: "strings",
          role: "rest-fill",
          notes: ["G", "B"],
          source: "melody-rest",
        },
      ],
    });
    expect(stage.measures[1].counterMelodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ beat: 2, role: "sustain-fill", source: "melody-sustain" }),
        expect.objectContaining({ beat: 3, role: "rest-fill", source: "melody-rest" }),
      ])
    );
    expect(stage.validation.counterMelodiesUseGaps).toBe(true);
  });
});
