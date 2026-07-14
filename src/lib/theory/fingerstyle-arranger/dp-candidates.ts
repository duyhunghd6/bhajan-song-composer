import type { GuitarStringNumber } from "../fingerstyle-compressor";
import {
  DP_CANDIDATE_REJECTION_REASONS,
  type DPCandidateRejectionReason,
} from "./dp-diagnostics";
import {
  type DPCandidate,
  type DPNoteEvent,
  type SkillLevel,
  SKILL_LEVEL_CONSTRAINTS,
  STANDARD_TUNING_MIDI,
  stringToIndex,
  midiAt,
} from "./dp-types";

const TREBLE_STRINGS: GuitarStringNumber[] = [1, 2, 3];
const BASS_STRINGS: GuitarStringNumber[] = [6, 5, 4];
export const DP_CANDIDATE_LIMIT = 20;
export const DP_CANDIDATE_SORT_KEYS = [
  "pressed-note-count",
  "hand-position",
  "melody-string",
  "bass-string",
] as const;

export interface DPPitchPosition {
  string: GuitarStringNumber;
  fret: number;
}

export interface DPCandidateGenerationDetails {
  eventIndex: number;
  capo: number;
  skillLevel: SkillLevel;
  melodyPositionsTested: number;
  melodyPositions: DPPitchPosition[];
  bassPositionsTested: number;
  bassPositions: DPPitchPosition[];
  cartesianCombinationCount: number;
  rejectionCounts: Record<DPCandidateRejectionReason, number>;
  acceptedBeforeCap: number;
  candidateCap: number;
  retainedCount: number;
  prunedByCapCount: number;
  sortKeys: readonly string[];
  retainedCandidates: DPCandidate[];
  prunedCandidates: DPCandidate[];
}

function emptyRejectionCounts(): Record<DPCandidateRejectionReason, number> {
  return Object.fromEntries(
    DP_CANDIDATE_REJECTION_REASONS.map(reason => [reason, 0])
  ) as Record<DPCandidateRejectionReason, number>;
}

function increment(
  counts: Record<DPCandidateRejectionReason, number>,
  reason: DPCandidateRejectionReason
): void {
  counts[reason] += 1;
}

function findPositionsDetailed(
  midi: number,
  strings: GuitarStringNumber[],
  maxFret: number,
  capo: number,
  pitch: "melody" | "bass",
  rejectionCounts: Record<DPCandidateRejectionReason, number>
): { tested: number; positions: DPPitchPosition[] } {
  const positions: DPPitchPosition[] = [];
  for (const string of strings) {
    const stringIndex = stringToIndex(string);
    const openMidi = STANDARD_TUNING_MIDI[stringIndex] + capo;
    const fret = midi - openMidi;
    if (fret < 0) {
      increment(rejectionCounts, `${pitch}-below-open-string`);
    } else if (fret > maxFret) {
      increment(rejectionCounts, `${pitch}-above-max-fret`);
    } else {
      positions.push({ string, fret });
    }
  }
  return { tested: strings.length, positions };
}

function computeHandPosition(shapeFrets: (number | null)[]): number {
  const fretted = shapeFrets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length === 0) return 0;
  return Math.round((Math.min(...fretted) + Math.max(...fretted)) / 2);
}

function detectBarre(shapeFrets: (number | null)[]): number | null {
  const fretted = shapeFrets
    .map((fret, index) => fret !== null && fret > 0 ? { fret, index } : null)
    .filter((value): value is { fret: number; index: number } => value !== null);
  if (fretted.length < 2) return null;
  const minFret = Math.min(...fretted.map(value => value.fret));
  return fretted.filter(value => value.fret === minFret).length >= 2 ? minFret : null;
}

function compareCandidates(a: DPCandidate, b: DPCandidate): number {
  const aPressed = Number(a.melodyFret > 0) + Number(a.bassFret > 0);
  const bPressed = Number(b.melodyFret > 0) + Number(b.bassFret > 0);
  return aPressed - bPressed
    || a.handPosition - b.handPosition
    || (a.melodyString ?? 7) - (b.melodyString ?? 7)
    || (a.bassString ?? 7) - (b.bassString ?? 7);
}

function restCandidate(): DPCandidate {
  return {
    origin: "rest",
    melodyString: null,
    melodyFret: 0,
    bassString: null,
    bassFret: 0,
    melodyTechnique: "free-stroke",
    shapeFrets: [null, null, null, null, null, null],
    handPosition: 0,
    usesBarre: false,
  };
}

