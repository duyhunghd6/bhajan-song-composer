import { describe, expect, it } from "vitest";
import { normalizeGuitarTabEvents } from "../accompaniment-workflow/tool-schema";
import {
  buildValidGuitarTabToolSchema,
  validateGuitarFretboardRange,
  validateGuitarTab,
  validateLeftHandReach,
  validateOneGuitarStringAssignments,
  type GuitarTabEvent,
} from "../guitar-tab-validation";

function event(overrides: Partial<GuitarTabEvent>): GuitarTabEvent {
  return {
    measureIndex: 0,
    beat: 1,
    note: "E2",
    string: 6,
    fret: 0,
    role: "bass",
    ...overrides,
  };
}

describe("guitar tab validation", () => {
  it("expands compact LLM tab events while preserving open-string fret zero and legacy events", () => {
    const [compact, legacy] = normalizeGuitarTabEvents([
      { m: 0, b: 1, sid: "m0-b1-bass", n: "E2", s: 6, f: 0, r: "bass" },
      { measureIndex: 0, beat: 2, sourceEventId: "m0-b2", note: "B2", string: 5, fret: 2, role: "fifth" },
    ]);

    expect(compact).toMatchObject({ measureIndex: 0, beat: 1, sourceEventId: "m0-b1-bass", note: "E2", string: 6, fret: 0, role: "bass" });
    expect(legacy).toMatchObject({ measureIndex: 0, beat: 2, sourceEventId: "m0-b2", note: "B2", string: 5, fret: 2, role: "fifth" });
    expect(validateGuitarTab([compact, legacy] as unknown as GuitarTabEvent[]).valid).toBe(true);
  });

  it("rejects simultaneous notes assigned to the same physical string", () => {
    const result = validateGuitarTab([
      event({ note: "E2", string: 6, fret: 0, role: "bass" }),
      event({ note: "G2", string: 6, fret: 3, role: "third" }),
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
      event({ note: "E2", string: 6, fret: 0, role: "bass" }),
      event({ note: "G3", string: 3, fret: 0, role: "third" }),
    ]);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects the same source note event assigned to multiple strings", () => {
    const result = validateOneGuitarStringAssignments([
      event({ note: "B3", string: 2, fret: 0, role: "melody", sourceEventId: "m1-b1-melody" }),
      event({ note: "B3", string: 3, fret: 4, role: "melody", sourceEventId: "m1-b1-melody" }),
    ]);

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "duplicate-source-note" }),
    ]));
  });

  it("accepts a concrete open-position bass-anchor voicing", () => {
    const result = validateGuitarTab([
      event({ note: "E2", string: 6, fret: 0, role: "bass-root", simultaneousGroupId: "em" }),
      event({ note: "B2", string: 5, fret: 2, role: "fifth", simultaneousGroupId: "em" }),
      event({ note: "E3", string: 4, fret: 2, role: "octave-root", simultaneousGroupId: "em" }),
      event({ note: "G3", string: 3, fret: 0, role: "minor-third", simultaneousGroupId: "em" }),
    ]);

    expect(result.valid).toBe(true);
    expect(result.validatedGroups[0]).toMatchObject({
      strings: [6, 5, 4, 3],
      noteCount: 4,
      leftHandPlayable: true,
      profileId: "standard-six-string",
    });
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
      event({ note: "G2", string: 6, fret: 0 }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "pitch-string-mismatch", string: 6 }),
      expect.objectContaining({ code: "pitch-register-mismatch", string: 6 }),
    ]));
  });

  it("rejects frets outside the selected guitar profile range", () => {
    const result = validateGuitarFretboardRange([
      event({ note: "C6", string: 1, fret: 20 }),
    ], { guitarProfile: "guitar-classic", requireScientificPitch: true });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "fret-out-of-range" }),
    ]));
  });

  it("requires octave-bearing notes when strict range validation is requested", () => {
    const result = validateGuitarFretboardRange([
      event({ note: "E", string: 6, fret: 0 }),
    ], { requireScientificPitch: true });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "missing-octave" }),
    ]));
  });

  it("rejects octave/register mismatches even when pitch class is correct", () => {
    const result = validateGuitarFretboardRange([
      event({ note: "E3", string: 6, fret: 0 }),
    ], { requireScientificPitch: true });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "pitch-register-mismatch" }),
    ]));
  });

  it("accepts a playable one-left-hand barre shape", () => {
    const result = validateLeftHandReach([
      event({ note: "F2", string: 6, fret: 1, role: "root", simultaneousGroupId: "f" }),
      event({ note: "C3", string: 5, fret: 3, role: "fifth", simultaneousGroupId: "f" }),
      event({ note: "F3", string: 4, fret: 3, role: "root", simultaneousGroupId: "f" }),
      event({ note: "A3", string: 3, fret: 2, role: "third", simultaneousGroupId: "f" }),
      event({ note: "C4", string: 2, fret: 1, role: "fifth", simultaneousGroupId: "f" }),
      event({ note: "F4", string: 1, fret: 1, role: "root", simultaneousGroupId: "f" }),
    ], { voicingProfile: "barre" });

    expect(result).toEqual([]);
  });

  it("rejects overfull fretting-hand spans", () => {
    const result = validateGuitarTab([
      event({ note: "F2", string: 6, fret: 1, role: "bass" }),
      event({ note: "B2", string: 5, fret: 2, role: "root" }),
      event({ note: "F3", string: 4, fret: 3, role: "fifth" }),
      event({ note: "B3", string: 3, fret: 4, role: "seventh" }),
      event({ note: "G#4", string: 2, fret: 9, role: "fill" }),
    ]);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "left-hand-unfingerable" }),
        expect.objectContaining({ code: "fret-span" }),
      ])
    );
  });

  it("exposes the valid_guitar_tab tool schema for one-guitar validation loops", () => {
    const schema = buildValidGuitarTabToolSchema();

    expect(schema.function.name).toBe("valid_guitar_tab");
    expect(schema.function.description).toContain("one physical guitar");
    expect(schema.function.parameters.properties).toHaveProperty("profileId");
    expect(schema.function.parameters.properties).toHaveProperty("voicingProfileId");
    expect(schema.function.parameters.properties.events.items.properties).toHaveProperty("sid");
    expect(schema.function.parameters.properties.events.items.required).toEqual([
      "m",
      "b",
      "sid",
      "n",
      "s",
      "f",
      "r",
    ]);
  });
});
