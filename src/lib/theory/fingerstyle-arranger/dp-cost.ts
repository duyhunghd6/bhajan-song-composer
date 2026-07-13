import type { GuitarStringNumber } from "../fingerstyle-compressor";
import {
  type DPCandidate,
  type DPHandState,
  type DPNoteEvent,
  type FingerstyleTechnique,
  type SkillLevel,
  SKILL_LEVEL_CONSTRAINTS,
  stringToIndex,
} from "./dp-types";

// ---------------------------------------------------------------------------
// Guide Finger & Legato Detection
// ---------------------------------------------------------------------------

/**
 * Detect whether two shapes share a "guide finger" — a string where the
 * same fret is held in both shapes, providing a physical pivot for the
 * left hand during the transition.
 */
export function detectGuideFinger(
  fromFrets: (number | null)[],
  toFrets: (number | null)[]
): boolean {
  for (let i = 0; i < 6; i++) {
    const f = fromFrets[i];
    const t = toFrets[i];
    if (f !== null && t !== null && f > 0 && f === t) {
      return true;
    }
  }
  return false;
}

/**
 * Detect whether two shapes share a "slide guide" — the same string
 * is fretted in both shapes but at different frets, allowing a slide
 * to reposition the hand.
 */
export function detectSlideGuide(
  fromFrets: (number | null)[],
  toFrets: (number | null)[]
): { stringIndex: number; fromFret: number; toFret: number } | null {
  for (let i = 0; i < 6; i++) {
    const f = fromFrets[i];
    const t = toFrets[i];
    if (f !== null && t !== null && f > 0 && t > 0 && f !== t) {
      return { stringIndex: i, fromFret: f, toFret: t };
    }
  }
  return null;
}

/**
 * Detect a hammer-on opportunity: the melody moves upward on the same string.
 */
export function detectHammerOn(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  melodyStringIndex: number | null
): boolean {
  if (melodyStringIndex === null) return false;
  const fromFret = fromState.frets[melodyStringIndex];
  const toFret = toCandidate.shapeFrets[melodyStringIndex];
  if (fromFret === null || toFret === null) return false;
  return toFret > fromFret && toFret - fromFret <= 4;
}

/**
 * Detect a pull-off opportunity: the melody moves downward on the same string
 * and the lower fret is already fretted or open.
 */
export function detectPullOff(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  melodyStringIndex: number | null
): boolean {
  if (melodyStringIndex === null) return false;
  const fromFret = fromState.frets[melodyStringIndex];
  const toFret = toCandidate.shapeFrets[melodyStringIndex];
  if (fromFret === null || toFret === null) return false;
  return toFret < fromFret;
}

/**
 * Determine the best technique for a transition, upgrading from free-stroke
 * to a legato technique when physically possible.
 */
export function detectBestTechnique(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  event: DPNoteEvent,
  skillLevel: SkillLevel
): FingerstyleTechnique {
  const constraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];
  const melodyStringIndex = toCandidate.melodyString !== null
    ? stringToIndex(toCandidate.melodyString)
    : null;

  // Check hammer-on
  if (
    !constraints.forbiddenTechniques.includes("hammer-on") &&
    detectHammerOn(fromState, toCandidate, melodyStringIndex)
  ) {
    return "hammer-on";
  }

  // Check pull-off
  if (
    !constraints.forbiddenTechniques.includes("pull-off") &&
    detectPullOff(fromState, toCandidate, melodyStringIndex)
  ) {
    return "pull-off";
  }

  // Check slide opportunity
  const slide = detectSlideGuide(fromState.frets, toCandidate.shapeFrets);
  if (slide && !constraints.forbiddenTechniques.includes("slide-shift")) {
    return "slide-shift";
  }

  return "free-stroke";
}

// ---------------------------------------------------------------------------
// Cost Components
// ---------------------------------------------------------------------------

/** Seconds per time-slice step at the given BPM (assumes 16 steps/measure in 4/4). */
function stepDurationSeconds(bpm: number): number {
  return 60 / bpm / 4; // 4 steps per beat, each beat = 60/bpm seconds
}

