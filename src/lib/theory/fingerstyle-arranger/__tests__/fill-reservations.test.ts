import { describe, expect, it } from "vitest";
import {
  analyzeFillReservationSlots,
  parseFillReservationSelection,
  validateFillReservationSelection,
} from "../fill-reservations";
import type { TimeSliceMeasure } from "../time-slice";

function makeMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: { key: "Em", comping_style: "PIMA", voicing_plan: "Open Em" },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: index === 0 ? "⬤" as const : null,
      melody: index === 0
        ? { pitch: "E4", state: "attack" as const }
        : index < 4
          ? { pitch: "E4", state: "sustain" as const }
          : { pitch: null, state: "rest" as const },
      lyric: null,
    })),
  };
}

describe("fill reservations", () => {
  it("reserves only source rests for sparse/default generation and binds every decision", () => {
    const analysis = analyzeFillReservationSlots({
      measures: [makeMeasure()], sourceFingerprint: "source", skillLevel: "beginner", densityMode: "few",
    });
    expect(analysis.slots).toHaveLength(12);
    expect(analysis.slots[0]).toMatchObject({ id: "fr-m1-s5", melodyState: "rest" });

    const payload = [
      "fill-reservations:v1", `set,${analysis.reservationSetId}`, "source,source", "decisions: [D,slot,use|skip,reason]",
      ...analysis.slots.map((slot, index) => `D,${slot.id},${index === 0 ? "use" : "skip"},test`),
    ].join("\n");
    const parsed = parseFillReservationSelection(payload);
    expect(parsed.valid).toBe(true);
    expect(validateFillReservationSelection(analysis, parsed.value!).selectedSlotIds).toEqual(["fr-m1-s5"]);
  });

  it("allows explicit dense profiles to reserve held melody slots", () => {
    const auto = analyzeFillReservationSlots({
      measures: [makeMeasure()], sourceFingerprint: "source", skillLevel: "advanced", densityMode: "auto",
    });
    const dense = analyzeFillReservationSlots({
      measures: [makeMeasure()], sourceFingerprint: "source", skillLevel: "beginner", densityMode: "normal",
    });

    expect(auto.slots.every(slot => slot.melodyState === "rest")).toBe(true);
    expect(dense.slots).toHaveLength(15);
    expect(dense.slots.slice(0, 3).every(slot => slot.melodyState === "sustain")).toBe(true);
  });

  it("excludes pickup measures", () => {
    const pickup = { ...makeMeasure(), pickupDurationUnits: 1 };
    expect(analyzeFillReservationSlots({ measures: [pickup], sourceFingerprint: "source", skillLevel: "beginner", densityMode: "few" }).slots).toEqual([]);
  });
});
