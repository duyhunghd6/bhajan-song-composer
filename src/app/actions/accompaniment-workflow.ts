"use server";

import { requestOpenAiCompatibleTool } from "./ai-config";
import {
  buildAccompanimentWorkflowPrompt,
  buildAccompanimentWorkflowToolSchema,
  buildConsolidatedChordIngestionPrompt,
  buildConsolidatedChordIngestionToolSchema,
  extractLyricChordAnnotations,
  normalizeWorkflowOptionDataLineBreaks,
  type AccompanimentWorkflowMetadata,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowSelectedContext,
  type AccompanimentWorkflowStepId,
} from "@/lib/theory/accompaniment-workflow";

interface RawWorkflowStepResult {
  options?: Array<Partial<AccompanimentWorkflowOption>>;
}

interface RawConsolidatedChordIngestionResult {
  chordToneMapping?: RawWorkflowStepResult;
  chordProgression?: RawWorkflowStepResult;
  voiceLeadingValidation?: RawWorkflowStepResult;
}

export interface GenerateAccompanimentWorkflowStepInput {
  stepId: AccompanimentWorkflowStepId;
  sourceAbc: string;
  metadata: AccompanimentWorkflowMetadata;
  previousSelections: AccompanimentWorkflowSelectedContext[];
  userNote?: string;
}

function toolNameForStep(stepId: AccompanimentWorkflowStepId): string {
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

function normalizeOptions(raw: unknown, sourceAbc: string): AccompanimentWorkflowOption[] {
  const result = raw as RawWorkflowStepResult;
  const options = Array.isArray(result.options) ? result.options.slice(0, 5) : [];

  if (options.length === 0) {
    throw new Error("LLM returned no workflow options");
  }

  return options.map((option, index) => {
    const data = option.data && typeof option.data === "object" && !Array.isArray(option.data)
      ? normalizeWorkflowOptionDataLineBreaks(option.data, sourceAbc)
      : {};

    return {
      id: normalizeId(option.id, `option-${index + 1}`),
      label: typeof option.label === "string" && option.label.trim() ? option.label.trim() : `Option ${index + 1}`,
      summary: typeof option.summary === "string" ? option.summary : "",
      justification: typeof option.justification === "string" ? option.justification : "",
      data,
      warnings: stringArray(option.warnings),
      validationNotes: stringArray(option.validationNotes),
    };
  });
}

function makeRun(input: {
  stepId: AccompanimentWorkflowStepId;
  requestPrompt: string;
  userNote?: string;
  options: AccompanimentWorkflowOption[];
  rawResult?: unknown;
}): AccompanimentWorkflowRun {
  return {
    id: `${input.stepId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    stepId: input.stepId,
    requestPrompt: input.requestPrompt,
    userNote: input.userNote?.trim() ?? "",
    options: input.options,
    rawResult: input.rawResult,
  };
}

export async function generateAccompanimentWorkflowStep(
  input: GenerateAccompanimentWorkflowStepInput
): Promise<AccompanimentWorkflowRun> {
  try {
    const requestPrompt = buildAccompanimentWorkflowPrompt(input);
    const toolSchema = buildAccompanimentWorkflowToolSchema(input.stepId);
    const toolName = toolNameForStep(input.stepId);
    const rawResult = await requestOpenAiCompatibleTool({
      systemPrompt: "You are an expert music theory arranger for Indian devotional/bhajan music. You make one small human-reviewable accompaniment decision at a time and always justify options with concrete theory and playability constraints.",
      userPrompt: requestPrompt,
      toolSchema,
      toolName,
      temperature: 0.25,
    });

    return makeRun({
      stepId: input.stepId,
      requestPrompt,
      userNote: input.userNote,
      options: normalizeOptions(rawResult, input.sourceAbc),
      rawResult,
    });
  } catch (error) {
    console.error("Error during accompaniment workflow generation:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during accompaniment workflow generation.");
  }
}

export async function generateConsolidatedChordIngestionWorkflowSteps(
  input: Omit<GenerateAccompanimentWorkflowStepInput, "stepId">
): Promise<AccompanimentWorkflowRun[]> {
  try {
    const lyricChordAnnotations = extractLyricChordAnnotations(input.sourceAbc);
    if (lyricChordAnnotations.length === 0) {
      throw new Error("No chord annotations were found in ABC lyric lines.");
    }

    const requestPrompt = buildConsolidatedChordIngestionPrompt(input);
    const rawResult = await requestOpenAiCompatibleTool({
      systemPrompt: "You are an expert music theory arranger for Indian devotional/bhajan music. You ingest user-provided lyric chord symbols as authoritative harmony and return three human-reviewable workflow decisions from one tool call.",
      userPrompt: requestPrompt,
      toolSchema: buildConsolidatedChordIngestionToolSchema(),
      toolName: "generate_consolidated_chord_ingestion",
      temperature: 0.2,
    });
    const result = rawResult as RawConsolidatedChordIngestionResult;

    return [
      makeRun({
        stepId: "chord-tone-mapping",
        requestPrompt,
        userNote: input.userNote,
        options: normalizeOptions(result.chordToneMapping, input.sourceAbc),
        rawResult: result.chordToneMapping,
      }),
      makeRun({
        stepId: "chord-progression",
        requestPrompt,
        userNote: input.userNote,
        options: normalizeOptions(result.chordProgression, input.sourceAbc),
        rawResult: result.chordProgression,
      }),
      makeRun({
        stepId: "voice-leading-validation",
        requestPrompt,
        userNote: input.userNote,
        options: normalizeOptions(result.voiceLeadingValidation, input.sourceAbc),
        rawResult: result.voiceLeadingValidation,
      }),
    ];
  } catch (error) {
    console.error("Error during consolidated chord ingestion workflow generation:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during consolidated chord ingestion workflow generation.");
  }
}
