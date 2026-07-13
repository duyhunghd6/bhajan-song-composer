import type { GuitarStringNumber } from "../fingerstyle-compressor";
import {
  type DPCandidate,
  type DPNoteEvent,
  type SkillLevel,
  SKILL_LEVEL_CONSTRAINTS,
  STANDARD_TUNING_MIDI,
  stringToIndex,
  indexToString,
  midiAt,
} from "./dp-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TREBLE_STRINGS: GuitarStringNumber[] = [1, 2, 3];
const BASS_STRINGS: GuitarStringNumber[] = [6, 5, 4];
const MAX_CANDIDATES = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find all (string, fret) positions where the given MIDI pitch can be played,
 * respecting skill-level max fret and capo.
 */
function findPositions(
  midi: number,
  strings: GuitarStringNumber[],
  maxFret: number,
  capo: number
): { string: GuitarStringNumber; fret: number }[] {
  const results: { string: GuitarStringNumber; fret: number }[] = [];
  for (const s of strings) {
    const idx = stringToIndex(s);
    const openMidi = STANDARD_TUNING_MIDI[idx] + capo;
    const fret = midi - openMidi;
    if (fret >= 0 && fret <= maxFret) {
      results.push({ string: s, fret });
    }
  }
  return results;
}

/**
 * Compute the hand position (center fret) from a fret layout.
 */
function computeHandPosition(shapeFrets: (number | null)[]): number {
  const fretted = shapeFrets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length === 0) return 0;
  return Math.round((Math.min(...fretted) + Math.max(...fretted)) / 2);
}

/**
 * Check whether a shape requires a barre (same fret on 2+ strings, at the lowest fretted position).
 */
function detectBarre(shapeFrets: (number | null)[]): number | null {
  const fretted = shapeFrets
    .map((f, i) => f !== null && f > 0 ? { fret: f, idx: i } : null)
    .filter((x): x is { fret: number; idx: number } => x !== null);

  if (fretted.length < 2) return null;

  const minFret = Math.min(...fretted.map(f => f.fret));
  const atMin = fretted.filter(f => f.fret === minFret);
  return atMin.length >= 2 ? minFret : null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate all feasible hand-shape candidates for a single DP note event.
 *
 * For each (melodyString, melodyFret) × (bassString, bassFret) combination,
 * builds a full 6-string shape layout, checks the fret span constraint,
 * filters by skill level, and returns up to MAX_CANDIDATES sorted by
 * ascending hand position (open-position preference).
 */
export function generateCandidates(
  event: DPNoteEvent,
  skillLevel: SkillLevel,
  capo: number = 0
): DPCandidate[] {
  const constraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];

  // Rest events produce a single "no-op" candidate
  if (event.isRest) {
    return [{
      melodyString: null,
      melodyFret: 0,
      bassString: null,
      bassFret: 0,
      melodyTechnique: "free-stroke",
      shapeFrets: [null, null, null, null, null, null],
      handPosition: 0,
      usesBarre: false,
    }];
  }

  // Find all positions for melody and bass
  const melodyPositions = event.melodyMidi !== null
    ? findPositions(event.melodyMidi, [...TREBLE_STRINGS, ...BASS_STRINGS], constraints.maxFret, capo)
    : [null];

  const bassPositions = event.bassMidi !== null
    ? findPositions(event.bassMidi, [...BASS_STRINGS, ...TREBLE_STRINGS], constraints.maxFret, capo)
    : [null];

  const candidates: DPCandidate[] = [];

  for (const melPos of melodyPositions) {
    for (const bassPos of bassPositions) {
      // Skip if melody and bass collide on the same string
      if (melPos && bassPos && melPos.string === bassPos.string) continue;

      // Build the shape frets array (index 0 = string 6)
      const shapeFrets: (number | null)[] = [null, null, null, null, null, null];

      if (melPos) {
        shapeFrets[stringToIndex(melPos.string)] = melPos.fret;
      }
      if (bassPos) {
        shapeFrets[stringToIndex(bassPos.string)] = bassPos.fret;
      }

      // Check fret span of all fretted notes (excluding open strings)
      const frettedNonZero = shapeFrets.filter((f): f is number => f !== null && f > 0);
      if (frettedNonZero.length >= 2) {
        const span = Math.max(...frettedNonZero) - Math.min(...frettedNonZero);
        if (span > constraints.maxFretSpan) continue;
      }

      const handPosition = computeHandPosition(shapeFrets);
      const barreFret = detectBarre(shapeFrets);
      const usesBarre = barreFret !== null;

      // Skip barres for beginner
      if (usesBarre && !constraints.allowBarre) continue;

      candidates.push({
        melodyString: melPos?.string ?? null,
        melodyFret: melPos?.fret ?? 0,
        bassString: bassPos?.string ?? null,
        bassFret: bassPos?.fret ?? 0,
        melodyTechnique: "free-stroke",  // default; DP cost function upgrades to legato when beneficial
        shapeFrets,
        handPosition,
        usesBarre,
      });
    }
  }

  // Sort by ascending hand position (prefer open/low positions)
  candidates.sort((a, b) => a.handPosition - b.handPosition);

  // Cap the number of candidates to keep the DP tractable
  return candidates.slice(0, MAX_CANDIDATES);
}

/**
 * Convenience: generate candidates for all events in a sequence.
 */
export function generateAllCandidates(
  events: DPNoteEvent[],
  skillLevel: SkillLevel,
  capo: number = 0
): DPCandidate[][] {
  return events.map(event => generateCandidates(event, skillLevel, capo));
}
