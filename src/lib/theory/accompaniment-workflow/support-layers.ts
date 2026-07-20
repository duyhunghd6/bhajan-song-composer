import type { AccompanimentStage } from "../accompaniment-stage";
import { generateDjembeArrangement } from "../djembe-arranger";
import {
  getSelectedWorkflowOption,
  isAccompanimentWorkflowStepComplete,
  isAccompanimentWorkflowStepEnabled,
} from "../accompaniment-workflow";
import type { AccompanimentWorkflowSession } from "./definition";

export interface AccompanimentSupportLayerBundle {
  djembe: string | null;
  combined: string | null;
  validation?: ReturnType<typeof generateDjembeArrangement>["validation"];
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

function selectedDjembeData(session: AccompanimentWorkflowSession): Record<string, unknown> {
  return (["djembe-groove-interlock", "djembe-fill-validation"] as const).reduce((data, stepId) => ({
    ...data,
    ...(getSelectedWorkflowOption(session, stepId)?.data ?? {}),
  }), {} as Record<string, unknown>);
}

function isDjembeReady(session: AccompanimentWorkflowSession): boolean {
  const stepId = "djembe-fill-validation";
  const option = getSelectedWorkflowOption(session, stepId);
  return isAccompanimentWorkflowStepEnabled(session, stepId)
    && isAccompanimentWorkflowStepComplete(session, stepId)
    && option?.data.skipped !== true;
}

function relabelSupportLayer(abc: string): string {
  return abc.replace(/Layer 3/g, "Layer 2").replace(/ensemble-support/g, "accompaniment-support");
}

export function generateAccompanimentSupportLayers(
  melodyAbc: string,
  { accompaniment, workflow }: GenerateAccompanimentSupportLayersOptions
): AccompanimentSupportLayerBundle {
  if (!workflow || !accompaniment || !isDjembeReady(workflow)) {
    return { djembe: null, combined: null };
  }

  const data = selectedDjembeData(workflow);
  const output = generateDjembeArrangement(melodyAbc, {
    accompaniment,
    plan: {
      grooveProfile: stringEnum(data.grooveProfile ?? data.profile, ["devotional", "folk-upbeat", "compound-flow", "sparse"], "devotional"),
      density: stringEnum(data.density, ["minimal", "moderate", "active"], "moderate"),
      bassSync: booleanData(data.bassSync, true),
      backbeatSlaps: booleanData(data.backbeatSlaps, true),
      fillPolicy: stringEnum(data.fillPolicy, ["none", "gap-only", "cadence-only"], "gap-only"),
    },
  });
  const djembe = relabelSupportLayer(output.abc);

  return { djembe, combined: djembe, validation: output.validation };
}
