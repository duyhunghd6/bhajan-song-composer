import type { TimeSliceMeasure } from "../time-slice";
import type { SkillLevel } from "../fingerstyle-constraints";
import type {
  FillDensityMode,
  FillSelectionBudget,
  FingerstyleGenerationPolicy,
  ResolvedFillDensity,
} from "./types";

const SKILL_DENSITY: Record<SkillLevel, Exclude<ResolvedFillDensity, "off">> = {
  beginner: "few",
  intermediate: "normal",
  advanced: "many",
};

export function normalizeFillPolicy(input: {
  skillLevel?: SkillLevel;
  densityMode?: FillDensityMode | string;
} = {}): FingerstyleGenerationPolicy {
  const skillLevel = input.skillLevel ?? "beginner";
  const rawDensity = input.densityMode?.trim().toLowerCase();

  if (rawDensity === "none") {
    return { skillLevel, densityMode: "none", resolvedDensity: "off", densitySource: "explicit" };
  }
  if (rawDensity === "all") {
    return { skillLevel, densityMode: "many", resolvedDensity: "many", densitySource: "legacy" };
  }
  if (rawDensity === "few" || rawDensity === "normal" || rawDensity === "many") {
    return {
      skillLevel,
      densityMode: rawDensity,
      resolvedDensity: rawDensity,
      densitySource: "explicit",
    };
  }

  return {
    skillLevel,
    densityMode: "auto",
    resolvedDensity: SKILL_DENSITY[skillLevel],
    densitySource: "skill-level",
  };
}

/**
 * Sparse/default fingerstyle keeps a held melody clear. Sustain decoration is an
 * explicit normal-or-many arrangement choice, independent of skill-based budget.
 */
export function allowsMelodySustainFill(policy: FingerstyleGenerationPolicy): boolean {
  return policy.densityMode === "normal" || policy.densityMode === "many";
}

function activeStepCount(measure: TimeSliceMeasure): number {
  if (!measure.pickupDurationUnits) return measure.grid.length;
  const lastMelodyIndex = measure.grid.reduce(
    (last, step, index) => step.melody.state === "rest" ? last : index,
    -1,
  );
  return Math.max(0, lastMelodyIndex + 1);
}

export function buildFillSelectionBudget(
  measures: TimeSliceMeasure[],
  policy: FingerstyleGenerationPolicy,
): FillSelectionBudget {
  if (policy.resolvedDensity === "off") {
    return { targetWindows: 0, maxWindows: 0, maxWindowsPerMeasure: 0, maxNotesPerWindow: 0 };
  }

  const equivalentMeasures = measures.reduce((total, measure) => {
    if (measure.grid.length === 0) return total;
    return total + activeStepCount(measure) / measure.grid.length;
  }, 0);
  const normalizedMeasureCount = Math.max(1, equivalentMeasures);
  const density = policy.resolvedDensity;
  const targetMultiplier = density === "few" ? 0.5 : density === "normal" ? 1 : 2;
  const maxMultiplier = density === "few" ? 1 : density === "normal" ? 2 : 3;
  const maxWindowsPerMeasure = density === "few" ? 1 : density === "normal" ? 2 : 3;
  const maxNotesPerWindow = policy.skillLevel === "beginner" ? 1 : policy.skillLevel === "intermediate" ? 2 : 3;

  return {
    targetWindows: Math.max(1, Math.ceil(targetMultiplier * normalizedMeasureCount)),
    maxWindows: Math.max(1, Math.ceil(maxMultiplier * normalizedMeasureCount)),
    maxWindowsPerMeasure,
    maxNotesPerWindow,
  };
}
