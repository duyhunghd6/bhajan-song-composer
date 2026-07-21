import { describe, expect, it } from "vitest";

import { realizeGuitarClassicAccompaniment } from "../guitar-classic-realization";
import { validateGuitarTab } from "../../guitar-tab-validation";

const sourceAbc = `X:1
T:Guitar Classic Realization
M:4/4
L:1/8
K:Em
[V:Melody] "Em" E2 F2 G2 A2 | "Am" B2 A2 G2 A2 |`;

const sparseAnchors = [
  { measureIndex: 1, step: 1, durationSteps: 8, beat: 1, note: "E2", string: 6 as const, fret: 0, role: "root" },
  { measureIndex: 1, step: 9, durationSteps: 8, beat: 3, note: "B2", string: 5 as const, fret: 2, role: "fifth" },
  { measureIndex: 2, step: 1, durationSteps: 8, beat: 1, note: "A2", string: 5 as const, fret: 0, role: "root" },
];

describe("realizeGuitarClassicAccompaniment", () => {
  it("turns sparse root/fifth anchors into a deterministic PIMA chord texture", () => {
    const first = realizeGuitarClassicAccompaniment({
      sourceAbc,
      compingProfileId: "devotional-pima-arpeggio",
      anchorEvents: sparseAnchors,
    });
    const second = realizeGuitarClassicAccompaniment({
      sourceAbc,
      compingProfileId: "devotional-pima-arpeggio",
      anchorEvents: sparseAnchors,
    });

    expect(first.errors).toEqual([]);
    expect(first.events).toEqual(second.events);
    expect(first.events.length).toBeGreaterThan(sparseAnchors.length);
    expect(new Set(first.events.filter((event) => event.measureIndex === 1).map((event) => event.step)).size).toBeGreaterThanOrEqual(6);
    expect(first.events.some((event) => event.measureIndex === 1 && event.note === "G3")).toBe(true);
    const bassAttacks = first.events.filter((event) => event.string >= 4).length;
    const trebleAttacks = first.events.filter((event) => event.string <= 3).length;
    expect(bassAttacks / first.events.length).toBeGreaterThanOrEqual(0.3);
    expect(bassAttacks / first.events.length).toBeLessThanOrEqual(0.45);
    expect(trebleAttacks / first.events.length).toBeGreaterThanOrEqual(0.55);
    expect(trebleAttacks / first.events.length).toBeLessThanOrEqual(0.7);
    expect(validateGuitarTab(first.events, {
      guitarProfile: "guitar-classic",
      requireScientificPitch: true,
      requireRenderableTiming: true,
    }).valid).toBe(true);
  });

  it("uses simultaneous bass and treble attacks for the pinch profile", () => {
    const result = realizeGuitarClassicAccompaniment({
      sourceAbc,
      compingProfileId: "devotional-pinch-arpeggio",
      anchorEvents: sparseAnchors,
    });

    expect(result.errors).toEqual([]);
    const pinchGroups = new Map<string, number[]>();
    for (const event of result.events) {
      if (!event.simultaneousGroupId?.startsWith("pinch-")) continue;
      const strings = pinchGroups.get(event.simultaneousGroupId) ?? [];
      strings.push(event.string);
      pinchGroups.set(event.simultaneousGroupId, strings);
    }
    expect(pinchGroups.size).toBeGreaterThan(0);
    for (const strings of pinchGroups.values()) {
      expect(strings.some((string) => string >= 4)).toBe(true);
      expect(strings.some((string) => string <= 3)).toBe(true);
    }
  });

  it("uses real multi-string groups for bhajan strum rather than bass-only notes", () => {
    const result = realizeGuitarClassicAccompaniment({
      sourceAbc,
      compingProfileId: "bhajan-strum",
      anchorEvents: sparseAnchors,
    });
    const groups = new Map<string, number>();
    for (const event of result.events) {
      if (!event.simultaneousGroupId) continue;
      groups.set(event.simultaneousGroupId, (groups.get(event.simultaneousGroupId) ?? 0) + 1);
    }

    expect(result.errors).toEqual([]);
    expect([...groups.values()].some((count) => count >= 3)).toBe(true);
  });
});
