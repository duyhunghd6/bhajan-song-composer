import {
  extractMelodyMeasures,
  getBeatsPerMeasure,
  melodyNoteToQuarterAbc,
  noteNameToAbc,
  resolveProgression,
} from "./arranger-utils";

export interface FingerstyleMeasure {
  measureIndex: number;
  chord: string;
  bassNotes: string[];
  melodyNotes: string[];
  abc: string;
}

export interface FingerstyleArrangement {
  key: string;
  timeSignature: string;
  measures: FingerstyleMeasure[];
  abc: string;
}

export function generateFingerstyleArrangement(
  abcString: string,
  progression?: string[]
): FingerstyleArrangement {
  const resolved = resolveProgression(abcString, progression);
  const melodyMeasures = extractMelodyMeasures(abcString);
  const beatCount = getBeatsPerMeasure(resolved.timeSignature);

  const measures = resolved.chords.map((chord, measureIndex) => {
    const melody = melodyMeasures[measureIndex] ?? [];
    const bassNotes = [noteNameToAbc(chord.notes[0], ","), noteNameToAbc(chord.notes[2], ",")];
    const tokens: string[] = [];
    const melodyNotes: string[] = [];

    for (let beat = 0; beat < beatCount; beat++) {
      if (beat % 2 === 0) {
        const bass = bassNotes[(beat / 2) % bassNotes.length];
        tokens.push(`${bass}2`);
      } else {
        const melodyEvent = melody[(beat - 1) / 2];
        tokens.push(melodyNoteToQuarterAbc(melodyEvent));
        if (melodyEvent) melodyNotes.push(melodyEvent.note);
      }
    }

    return {
      measureIndex,
      chord: chord.chordName,
      bassNotes,
      melodyNotes,
      abc: tokens.join(" "),
    };
  });

  return {
    key: resolved.key,
    timeSignature: resolved.timeSignature,
    measures,
    abc: `V:Guitar clef=treble-8\n| ${measures.map((measure) => measure.abc).join(" | ")} |`,
  };
}

export function generateFingerstyleLine(abcString: string, progression?: string[]): string {
  return generateFingerstyleArrangement(abcString, progression).abc;
}
