import { Chord, Note } from "@tonaljs/tonal";

import type { GuitarStringNumber } from "../../fingerstyle-compressor";
import { parseScientificPitch } from "../../guitar-playability";
import type { TimeSliceGridStep, TimeSliceMeasure } from "../time-slice";
import { enumerateFillCandidates } from "./candidates";
import {
  allowsMelodySustainFill,
  buildFillSelectionBudget,
  normalizeFillPolicy,
} from "./policy";
import { scoreFillOpportunity } from "./scoring";
import {
  FILL_OPPORTUNITY_FORMAT_VERSION,
  type AnalyzeFillOpportunitiesInput,
  type FillAtomicCandidate,
  type FillBoundaryEvidence,
  type FillOpportunityAnalysis,
  type FillOpportunityWindow,
  type FillRejectionReason,
} from "./types";

const REJECTION_REASONS: FillRejectionReason[] = [
  "pickup-padding",
  "melody-attack",
  "protected-melody-sustain",
  "foundation-attack",
  "unsupported-melody-state",
  "no-legal-pitch",
  "protected-melody-string",
  "occupied-string",
  "fret-limit",
  "fret-span",
  "hand-jump",
  "register-collision",
  "unresolved-approach",
  "dominated-placement",
];

function emptyRejectionCounts(): Record<FillRejectionReason, number> {
  return Object.fromEntries(REJECTION_REASONS.map(reason => [reason, 0])) as Record<FillRejectionReason, number>;
}

function activeStepLimit(measure: TimeSliceMeasure): number {
  if (!measure.pickupDurationUnits) return measure.grid.length;
  const lastMelodyIndex = measure.grid.reduce(
    (last, step, index) => step.melody.state === "rest" ? last : index,
    -1,
  );
  return Math.max(0, lastMelodyIndex + 1);
}

function mergeRejectionCounts(
  target: Record<FillRejectionReason, number>,
  source: Partial<Record<FillRejectionReason, number>>,
): void {
  for (const [reason, count] of Object.entries(source)) {
    target[reason as FillRejectionReason] += count ?? 0;
  }
}

function hashId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function handPositionFromStep(step: TimeSliceGridStep | undefined, fallback = 0): number {
  const frets = step?.tablature?.map(tab => tab.fret).filter(fret => fret > 0) ?? [];
  if (frets.length === 0) return fallback;
  return Math.round(frets.reduce((total, fret) => total + fret, 0) / frets.length);
}

function findNearestFoundationStep(
  measures: TimeSliceMeasure[],
  measureIndex: number,
  stepIndex: number,
  direction: -1 | 1,
): { step: TimeSliceGridStep; distance: number } | null {
  let currentMeasure = measureIndex;
  let currentStep = stepIndex + direction;
  let distance = 1;

  while (currentMeasure >= 0 && currentMeasure < measures.length) {
    const grid = measures[currentMeasure].grid;
    while (currentStep >= 0 && currentStep < grid.length) {
      if ((grid[currentStep].tablature?.length ?? 0) > 0) {
        return { step: grid[currentStep], distance };
      }
      currentStep += direction;
      distance++;
    }
    currentMeasure += direction;
    if (currentMeasure < 0 || currentMeasure >= measures.length) break;
    currentStep = direction > 0 ? 0 : measures[currentMeasure].grid.length - 1;
  }

  return null;
}

function findNextMelodyAttack(
  measures: TimeSliceMeasure[],
  measureIndex: number,
  stepIndex: number,
): { step: TimeSliceGridStep; distance: number } | null {
  let distance = 1;
  for (let currentMeasure = measureIndex; currentMeasure < measures.length; currentMeasure++) {
    const start = currentMeasure === measureIndex ? stepIndex + 1 : 0;
    for (let currentStep = start; currentStep < measures[currentMeasure].grid.length; currentStep++) {
      const step = measures[currentMeasure].grid[currentStep];
      if (step.melody.state === "attack" && step.melody.pitch) return { step, distance };
      distance++;
    }
  }
  return null;
}

function findNextChord(
  measures: TimeSliceMeasure[],
  measureIndex: number,
  stepIndex: number,
  nextLineMeasures?: TimeSliceMeasure[],
): string | undefined {
  const nextStepChord = measures[measureIndex]?.grid[stepIndex + 1]?.chord;
  if (nextStepChord) return nextStepChord;

  const nextMeasureChord = measures[measureIndex + 1]?.grid[0]?.chord;
  if (nextMeasureChord) return nextMeasureChord;

  return nextLineMeasures?.find(measure => measure.grid[0]?.chord)?.grid[0]?.chord;
}

