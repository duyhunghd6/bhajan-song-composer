import { describe, expect, it } from "vitest";
import { buildValidGuitarTabToolSchema, validateGuitarTab, type GuitarTabEvent } from "../guitar-tab-validation";

function event(overrides: Partial<GuitarTabEvent>): GuitarTabEvent {
  return {
    measureIndex: 0,
    beat: 1,
    note: "E3",
    string: 6,
    fret: 0,
    role: "bass",
    ...overrides,
  };
}

describe("guitar tab validation", () => {
  it("rejects simultaneous notes assigned to the same physical string", () => {
    const result = validateGuitarTab([
      event({ note: "E3", string: 6, fret: 0, role: "bass" }),
      event({ note: "G3", string: 6, fret: 3, role: "third" }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate-string",
          string: 6,
          message: expect.stringContaining("one guitar string cannot produce multiple pitches"),
        }),
      ])
    );
  });

  it("accepts simultaneous notes when each pitch uses a different string", () => {
    const result = validateGuitarTab([
      event({ note: "E3", string: 6, fret: 0, role: "bass" }),
      event({ note: "G3", string: 3, fret: 0, role: "third" }),
    ]);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("accepts a concrete open-position bass-anchor voicing", () => {
    const result = validateGuitarTab([
      event({ note: "E3", string: 6, fret: 0, role: "bass-root", simultaneousGroupId: "em" }),
      event({ note: "B3", string: 5, fret: 2, role: "fifth", simultaneousGroupId: "em" }),
      event({ note: "E4", string: 4, fret: 2, role: "octave-root", simultaneousGroupId: "em" }),
      event({ note: "G3", string: 3, fret: 0, role: "minor-third", simultaneousGroupId: "em" }),
    ]);

    expect(result.valid).toBe(true);
    expect(result.validatedGroups[0]).toMatchObject({ strings: [6, 5, 4, 3], noteCount: 4 });
  });

  it("rejects invalid string and fret values", () => {
    const result = validateGuitarTab([
      event({ string: 7 as 6, fret: -1 }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "invalid-string" }),
      expect.objectContaining({ code: "invalid-fret" }),
    ]));
  });

  it("rejects pitch/string/fret mismatches", () => {
    const result = validateGuitarTab([
      event({ note: "G3", string: 6, fret: 0 }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "pitch-string-mismatch", string: 6 }),
    ]));
  });

  it("rejects overfull fretting-hand spans", () => {
    const result = validateGuitarTab([
      event({ note: "F3", string: 6, fret: 1, role: "bass" }),
      event({ note: "C4", string: 5, fret: 3, role: "root" }),
      event({ note: "F4", string: 4, fret: 3, role: "fifth" }),
      event({ note: "B4", string: 3, fret: 4, role: "seventh" }),
      event({ note: "G#4", string: 2, fret: 9, role: "fill" }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "too-many-fretted-notes" }),
        expect.objectContaining({ code: "fret-span" }),
      ])
    );
  });

  it("exposes the valid_guitar_tab tool schema for LLM validation loops", () => {
    const schema = buildValidGuitarTabToolSchema();

    expect(schema.function.name).toBe("valid_guitar_tab");
    expect(schema.function.description).toContain("Call this before");
    expect(schema.function.parameters.properties.events.items.required).toEqual([
      "measureIndex",
      "beat",
      "note",
      "string",
      "fret",
      "role",
    ]);
  });
});
