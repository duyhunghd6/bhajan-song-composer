"use server";

import { requestOpenAiCompatibleTool } from "./ai-config";
import {
  buildEnsembleWorkflowPrompt,
  buildEnsembleWorkflowToolSchema,
  type EnsembleWorkflowMetadata,
  type EnsembleWorkflowOption,
  type EnsembleWorkflowRun,
  type EnsembleWorkflowSelectedContext,
  type EnsembleWorkflowStepId,
} from "@/lib/theory/ensemble-workflow";

interface RawWorkflowStepResult {
  options?: Array<Partial<EnsembleWorkflowOption>>;
}

export interface GenerateEnsembleWorkflowStepInput {
  stepId: EnsembleWorkflowStepId;
  sourceAbc: string;
  metadata: EnsembleWorkflowMetadata;
  previousSelections: EnsembleWorkflowSelectedContext[];
  userNote?: string;
}

function toolNameForStep(stepId: EnsembleWorkflowStepId): string {
  return `generate_${stepId.replaceAll("-", "_")}`;
}

function normalizeId(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeOptions(raw: unknown): EnsembleWorkflowOption[] {
  const result = raw as RawWorkflowStepResult;
  const options = Array.isArray(result.options) ? result.options.slice(0, 5) : [];

  if (options.length === 0) {
    throw new Error("LLM returned no ensemble workflow options");
  }

  return options.map((option, index) => ({
    id: normalizeId(option.id, `option-${index + 1}`),
    label: typeof option.label === "string" && option.label.trim() ? option.label.trim() : `Option ${index + 1}`,
    summary: typeof option.summary === "string" ? option.summary : "",
    justification: typeof option.justification === "string" ? option.justification : "",
    data: option.data && typeof option.data === "object" && !Array.isArray(option.data) ? option.data : {},
    warnings: stringArray(option.warnings),
    validationNotes: stringArray(option.validationNotes),
  }));
}

export async function generateEnsembleWorkflowStep(
  input: GenerateEnsembleWorkflowStepInput
): Promise<EnsembleWorkflowRun> {
  try {
    const requestPrompt = buildEnsembleWorkflowPrompt(input);
    const toolSchema = buildEnsembleWorkflowToolSchema(input.stepId);
    const toolName = toolNameForStep(input.stepId);
    const rawResult = await requestOpenAiCompatibleTool({
      systemPrompt: "You are an expert music theory arranger for Indian devotional/bhajan ensemble expansion. You make one small human-reviewable Djembe, Flute, or Violin decision at a time, preserving melody priority and Layer 2 accompaniment support.",
      userPrompt: requestPrompt,
      toolSchema,
      toolName,
      temperature: 0.25,
    });

    return {
      id: `${input.stepId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      stepId: input.stepId,
      requestPrompt,
      userNote: input.userNote?.trim() ?? "",
      options: normalizeOptions(rawResult),
      rawResult,
    };
  } catch (error) {
    console.error("Error during ensemble workflow generation:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during ensemble workflow generation.");
  }
}
