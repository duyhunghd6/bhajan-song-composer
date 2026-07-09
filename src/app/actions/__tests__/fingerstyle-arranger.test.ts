import { describe, expect, it } from "vitest";
import { validateFingerstylePhysics } from "@/lib/theory/fingerstyle-arranger/physics-validation";
import type { TimeSliceGridStep } from "@/lib/theory/fingerstyle-arranger/time-slice";

describe("validateFingerstylePhysics", () => {
  const baseStep: Omit<TimeSliceGridStep, "tablature"> = {
    step: 1,
    chord: "Em",
    weight: "⬤",
    melody: { pitch: "E4", state: "attack" },
    lyric: "Ha-",
  };

  it("accepts a standard 4-string pinch", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 5, fret: 2, finger: "i", role: "fifth" },
          { string: 3, fret: 0, finger: "m", role: "fill" },
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(true);
  });

  it("accepts a 5-string strum with multiple thumb 'p' fingers", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 5, fret: 2, finger: "p", role: "fifth" },
          { string: 4, fret: 2, finger: "p", role: "fill" },
          { string: 3, fret: 0, finger: "p", role: "fill" },
          { string: 1, fret: 0, finger: "a", role: "melody" }, // melody played with 'a', others strummed with 'p'
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(true);
  });

  it("rejects a 5-string pinch using separate non-strum fingers", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 5, fret: 2, finger: "i", role: "fifth" },
          { string: 4, fret: 2, finger: "m", role: "fill" },
          { string: 3, fret: 0, finger: "a", role: "fill" },
          { string: 1, fret: 0, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Exceeds picking finger budget");
  });

  it("rejects more than 6 strings", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        tablature: [
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 5, fret: 2, finger: "p", role: "fifth" },
          { string: 4, fret: 2, finger: "p", role: "fill" },
          { string: 3, fret: 0, finger: "p", role: "fill" },
          { string: 2, fret: 0, finger: "p", role: "fill" },
          { string: 1, fret: 0, finger: "p", role: "melody" },
          { string: 1, fret: 3, finger: "p", role: "melody" }, // duplicate / extra
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Exceeds physical guitar limit of 6 strings");
  });

  it("rejects physically impossible diagonal stretch (String 6 Fret 3 and String 1 Fret 7)", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        melody: { pitch: "B4", state: "attack" }, // String 1 fret 7 is B4
        tablature: [
          { string: 6, fret: 3, finger: "p", role: "root" },
          { string: 1, fret: 7, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(false);
    expect(result.message).toContain("Physically impossible diagonal stretch");
  });

  it("accepts a playable diagonal stretch (String 6 Fret 3 and String 1 Fret 3)", () => {
    const grid: TimeSliceGridStep[] = [
      {
        ...baseStep,
        melody: { pitch: "G4", state: "attack" }, // String 1 fret 3 is G4
        tablature: [
          { string: 6, fret: 3, finger: "p", role: "root" },
          { string: 1, fret: 3, finger: "a", role: "melody" },
        ],
      },
    ];

    const result = validateFingerstylePhysics(grid);
    expect(result.valid).toBe(true);
  });
});
