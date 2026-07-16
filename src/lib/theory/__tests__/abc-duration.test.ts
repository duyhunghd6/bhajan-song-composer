import { describe, expect, it } from "vitest";
import { normalizeAbcMeasureDuration, measureDurationUnits } from "../abc-duration";

describe("ABC duration normalization", () => {
  it("preserves string assignments on every Ganesha guitar note", () => {
    const measure = "[!2!B!3!G!6!E,] !2!e !3!G !2!B4 !3!B";

    expect(measureDurationUnits(measure)).toBe(8);
    expect(normalizeAbcMeasureDuration(measure, 8)).toBe(measure);
  });

  it("preserves ties while normalizing a sustained note", () => {
    expect(normalizeAbcMeasureDuration("E4- E4", 8)).toBe("E4- E4");
  });

  it("preserves ties on forced-string chord tokens", () => {
    const measure = "[!1!e!3!G]4- [!1!e!3!G]4";

    expect(normalizeAbcMeasureDuration(measure, 8)).toBe(measure);
  });
});
