import type { TransitionCostBreakdown } from "./dp-diagnostics";
import {
  type DPCandidate,
  type DPHandState,
  type DPNoteEvent,
  type FingerstyleTechnique,
  type SkillLevel,
  SKILL_LEVEL_CONSTRAINTS,
  stringToIndex,
} from "./dp-types";

export const DP_COST_CONSTANTS = {
  jumpBaseSeconds: 0.05,
  jumpSecondsPerFret: 0.02,
  insufficientTimeBase: 50,
  insufficientTimePerFret: 10,
  insufficientTimePerExcessSecond: 200,
  overJumpLimitBase: 10,
  overJumpLimitPerFret: 2,
  overJumpLimitExcessSquared: 3,
  normalMovementBase: 1.5,
  normalMovementPerFret: 0.4,
  identicalShape: 0,
  guideFingerShape: 0.3,
  slideGuideShape: 0.5,
  fullShapeChange: 1.5,
  sustainInterruptionPerString: 1,
  sameRoleStringChange: 4,
  barreBase: 2,
  barrePerConsecutiveMeasure: 0.3,
  frettedPlacement: 0.4,
  beginnerBarreMultiplier: 5,
  lowerSkillHighFretMultiplier: 1.5,
} as const;

export function detectGuideFinger(fromFrets: (number | null)[], toFrets: (number | null)[]): boolean {
  for (let index = 0; index < 6; index++) {
    const from = fromFrets[index];
    const to = toFrets[index];
    if (from !== null && to !== null && from > 0 && from === to) return true;
  }
  return false;
}

export function detectSlideGuide(
  fromFrets: (number | null)[],
  toFrets: (number | null)[]
): { stringIndex: number; fromFret: number; toFret: number } | null {
  for (let index = 0; index < 6; index++) {
    const from = fromFrets[index];
    const to = toFrets[index];
    if (from !== null && to !== null && from > 0 && to > 0 && from !== to) {
      return { stringIndex: index, fromFret: from, toFret: to };
    }
  }
  return null;
}

export function detectHammerOn(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  melodyStringIndex: number | null
): boolean {
  if (melodyStringIndex === null) return false;
  const fromFret = fromState.frets[melodyStringIndex];
  const toFret = toCandidate.shapeFrets[melodyStringIndex];
  return fromFret !== null && toFret !== null && toFret > fromFret && toFret - fromFret <= 4;
}

export function detectPullOff(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  melodyStringIndex: number | null
): boolean {
  if (melodyStringIndex === null) return false;
  const fromFret = fromState.frets[melodyStringIndex];
  const toFret = toCandidate.shapeFrets[melodyStringIndex];
  return fromFret !== null && toFret !== null && toFret < fromFret;
}

export function detectBestTechnique(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  _event: DPNoteEvent,
  skillLevel: SkillLevel
): FingerstyleTechnique {
  const constraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];
  const melodyStringIndex = toCandidate.melodyString !== null
    ? stringToIndex(toCandidate.melodyString)
    : null;
  if (!constraints.forbiddenTechniques.includes("hammer-on") && detectHammerOn(fromState, toCandidate, melodyStringIndex)) {
    return "hammer-on";
  }
  if (!constraints.forbiddenTechniques.includes("pull-off") && detectPullOff(fromState, toCandidate, melodyStringIndex)) {
    return "pull-off";
  }
  if (detectSlideGuide(fromState.frets, toCandidate.shapeFrets)
    && !constraints.forbiddenTechniques.includes("slide-shift")) {
    return "slide-shift";
  }
  return "free-stroke";
}

export function dpStepDurationSeconds(bpm: number): number {
  return 60 / bpm / 4;
}

