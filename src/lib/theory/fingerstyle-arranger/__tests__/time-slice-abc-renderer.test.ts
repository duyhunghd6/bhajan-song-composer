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

function sparseOpeningMeasure(): TimeSliceMeasure {
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
        : { pitch: null, state: "rest" as const },
      lyric: null,
      tablature: index === 0
        ? [{ string: 1 as const, fret: 0, finger: "a" as const, role: "melody" as const }]
        : [],
    })),
  };
}

function sameStringDurationMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: { key: "Em", comping_style: "Sparse PIMA", voicing_plan: "Open Em" },
    grid: Array.from({ length: 8 }, (_, index) => ({
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

function sourceRhythmMeasure(): TimeSliceMeasure {
  const notes = [
    { start: 0, duration: 2, pitch: "E4", string: 1 as const, fret: 0 },
    { start: 2, duration: 4, pitch: "E4", string: 1 as const, fret: 0 },
    { start: 6, duration: 2, pitch: "F#4", string: 1 as const, fret: 2 },
    { start: 8, duration: 2, pitch: "G4", string: 1 as const, fret: 3 },
    { start: 10, duration: 2, pitch: "F#4", string: 1 as const, fret: 2 },
    { start: 12, duration: 2, pitch: "E4", string: 1 as const, fret: 0 },
    { start: 14, duration: 2, pitch: "B3", string: 2 as const, fret: 0 },
  ];
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: { key: "Em", comping_style: "Sparse PIMA", voicing_plan: "Open Em" },
    grid: Array.from({ length: 16 }, (_, index) => {
      const note = notes.find(candidate => candidate.start === index);
      const sustainedNote = notes.find(candidate => (
        candidate.start < index && index < candidate.start + candidate.duration
      ));
      return {
        step: index + 1,
        chord: "Em",
        weight: index === 0 ? "⬤" as const : null,
        melody: note
          ? { pitch: note.pitch, state: "attack" as const }
          : sustainedNote
            ? { pitch: sustainedNote.pitch, state: "sustain" as const }
            : { pitch: null, state: "rest" as const },
        lyric: null,
        tablature: note
          ? [
              { string: note.string, fret: note.fret, finger: "a" as const, role: "melody" as const, durationSteps: note.duration },
              ...(note.start === 8
                ? [{ string: 6 as const, fret: 0, finger: "p" as const, role: "root" as const, durationSteps: note.duration }]
                : []),
            ]
          : [],
      };
    }),
  };
}

function adjacentEqualPitchFillMeasure(): TimeSliceMeasure {
  return {
    measure: 1,
    lineIndex: 0,
    style_profile: { key: "Em", comping_style: "Sparse PIMA", voicing_plan: "Open Em" },
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

describe("time-slice ABC interval renderer", () => {
  it("renders a sparse full measure as a note followed by rests", () => {
    const rendered = convertTimeSliceMeasureToAbc(
      sparseOpeningMeasure(),
      buildAbcDurationContext(ABC),
      getKeyAccidentalsFromAbc(ABC),
      true,
    );

    expect(rendered).toBe("!1!e/2 z7/2");
  });

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

  it("keeps source melody rhythm when bass starts with a melody attack", () => {
    const rendered = convertTimeSliceMeasureToAbc(
      sourceRhythmMeasure(),
      buildAbcDurationContext(ABC),
      getKeyAccidentalsFromAbc(ABC),
      true,
    );

    expect(rendered).toBe("!1!e !1!e2 !1!f [!1!g!6!E,] !1!f !1!e !2!B");
    expect(rendered).not.toContain("[!1!g!6!E,]/2 !1!g/2");
  });

  it("honors an explicit melody duration before source sustain fallback", () => {
    const measure = heldMelodyMeasure();
    measure.grid[0].tablature![0].durationSteps = 1;
    const rendered = convertTimeSliceMeasureToAbc(
      measure,
      buildAbcDurationContext(ABC),
      getKeyAccidentalsFromAbc(ABC),
      true,
    );

    expect(rendered).toContain("!1!e/2");
    expect(rendered).not.toContain("!1!e-");
  });

  it("renders durationless non-melody attacks for one step", () => {
    const rendered = convertTimeSliceMeasureToAbc(
      sameStringDurationMeasure(),
      buildAbcDurationContext(ABC),
      getKeyAccidentalsFromAbc(ABC),
      true,
    );

    expect(rendered).toBe("!6!E,/2 z/2 !1!e/2 z/2 !6!F,/2 z3/2");
    expect(rendered).not.toContain("!6!E,-");
    expect(rendered).not.toContain("[!1!e!6!E,]");
  });

  it("renders adjacent equal-pitch fills as separate untied attacks", () => {
    const rendered = convertTimeSliceMeasureToAbc(
      adjacentEqualPitchFillMeasure(),
      buildAbcDurationContext(ABC),
      getKeyAccidentalsFromAbc(ABC),
      true,
    );

    expect(rendered).toBe("z3/2 !3!G9/2 !3!G z");
    expect(rendered).not.toContain("!3!G-");
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
