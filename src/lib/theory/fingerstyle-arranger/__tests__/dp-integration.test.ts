import { describe, expect, it } from "vitest";
import { buildAbcDurationContext } from "../../abc-duration";
import { getKeyAccidentalsFromAbc } from "../../abc-key-signature";
import { midiForStringFret, parseScientificPitch } from "../../guitar-playability";
import { applyDPToTimeSliceMeasures } from "../dp-integration";
import {
  convertAbcToTimeSliceGrid,
  convertTimeSliceMeasureToAbc,
  type TimeSliceGridStep,
  type TimeSliceMeasure,
} from "../time-slice";
import { renderCombinedAsciiTab } from "../toon-utils";

const GANESHA_ABC = `X:1
T:Ganesha, Ganesha — Voice-leading Option 1 Sparse Bass
L:1/8
M:4/4
Q:1/2=120
K:G
%%score (Melody) (Guitar)
%%vocalspace 10
%%botmargin 80
V:Melody name="Melody" stem=up
V:Guitar clef=treble-8 name="Guitar" stem=down
%%MIDI program 24
% Staff system 1: Melody and visible instruments share this measure range.
[V:Melody] | B, | : "Em" E E2 F GF E B, | "Em" E E2 F GF E2 | "Am" B2 A2 G2 A2 | "Em" E E3- E2 z B, |
w: Ga- | ne- sha Ga- ne- * sha Ga- | ne- sha Ga- ne- * sha | Jay jay Shri Ga- | ne- sha! _ Ga
w: | ⬤ | ⬤ * * ● * • * | ⬤ * * ● * • | ⬤ • ● • | ⬤ * ● * |
[V:Guitar] | [!2!B] z7 | : [!1!e!2!B!3!G!6!E,] [!1!e] [!2!B] [!1!f] [!1!g!6!E,] [!1!f] [!1!e!6!E,] [!2!B] | [!1!e!2!B!3!G!6!E,] [!1!e] [!3!G] [!1!f] [!1!g!6!E,] [!1!f] [!2!e!6!E,] [!2!B] | [!1!b!5!A,]2 [!1!a!5!A,]2 [!1!g!5!A,]2 [!1!a!5!A,]2 | [!2!B!3!G!6!E,] [!2!e] [!3!G] [!2!B]4 [!3!B] |`;

const GANESHA_REPORTED_ASCII = `Measures 1–3
e|-------------------------------------------------|-0-----0-----------2-----3-----2-----0-----------|-0-----0-----------2-----3-----2-----------------|
B|-0-----------------------------------------------|-0-----------0-----------------------------0-----|-0-----------------------------------5-----0-----|
G|-------------------------------------------------|-0-----------------------------------------------|-0-----------0-----------------------------------|
D|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|
A|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|
E|-------------------------------------------------|-0-----------------------0-----------0-----------|-0-----------------------0-----------0-----------|

Measures 4–5
e|-7-----------5-----------3-----------5-----------|-------------------------------------------------|
B|-------------------------------------------------|-0-----5-----------0-----------------------------|
G|-------------------------------------------------|-0-----------0-----------------------------4-----|
D|-------------------------------------------------|-------------------------------------------------|
A|-0-----------0-----------0-----------0-----------|-------------------------------------------------|
E|-------------------------------------------------|-0-----------------------------------------------|
`;

const GANESHA_CORRECTED_ASCII = `Measures 1–3
e|-------------------------------------------------|-0-----0-----------2-----3-----2-----0-----------|-0-----0-----------2-----3-----2-----------------|
B|-0-----------------------------------------------|-0-----------0-----------------------------0-----|-0-----------------------------------5-----0-----|
G|-------------------------------------------------|-0-----------------------------------------------|-0-----------0-----------------------------------|
D|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|
A|-------------------------------------------------|-------------------------------------------------|-------------------------------------------------|
E|-------------------------------------------------|-0-----------------------0-----------0-----------|-0-----------------------0-----------0-----------|

Measures 4–5
e|-7-----------5-----------3-----------5-----------|-------------------------------------------------|
B|-------------------------------------------------|-5-----5-----------0-----------------------------|
G|-------------------------------------------------|-0-----------0-----------------------------4-----|
D|-------------------------------------------------|-------------------------------------------------|
A|-0-----------0-----------0-----------0-----------|-------------------------------------------------|
E|-------------------------------------------------|-0-----------------------------------------------|
`;

const STRING_BY_LINE = { e: 1, B: 2, G: 3, D: 4, A: 5, E: 6 } as const;
const FINGER_BY_STRING = { 1: "a", 2: "m", 3: "i", 4: "p", 5: "p", 6: "p" } as const;

