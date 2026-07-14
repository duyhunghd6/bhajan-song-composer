"use server";

import { requestOpenAiCompatibleToolLoop } from "./ai-config";
import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { applyFingerstyleTablatureToon, FINGERSTYLE_TABLATURE_TOON_CONTRACT } from "@/lib/theory/fingerstyle-arranger/llm-codec";
import { validateFingerstylePhysics } from "@/lib/theory/fingerstyle-arranger/physics-validation";
import { formatMeasureAsToon } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import {
  buildFingerstyleTablatureToolDefinition,
  executeGuitarVoicingQuery,
  formatFingerstyleToolDiagnostic,
  GUITAR_VOICING_TOOL_DEFINITION,
} from "./fingerstyle-tool-contract";

export interface GenerateFingerstyleMeasureInput {
  measure: TimeSliceMeasure;
  activeAbc: string;
}

export interface GenerateFingerstyleMeasureOutput {
  success: boolean;
  measure?: TimeSliceMeasure;
  visualTablature?: string;
  logs: string[];
  error?: string;
}

export async function generateAIFingerstyleMeasure(
  input: GenerateFingerstyleMeasureInput
): Promise<GenerateFingerstyleMeasureOutput> {
  const systemPrompt = `You are an expert devotional fingerstyle guitar arranger. The source TOON is authoritative and omits tablature. Never repeat or edit its chord, weight, melody, lyric, style, or measure metadata.

For validation and final submission, send only this complete tablature replacement table:
${FINGERSTYLE_TABLATURE_TOON_CONTRACT}

0. **Pickup:** If \`pickup_beats:\` is present, omit every padding step after the melody ends. Omitted steps are empty.

1. **Voicings:** On Step 1, Step 9, and every chord change, call \`query_guitar_voicings(chord, melody_pitch)\`. Its \`frets_6_to_1\` column is authoritative for strings 6 through 1 and rows are sorted by ascending \`span\` (maximum minus minimum positive fret). Use only returned frets; never invent notes.

2. **Right hand:** For PIMA or Sparse profiles, use at most a 4-note pinch or a double-stop, not a 5/6-string downbeat strum. A pinch uses one bass \`p\` plus up to \`i,m,a\` on inner/treble strings. Full strums are allowed only for non-sparse profiles on ⬤.

3. **Melody and bass:** Melody is absolute priority and wins string collisions. On ● prefer a double-stop. Bass-role notes may appear only on weighted steps (⬤, ●, or *).

4. **Fills and sustain:** fill_density none allows 0 fills; few allows at most 4 fills; all allows dense fills. Never pluck a fill on a string sustaining the melody.

5. **Validate and submit:** Call \`validate_fingerstyle_physics({ tablature_toon })\`. If valid, call \`submit_arranged_measure({ tablature_toon })\` with the exact same table. Do not send a full grid.`;

  const userPrompt = `Arrange Measure ${input.measure.measure} in ${input.measure.style_profile.key} key.
Here is the TOON grid:
${formatMeasureAsToon(input.measure, { tablature: "omit" })}`;

  let finalOutput: GenerateFingerstyleMeasureOutput | null = null;
  const logs: string[] = [];

  logs.push(`=== SYSTEM PROMPT ===\n${systemPrompt}\n`);
  logs.push(`=== USER PROMPT ===\n${userPrompt}\n`);

  try {
    await requestOpenAiCompatibleToolLoop({
      systemPrompt,
      userPrompt,
      onDiagnostic: (event) => {
        if (event.type === "tool-call") {
          console.log(`[Measure ${input.measure.measure}] LLM called tool: ${event.toolName}`);
          logs.push(`[TOOL IN] ${event.toolName}(${formatFingerstyleToolDiagnostic(event.input)})`);
        } else if (event.type === "tool-result") {
          logs.push(`[TOOL OUT] ${event.toolName} => ${formatFingerstyleToolDiagnostic(event.result)}`);
        } else if (event.type === "final-validation") {
          console.log(`[Measure ${input.measure.measure}] Final validation: ${event.valid ? "Passed" : "Failed"} - ${event.message || ""}`);
          logs.push(`[VALIDATION] ${event.valid ? "PASSED" : "FAILED"}: ${event.message || ""}`);
        } else if (event.type === "chat-request") {
          logs.push(`[LLM QUERY] Sending ${event.messageCount} messages. Available tools: ${event.toolNames.join(", ")}`);
        } else if (event.type === "chat-response") {
          logs.push(`[LLM RESPONSE] Tools called: ${event.toolCallNames.join(", ")}`);
        } else if (event.type === "chat-error" || event.type === "loop-exhausted") {
          console.error(`[Measure ${input.measure.measure}] AI Loop Error:`, (event as any).message || (event as any).lastValidationMessage);
          logs.push(`[ERROR] ${(event as any).message || (event as any).lastValidationMessage}`);
        }
      },
      tools: [
        buildFingerstyleTablatureToolDefinition(
          "submit_arranged_measure",
          "Submit the final compact tablature table for this measure.",
        ),
        GUITAR_VOICING_TOOL_DEFINITION,
        buildFingerstyleTablatureToolDefinition(
          "validate_fingerstyle_physics",
          "Validate the complete compact tablature table for this measure.",
        ),
      ],
      finalToolName: "submit_arranged_measure",
      localTools: [
        {
          name: "query_guitar_voicings",
          execute: executeGuitarVoicingQuery,
        },
        {
          name: "validate_fingerstyle_physics",
          execute: (args) => {
            const decoded = applyFingerstyleTablatureToon(
              (args as { tablature_toon?: unknown }).tablature_toon,
              [input.measure],
            );
            if (!decoded.ok) {
              return { valid: false, code: decoded.error.code, message: decoded.error.message };
            }
            return validateFingerstylePhysics(decoded.measures[0].grid, {
              fillDensity: input.measure.style_profile.fill_density,
            });
          },
        },
      ],
      validateFinalResult: (args) => {
        const decoded = applyFingerstyleTablatureToon(
          (args as { tablature_toon?: unknown }).tablature_toon,
          [input.measure],
        );
        if (!decoded.ok) {
          return {
            valid: false,
            message: decoded.error.message,
            toolResult: { valid: false, code: decoded.error.code, message: decoded.error.message },
          };
        }

        const validation = validateFingerstylePhysics(decoded.measures[0].grid, {
          fillDensity: input.measure.style_profile.fill_density,
        });
        if (!validation.valid) {
          return {
            valid: false,
            message: validation.message,
            toolResult: { valid: false, message: validation.message },
          };
        }

        finalOutput = {
          success: true,
          measure: decoded.measures[0],
          logs,
        };
        return { valid: true };
      },
      temperature: 0.25,
      maxIterations: 8,
    });
  } catch (error: any) {
    return {
      success: false,
      logs,
      error: error.message || "Unknown error during AI generation."
    };
  }

  if (!finalOutput) {
    return {
      success: false,
      logs,
      error: "LLM failed to return a valid arranged measure."
    };
  }

  return finalOutput;
}