function movementDetails(
  fromPosition: number,
  toPosition: number,
  movementSteps: number,
  bpm: number,
  skillLevel: SkillLevel
): TransitionCostBreakdown["movement"] {
  const distance = Math.abs(toPosition - fromPosition);
  const availableSeconds = movementSteps * dpStepDurationSeconds(bpm);
  const estimatedJumpSeconds = DP_COST_CONSTANTS.jumpBaseSeconds
    + distance * DP_COST_CONSTANTS.jumpSecondsPerFret;
  const beatsAvailable = movementSteps / 4;
  const jumpPerBeat = distance / Math.max(beatsAvailable, 0.25);
  const jumpPerBeatLimit = SKILL_LEVEL_CONSTRAINTS[skillLevel].maxHandJumpPerBeat;
  let classification: TransitionCostBreakdown["movement"]["classification"];
  let cost: number;

  if (distance === 0) {
    classification = "stationary";
    cost = 0;
  } else if (estimatedJumpSeconds > availableSeconds) {
    classification = "insufficient-time";
    const excess = estimatedJumpSeconds - availableSeconds;
    cost = DP_COST_CONSTANTS.insufficientTimeBase
      + distance * DP_COST_CONSTANTS.insufficientTimePerFret
      + excess * DP_COST_CONSTANTS.insufficientTimePerExcessSecond;
  } else if (jumpPerBeat > jumpPerBeatLimit) {
    classification = "over-skill-limit";
    const excess = jumpPerBeat - jumpPerBeatLimit;
    cost = DP_COST_CONSTANTS.overJumpLimitBase
      + distance * DP_COST_CONSTANTS.overJumpLimitPerFret
      + excess * excess * DP_COST_CONSTANTS.overJumpLimitExcessSquared;
  } else {
    classification = "normal";
    cost = DP_COST_CONSTANTS.normalMovementBase + distance * DP_COST_CONSTANTS.normalMovementPerFret;
  }

  return {
    fromPosition,
    toPosition,
    distance,
    movementSteps,
    availableSeconds,
    estimatedJumpSeconds,
    beatsAvailable,
    jumpPerBeat,
    jumpPerBeatLimit,
    classification,
    cost,
  };
}

export function positionMovementCost(
  fromPosition: number,
  toPosition: number,
  durationSteps: number,
  bpm: number,
  skillLevel: SkillLevel
): number {
  return movementDetails(fromPosition, toPosition, durationSteps, bpm, skillLevel).cost;
}

function shapeDetails(
  fromFrets: (number | null)[],
  toFrets: (number | null)[]
): TransitionCostBreakdown["shape"] {
  const identical = fromFrets.every((fret, index) => fret === toFrets[index]);
  const guideFinger = !identical && detectGuideFinger(fromFrets, toFrets);
  const slideGuide = !identical && !guideFinger ? detectSlideGuide(fromFrets, toFrets) : null;
  const classification = identical
    ? "identical"
    : guideFinger
      ? "guide-finger"
      : slideGuide
        ? "slide-guide"
        : "full-change";
  const cost = classification === "identical"
    ? DP_COST_CONSTANTS.identicalShape
    : classification === "guide-finger"
      ? DP_COST_CONSTANTS.guideFingerShape
      : classification === "slide-guide"
        ? DP_COST_CONSTANTS.slideGuideShape
        : DP_COST_CONSTANTS.fullShapeChange;
  return { classification, guideFinger, slideGuide, cost };
}

export function shapeChangeCost(fromFrets: (number | null)[], toFrets: (number | null)[]): number {
  return shapeDetails(fromFrets, toFrets).cost;
}

function sustainDetails(
  fromState: DPHandState,
  toFrets: (number | null)[],
  currentStep: number
): TransitionCostBreakdown["sustain"] {
  const interruptedStringIndexes: number[] = [];
  for (let index = 0; index < 6; index++) {
    const ringUntil = fromState.ringingUntil[index];
    if (ringUntil !== null && ringUntil > currentStep && fromState.frets[index] !== toFrets[index]) {
      interruptedStringIndexes.push(index);
    }
  }
  return {
    currentStep,
    interruptedStringIndexes,
    costPerString: DP_COST_CONSTANTS.sustainInterruptionPerString,
    cost: interruptedStringIndexes.length * DP_COST_CONSTANTS.sustainInterruptionPerString,
  };
}

export function sustainViolationCost(
  fromState: DPHandState,
  toFrets: (number | null)[],
  currentStep: number
): number {
  return sustainDetails(fromState, toFrets, currentStep).cost;
}

