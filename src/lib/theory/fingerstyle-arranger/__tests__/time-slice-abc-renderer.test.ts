import { describe, expect, it } from "vitest";

import { buildAbcDurationContext } from "../../abc-duration";
import { getKeyAccidentalsFromAbc } from "../../abc-key-signature";
import { convertTimeSliceMeasureToAbc, type TimeSliceMeasure } from "../time-slice";
import { renderTimeSliceMeasuresToAbc } from "../time-slice-abc-renderer";

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

  it("renders an explicit source-Melody cross-bar tie only for matching physical strings", () => {
    const source = `X:1\nL:1/8\nM:4/4\nK:Em\n| B8- | B8 |`;
    const first = {
      ...sourceRhythmMeasure(),
      source_abc: { melody: "B8-", lyric: "", beatWeight: "" },
    };
    const second = {
      ...sourceRhythmMeasure(),
      measure: 2,
      source_abc: { melody: "B8", lyric: "", beatWeight: "" },
      grid: sourceRhythmMeasure().grid.map((step, index) => ({
        ...step,
        // A genuine cross-measure tie means the first step is a sustain, not a new attack.
        melody: index === 0
          ? { pitch: "B4", state: "sustain" as const }
          : step.melody,
        tablature: index === 0
          ? [{ string: 2 as const, fret: 0, finger: "a" as const, role: "melody" as const, durationSteps: 16 }]
          : [],
      })),
    };

    const [renderedFirst, renderedSecond] = renderTimeSliceMeasuresToAbc(
      [first, second],
      buildAbcDurationContext(source),
      getKeyAccidentalsFromAbc(source),
      true,
    );

    expect(renderedFirst).toContain("!2!B-");
    expect(renderedSecond.startsWith("!2!B8")).toBe(true);
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

  it("retains source Melody tie segmentation without changing physical duration", () => {
    const measure: TimeSliceMeasure = {
      ...sparseOpeningMeasure(),
      source_abc: { melody: "E3- E2 z3", lyric: "", beatWeight: "" },
      grid: Array.from({ length: 16 }, (_, index) => ({
        step: index + 1,
        chord: "Em",
        weight: null,
        melody: index === 0
          ? { pitch: "E4", state: "attack" as const }
          : index < 10
            ? { pitch: "E4", state: "sustain" as const }
            : { pitch: null, state: "rest" as const },
        lyric: null,
        tablature: index === 0
          ? [{ string: 1 as const, fret: 0, finger: "a" as const, role: "melody" as const, durationSteps: 10 }]
          : [],
      })),
    };

    expect(convertTimeSliceMeasureToAbc(
      measure,
      buildAbcDurationContext(ABC),
      getKeyAccidentalsFromAbc(ABC),
      true,
    )).toBe("!1!e3- !1!e2 z3");
  });

  it("does NOT produce a cross-measure tie when the next measure's first step is an attack on the same pitch", () => {
    // Scenario from the bug: M19 ends with B4 sustain on string 1 fret 7,
    // source_abc has tie (B4-), but M20 grid[0] melody state is "attack".
    // The guitar must re-attack B4 in M20, not tie from M19.
    const source = `X:1\nL:1/8\nM:4/4\nK:G\n| B8- | B8 |`;
    const m19: TimeSliceMeasure = {
      measure: 19,
      lineIndex: 0,
      style_profile: { key: "G", comping_style: "Sparse PIMA", voicing_plan: "Open G" },
      source_abc: { melody: 'G A2 B- "B7" B4-', lyric: "", beatWeight: "" },
      grid: Array.from({ length: 16 }, (_, index) => ({
        step: index + 1,
        chord: index < 8 ? "Am" : "B7",
        weight: index === 0 ? "⬤" as const : null,
        melody: index === 0
          ? { pitch: "G4", state: "attack" as const }
          : index < 2
            ? { pitch: "G4", state: "sustain" as const }
            : index === 2
              ? { pitch: "A4", state: "attack" as const }
              : index < 6
                ? { pitch: "A4", state: "sustain" as const }
                : index === 6
                  ? { pitch: "B4", state: "attack" as const }
                  : { pitch: "B4", state: "sustain" as const },
        lyric: null,
        tablature: index === 0
          ? [
              { string: 5 as const, fret: 0, finger: "p" as const, role: "bass" as const, durationSteps: 1 },
              { string: 1 as const, fret: 3, finger: "a" as const, role: "melody" as const },
            ]
          : index === 2
            ? [{ string: 1 as const, fret: 5, finger: "a" as const, role: "melody" as const }]
            : index === 6
              ? [{ string: 1 as const, fret: 7, finger: "a" as const, role: "melody" as const }]
              : [],
      })),
    };
    const m20: TimeSliceMeasure = {
      measure: 20,
      lineIndex: 0,
      style_profile: { key: "G", comping_style: "Sparse PIMA", voicing_plan: "Open G" },
      source_abc: { melody: "B4 B2 z B,", lyric: "", beatWeight: "" },
      grid: Array.from({ length: 16 }, (_, index) => ({
        step: index + 1,
        chord: "C",
        weight: index === 0 ? "⬤" as const : null,
        melody: index === 0
          ? { pitch: "B4", state: "attack" as const } // ← new attack, NOT sustain
          : index < 8
            ? { pitch: "B4", state: "sustain" as const }
            : index === 8
              ? { pitch: "B4", state: "attack" as const }
              : index < 12
                ? { pitch: "B4", state: "sustain" as const }
                : index < 14
                  ? { pitch: null, state: "rest" as const }
                  : index === 14
                    ? { pitch: "B3", state: "attack" as const }
                    : { pitch: "B3", state: "sustain" as const },
        lyric: null,
        tablature: index === 0
          ? [
              { string: 4 as const, fret: 5, finger: "p" as const, role: "bass" as const, durationSteps: 1 },
              { string: 1 as const, fret: 7, finger: "a" as const, role: "melody" as const },
            ]
          : index === 8
            ? [
                { string: 4 as const, fret: 5, finger: "p" as const, role: "bass" as const, durationSteps: 1 },
                { string: 1 as const, fret: 7, finger: "a" as const, role: "melody" as const },
              ]
            : index === 14
              ? [{ string: 2 as const, fret: 0, finger: "a" as const, role: "melody" as const }]
              : [],
      })),
    };

    const [renderedM19, renderedM20] = renderTimeSliceMeasuresToAbc(
      [m19, m20],
      buildAbcDurationContext(source),
      getKeyAccidentalsFromAbc(source),
      true,
    );

    // M19 must NOT end with a tie on string 1 because M20 is a new attack
    expect(renderedM19).not.toMatch(/!1!b[^-]*-\s*$/);
    // M20 must contain a new attack for string 1 (B4 = fret 7)
    expect(renderedM20).toContain("!1!b");
  });
});

