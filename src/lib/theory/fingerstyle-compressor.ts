import { MelodyNoteEvent } from "./arranger-utils";
import { ChordInfo } from "./chords";
import { frettingFingerForFret, isFretPlayable, MAX_FRET_STRETCH, FrettingFinger } from "./guitar-playability";
import { normalizeAbcNote } from "./melody-analyzer";
import {
  FingerstylePickingProfile,
  FingerstylePickingProfileId,
  FingerstylePhysicalTechnique,
  PickingFinger,
  pickingProfileFor,
  strictPimaFingerForString,
} from "./picking-profiles";
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

export type FingerstylePhysicalRole = RoutedFingerstyleEvent["role"] | "fifth" | "fill" | "percussion";

export interface FingerstylePhysicalHandEvent {
  note: string | null;
  string: GuitarStringNumber | null;
  fret: number;
  beat: number;
  role: FingerstylePhysicalRole;
  pickingFinger: PickingFinger;
  frettingFinger: FrettingFinger | null;
  technique: FingerstylePhysicalTechnique;
}

export interface FingerstylePhysicalHandMeasure {
  measureIndex: number;
  chord: string;
  profile: FingerstylePickingProfile;
  events: FingerstylePhysicalHandEvent[];
  validation: {
    frettingPlayable: boolean;
    pickingPlayable: boolean;
    strictPima: boolean;
  };
}

export interface FingerstyleCompressionOptions {
  pickingProfile?: FingerstylePickingProfileId;
  workflowOptionData?: Record<string, unknown>;
}

export interface FingerstyleDownwardCompression {
  outerVoiceMap: FingerstyleOuterVoiceMeasure[];
  innerVoiceReduction: FingerstyleInnerVoiceMeasure[];
  physicalHandMapping: FingerstylePhysicalHandMeasure[];
  fallbackSuggestions: FingerstyleFallbackSuggestion[];
  validation: {
    melodyRoutedToTrebleStrings: boolean;
    bassRoutedToBassStrings: boolean;
    beatOnePairingsPlayable: boolean;
    guideTonesPlacedOnWeakBeats: boolean;
    frettingAssignmentsPlayable: boolean;
    pickingAssignmentsPlayable: boolean;
    strictPimaPicking: boolean;
    thumbClockContinuous: boolean;
    stringSlapsOnBackbeat: boolean;
  };
}

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

function physicalEvent(
  event: RoutedFingerstyleEvent,
  technique: FingerstylePhysicalTechnique,
  pickingFinger = strictPimaFingerForString(event.string),
  beat = event.beat
): FingerstylePhysicalHandEvent {
  return {
    note: event.note,
    string: event.string,
    fret: event.fret,
    beat,
    role: event.role,
    pickingFinger,
    frettingFinger: frettingFingerForFret(event.fret),
    technique,
  };
}

function stringSlapEvent(beat: number): FingerstylePhysicalHandEvent {
  return {
    note: null,
    string: 6,
    fret: 0,
    beat,
    role: "percussion",
    pickingFinger: "p",
    frettingFinger: null,
    technique: "string-slap",
  };
}

function isStrictPimaEvent(event: FingerstylePhysicalHandEvent): boolean {
  return event.string === null || event.pickingFinger === strictPimaFingerForString(event.string);
}

function buildStrictPimaEvents(
  outerMeasure: FingerstyleOuterVoiceMeasure,
  innerMeasure: FingerstyleInnerVoiceMeasure | undefined
): FingerstylePhysicalHandEvent[] {
  return [
    ...outerMeasure.bassRoute.map((event) => physicalEvent(event, "thumb-clock")),
    ...outerMeasure.melodyRoute.map((event) =>
      physicalEvent(event, event.beat === 1 && outerMeasure.bassRoute.some((bass) => bass.beat === event.beat) ? "pinch" : "guide-tone")
    ),
    ...(innerMeasure?.guideTones ?? []).map((event) => physicalEvent(event, "guide-tone")),
  ];
}

