import { describe, expect, it } from "vitest";
import { buildAbcDurationContext } from "../../abc-duration";
import { getKeyAccidentalsFromAbc } from "../../abc-key-signature";
import {
  validateGuitarAbcAgainstAsciiGuitarTab,
  formatAbcAsciiGuitarTabValidation,
} from "../abc-ascii-guitartab-validation";
import { convertTimeSliceMeasureToAbc } from "../time-slice";
import type { TimeSliceMeasure } from "../time-slice";

const BASE_ABC = `X:1\nT:Validation\nM:4/4\nL:1/8\nK:Em\n`;

function makeMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: {
      key: "Em",
      comping_style: "PIMA",
      voicing_plan: "Open Em",
    },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: index === 0 ? "⬤" as const : null,
      melody: index === 0
        ? { pitch: "E4", state: "attack" as const }
        : { pitch: null, state: "rest" as const },
      lyric: null,
      tablature: index === 0
        ? [
            { string: 6 as const, fret: 0, finger: "p" as const, role: "bass" as const, durationSteps: 4 },
            { string: 1 as const, fret: 0, finger: "a" as const, role: "melody" as const },
          ]
        : index === 4
          ? [{ string: 3 as const, fret: 4, finger: "i" as const, role: "fill" as const, durationSteps: 2 }]
          : [],
    })),
  };
}

function sameStringDurationMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: {
      key: "Em",
      comping_style: "PIMA",
      voicing_plan: "Open Em",
    },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: null,
      melody: { pitch: null, state: "rest" as const },
      lyric: null,
      tablature: index === 0
        ? [{ string: 6 as const, fret: 0, finger: "p" as const, role: "fill" as const }]
        : index === 2
          ? [{ string: 1 as const, fret: 0, finger: "a" as const, role: "fill" as const }]
          : index === 4
            ? [{ string: 6 as const, fret: 2, finger: "p" as const, role: "fill" as const }]
            : [],
    })),
  };
}

function adjacentEqualPitchFillMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: {
      key: "Em",
      comping_style: "PIMA",
      voicing_plan: "Open Em",
    },
    grid: Array.from({ length: 16 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: null,
      melody: { pitch: null, state: "rest" as const },
      lyric: null,
      tablature: index === 3
        ? [{ string: 3 as const, fret: 0, finger: "i" as const, role: "fill" as const, durationSteps: 9 }]
        : index === 12
          ? [{ string: 3 as const, fret: 0, finger: "i" as const, role: "fill" as const, durationSteps: 2 }]
          : [],
    })),
  };
}

function singleLongFillMeasure(): TimeSliceMeasure {
  return {
    ...adjacentEqualPitchFillMeasure(),
    grid: adjacentEqualPitchFillMeasure().grid.map((step, index) => ({
      ...step,
      tablature: index === 0
        ? [{ string: 3 as const, fret: 0, finger: "i" as const, role: "fill" as const, durationSteps: 2 }]
        : [],
    })),
  };
}

function validate(abcBody: string, measure = makeMeasure()) {
  const abc = `${BASE_ABC}${abcBody}`;
  return validateGuitarAbcAgainstAsciiGuitarTab({
    abc,
    measures: [measure],
    durationContext: buildAbcDurationContext(BASE_ABC),
    keyAccidentals: getKeyAccidentalsFromAbc(BASE_ABC),
  });
}

describe("ABC ↔ ASCII-GuitarTab validation", () => {
  it("accepts canonical time-slice ABC with forced strings and rests", () => {
    const measure = makeMeasure();
    const body = convertTimeSliceMeasureToAbc(
      measure,
      buildAbcDurationContext(BASE_ABC),
      getKeyAccidentalsFromAbc(BASE_ABC),
      true,
    );
    const result = validate(body, measure);
    expect(result.valid).toBe(true);
    expect(result.mismatchCount).toBe(0);
    expect(result.expectedEventCount).toBe(3);
    expect(result.actualEventCount).toBe(3);
  });

  it("reports a wrong fret and an unexpected attack", () => {
    const result = validate("[!6!E,!1!e]2 !3!c2 z4");
    expect(result.valid).toBe(false);
    expect(result.mismatches.some(issue => issue.kind === "fret-mismatch")).toBe(true);
  });

  it("validates independent one-step durationless non-melody attacks", () => {
    const measure = sameStringDurationMeasure();
    const body = convertTimeSliceMeasureToAbc(
      measure,
      buildAbcDurationContext(BASE_ABC),
      getKeyAccidentalsFromAbc(BASE_ABC),
      true,
    );
    const result = validate(body, measure);

    expect(result.valid).toBe(true);
    expect(result.expectedEventCount).toBe(3);
    expect(result.actualEventCount).toBe(3);
    expect(result.mismatches).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "duration-mismatch" }),
    ]));
  });

  it("keeps adjacent equal-pitch fill attacks distinct", () => {
    const measure = adjacentEqualPitchFillMeasure();
    const body = convertTimeSliceMeasureToAbc(
      measure,
      buildAbcDurationContext(BASE_ABC),
      getKeyAccidentalsFromAbc(BASE_ABC),
      true,
    );
    const result = validate(body, measure);

    expect(result.valid).toBe(true);
    expect(result.expectedEventCount).toBe(2);
    expect(result.actualEventCount).toBe(2);
    expect(result.mismatches).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "missing-event", step: 13, string: 3 }),
      expect.objectContaining({ kind: "duration-mismatch", string: 3 }),
    ]));
  });

  it("merges a genuine tied continuation into one event", () => {
    const measure = singleLongFillMeasure();
    const result = validate("!3!G/2- !3!G/2 z7", measure);

    expect(result.valid).toBe(true);
    expect(result.expectedEventCount).toBe(1);
    expect(result.actualEventCount).toBe(1);
  });

  it("rejects missing string forcing instead of auto-assigning a string", () => {
    const result = validate("[E,e]2 !3!B2 z4");

    expect(result.valid).toBe(false);
    expect(result.mismatches.some(issue => issue.kind === "parse-error" && issue.message.includes("missing a !N!"))).toBe(true);
  });

  it("keeps quoted chord symbols separate from note chords", () => {
    const result = validate('"Em"[!1!e!6!E,-]/2 !6!E,3/2 !3!B z5');
    expect(result.valid).toBe(true);
    expect(result.mismatchCount).toBe(0);
  });

  it("formats a bounded human-readable diagnostic", () => {
    const result = validate("[!6!E,!1!e]2 !3!B2 z4");
    const formatted = formatAbcAsciiGuitarTabValidation(result);

    expect(formatted).toContain("measures=1");
    expect(formatted).toContain("mismatches=");
    expect(formatted.split("\n").length).toBeLessThanOrEqual(9);
  });
});