/** Generate candidates plus a complete, deterministic account of enumeration and pruning. */
export function generateCandidatesDetailed(
  event: DPNoteEvent,
  skillLevel: SkillLevel,
  capo: number = 0
): DPCandidateGenerationDetails {
  const constraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];
  const rejectionCounts = emptyRejectionCounts();

  if (event.isRest) {
    const retainedCandidates = [restCandidate()];
    return {
      eventIndex: event.index,
      capo,
      skillLevel,
      melodyPositionsTested: 0,
      melodyPositions: [],
      bassPositionsTested: 0,
      bassPositions: [],
      cartesianCombinationCount: 1,
      rejectionCounts,
      acceptedBeforeCap: 1,
      candidateCap: DP_CANDIDATE_LIMIT,
      retainedCount: 1,
      prunedByCapCount: 0,
      sortKeys: DP_CANDIDATE_SORT_KEYS,
      retainedCandidates,
      prunedCandidates: [],
    };
  }

  const allStrings = [...TREBLE_STRINGS, ...BASS_STRINGS];
  const bassFirstStrings = [...BASS_STRINGS, ...TREBLE_STRINGS];
  const melodySearch = event.melodyMidi === null
    ? { tested: 0, positions: [] }
    : findPositionsDetailed(event.melodyMidi, allStrings, constraints.maxFret, capo, "melody", rejectionCounts);
  const bassSearch = event.bassMidi === null
    ? { tested: 0, positions: [] }
    : findPositionsDetailed(event.bassMidi, bassFirstStrings, constraints.maxFret, capo, "bass", rejectionCounts);
  const melodyOptions: (DPPitchPosition | null)[] = event.melodyMidi === null ? [null] : melodySearch.positions;
  const bassOptions: (DPPitchPosition | null)[] = event.bassMidi === null ? [null] : bassSearch.positions;
  const candidates: DPCandidate[] = [];

  for (const melodyPosition of melodyOptions) {
    for (const bassPosition of bassOptions) {
      if (
        melodyPosition
        && event.melodyMidi !== null
        && midiAt(stringToIndex(melodyPosition.string), melodyPosition.fret, capo) !== event.melodyMidi
      ) {
        increment(rejectionCounts, "melody-pitch-verification");
        continue;
      }
      if (
        bassPosition
        && event.bassMidi !== null
        && midiAt(stringToIndex(bassPosition.string), bassPosition.fret, capo) !== event.bassMidi
      ) {
        increment(rejectionCounts, "bass-pitch-verification");
        continue;
      }
      if (melodyPosition && bassPosition && melodyPosition.string === bassPosition.string) {
        increment(rejectionCounts, "melody-bass-string-collision");
        continue;
      }

      const shapeFrets: (number | null)[] = event.fixedFrets
        ? [...event.fixedFrets]
        : [null, null, null, null, null, null];
      const melodyIndex = melodyPosition ? stringToIndex(melodyPosition.string) : null;
      const bassIndex = bassPosition ? stringToIndex(bassPosition.string) : null;
      if (
        (melodyIndex !== null && shapeFrets[melodyIndex] !== null)
        || (bassIndex !== null && shapeFrets[bassIndex] !== null)
      ) {
        increment(rejectionCounts, "fixed-string-collision");
        continue;
      }

      if (melodyPosition && melodyIndex !== null) shapeFrets[melodyIndex] = melodyPosition.fret;
      if (bassPosition && bassIndex !== null) shapeFrets[bassIndex] = bassPosition.fret;

      const fretted = shapeFrets.filter((fret): fret is number => fret !== null && fret > 0);
      if (fretted.length >= 2 && Math.max(...fretted) - Math.min(...fretted) > constraints.maxFretSpan) {
        increment(rejectionCounts, "fret-span-exceeded");
        continue;
      }

      const usesBarre = detectBarre(shapeFrets) !== null;
      if (usesBarre && !constraints.allowBarre) {
        increment(rejectionCounts, "barre-not-allowed");
        continue;
      }

      candidates.push({
        origin: "generated",
        melodyString: melodyPosition?.string ?? null,
        melodyFret: melodyPosition?.fret ?? 0,
        bassString: bassPosition?.string ?? null,
        bassFret: bassPosition?.fret ?? 0,
        melodyTechnique: "free-stroke",
        shapeFrets,
        handPosition: computeHandPosition(shapeFrets),
        usesBarre,
      });
    }
  }

  candidates.sort(compareCandidates);
  const retainedCandidates = candidates.slice(0, DP_CANDIDATE_LIMIT);
  const prunedCandidates = candidates.slice(DP_CANDIDATE_LIMIT);
  return {
    eventIndex: event.index,
    capo,
    skillLevel,
    melodyPositionsTested: melodySearch.tested,
    melodyPositions: melodySearch.positions,
    bassPositionsTested: bassSearch.tested,
    bassPositions: bassSearch.positions,
    cartesianCombinationCount: melodyOptions.length * bassOptions.length,
    rejectionCounts,
    acceptedBeforeCap: candidates.length,
    candidateCap: DP_CANDIDATE_LIMIT,
    retainedCount: retainedCandidates.length,
    prunedByCapCount: prunedCandidates.length,
    sortKeys: DP_CANDIDATE_SORT_KEYS,
    retainedCandidates,
    prunedCandidates,
  };
}

/** Compatibility wrapper retaining the existing candidate-array API. */
export function generateCandidates(
  event: DPNoteEvent,
  skillLevel: SkillLevel,
  capo: number = 0
): DPCandidate[] {
  return generateCandidatesDetailed(event, skillLevel, capo).retainedCandidates;
}

export function generateAllCandidates(
  events: DPNoteEvent[],
  skillLevel: SkillLevel,
  capo: number = 0
): DPCandidate[][] {
  return events.map(event => generateCandidates(event, skillLevel, capo));
}