/**
 * Cost of physically moving the hand from one position to another.
 *
 * IMPORTANT: This function must NEVER return Infinity. A hard Infinity wall
 * poisons the entire Viterbi trellis downstream — once any transition costs
 * Infinity, all subsequent events inherit Infinity and the optimizer's path
 * becomes meaningless. Instead, we return steep but finite penalties so the
 * optimizer can always find the "least painful" path.
 */
export function positionMovementCost(
  fromPosition: number,
  toPosition: number,
  durationSteps: number,
  bpm: number,
  skillLevel: SkillLevel
): number {
  const distance = Math.abs(toPosition - fromPosition);
  if (distance === 0) return 0;

  const constraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];
  const availableTime = durationSteps * stepDurationSeconds(bpm);

  // Jump time: minimum time to lift hand, move, and settle
  const jumpTime = 0.05 + distance * 0.02;
  if (jumpTime > availableTime) {
    // Physically impossible to move in time — very steep penalty
    // but NOT Infinity, so the trellis can still find a least-bad path
    const excess = jumpTime - availableTime;
    return 50 + distance * 10 + excess * 200;
  }

  // Penalize exceeding per-beat jump limits (skill-gated)
  const beatsAvailable = durationSteps / 4;
  const jumpPerBeat = distance / Math.max(beatsAvailable, 0.25);
  if (jumpPerBeat > constraints.maxHandJumpPerBeat) {
    // Difficult but not physically impossible — steep graduated penalty
    const excess = jumpPerBeat - constraints.maxHandJumpPerBeat;
    return 10 + distance * 2 + excess * excess * 3;
  }

  return 1.5 + distance * 0.4;
}

/**
 * Cost of changing the chord shape. Detects guide fingers and slides.
 */
export function shapeChangeCost(
  fromFrets: (number | null)[],
  toFrets: (number | null)[]
): number {
  // Identical shapes → free
  const same = fromFrets.every((f, i) => f === toFrets[i]);
  if (same) return 0;

  // Guide finger (same string, same fret stays planted) → cheap
  if (detectGuideFinger(fromFrets, toFrets)) return 0.3;

  // Slide guide (same string, different fret) → moderate
  if (detectSlideGuide(fromFrets, toFrets)) return 0.5;

  // Full shape change → expensive
  return 1.5;
}

/**
 * Penalty for releasing strings that are supposed to still be ringing.
 */
export function sustainViolationCost(
  fromState: DPHandState,
  toFrets: (number | null)[],
  currentStep: number
): number {
  let cost = 0;
  for (let i = 0; i < 6; i++) {
    const ringUntil = fromState.ringingUntil[i];
    if (ringUntil !== null && ringUntil > currentStep) {
      // This string should still be ringing
      if (fromState.frets[i] !== toFrets[i]) {
        cost += 3.0; // Heavy penalty for audible sustain interruption
      }
    }
  }
  return cost;
}

/**
 * Cost associated with the technique used to produce the note.
 */
export function techniqueCost(
  technique: FingerstyleTechnique,
  usesBarre: boolean,
  consecutiveBarreMeasures: number,
  fromState: DPHandState,
  toCandidate: DPCandidate,
  durationSteps: number,
  bpm: number
): number {
  switch (technique) {
    case "hammer-on":
      return 0.1;
    case "pull-off":
      return 0.15;
    case "slide-shift": {
      const slide = detectSlideGuide(fromState.frets, toCandidate.shapeFrets);
      if (!slide) return 0.3;
      const distance = Math.abs(slide.toFret - slide.fromFret);
      const availableTime = durationSteps * stepDurationSeconds(bpm);
      return 0.3 * distance / Math.max(availableTime, 0.1);
    }
    case "slide-guide":
      return 0.2;
    case "vibrato":
      return 0.0;
    case "natural-harmonic":
      return 0.2;
    case "barre":
    case "partial-barre":
      return 2.0 + 0.3 * consecutiveBarreMeasures;
    case "guide-finger-pivot":
      return 0.0;
    case "rest-stroke":
      return 0.0; // Adjacent-string muting handled by sustainViolationCost
    case "free-stroke":
      return 0.0;
    case "palm-mute":
      return 0.5;
    case "bend":
      return 0.5;
    case "grace-note":
      return 0.1;
    default:
      return 0.0;
  }
}