export function techniqueCost(
  technique: FingerstyleTechnique,
  _usesBarre: boolean,
  consecutiveBarreMeasures: number,
  fromState: DPHandState,
  toCandidate: DPCandidate,
  durationSteps: number,
  bpm: number
): number {
  switch (technique) {
    case "hammer-on": return 0.1;
    case "pull-off": return 0.15;
    case "slide-shift": {
      const slide = detectSlideGuide(fromState.frets, toCandidate.shapeFrets);
      if (!slide) return 0.3;
      const distance = Math.abs(slide.toFret - slide.fromFret);
      return 0.3 * distance / Math.max(durationSteps * dpStepDurationSeconds(bpm), 0.1);
    }
    case "slide-guide": return 0.2;
    case "natural-harmonic": return 0.2;
    case "barre":
    case "partial-barre":
      return DP_COST_CONSTANTS.barreBase
        + DP_COST_CONSTANTS.barrePerConsecutiveMeasure * consecutiveBarreMeasures;
    case "palm-mute": return 0.5;
    case "bend": return 0.5;
    case "grace-note": return 0.1;
    default: return 0;
  }
}

function maxFretUsed(candidate: DPCandidate): number {
  return Math.max(0, ...candidate.shapeFrets.filter((fret): fret is number => fret !== null));
}

export function skillMultiplier(
  candidate: DPCandidate,
  technique: FingerstyleTechnique,
  skillLevel: SkillLevel,
  maxMelodyFret?: number,
): number {
  const constraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];
  if (constraints.forbiddenTechniques.includes(technique)) return Infinity;
  const maxFret = maxFretUsed(candidate);
  const melodyStringIndex = candidate.melodyString === null ? null : stringToIndex(candidate.melodyString);
  const nonMelodyMaxFret = Math.max(0, ...candidate.shapeFrets
    .filter((fret, index): fret is number => index !== melodyStringIndex && fret !== null));
  if (nonMelodyMaxFret > constraints.maxFret) return Infinity;
  if (candidate.melodyFret > (maxMelodyFret ?? constraints.maxFret)) return Infinity;
  let multiplier = 1;
  if (skillLevel === "beginner") {
    if (candidate.usesBarre) multiplier *= DP_COST_CONSTANTS.beginnerBarreMultiplier;
    if (maxFret > 3) multiplier *= DP_COST_CONSTANTS.lowerSkillHighFretMultiplier;
  } else if (skillLevel === "intermediate" && maxFret > 7) {
    multiplier *= DP_COST_CONSTANTS.lowerSkillHighFretMultiplier;
  }
  return multiplier;
}

export function placementCost(candidate: DPCandidate): number {
  return (candidate.melodyString !== null && candidate.melodyFret > 0 ? DP_COST_CONSTANTS.frettedPlacement : 0)
    + (candidate.bassString !== null && candidate.bassFret > 0 ? DP_COST_CONSTANTS.frettedPlacement : 0);
}

function continuityDetails(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  event: DPNoteEvent,
): TransitionCostBreakdown["continuity"] {
  const melodyStringChanged = event.melodyMidi !== null
    && fromState.lastMelodyMidi !== null
    && fromState.lastMelodyString !== null
    && toCandidate.melodyString !== null
    && fromState.lastMelodyString !== toCandidate.melodyString;
  const bassStringChanged = event.bassMidi !== null
    && fromState.lastBassMidi !== null
    && fromState.lastBassString !== null
    && toCandidate.bassString !== null
    && fromState.lastBassString !== toCandidate.bassString;
  const cost = (Number(melodyStringChanged) + Number(bassStringChanged))
    * DP_COST_CONSTANTS.sameRoleStringChange;
  return {
    melodyStringChanged,
    bassStringChanged,
    costPerStringChange: DP_COST_CONSTANTS.sameRoleStringChange,
    cost,
  };
}

export interface TransitionCostDetailedOptions {
  recurringShapePenalty?: number;
  preferredShape?: string | null;
  preferredShapeFeasible?: boolean;
  candidateShape?: string;
}

