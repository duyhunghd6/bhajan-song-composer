import type { FillDensityMode, FingerstyleGenerationPolicy } from "@/lib/theory/fingerstyle-arranger/fill-opportunities";
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

export interface GenerateFingerstyleLineOutput {
  success: boolean;
  measures?: TimeSliceMeasure[];
  logs: string[];
  diagnostics?: FingerstyleGenerationDiagnosticRun;
  fillSummary?: FingerstyleFillGenerationSummary;
  error?: string;
}
