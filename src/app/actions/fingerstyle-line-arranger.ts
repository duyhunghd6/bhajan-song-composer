"use server";

import {
  rebuildFingerstyleLineOption,
  runFingerstyleLineWorkflow,
} from "./fingerstyle-line-arranger/workflow";
import type {
  GenerateFingerstyleLineInput,
  GenerateFingerstyleLineOutput,
  SelectFingerstyleLineOptionInput,
  SelectFingerstyleLineOptionOutput,
} from "./fingerstyle-line-arranger/types";

export type {
  FingerstyleFillGenerationSummary,
  FingerstyleGenerationNotice,
  FingerstyleLineGenerationOption,
  FingerstyleLineGenerationRun,
  GenerateFingerstyleLineInput,
  GenerateFingerstyleLineOutput,
  PreviousLineContext,
  SelectFingerstyleLineOptionInput,
  SelectFingerstyleLineOptionOutput,
} from "./fingerstyle-line-arranger/types";

export async function generateAIFingerstyleLine(
  input: GenerateFingerstyleLineInput,
): Promise<GenerateFingerstyleLineOutput> {
  return runFingerstyleLineWorkflow(input);
}

export async function selectAIFingerstyleLineOption(
  input: SelectFingerstyleLineOptionInput,
): Promise<SelectFingerstyleLineOptionOutput> {
  return rebuildFingerstyleLineOption(input);
}