export function transitionCostDetailed(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  event: DPNoteEvent,
  skillLevel: SkillLevel,
  options: TransitionCostDetailedOptions = {}
): TransitionCostBreakdown {
  const technique = detectBestTechnique(fromState, toCandidate, event, skillLevel);
  const movementSteps = event.movementSteps ?? event.durationSteps;
  const movement = movementDetails(
    fromState.handPosition,
    toCandidate.handPosition,
    movementSteps,
    event.bpm,
    skillLevel
  );
  const shape = shapeDetails(fromState.frets, toCandidate.shapeFrets);
  const sustain = sustainDetails(fromState, toCandidate.shapeFrets, event.absoluteOnsetStep ?? event.index);
  const techniqueValue = techniqueCost(
    technique,
    toCandidate.usesBarre,
    fromState.consecutiveBarreMeasures,
    fromState,
    toCandidate,
    movementSteps,
    event.bpm
  );
  const barreCost = toCandidate.usesBarre
    ? DP_COST_CONSTANTS.barreBase
      + DP_COST_CONSTANTS.barrePerConsecutiveMeasure * fromState.consecutiveBarreMeasures
    : 0;
  const placementValue = placementCost(toCandidate);
  const continuity = continuityDetails(fromState, toCandidate, event);
  const multiplier = skillMultiplier(toCandidate, technique, skillLevel, event.maxMelodyFret);
  const maximumFret = maxFretUsed(toCandidate);
  const constraints = SKILL_LEVEL_CONSTRAINTS[skillLevel];
  const candidateShape = options.candidateShape ?? toCandidate.shapeFrets.map(fret => fret ?? "x").join(":");
  const recurringPenalty = options.recurringShapePenalty ?? 0;
  const baseCost = movement.cost + shape.cost + sustain.cost + techniqueValue + barreCost + placementValue + continuity.cost;

  return {
    technique,
    movement,
    shape,
    sustain,
    techniqueCost: techniqueValue,
    barre: {
      usesBarre: toCandidate.usesBarre,
      consecutiveMeasures: fromState.consecutiveBarreMeasures,
      cost: barreCost,
    },
    placement: {
      melodyFretted: toCandidate.melodyString !== null && toCandidate.melodyFret > 0,
      bassFretted: toCandidate.bassString !== null && toCandidate.bassFret > 0,
      costPerFrettedNote: DP_COST_CONSTANTS.frettedPlacement,
      cost: placementValue,
    },
    continuity,
    skill: {
      level: skillLevel,
      allowed: Number.isFinite(multiplier),
      maxFretUsed: maximumFret,
      maxFretAllowed: Math.max(constraints.maxFret, event.maxMelodyFret ?? constraints.maxFret),
      forbiddenTechnique: constraints.forbiddenTechniques.includes(technique),
      multiplier,
    },
    recurringShape: {
      preferredShape: options.preferredShape ?? null,
      candidateShape,
      preferredShapeFeasible: options.preferredShapeFeasible ?? false,
      matchesPreferredShape: options.preferredShape === candidateShape,
      penalty: recurringPenalty,
    },
    baseCost,
    totalCost: Number.isFinite(multiplier) ? baseCost * multiplier + recurringPenalty : Infinity,
  };
}

export function transitionCost(
  fromState: DPHandState,
  toCandidate: DPCandidate,
  event: DPNoteEvent,
  skillLevel: SkillLevel
): number {
  return transitionCostDetailed(fromState, toCandidate, event, skillLevel).totalCost;
}

export function applyCandidate(
  fromState: DPHandState,
  candidate: DPCandidate,
  event: DPNoteEvent
): DPHandState {
  const ringingUntil: (number | null)[] = [null, null, null, null, null, null];
  const onsetStep = event.absoluteOnsetStep ?? event.index;
  if (candidate.melodyString !== null) {
    ringingUntil[stringToIndex(candidate.melodyString)] = onsetStep + event.durationSteps;
  }
  if (candidate.bassString !== null) {
    ringingUntil[stringToIndex(candidate.bassString)] = onsetStep + event.durationSteps;
  }
  return {
    handPosition: candidate.handPosition,
    frets: [...candidate.shapeFrets],
    ringingUntil,
    barreFret: candidate.usesBarre ? detectBarreFret(candidate.shapeFrets) : null,
    consecutiveBarreMeasures: candidate.usesBarre ? fromState.consecutiveBarreMeasures + 1 : 0,
    lastMelodyString: candidate.melodyString,
    lastMelodyMidi: event.melodyMidi,
    lastBassString: candidate.bassString,
    lastBassMidi: event.bassMidi,
  };
}

function detectBarreFret(shapeFrets: (number | null)[]): number | null {
  const fretted = shapeFrets.filter((fret): fret is number => fret !== null && fret > 0);
  if (fretted.length < 2) return null;
  const minFret = Math.min(...fretted);
  return fretted.filter(fret => fret === minFret).length >= 2 ? minFret : null;
}
