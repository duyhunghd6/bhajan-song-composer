import { ChordInfo } from "./chords";
import { getBeatsPerMeasure, noteNameToAbc, resolveProgression } from "./arranger-utils";

export interface PianoBassMeasure {
  measureIndex: number;
  chord: string;
  notes: string[];
  abc: string;
}

export interface PianoBassArrangement {
  key: string;
  timeSignature: string;
  measures: PianoBassMeasure[];
  abc: string;
}

function buildRootFifthPattern(chord: ChordInfo, beatCount: number): string[] {
  const root = noteNameToAbc(chord.notes[0], ",,");
  const fifth = noteNameToAbc(chord.notes[2], ",,");
  const octaveRoot = noteNameToAbc(chord.notes[0], ",");
  const pattern = [root, fifth, octaveRoot, fifth];

  return Array.from({ length: beatCount }, (_, index) => pattern[index % pattern.length]);
}

export function generatePianoBassArrangement(
  abcString: string,
  progression?: string[]
): PianoBassArrangement {
  const resolved = resolveProgression(abcString, progression);
  const beatCount = getBeatsPerMeasure(resolved.timeSignature);

  const measures = resolved.chords.map((chord, measureIndex) => {
    const notes = buildRootFifthPattern(chord, beatCount);
    const abc = notes.map((note) => `${note}2`).join(" ");

    return {
      measureIndex,
      chord: chord.chordName,
      notes,
      abc,
    };
  });

  return {
    key: resolved.key,
    timeSignature: resolved.timeSignature,
    measures,
    abc: `V:Bass clef=bass\n| ${measures.map((measure) => measure.abc).join(" | ")} |`,
  };
}

export function generatePianoBassLine(abcString: string, progression?: string[]): string {
  return generatePianoBassArrangement(abcString, progression).abc;
}
