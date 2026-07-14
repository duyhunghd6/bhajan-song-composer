import type { TimeSliceGridStep } from "../time-slice";
import type {
  FillAtomicCandidate,
  FillBoundaryEvidence,
  FillOpportunityScoreBreakdown,
} from "./types";

export interface ScoreFillOpportunityInput {
  capacitySteps: number;
  melodyContext: "rest" | "sustain";
  startWeight: TimeSliceGridStep["weight"];
  boundaryEvidence: FillBoundaryEvidence;
  candidates: FillAtomicCandidate[];
  nextMelodyMidi: number | null;
  stepsUntilNextMelodyAttack: number | null;
}

function metricScore(weight: TimeSliceGridStep["weight"]): number {
  if (weight === null) return 10;
  if (weight === "*") return 8;
  if (weight === "●") return 4;
  return 1;
}

function voiceLeadingScore(candidates: FillAtomicCandidate[], nextMelodyMidi: number | null): number {
  if (candidates.length === 0 || nextMelodyMidi === null) return 4;
  const smallestDistance = Math.min(...candidates.map(candidate => Math.abs(candidate.midi - nextMelodyMidi)));
  if (smallestDistance <= 2) return 10;
  if (smallestDistance <= 5) return 7;
  if (smallestDistance <= 9) return 4;
  return 1;
}

export function scoreFillOpportunity(input: ScoreFillOpportunityInput): {
  score: number;
  breakdown: FillOpportunityScoreBreakdown;
} {
  const minimumHandCost = input.candidates.length > 0
    ? Math.min(...input.candidates.map(candidate => candidate.totalHandCost))
    : 12;
  const chordCandidateRatio = input.candidates.length === 0
    ? 0
    : input.candidates.filter(candidate => candidate.harmonicRole !== "scale-approach").length / input.candidates.length;
  const cadenceRestraint = input.boundaryEvidence.cadenceHint === "tonic-arrival"
    ? 15
    : input.boundaryEvidence.repeatBoundary
      ? 8
      : 0;
  const crowdingPenalty = input.stepsUntilNextMelodyAttack === null
    ? 0
    : input.stepsUntilNextMelodyAttack <= 1
      ? 10
      : input.stepsUntilNextMelodyAttack <= 2
        ? 5
        : 0;

  const breakdown: FillOpportunityScoreBreakdown = {
    silenceCapacity: Math.round(25 * Math.min(input.capacitySteps / 4, 1)),
    phraseTransfer: input.boundaryEvidence.lineEnd
      ? input.boundaryEvidence.nextMelodyDistanceSteps !== null ? 20 : 14
      : input.boundaryEvidence.trailingRestSteps >= 2 ? 6 : 0,
    handContinuity: Math.round(20 * (1 - Math.min(minimumHandCost / 10, 1))),
    harmonicFit: Math.round(8 + chordCandidateRatio * 7),
    voiceLeading: voiceLeadingScore(input.candidates, input.nextMelodyMidi),
    metricFit: metricScore(input.startWeight),
    cadenceRestraint,
    crowdingPenalty,
    repetitionPenalty: 0,
  };

  const positive = breakdown.silenceCapacity
    + breakdown.phraseTransfer
    + breakdown.handContinuity
    + breakdown.harmonicFit
    + breakdown.voiceLeading
    + breakdown.metricFit;
  const penalties = breakdown.cadenceRestraint
    + breakdown.crowdingPenalty
    + breakdown.repetitionPenalty;

  return {
    score: Math.max(0, Math.min(100, Math.round(positive - penalties))),
    breakdown,
  };
}