/**
 * Skill-level cost multiplier. Makes forbidden/difficult techniques
 * prohibitively expensive at lower skill levels.
 */
export function skillMultiplier(
  candidate: DPCandidate,
  technique: FingerstyleTechnique,
  skillLevel: SkillLevel
): number {
  const constraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];

  // Forbidden technique → impossible
  if (constraints.forbiddenTechniques.includes(technique)) return Infinity;

  let multiplier = 1.0;

  // High fret penalty for lower skill levels
  const maxFretUsed = Math.max(
    0,
    ...candidate.shapeFrets.filter((f): f is number => f !== null)
  );
  if (maxFretUsed > constraints.maxFret) return Infinity;

  if (skillLevel === "beginner") {
    if (candidate.usesBarre) multiplier *= 5.0;
    if (maxFretUsed > 3) multiplier *= 1.5;
  } else if (skillLevel === "intermediate") {
    if (maxFretUsed > 7) multiplier *= 1.5;
  }

  return multiplier;
}

// ---------------------------------------------------------------------------
// Total Transition Cost
// ---------------------------------------------------------------------------

/**
 * Compute the total cost of transitioning from `fromState` to `toCandidate`
 * for the given event and skill level.
 */
export function transitionCost(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  event: DPNoteEvent,
  skillLevel: SkillLevel
): number {
  // 1. Detect the best legato technique
  const technique = detectBestTechnique(fromState, toCandidate, event, skillLevel);

  // 2. Skill filter — if impossible, return Infinity early
  const sMul = skillMultiplier(toCandidate, technique, skillLevel);
  if (!isFinite(sMul)) return Infinity;

  // 3. Position movement
  const posCost = positionMovementCost(
    fromState.handPosition,
    toCandidate.handPosition,
    event.durationSteps,
    event.bpm,
    skillLevel
  );
  if (!isFinite(posCost)) return Infinity;

  // 4. Shape change
  const shapeCost = shapeChangeCost(fromState.frets, toCandidate.shapeFrets);

  // 5. Sustain violation
  const sustainCost = sustainViolationCost(fromState, toCandidate.shapeFrets, event.index);

  // 6. Technique cost
  const techCost = techniqueCost(
    technique,
    toCandidate.usesBarre,
    fromState.consecutiveBarreMeasures,
    fromState,
    toCandidate,
    event.durationSteps,
    event.bpm
  );

  // Barre penalty for lower skill levels
  const barrePenalty = toCandidate.usesBarre ? (2.0 + 0.3 * fromState.consecutiveBarreMeasures) : 0;

  const baseCost = posCost + shapeCost + sustainCost + techCost + barrePenalty;
  return baseCost * sMul;
}

/**
 * Build a new DPHandState after applying a candidate at a given event.
 */
export function applyCandidate(
  _fromState: DPHandState,
  candidate: DPCandidate,
  event: DPNoteEvent
): DPHandState {
  const ringingUntil: (number | null)[] = [null, null, null, null, null, null];

  // Melody note rings for its duration
  if (candidate.melodyString !== null) {
    const idx = stringToIndex(candidate.melodyString);
    ringingUntil[idx] = event.index + event.durationSteps;
  }

  // Bass note rings for its duration
  if (candidate.bassString !== null) {
    const idx = stringToIndex(candidate.bassString);
    ringingUntil[idx] = event.index + event.durationSteps;
  }

  return {
    handPosition: candidate.handPosition,
    frets: [...candidate.shapeFrets],
    ringingUntil,
    barreFret: candidate.usesBarre ? (detectBarreFret(candidate.shapeFrets) ?? null) : null,
    consecutiveBarreMeasures: candidate.usesBarre
      ? _fromState.consecutiveBarreMeasures + 1
      : 0,
  };
}

/** Extract the barre fret from a shape layout. */
function detectBarreFret(shapeFrets: (number | null)[]): number | null {
  const fretted = shapeFrets.filter((f): f is number => f !== null && f > 0);
  if (fretted.length < 2) return null;
  const minFret = Math.min(...fretted);
  const atMin = fretted.filter(f => f === minFret);
  return atMin.length >= 2 ? minFret : null;
}
