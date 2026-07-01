import { MelodyNoteEvent } from "./arranger-utils";
import { ChordInfo } from "./chords";
import { normalizeAbcNote } from "./melody-analyzer";
import { getNoteValue } from "./scales";

export type GuitarStringNumber = 1 | 2 | 3 | 4 | 5 | 6;

export interface GuitarStringPosition {
  note: string;
  string: GuitarStringNumber;
  fret: number;
}

export interface RoutedFingerstyleEvent extends GuitarStringPosition {
  beat: number;
  role: "melody" | "bass" | "root" | "third" | "seventh";
}

export interface BeatOnePairingReport {
  valid: boolean;
  melody: GuitarStringPosition | null;
  bass: GuitarStringPosition;
  fretStretch: number;
  maxFretStretch: number;
}

export interface FingerstyleOuterVoiceMeasure {
  measureIndex: number;
  chord: string;
  melodyRoute: RoutedFingerstyleEvent[];
  bassRoute: RoutedFingerstyleEvent[];
  beatOnePairing: BeatOnePairingReport;
}

export interface PrunedTone {
  note: string;
  role: "fifth";
  reason: string;
}

export interface FingerstyleInnerVoiceMeasure {
  measureIndex: number;
  chord: string;
  prunedTones: PrunedTone[];
  guideTones: RoutedFingerstyleEvent[];
}

export interface FingerstyleFallbackSuggestion {
  measureIndex: number;
  chord: string;
  reason: string;
  suggestedKeys: string[];
}

export interface FingerstyleDownwardCompression {
  outerVoiceMap: FingerstyleOuterVoiceMeasure[];
  innerVoiceReduction: FingerstyleInnerVoiceMeasure[];
  fallbackSuggestions: FingerstyleFallbackSuggestion[];
  validation: {
    melodyRoutedToTrebleStrings: boolean;
    bassRoutedToBassStrings: boolean;
    beatOnePairingsPlayable: boolean;
    guideTonesPlacedOnWeakBeats: boolean;
  };
}

const MAX_FRET_STRETCH = 5;
const TREBLE_STRINGS: GuitarStringNumber[] = [1, 2, 3];
const BASS_STRINGS: GuitarStringNumber[] = [6, 5, 4];
const OPEN_STRING_VALUES: Record<GuitarStringNumber, number> = {
  1: getNoteValue("E"),
  2: getNoteValue("B"),
  3: getNoteValue("G"),
  4: getNoteValue("D"),
  5: getNoteValue("A"),
  6: getNoteValue("E"),
};

function fretFor(note: string, string: GuitarStringNumber): number {
  const noteValue = getNoteValue(normalizeAbcNote(note));
  const openValue = OPEN_STRING_VALUES[string];

  if (noteValue === undefined || openValue === undefined) return 0;
  return (noteValue - openValue + 12) % 12;
}

function isHighRegisterAbcNote(note: string): boolean {
  return /[a-g]/.test(note);
}

function routeToStrings(note: string, strings: GuitarStringNumber[]): GuitarStringPosition {
  const candidates = strings.map((string) => ({
    note: normalizeAbcNote(note),
    string,
    fret: fretFor(note, string),
  }));

  if (isHighRegisterAbcNote(note)) {
    return candidates.find((candidate) => candidate.string === 1) ?? candidates[0];
  }

  return candidates.reduce((best, candidate) => (candidate.fret < best.fret ? candidate : best));
}

function routeBassRoot(chord: ChordInfo): GuitarStringPosition {
  const candidates = BASS_STRINGS.map((string) => ({
    note: chord.notes[0],
    string,
    fret: fretFor(chord.notes[0], string),
  }));

  return candidates.reduce((best, candidate) => (candidate.fret < best.fret ? candidate : best));
}

function buildBeatOnePairing(
  melodyRoute: RoutedFingerstyleEvent[],
  bassRoute: RoutedFingerstyleEvent[]
): BeatOnePairingReport {
  const melody = melodyRoute.find((event) => event.beat === 1) ?? null;
  const bass = bassRoute[0];
  const fretStretch = melody ? Math.abs(melody.fret - bass.fret) : 0;

  return {
    valid: fretStretch <= MAX_FRET_STRETCH,
    melody,
    bass,
    fretStretch,
    maxFretStretch: MAX_FRET_STRETCH,
  };
}

function buildFallbackSuggestion(
  measureIndex: number,
  chord: string,
  pairing: BeatOnePairingReport
): FingerstyleFallbackSuggestion | null {
  if (pairing.valid) return null;

  return {
    measureIndex,
    chord,
    reason: `Beat 1 melody/bass pairing spans ${pairing.fretStretch} frets; transpose toward open-string bass anchors.`,
    suggestedKeys: ["E", "A", "D"],
  };
}

export function compressFingerstyleArrangement(
  chords: ChordInfo[],
  melodyMeasures: MelodyNoteEvent[][]
): FingerstyleDownwardCompression {
  const outerVoiceMap = chords.map((chord, measureIndex): FingerstyleOuterVoiceMeasure => {
    const melody = melodyMeasures[measureIndex] ?? [];
    const melodyRoute = melody.map((event, eventIndex): RoutedFingerstyleEvent => ({
      ...routeToStrings(event.note, TREBLE_STRINGS),
      beat: eventIndex + 1,
      role: "melody",
    }));
    const bassRoot = routeBassRoot(chord);
    const bassRoute: RoutedFingerstyleEvent[] = [1, 3].map((beat) => ({
      ...bassRoot,
      beat,
      role: "bass",
    }));

    return {
      measureIndex,
      chord: chord.chordName,
      melodyRoute,
      bassRoute,
      beatOnePairing: buildBeatOnePairing(melodyRoute, bassRoute),
    };
  });

  const innerVoiceReduction = chords.map((chord, measureIndex): FingerstyleInnerVoiceMeasure => {
    const third = chord.notes[1];
    const fifth = chord.notes[2];

    return {
      measureIndex,
      chord: chord.chordName,
      prunedTones: [
        {
          note: fifth,
          role: "fifth",
          reason: "Fifths add weight but less harmonic identity than guide tones under fingerstyle bandwidth limits.",
        },
      ],
      guideTones: [
        {
          ...routeToStrings(third, TREBLE_STRINGS),
          beat: 2,
          role: "third",
        },
      ],
    };
  });

  const fallbackSuggestions = outerVoiceMap
    .map((measure) => buildFallbackSuggestion(measure.measureIndex, measure.chord, measure.beatOnePairing))
    .filter((suggestion): suggestion is FingerstyleFallbackSuggestion => suggestion !== null);

  return {
    outerVoiceMap,
    innerVoiceReduction,
    fallbackSuggestions,
    validation: {
      melodyRoutedToTrebleStrings: outerVoiceMap.every((measure) =>
        measure.melodyRoute.every((event) => TREBLE_STRINGS.includes(event.string))
      ),
      bassRoutedToBassStrings: outerVoiceMap.every((measure) =>
        measure.bassRoute.every((event) => BASS_STRINGS.includes(event.string))
      ),
      beatOnePairingsPlayable: fallbackSuggestions.length === 0,
      guideTonesPlacedOnWeakBeats: innerVoiceReduction.every((measure) =>
        measure.guideTones.every((event) => event.beat === 2 || event.beat === 4)
      ),
    },
  };
}