function attachReportedAscii(
  sourceMeasures: TimeSliceMeasure[],
  ascii: string
): TimeSliceMeasure[] {
  const measures: TimeSliceMeasure[] = JSON.parse(JSON.stringify(sourceMeasures));
  let measureIndex = 0;

  for (const block of ascii.trim().split(/\n\s*\n/)) {
    const lines = block.split("\n").slice(1);
    const segmentsByString = lines.map(line => {
      const string = STRING_BY_LINE[line[0] as keyof typeof STRING_BY_LINE];
      return { string, segments: line.split("|").slice(1, -1) };
    });
    const measureCount = segmentsByString[0]?.segments.length ?? 0;

    for (let localMeasure = 0; localMeasure < measureCount; localMeasure++) {
      const measure = measures[measureIndex++];
      for (let stepIndex = 0; stepIndex < measure.grid.length; stepIndex++) {
        const tabs: NonNullable<TimeSliceGridStep["tablature"]> = [];
        for (const { string, segments } of segmentsByString) {
          const cell = segments[localMeasure].slice(1 + stepIndex * 3, 3 + stepIndex * 3);
          const fretText = cell.replaceAll("-", "");
          if (!fretText) continue;
          tabs.push({
            string,
            fret: Number(fretText),
            finger: FINGER_BY_STRING[string],
            role: "fill",
          });
        }

        const step = measure.grid[stepIndex];
        if (tabs.length > 0 && step.melody.state === "attack") {
          const sourceMidi = step.melody.pitch
            ? parseScientificPitch(step.melody.pitch)?.midi ?? null
            : null;
          let melodyIndex = tabs.findIndex(tab =>
            midiForStringFret(tab.string, tab.fret) === sourceMidi
          );
          if (melodyIndex < 0) {
            melodyIndex = tabs.reduce((best, tab, index) =>
              midiForStringFret(tab.string, tab.fret)
                > midiForStringFret(tabs[best].string, tabs[best].fret)
                ? index
                : best, 0);
          }
          tabs[melodyIndex].role = "melody";
        }
        step.tablature = tabs;
      }
    }
  }

  return measures;
}

function makeRegressionMeasure(): TimeSliceMeasure {
  const grid: TimeSliceGridStep[] = Array.from({ length: 16 }, (_, index) => ({
    step: index + 1,
    chord: "Em",
    weight: index === 0 ? "⬤" : null,
    melody: {
      pitch: index === 0 ? "E4" : null,
      state: index === 0 ? "attack" : "rest",
    },
    lyric: null,
    tablature: index === 0
      ? [
          { string: 3, fret: 0, finger: "i", role: "melody" },
          { string: 6, fret: 0, finger: "p", role: "root" },
          { string: 5, fret: 7, finger: "p", role: "fifth" },
        ]
      : [],
  }));

  return {
    measure: 1,
    lineIndex: 0,
    style_profile: {
      key: "Em",
      comping_style: "PIMA devotional fingerstyle. Sparse fills.",
      voicing_plan: "Open-position Em and D shapes.",
      fill_density: "few",
    },
    grid,
  };
}

describe("fingerstyle DP integration", () => {
  it("preserves authoritative melody pitch and does not collapse independent chord tones", () => {
    const input = makeRegressionMeasure();
    const { measures } = applyDPToTimeSliceMeasures([input], 120, {
      skillLevel: "intermediate",
      capo: 0,
      autoCapo: false,
    });

    const output = measures[0].grid[0].tablature ?? [];
    const melody = output.find(tab => tab.role === "melody");
    const root = output.find(tab => tab.role === "root");
    const fifth = output.find(tab => tab.role === "fifth");

    expect(melody).toBeDefined();
    expect(midiForStringFret(melody!.string, melody!.fret)).toBe(64);
    expect(root).toMatchObject({ role: "root", string: 6, fret: 0 });
    expect(fifth).toMatchObject({ role: "fifth", string: 5, fret: 7 });
    expect(new Set(output.map(tab => tab.string)).size).toBe(output.length);
  });

  it("corrects the reported Ganesha melody-pitch regression", () => {
    const source = convertAbcToTimeSliceGrid(
      GANESHA_ABC,
      ["C", "Em", "Em", "Am", "Em"]
    );
    const reported = attachReportedAscii(source, GANESHA_REPORTED_ASCII);
    for (const measure of reported) measure.style_profile.fill_density = "many";
    expect(renderCombinedAsciiTab(reported)).toBe(GANESHA_REPORTED_ASCII);

    const { measures } = applyDPToTimeSliceMeasures(reported, 120, {
      skillLevel: "intermediate",
      capo: 0,
      autoCapo: false,
    });

    for (const measure of measures) {
      for (const step of measure.grid) {
        if (step.melody.state !== "attack" || !step.melody.pitch) continue;
        const sourceMidi = parseScientificPitch(step.melody.pitch)!.midi;
        const melody = step.tablature?.find(tab => tab.role === "melody");
        expect(melody).toBeDefined();
        expect(midiForStringFret(melody!.string, melody!.fret)).toBe(sourceMidi);
      }
    }

    const durationContext = buildAbcDurationContext(GANESHA_ABC);
    const keyAccidentals = getKeyAccidentalsFromAbc(GANESHA_ABC);
    const correctedFinalMeasure = convertTimeSliceMeasureToAbc(
      measures[4],
      durationContext,
      keyAccidentals,
      true
    );
    expect(correctedFinalMeasure).toBe(
      "[!2!e!3!G!6!E,] !2!e !3!G !2!B4 !3!B"
    );

    const correctedAscii = renderCombinedAsciiTab(measures);
    expect(correctedAscii).toBe(GANESHA_CORRECTED_ASCII);
  });
});
