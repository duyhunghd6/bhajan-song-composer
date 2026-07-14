import { describe, expect, it } from "vitest";

import { buildAbcDurationContext } from "../../abc-duration";
import { getKeyAccidentalsFromAbc } from "../../abc-key-signature";
import { convertTimeSliceMeasureToAbc, type TimeSliceMeasure } from "../time-slice";

const ABC = `X:1
L:1/8
M:4/4
K:Em
| E2 z6 |`;

function heldMelodyMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: { key: "Em", comping_style: "Sparse PIMA", voicing_plan: "Open Em" },
    grid: Array.from({ length: 8 }, (_, index) => ({
      step: index + 1,
      chord: "Em",
      weight: index === 0 ? "⬤" as const : null,
      melody: index === 0
        ? { pitch: "E4", state: "attack" as const }
        : index < 4
          ? { pitch: "E4", state: "sustain" as const }
          : { pitch: null, state: "rest" as const },
      lyric: null,
      tablature: index === 0
        ? [{ string: 1 as const, fret: 0, finger: "a" as const, role: "melody" as const }]
        : index === 2
          ? [{
              string: 3 as const,
              fret: 0,
              finger: "i" as const,
              role: "fill" as const,
              durationSteps: 2,
              fillWindowId: "w-m1-s3-4",
              fillCandidateId: "c-m1-s3-G3-str3f0",
            }]
          : [],
    })),
  };
}

describe("time-slice ABC interval renderer", () => {
  it("splits and ties a held melody around a fill without shortening or retriggering it", () => {
    const rendered = convertTimeSliceMeasureToAbc(
      heldMelodyMeasure(),
      buildAbcDurationContext(ABC),
      getKeyAccidentalsFromAbc(ABC),
      true,
    );

    expect(rendered).toBe("!1!e- [!1!e!3!G] z2");
    expect(rendered).toContain("!1!e-");
    expect(rendered).toContain("[!1!e!3!G]");
  });

  it("preserves explicit fill duration provenance on the source measure", () => {
    const measure = heldMelodyMeasure();
    convertTimeSliceMeasureToAbc(
      measure,
      buildAbcDurationContext(ABC),
      getKeyAccidentalsFromAbc(ABC),
      true,
    );

    expect(measure.grid[2].tablature?.[0]).toMatchObject({
      durationSteps: 2,
      fillWindowId: "w-m1-s3-4",
      fillCandidateId: "c-m1-s3-G3-str3f0",
    });
  });
});
