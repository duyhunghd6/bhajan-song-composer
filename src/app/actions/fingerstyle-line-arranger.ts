"use server";

import { runFingerstyleLineWorkflow } from "./fingerstyle-line-arranger/workflow";
import type {
  GenerateFingerstyleLineInput,
  GenerateFingerstyleLineOutput,
} from "./fingerstyle-line-arranger/types";

export type {
  FingerstyleFillGenerationSummary,
  GenerateFingerstyleLineInput,
  GenerateFingerstyleLineOutput,
  PreviousLineContext,
} from "./fingerstyle-line-arranger/types";

export async function generateAIFingerstyleLine(
  input: GenerateFingerstyleLineInput,
): Promise<GenerateFingerstyleLineOutput> {
  return runFingerstyleLineWorkflow(input);
}
