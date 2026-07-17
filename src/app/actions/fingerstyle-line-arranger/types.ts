import type {
  FillComposition,
  FillDensityMode,
  FillOpportunityAnalysis,
  FingerstyleGenerationPolicy,
} from "@/lib/theory/fingerstyle-arranger/fill-opportunities";
import type { FingerstyleGenerationDiagnosticRun } from "@/lib/theory/fingerstyle-arranger/generation-diagnostics";
import type { SkillLevel } from "@/lib/theory/fingerstyle-arranger/fingerstyle-constraints";
import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";

export interface PreviousLineContext {
  lineIndex: number;
  inputToon: string;
  outputToon: string;
}

export interface GenerateFingerstyleLineInput {
  songSlug: string;
  sourceFingerprint: string;
  lineMeasures: TimeSliceMeasure[];
  previousLines: PreviousLineContext[];
  activeAbc: string;
  skillLevel?: SkillLevel;
  densityMode?: FillDensityMode;
  previousLineMeasures?: TimeSliceMeasure[];
  nextLineMeasures?: TimeSliceMeasure[];
}

export interface FingerstyleFillGenerationSummary {
  bpm: number;
  policy: FingerstyleGenerationPolicy;
  evaluatedStepCount: number;
  evaluatedPlacementCount: number;
  eligibleWindowCount: number;
  selectedWindowCount: number;
  composedFillCount: number;
  finalValidation: "passed" | "failed";
}

export interface FingerstyleGenerationNotice {
  code: "fills-unavailable";
  severity: "warning";
  message: string;
  reason: "no-legal-windows" | "all-windows-skipped" | "retry-exhausted";
}

export interface FingerstyleFillOptionJustification {
  positions: Array<{
    windowId: string;
    measure: number;
    startStep: number;
    endStep: number;
    activeChord: string;
    reason: string;
  }>;
  notes: Array<{
    candidateId: string;
    measure: number;
    step: number;
    pitch: string;
    harmonicRole: string;
    string: number;
    fret: number;
    durationSteps: number;
    finger: "i" | "m" | "a";
    reason: string;
  }>;
}

export interface FingerstyleLineGenerationOption {
  id: string;
  ordinal: number;
  selection: import("@/lib/theory/fingerstyle-arranger/fill-opportunities").FillSelection;
  composition: FillComposition;
  fillSummary: FingerstyleFillGenerationSummary;
  /** Server-derived evidence for the accepted fill placement and note choices. */
  justification: FingerstyleFillOptionJustification;
}

/**
 * One source-bound generation run. Every option shares this frozen bass
 * foundation and post-bass candidate catalog; only fills differ.
 */
export interface FingerstyleLineGenerationRun {
  version: 1;
  id: string;
  sourceFingerprint: string;
  lineIndex: number;
  measureNumbers: number[];
  policy: FingerstyleGenerationPolicy;
  foundation: TimeSliceMeasure[];
  opportunityAnalysis: FillOpportunityAnalysis;
  options: FingerstyleLineGenerationOption[];
  selectedOptionId: string;
}

export interface SelectFingerstyleLineOptionInput {
  sourceFingerprint: string;
  lineMeasures: TimeSliceMeasure[];
  activeAbc: string;
  generationRun: FingerstyleLineGenerationRun;
  optionId: string;
}

export interface SelectFingerstyleLineOptionOutput {
  success: boolean;
  measures?: TimeSliceMeasure[];
  selectedOptionId?: string;
  error?: string;
}

export interface GenerateFingerstyleLineOutput {
  success: boolean;
  measures?: TimeSliceMeasure[];
  generationRun?: FingerstyleLineGenerationRun;
  selectedOptionId?: string;
  logs: string[];
  diagnostics?: FingerstyleGenerationDiagnosticRun;
  fillSummary?: FingerstyleFillGenerationSummary;
  notices?: FingerstyleGenerationNotice[];
  error?: string;
}