function findMelodyCeilingMidi(
  measures: TimeSliceMeasure[],
  measureIndex: number,
  stepIndex: number,
): number | null {
  const currentPitch = measures[measureIndex].grid[stepIndex]?.melody.pitch;
  const currentMidi = currentPitch ? parseScientificPitch(currentPitch)?.midi ?? null : null;
  if (currentMidi !== null) return currentMidi;
  const next = findNextMelodyAttack(measures, measureIndex, stepIndex);
  if (next?.step.melody.pitch) return parseScientificPitch(next.step.melody.pitch)?.midi ?? null;

  for (let currentMeasure = measureIndex; currentMeasure >= 0; currentMeasure--) {
    const start = currentMeasure === measureIndex ? stepIndex - 1 : measures[currentMeasure].grid.length - 1;
    for (let currentStep = start; currentStep >= 0; currentStep--) {
      const pitch = measures[currentMeasure].grid[currentStep].melody.pitch;
      if (pitch) return parseScientificPitch(pitch)?.midi ?? null;
    }
  }
  return null;
}

function keyRoot(key: string): string | null {
  const match = key.trim().match(/^([A-Ga-g](?:#|b)?)/);
  return match ? match[1][0].toUpperCase() + match[1].slice(1) : null;
}

function cadenceHint(chord: string, key: string, lineEnd: boolean): FillBoundaryEvidence["cadenceHint"] {
  if (!lineEnd) return "continuation";
  const tonic = Chord.get(chord).tonic;
  const root = keyRoot(key);
  if (!tonic || !root) return "unknown";
  const tonicChroma = Note.chroma(tonic);
  const rootChroma = Note.chroma(root);
  if (tonicChroma === null || rootChroma === null) return "unknown";
  if (tonicChroma === rootChroma) return "tonic-arrival";
  if ((tonicChroma - rootChroma + 12) % 12 === 7) return "dominant-arrival";
  return "continuation";
}

function lastLyricBefore(measure: TimeSliceMeasure, endIndex: number): string | null {
  for (let index = endIndex; index >= 0; index--) {
    if (measure.grid[index].lyric) return measure.grid[index].lyric;
  }
  return null;
}

function firstNextLineMelodyDistance(nextLineMeasures?: TimeSliceMeasure[]): number | null {
  if (!nextLineMeasures) return null;
  let distance = 1;
  for (const measure of nextLineMeasures) {
    for (const step of measure.grid) {
      if (step.melody.state === "attack" && step.melody.pitch) return distance;
      distance++;
    }
  }
  return null;
}

function protectedStringAtStep(
  measure: TimeSliceMeasure,
  targetStepIndex: number,
): GuitarStringNumber[] {
  let melodyString: GuitarStringNumber | null = null;
  for (let index = 0; index <= targetStepIndex; index++) {
    const step = measure.grid[index];
    if (step.melody.state === "attack") {
      melodyString = step.tablature?.find(tab => tab.role === "melody")?.string ?? melodyString;
    } else if (step.melody.state === "rest") {
      melodyString = null;
    }
  }
  return measure.grid[targetStepIndex]?.melody.state === "sustain" && melodyString !== null
    ? [melodyString]
    : [];
}

interface RawWindow {
  measureIndex: number;
  startIndex: number;
  endIndex: number;
  melodyContext: "rest" | "sustain";
}

function collectRawWindows(
  measures: TimeSliceMeasure[],
  allowMelodySustain: boolean,
  rejectionCounts: Record<FillRejectionReason, number>,
): { windows: RawWindow[]; evaluatedStepCount: number } {
  const windows: RawWindow[] = [];
  let evaluatedStepCount = 0;

  measures.forEach((measure, measureIndex) => {
    const activeLimit = activeStepLimit(measure);
    let current: RawWindow | null = null;

    for (let stepIndex = 0; stepIndex < measure.grid.length; stepIndex++) {
      evaluatedStepCount++;
      const step = measure.grid[stepIndex];
      let rejection: FillRejectionReason | null = null;
      if (stepIndex >= activeLimit) rejection = "pickup-padding";
      else if (step.melody.state === "attack") rejection = "melody-attack";
      else if (step.melody.state === "sustain" && !allowMelodySustain) rejection = "protected-melody-sustain";
      else if ((step.tablature?.length ?? 0) > 0) rejection = "foundation-attack";
      else if (step.melody.state !== "rest" && step.melody.state !== "sustain") rejection = "unsupported-melody-state";

      const context = step.melody.state === "rest" ? "rest" : "sustain";
      const canExtend = current
        && !rejection
        && current.melodyContext === context
        && measure.grid[current.endIndex].chord === step.chord;

      if (rejection) {
        rejectionCounts[rejection]++;
        if (current) windows.push(current);
        current = null;
      } else if (canExtend && current) {
        current.endIndex = stepIndex;
      } else {
        if (current) windows.push(current);
        current = { measureIndex, startIndex: stepIndex, endIndex: stepIndex, melodyContext: context };
      }
    }
    if (current) windows.push(current);
  });

  return { windows, evaluatedStepCount };
}

export function analyzeFillOpportunities(input: AnalyzeFillOpportunitiesInput): FillOpportunityAnalysis {
  const policy = normalizeFillPolicy(input);
  const budget = buildFillSelectionBudget(input.measures, policy);
  const rejectionCounts = emptyRejectionCounts();
  const raw = collectRawWindows(
    input.measures,
    allowsMelodySustainFill(policy),
    rejectionCounts,
  );
  const allCandidates: FillAtomicCandidate[] = [];
  const windows: FillOpportunityWindow[] = [];
  let evaluatedPlacementCount = 0;
  const nextLineDistance = firstNextLineMelodyDistance(input.nextLineMeasures);

  for (const rawWindow of raw.windows) {
    const measure = input.measures[rawWindow.measureIndex];
    const startStep = measure.grid[rawWindow.startIndex];
    const endStep = measure.grid[rawWindow.endIndex];
    const windowId = `w-m${measure.measure}-s${startStep.step}-${endStep.step}`;
    const lineEnd = rawWindow.measureIndex === input.measures.length - 1
      && rawWindow.endIndex === activeStepLimit(measure) - 1;
    const protectedStrings = [...new Set(
      Array.from({ length: rawWindow.endIndex - rawWindow.startIndex + 1 }, (_, offset) => (
        protectedStringAtStep(measure, rawWindow.startIndex + offset)
      )).flat(),
    )];
    const windowCandidates: FillAtomicCandidate[] = [];

    for (let stepIndex = rawWindow.startIndex; stepIndex <= rawWindow.endIndex; stepIndex++) {
      const previous = findNearestFoundationStep(input.measures, rawWindow.measureIndex, stepIndex, -1);
      const next = findNearestFoundationStep(input.measures, rawWindow.measureIndex, stepIndex, 1);
      const previousFallback = input.previousLineMeasures?.at(-1)?.grid.findLast(step => (step.tablature?.length ?? 0) > 0);
      const nextFallback = input.nextLineMeasures?.[0]?.grid.find(step => (step.tablature?.length ?? 0) > 0);
      const previousStep = previous?.step ?? previousFallback;
      const nextStep = next?.step ?? nextFallback;
      const previousPosition = handPositionFromStep(previousStep);
      const nextPosition = handPositionFromStep(nextStep, previousPosition);
      const foundationFrets = previousStep?.tablature?.map(tab => tab.fret).filter(fret => fret > 0) ?? [];
      const result = enumerateFillCandidates({
        windowId,
        measure: measure.measure,
        step: measure.grid[stepIndex],
        endStep: endStep.step,
        key: measure.style_profile.key,
        nextChord: findNextChord(input.measures, rawWindow.measureIndex, stepIndex, input.nextLineMeasures),
        skillLevel: policy.skillLevel,
        protectedStrings: protectedStringAtStep(measure, stepIndex),
        occupiedStrings: measure.grid[stepIndex].tablature?.map(tab => tab.string) ?? [],
        melodyCeilingMidi: findMelodyCeilingMidi(input.measures, rawWindow.measureIndex, stepIndex),
        previousHandPosition: previousPosition,
        nextHandPosition: nextPosition,
        movementStepsFromPrevious: previous?.distance ?? 4,
        movementStepsToNext: next?.distance ?? nextLineDistance ?? 4,
        foundationFrets,
      });
      evaluatedPlacementCount += result.evaluatedPlacementCount;
      mergeRejectionCounts(rejectionCounts, result.rejectionCounts);
      windowCandidates.push(...result.candidates);
    }

    if (windowCandidates.length === 0) {
      rejectionCounts["no-legal-pitch"]++;
      continue;
    }

    const nextMelody = findNextMelodyAttack(input.measures, rawWindow.measureIndex, rawWindow.endIndex);
    const nextMelodyMidi = nextMelody?.step.melody.pitch
      ? parseScientificPitch(nextMelody.step.melody.pitch)?.midi ?? null
      : input.nextLineMeasures
        ? findMelodyCeilingMidi(input.nextLineMeasures, 0, -1)
        : null;
    const lastLyric = lastLyricBefore(measure, rawWindow.endIndex);
    const boundaryEvidence: FillBoundaryEvidence = {
      lineEnd,
      trailingRestSteps: rawWindow.melodyContext === "rest" ? rawWindow.endIndex - rawWindow.startIndex + 1 : 0,
      lyricTerminal: Boolean(lastLyric && lastLyric !== "_" && lastLyric !== "*"),
      repeatBoundary: Boolean(lineEnd && measure.barline?.repeatEnd),
      cadenceHint: cadenceHint(endStep.chord, measure.style_profile.key, lineEnd),
      nextMelodyDistanceSteps: lineEnd ? nextLineDistance : nextMelody?.distance ?? null,
      confidence: lineEnd && (rawWindow.melodyContext === "rest" || measure.barline?.repeatEnd)
        ? "high"
        : lineEnd
          ? "medium"
          : "low",
    };
    const scored = scoreFillOpportunity({
      capacitySteps: rawWindow.endIndex - rawWindow.startIndex + 1,
      melodyContext: rawWindow.melodyContext,
      startWeight: startStep.weight,
      boundaryEvidence,
      candidates: windowCandidates,
      nextMelodyMidi,
      stepsUntilNextMelodyAttack: lineEnd ? nextLineDistance : nextMelody?.distance ?? null,
    });

    const candidateIds = windowCandidates.map(candidate => candidate.id);
    windows.push({
      id: windowId,
      measure: measure.measure,
      lineIndex: measure.lineIndex,
      startStep: startStep.step,
      endStep: endStep.step,
      capacitySteps: rawWindow.endIndex - rawWindow.startIndex + 1,
      activeChord: startStep.chord,
      key: measure.style_profile.key,
      melodyContext: rawWindow.melodyContext,
      protectedStrings,
      boundaryEvidence,
      score: scored.score,
      scoreBreakdown: scored.breakdown,
      candidateIds,
      flags: [
        rawWindow.melodyContext,
        ...(lineEnd ? ["line-end"] : []),
        ...(boundaryEvidence.cadenceHint === "tonic-arrival" ? ["cadence-restraint"] : []),
      ],
    });
    allCandidates.push(...windowCandidates);
  }

  windows.sort((left, right) => right.score - left.score || left.measure - right.measure || left.startStep - right.startStep);
  const candidateRank = new Map(windows.map((window, index) => [window.id, index]));
  allCandidates.sort((left, right) => (
    (candidateRank.get(left.windowId) ?? 0) - (candidateRank.get(right.windowId) ?? 0)
    || left.step - right.step
    || right.score - left.score
    || left.id.localeCompare(right.id)
  ));
  const foundationSignature = input.measures.map(measure => [
    measure.measure,
    measure.lineIndex,
    measure.style_profile.key,
    ...measure.grid.map(step => [
      step.step,
      step.chord,
      step.weight ?? "-",
      step.melody.pitch ?? "-",
      step.melody.state,
      ...(step.tablature ?? []).map(tab => `${tab.string}/${tab.fret}/${tab.role}`),
    ].join(":")),
  ].join(";")).join("|");
  const opportunitySetId = `fos-${hashId([
    input.sourceFingerprint,
    policy.skillLevel,
    policy.densityMode,
    foundationSignature,
  ].join("|"))}`;

  return {
    version: FILL_OPPORTUNITY_FORMAT_VERSION,
    opportunitySetId,
    sourceFingerprint: input.sourceFingerprint,
    policy,
    budget: {
      ...budget,
      targetWindows: Math.min(budget.targetWindows, windows.length),
      maxWindows: Math.min(budget.maxWindows, windows.length),
    },
    evaluatedStepCount: raw.evaluatedStepCount,
    evaluatedPlacementCount,
    rejectionCounts,
    windows,
    candidates: allCandidates,
  };
}
