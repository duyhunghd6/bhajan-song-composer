import { describe, expect, it } from "vitest";
import { midiForStringFret } from "../../guitar-playability";
import { placeFingerstyleFoundationOnTimeGrid } from "../heuristic-time-slice";
import type { TimeSliceMeasure } from "../time-slice";

function makeMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: {
      key: "Em",
      comping_style: "PIMA",
      voicing_plan: "Open Em",
      fill_density: "few",
    },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: index === 0 ? "⬤" as const : null,
      melody: {
        pitch: index === 0 ? "E4" : null,
        state: index === 0 ? "attack" as const : "rest" as const,
      },
      lyric: null,
      tablature: index === 0
        ? [
            { string: 6 as const, fret: 0, finger: "p" as const, role: "root" as const },
            { string: 2 as const, fret: 5, finger: "m" as const, role: "melody" as const },
          ]
        : undefined,
    })),
  };
}

describe("TimeGrid foundation placement", () => {
  it("prefers an available open string over the submitted fretted position", () => {
    const result = placeFingerstyleFoundationOnTimeGrid([makeMeasure()], { skillLevel: "beginner" });
    const melody = result.measures[0].grid[0].tablature?.find(tab => tab.role === "melody");

    expect(melody).toMatchObject({ string: 1, fret: 0 });
    expect(midiForStringFret(melody!.string, melody!.fret)).toBe(64);
    expect(result.measures[0].grid[0].tablature).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: "root", string: 6, fret: 0 }),
    ]));
  });

  it("prefers the lowest fret when no open candidate is available", () => {
    const input = makeMeasure();
    input.grid[0].melody.pitch = "F#4";
    input.grid[0].tablature = [
      { string: 6 as const, fret: 0, finger: "p" as const, role: "root" as const },
      { string: 2 as const, fret: 7, finger: "m" as const, role: "melody" as const },
    ];

    const result = placeFingerstyleFoundationOnTimeGrid([input], {
      skillLevel: "beginner",
      maxMelodyFret: 12,
    });
    const melody = result.measures[0].grid[0].tablature?.find(tab => tab.role === "melody");

    expect(melody).toMatchObject({ string: 1, fret: 2 });
    expect(midiForStringFret(melody!.string, melody!.fret)).toBe(66);
  });

  it("does not use an occupied open string for the melody", () => {
    const input = makeMeasure();
    input.grid[0].tablature = [
      { string: 1 as const, fret: 0, finger: "i" as const, role: "harmony" as const },
      { string: 2 as const, fret: 5, finger: "m" as const, role: "melody" as const },
      { string: 6 as const, fret: 0, finger: "p" as const, role: "root" as const },
    ];

    const result = placeFingerstyleFoundationOnTimeGrid([input]);
    const melody = result.measures[0].grid[0].tablature?.find(tab => tab.role === "melody");

    expect(melody).toMatchObject({ string: 2, fret: 5 });
    expect(result.unresolvedEventCount).toBe(0);
  });

  it("is deterministic and does not mutate source measures", () => {
    const input = makeMeasure();
    const first = placeFingerstyleFoundationOnTimeGrid([input]);
    const second = placeFingerstyleFoundationOnTimeGrid([input]);

    expect(first.measures).toEqual(second.measures);
    expect(input.grid[0].tablature?.find(tab => tab.role === "melody")).toMatchObject({ string: 2, fret: 5 });
  });

  it("reports the deterministic TimeGrid placement outcome", () => {
    const result = placeFingerstyleFoundationOnTimeGrid([makeMeasure()]);

    expect(result.logs.join("\n")).toContain("TIMEGRID");
    expect(result.diagnostics.outcome).toBe("accepted");
    expect(result.diagnostics.unresolvedEventCount).toBe(0);
  });
});