function buildFolkTravisEvents(outerMeasure: FingerstyleOuterVoiceMeasure): FingerstylePhysicalHandEvent[] {
  const bassAnchor = outerMeasure.bassRoute[0];
  const thumbClock = [1, 2, 3, 4].map((beat) => physicalEvent(bassAnchor, "thumb-clock", "p", beat));
  const syncopatedMelody = outerMeasure.melodyRoute.map((event, index) =>
    physicalEvent(event, event.beat === 1 ? "pinch" : "syncopation", index % 2 === 0 ? "i" : "m", event.beat)
  );

  return [...thumbClock, stringSlapEvent(2), stringSlapEvent(4), ...syncopatedMelody];
}

function melodyBeatPositions(melody: MelodyNoteEvent[]): number[] {
  let elapsedUnits = 0;
  return melody.map((event) => {
    const beat = elapsedUnits / 2 + 1;
    elapsedUnits += event.duration;
    return beat;
  });
}

function sortPhysicalEvents(events: FingerstylePhysicalHandEvent[]): FingerstylePhysicalHandEvent[] {
  return events.sort((left, right) => left.beat - right.beat || (left.string ?? 9) - (right.string ?? 9));
}

function buildPhysicalHandMapping(
  outerVoiceMap: FingerstyleOuterVoiceMeasure[],
  innerVoiceReduction: FingerstyleInnerVoiceMeasure[],
  profileId: FingerstylePickingProfileId
): FingerstylePhysicalHandMeasure[] {
  const profile = pickingProfileFor(profileId);

  return outerVoiceMap.map((outerMeasure) => {
    const innerMeasure = innerVoiceReduction[outerMeasure.measureIndex];
    const events = sortPhysicalEvents(
      profileId === "folk-travis" ? buildFolkTravisEvents(outerMeasure) : buildStrictPimaEvents(outerMeasure, innerMeasure)
    );

    return {
      measureIndex: outerMeasure.measureIndex,
      chord: outerMeasure.chord,
      profile,
      events,
      validation: {
        frettingPlayable: events.every((event) => isFretPlayable(event.fret)),
        pickingPlayable: profileId === "folk-travis" || events.every((event) => isStrictPimaEvent(event)),
        strictPima: profileId === "strict-pima" && events.every((event) => isStrictPimaEvent(event)),
      },
    };
  });
}

export function compressFingerstyleArrangement(
  chords: ChordInfo[],
  melodyMeasures: MelodyNoteEvent[][],
  options: FingerstyleCompressionOptions = {}
): FingerstyleDownwardCompression {
  const pickingProfile = options.pickingProfile ?? "strict-pima";
  const outerVoiceMap = chords.map((chord, measureIndex): FingerstyleOuterVoiceMeasure => {
    const melody = melodyMeasures[measureIndex] ?? [];
    const melodyBeats = melodyBeatPositions(melody);
    const melodyRoute = melody.map((event, eventIndex): RoutedFingerstyleEvent => ({
      ...routeToStrings(event.note, TREBLE_STRINGS),
      beat: melodyBeats[eventIndex] ?? eventIndex + 1,
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
  const physicalHandMapping = buildPhysicalHandMapping(outerVoiceMap, innerVoiceReduction, pickingProfile);

  return {
    outerVoiceMap,
    innerVoiceReduction,
    physicalHandMapping,
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
      frettingAssignmentsPlayable: physicalHandMapping.every((measure) => measure.validation.frettingPlayable),
      pickingAssignmentsPlayable: physicalHandMapping.every((measure) => measure.validation.pickingPlayable),
      strictPimaPicking: physicalHandMapping.every((measure) => measure.validation.strictPima),
      thumbClockContinuous: physicalHandMapping.every((measure) =>
        [1, 2, 3, 4].every((beat) =>
          measure.events.some((event) => event.beat === beat && event.technique === "thumb-clock")
        )
      ),
      stringSlapsOnBackbeat: pickingProfile === "strict-pima" || physicalHandMapping.every((measure) =>
        [2, 4].every((beat) =>
          measure.events.some((event) => event.beat === beat && event.technique === "string-slap")
        )
      ),
    },
  };
}
