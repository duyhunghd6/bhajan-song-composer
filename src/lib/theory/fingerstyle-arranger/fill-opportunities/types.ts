import type { GuitarStringNumber } from "../../fingerstyle-compressor";
import type { TimeSliceMeasure } from "../time-slice";
import type { SkillLevel } from "../fingerstyle-constraints";

export const FILL_OPPORTUNITY_FORMAT_VERSION = "fill-opportunities:v1" as const;
export const FILL_SELECTION_FORMAT_VERSION = "fill-selection:v1" as const;
export const FILL_COMPOSITION_FORMAT_VERSION = "fills:v1" as const;

export type FillDensityMode = "auto" | "none" | "few" | "normal" | "many";
export type ResolvedFillDensity = "off" | "few" | "normal" | "many";

export interface FingerstyleGenerationPolicy {
  skillLevel: SkillLevel;
  densityMode: FillDensityMode;
  resolvedDensity: ResolvedFillDensity;
  densitySource: "skill-level" | "explicit" | "legacy";
}

export interface FillSelectionBudget {
  targetWindows: number;
  maxWindows: number;
  maxWindowsPerMeasure: number;
  maxNotesPerWindow: number;
}

export type FillRejectionReason =
  | "pickup-padding"
  | "melody-attack"
  | "foundation-attack"
  | "unsupported-melody-state"
  | "no-legal-pitch"
  | "protected-melody-string"
  | "occupied-string"
  | "fret-limit"
  | "fret-span"
  | "hand-jump"
  | "register-collision"
  | "unresolved-approach"
  | "dominated-placement";

export type FillHarmonicRole =
  | "root"
  | "third"
  | "fifth"
  | "seventh"
  | "extension"
  | "scale-approach";

export interface FillBoundaryEvidence {
  lineEnd: boolean;
  trailingRestSteps: number;
  lyricTerminal: boolean;
  repeatBoundary: boolean;
  cadenceHint: "tonic-arrival" | "dominant-arrival" | "continuation" | "unknown";
  nextMelodyDistanceSteps: number | null;
  confidence: "high" | "medium" | "low";
}

export interface FillOpportunityScoreBreakdown {
  silenceCapacity: number;
  phraseTransfer: number;
  handContinuity: number;
  harmonicFit: number;
  voiceLeading: number;
  metricFit: number;
  cadenceRestraint: number;
  crowdingPenalty: number;
  repetitionPenalty: number;
}

export interface FillAtomicCandidate {
  id: string;
  windowId: string;
  measure: number;
  step: number;
  pitch: string;
  midi: number;
  harmonicRole: FillHarmonicRole;
  string: GuitarStringNumber;
  fret: number;
  suggestedFinger: "i" | "m" | "a";
  maxDurationSteps: number;
  incomingHandCost: number;
  outgoingHandCost: number;
  totalHandCost: number;
  score: number;
  conditions: string[];
}

export interface FillOpportunityWindow {
  id: string;
  measure: number;
  lineIndex: number;
  startStep: number;
  endStep: number;
  capacitySteps: number;
  activeChord: string;
  key: string;
  melodyContext: "rest" | "sustain";
  protectedStrings: GuitarStringNumber[];
  boundaryEvidence: FillBoundaryEvidence;
  score: number;
  scoreBreakdown: FillOpportunityScoreBreakdown;
  candidateIds: string[];
  flags: string[];
}

export interface FillOpportunityAnalysis {
  version: typeof FILL_OPPORTUNITY_FORMAT_VERSION;
  opportunitySetId: string;
  sourceFingerprint: string;
  policy: FingerstyleGenerationPolicy;
  budget: FillSelectionBudget;
  evaluatedStepCount: number;
  evaluatedPlacementCount: number;
  rejectionCounts: Record<FillRejectionReason, number>;
  windows: FillOpportunityWindow[];
  candidates: FillAtomicCandidate[];
}

export interface AnalyzeFillOpportunitiesInput {
  measures: TimeSliceMeasure[];
  sourceFingerprint: string;
  skillLevel?: SkillLevel;
  densityMode?: FillDensityMode | string;
  previousLineMeasures?: TimeSliceMeasure[];
  nextLineMeasures?: TimeSliceMeasure[];
}

export interface FillSelectionDecision {
  windowId: string;
  decision: "use" | "skip";
  reason: string;
}

export interface FillSelection {
  version: typeof FILL_SELECTION_FORMAT_VERSION;
  opportunitySetId: string;
  sourceFingerprint: string;
  decisions: FillSelectionDecision[];
}

export interface FillCompositionEntry {
  candidateId: string;
  durationSteps: number;
  finger: "i" | "m" | "a";
}

export interface FillComposition {
  version: typeof FILL_COMPOSITION_FORMAT_VERSION;
  opportunitySetId: string;
  sourceFingerprint: string;
  entries: FillCompositionEntry[];
}

export interface FillValidationIssue {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface FillValidationResult<T> {
  valid: boolean;
  value?: T;
  issues: FillValidationIssue[];
  message: string;
}

export interface FillOpportunityPage {
  toon: string;
  cursor: number;
  nextCursor: number | null;
  candidateCount: number;
}
