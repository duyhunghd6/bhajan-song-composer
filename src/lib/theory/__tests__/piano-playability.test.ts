import { describe, expect, it } from "vitest";
import { validatePianoPlayability } from "../piano-playability";

describe("Piano physical validation", () => {
  it("converts hand spans wider than a major 10th into rolled playback events", () => {
    const report = validatePianoPlayability([
      {
        measureIndex: 0,
        beat: 1,
        hand: "right",
        notes: [
          { note: "C", midi: 48, abc: "C," },
          { note: "E", midi: 64, abc: "E" },
          { note: "G", midi: 67, abc: "G" },
        ],
        abc: "[C,EG]4",
      },
    ]);

    expect(report.valid).toBe(true);
    expect(report.measures[0]).toMatchObject({
      measureIndex: 0,
      beat: 1,
      hand: "right",
      spanSemitones: 19,
      maxSpanSemitones: 16,
      rolled: true,
      collisionKeys: [],
      resolution: "rolled-articulation",
    });
    expect(report.playbackEvents).toEqual([
      expect.objectContaining({
        measureIndex: 0,
        beat: 1,
        hand: "right",
        articulation: "rolled",
        midi: [48, 64, 67],
        abc: "C, E G",
      }),
    ]);
  });

  it("reports left/right hand collisions and shifts the left hand out of the way", () => {
    const report = validatePianoPlayability([
      {
        measureIndex: 0,
        beat: 1,
        hand: "left",
        notes: [
          { note: "C", midi: 48, abc: "C," },
          { note: "G", midi: 55, abc: "G," },
        ],
        abc: "[C,G,]2",
      },
      {
        measureIndex: 0,
        beat: 1,
        hand: "right",
        notes: [
          { note: "C", midi: 48, abc: "C," },
          { note: "E", midi: 52, abc: "E," },
        ],
        abc: "[C,E,]4",
      },
    ]);

    expect(report.measures[0]).toMatchObject({
      hand: "left",
      collisionKeys: ["C"],
      resolution: "left-hand-shift-down-octave",
    });
    expect(report.playbackEvents[0]).toMatchObject({
      hand: "left",
      midi: [36, 43],
      abc: "[C,,G,,]2",
    });
    expect(report.playbackEvents[1]).toMatchObject({
      hand: "right",
      midi: [48, 52],
      abc: "[C,E,]4",
    });
  });

  it("thins left-hand textures when shifting an overlap would leave the piano range", () => {
    const report = validatePianoPlayability([
      {
        measureIndex: 0,
        beat: 1,
        hand: "left",
        notes: [
          { note: "C", midi: 36, abc: "C,," },
          { note: "G", midi: 43, abc: "G,," },
          { note: "C", midi: 48, abc: "C," },
        ],
        abc: "[C,,G,,C,]2",
      },
      {
        measureIndex: 0,
        beat: 1,
        hand: "right",
        notes: [
          { note: "E", midi: 40, abc: "E,," },
          { note: "G", midi: 43, abc: "G,," },
        ],
        abc: "[E,,G,,]4",
      },
    ]);

    expect(report.measures[0]).toMatchObject({
      hand: "left",
      collisionKeys: ["G"],
      resolution: "left-hand-thinned",
    });
    expect(report.playbackEvents[0]).toMatchObject({
      hand: "left",
      midi: [36],
      abc: "C,,2",
    });
  });
});
