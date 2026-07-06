import type { AccompanimentStage } from "../accompaniment-stage";
import { generateEnsembleExpansionOutput, type EnsembleExpansionValidation } from "../ensemble-output-contract";
import {
  DEFAULT_ENSEMBLE_GENERATION_PLAN,
  type EnsembleGenerationPlan,
} from "../ensemble-workflow";
import {
  getSelectedWorkflowOption,
  isAccompanimentWorkflowStepComplete,
  isAccompanimentWorkflowStepEnabled,
} from "../accompaniment-workflow";
import type {
  AccompanimentWorkflowSession,
  AccompanimentWorkflowStepId,
} from "./definition";

export interface AccompanimentSupportLayerBundle {
  djembe: string | null;
  flute: string | null;
  violin: string | null;
  combined: string | null;
  validation?: EnsembleExpansionValidation;
}

interface GenerateAccompanimentSupportLayersOptions {
  accompaniment: AccompanimentStage | null;
  workflow: AccompanimentWorkflowSession | null;
}

function stringEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function booleanData(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberData(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function stringData(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function selectedData(session: AccompanimentWorkflowSession, stepIds: AccompanimentWorkflowStepId[]): Record<string, unknown> {
  return stepIds.reduce((acc, stepId) => ({
    ...acc,
    ...(getSelectedWorkflowOption(session, stepId)?.data ?? {}),
  }), {} as Record<string, unknown>);
}

function branchReady(session: AccompanimentWorkflowSession, finalStepId: AccompanimentWorkflowStepId): boolean {
  const option = getSelectedWorkflowOption(session, finalStepId);
  return isAccompanimentWorkflowStepEnabled(session, finalStepId)
    && isAccompanimentWorkflowStepComplete(session, finalStepId)
    && option?.data.skipped !== true;
}

function relabelSupportLayer(abc: string): string {
  return abc
    .replace(/Layer 3/g, "Layer 2")
    .replace(/ensemble-support/g, "accompaniment-support");
}

function getAccompanimentSupportPlan(session: AccompanimentWorkflowSession): EnsembleGenerationPlan {
  const djembeData = selectedData(session, ["djembe-groove-interlock", "djembe-fill-validation"]);
  const fluteData = selectedData(session, ["flute-yield-register", "flute-breath-fill-validation"]);
  const violinData = selectedData(session, ["violin-bed-register", "violin-expression-validation"]);

  return {
    djembe: {
      grooveProfile: stringEnum(djembeData.grooveProfile ?? djembeData.profile, ["devotional", "folk-upbeat", "compound-flow", "sparse"], DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.grooveProfile),
      density: stringEnum(djembeData.density, ["minimal", "moderate", "active"], DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.density),
      bassSync: booleanData(djembeData.bassSync, DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.bassSync),
      backbeatSlaps: booleanData(djembeData.backbeatSlaps, DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.backbeatSlaps),
      fillPolicy: stringEnum(djembeData.fillPolicy, ["none", "gap-only", "cadence-only"], DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.fillPolicy),
    },
    flute: {
      role: stringEnum(fluteData.role, ["halo", "gap-fills", "sustained-pad"], DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.role),
      fillDensity: stringEnum(fluteData.fillDensity ?? fluteData.density, ["minimal", "moderate", "active"], DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.fillDensity),
      preferredRegister: stringData(fluteData.preferredRegister, DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.preferredRegister),
      breathEveryMeasures: numberData(fluteData.breathEveryMeasures, DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.breathEveryMeasures, 1, 8),
      yieldWhenMelodyActive: booleanData(fluteData.yieldWhenMelodyActive, DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.yieldWhenMelodyActive),
    },
    violin: {
      role: stringEnum(violinData.role, ["harmonic-bed", "counterline", "drone-pad"], DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.role),
      registerStrategy: stringEnum(violinData.registerStrategy, ["below-melody", "interlock"], DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.registerStrategy),
      doubleStopPolicy: stringEnum(violinData.doubleStopPolicy, ["single-note", "safe-double-stops"], DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.doubleStopPolicy),
      expressionProfile: stringEnum(violinData.expressionProfile, ["plain", "swell-vibrato"], DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.expressionProfile),
      yieldWhenMelodyActive: booleanData(violinData.yieldWhenMelodyActive, DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.yieldWhenMelodyActive),
    },
  };
}

export function generateAccompanimentSupportLayers(
  melodyAbc: string,
  { accompaniment, workflow }: GenerateAccompanimentSupportLayersOptions
): AccompanimentSupportLayerBundle {
  if (!workflow || !accompaniment || workflow.setup?.style === "solo-fingerstyle") {
    return { djembe: null, flute: null, violin: null, combined: null };
  }

  const djembeReady = branchReady(workflow, "djembe-fill-validation");
  const fluteReady = branchReady(workflow, "flute-breath-fill-validation");
  const violinReady = branchReady(workflow, "violin-expression-validation");

  if (!djembeReady && !fluteReady && !violinReady) {
    return { djembe: null, flute: null, violin: null, combined: null };
  }

  const output = generateEnsembleExpansionOutput(melodyAbc, {
    accompaniment,
    plan: getAccompanimentSupportPlan(workflow),
  });
  const djembe = djembeReady ? relabelSupportLayer(output.abcLayers.layer3Djembe) : null;
  const flute = fluteReady ? relabelSupportLayer(output.abcLayers.layer3Flute) : null;
  const violin = violinReady ? relabelSupportLayer(output.abcLayers.layer3Violin) : null;

  return {
    djembe,
    flute,
    violin,
    combined: [djembe, flute, violin].filter(Boolean).join("\n") || null,
    validation: output.validation,
  };
}
