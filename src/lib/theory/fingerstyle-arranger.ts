import { generateAccompanimentStage, AccompanimentStage } from "./accompaniment-stage";
import {
  extractMelodyMeasures,
  getBeatsPerMeasure,
  melodyNoteToQuarterAbc,
  noteNameToAbc,
  resolveProgression,
} from "./arranger-utils";
import { FullTrackExpansionStage, generateFullTrackExpansionStage } from "./full-track-expansion-stage";
import { CadenceRole, generateHarmonizationStage } from "./harmonizer";

export interface FingerstyleMeasure {
  measureIndex: number;
  chord: string;
  bassNotes: string[];
  melodyNotes: string[];
  abc: string;
}

export type FingerstyleUpwardConstructionLayerId =
  | "melody"
  | "harmonization"
  | "accompaniment"
  | "bassline"
  | "rhythm-percussion"
  | "counter-melody";

export interface FingerstyleMelodySourceLayer {
  id: "melody";
  layer: {
    number: 1;
    name: "Melody";
    instrument: "voice";
  };
  measures: Array<{
    measureIndex: number;
    notes: string[];
  }>;
}

export interface FingerstyleHarmonizationSourceLayer {
  id: "harmonization";
  progression: string[];
  measures: Array<{
    measureIndex: number;
    chord: string;
    cadenceRole: CadenceRole;
  }>;
}

export interface FingerstyleAccompanimentSourceLayer {
  id: "accompaniment";
  layer: AccompanimentStage["layer"];
  measures: AccompanimentStage["measures"];
}

export interface FingerstyleBasslineSourceLayer {
  id: "bassline";
  measures: Array<{
    measureIndex: number;
    chord: string;
    bassMap: FullTrackExpansionStage["measures"][number]["bassMap"];
  }>;
}

export interface FingerstyleRhythmPercussionSourceLayer {
  id: "rhythm-percussion";
  measures: Array<{
    measureIndex: number;
    chord: string;
    drums: FullTrackExpansionStage["measures"][number]["drums"];
  }>;
}

export interface FingerstyleCounterMelodySourceLayer {
  id: "counter-melody";
  measures: Array<{
    measureIndex: number;
    chord: string;
    melodicGaps: FullTrackExpansionStage["measures"][number]["melodicGaps"];
    counterMelodies: FullTrackExpansionStage["measures"][number]["counterMelodies"];
  }>;
}

export type FingerstyleUpwardConstructionLayer =
  | FingerstyleMelodySourceLayer
  | FingerstyleHarmonizationSourceLayer
  | FingerstyleAccompanimentSourceLayer
  | FingerstyleBasslineSourceLayer
  | FingerstyleRhythmPercussionSourceLayer
  | FingerstyleCounterMelodySourceLayer;

export interface FingerstyleUpwardConstructionContext {
  layers: FingerstyleUpwardConstructionLayer[];
  validation: {
    melodyReady: boolean;
    harmonizationReady: boolean;
    accompanimentReady: boolean;
    basslineReady: boolean;
    rhythmPercussionReady: boolean;
    counterMelodyUsesMelodicGaps: boolean;
  };
}

export interface FingerstyleArrangement {
  key: string;
  timeSignature: string;
  upwardConstruction: FingerstyleUpwardConstructionContext;
  measures: FingerstyleMeasure[];
  abc: string;
}

function buildMelodySourceLayer(melodyMeasures: ReturnType<typeof extractMelodyMeasures>): FingerstyleMelodySourceLayer {
  return {
    id: "melody",
    layer: { number: 1, name: "Melody", instrument: "voice" },
    measures: melodyMeasures.map((measure, measureIndex) => ({
      measureIndex,
      notes: measure.map((event) => event.note),
    })),
  };
}

function buildHarmonizationSourceLayer(
  abcString: string,
  progression: string[]
): FingerstyleHarmonizationSourceLayer {
  const harmonization = generateHarmonizationStage(abcString);

  return {
    id: "harmonization",
    progression,
    measures: progression.map((chord, measureIndex) => ({
      measureIndex,
      chord,
      cadenceRole: harmonization.measures[measureIndex]?.cadenceRole ?? "continuation",
    })),
  };
}

function buildUpwardConstructionContext(
  abcString: string,
  progression: string[],
  melodyMeasures: ReturnType<typeof extractMelodyMeasures>
): FingerstyleUpwardConstructionContext {
  const accompaniment = generateAccompanimentStage(abcString, { progression });
  const fullTrackExpansion = generateFullTrackExpansionStage(abcString, { accompaniment });

  const melodyLayer = buildMelodySourceLayer(melodyMeasures);
  const harmonizationLayer = buildHarmonizationSourceLayer(abcString, progression);
  const accompanimentLayer: FingerstyleAccompanimentSourceLayer = {
    id: "accompaniment",
    layer: accompaniment.layer,
    measures: accompaniment.measures,
  };
  const basslineLayer: FingerstyleBasslineSourceLayer = {
    id: "bassline",
    measures: fullTrackExpansion.measures.map((measure) => ({
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      bassMap: measure.bassMap,
    })),
  };
  const rhythmPercussionLayer: FingerstyleRhythmPercussionSourceLayer = {
    id: "rhythm-percussion",
    measures: fullTrackExpansion.measures.map((measure) => ({
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      drums: measure.drums,
    })),
  };
  const counterMelodyLayer: FingerstyleCounterMelodySourceLayer = {
    id: "counter-melody",
    measures: fullTrackExpansion.measures.map((measure) => ({
      measureIndex: measure.measureIndex,
      chord: measure.chord,
      melodicGaps: measure.melodicGaps,
      counterMelodies: measure.counterMelodies,
    })),
  };

  return {
    layers: [
      melodyLayer,
      harmonizationLayer,
      accompanimentLayer,
      basslineLayer,
      rhythmPercussionLayer,
      counterMelodyLayer,
    ],
    validation: {
      melodyReady: melodyLayer.measures.length > 0,
      harmonizationReady: harmonizationLayer.progression.length > 0,
      accompanimentReady: accompanimentLayer.measures.length > 0,
      basslineReady: basslineLayer.measures.every((measure) => measure.bassMap.length > 0),
      rhythmPercussionReady: rhythmPercussionLayer.measures.every((measure) => measure.drums.kickBeats.length > 0),
      counterMelodyUsesMelodicGaps: fullTrackExpansion.validation.counterMelodiesUseGaps,
    },
  };
}

export function generateFingerstyleArrangement(
  abcString: string,
  progression?: string[]
): FingerstyleArrangement {
  const resolved = resolveProgression(abcString, progression);
  const melodyMeasures = extractMelodyMeasures(abcString);
  const beatCount = getBeatsPerMeasure(resolved.timeSignature);
  const resolvedProgression = resolved.chords.map((chord) => chord.chordName);

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
    upwardConstruction: buildUpwardConstructionContext(abcString, resolvedProgression, melodyMeasures),
    measures,
    abc: `V:Guitar clef=treble-8\n| ${measures.map((measure) => measure.abc).join(" | ")} |`,
  };
}

export function generateFingerstyleLine(abcString: string, progression?: string[]): string {
  return generateFingerstyleArrangement(abcString, progression).abc;
}
