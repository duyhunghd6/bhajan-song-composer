"use server";

import { requestOpenAiCompatibleToolLoop, type ToolDiagnosticEvent } from "./ai-config";
import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { validateFingerstylePhysics } from "@/lib/theory/fingerstyle-arranger/physics-validation";
import { applyFingerstyleTablatureToon, FINGERSTYLE_TABLATURE_TOON_CONTRACT } from "@/lib/theory/fingerstyle-arranger/llm-codec";
import { formatLineAsToon, renderAsciiTab } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import { applyDPToTimeSliceMeasures } from "@/lib/theory/fingerstyle-arranger/dp-integration";
import {
  buildFingerstyleTablatureToolDefinition,
  executeGuitarVoicingQuery,
  formatFingerstyleToolDiagnostic,
  GUITAR_VOICING_TOOL_DEFINITION,
} from "./fingerstyle-tool-contract";
import fs from "fs/promises";
import path from "path";

const FINGERSTYLE_DIAGNOSTICS_DIR = ".fingerstyle-diagnostics";
// ── Types ──────────────────────────────────────────────────────────────

export interface PreviousLineContext {
  lineIndex: number;
  inputToon: string;
  outputToon: string;
}

export interface GenerateFingerstyleLineInput {
  lineMeasures: TimeSliceMeasure[];
  previousLines: PreviousLineContext[];
  activeAbc: string;
}

export interface GenerateFingerstyleLineOutput {
  success: boolean;
  measures?: TimeSliceMeasure[];
  logs: string[];
  error?: string;
}

// ── System prompt (line-level, with context) ───────────────────────────

function buildLineSystemPrompt(): string {
  return `You are an expert devotional fingerstyle guitar arranger. You will receive authoritative source TOON for MULTIPLE measures. The source omits tablature; never repeat or edit its chord, weight, melody, lyric, style, or measure metadata.

For both validation and final submission, send only the complete tablature replacement table:
${FINGERSTYLE_TABLATURE_TOON_CONTRACT}

Follow this tool workflow for each measure:

0. **Pickup (Anacrusis) Measure Check:**
   - If a measure header contains \`pickup_beats:\`, only arrange the active melody steps.
   - Omit every padding step from \`tablature_toon\`; omitted steps are empty.

1. **Lock the Grip & Voicings:**
   - On Step 1, Step 9, and every chord change, call \`query_guitar_voicings(chord, melody_pitch)\`.
   - Results use \`frets_6_to_1\` for strings 6 through 1 and are sorted by ascending \`span\` (maximum minus minimum positive fret).
   - Choose the smallest practical span. Use only returned strings and frets; never invent notes.

2. **Right-Hand Foundation:**
   - If \`comping_style\` or \`voicing_plan\` contains PIMA or Sparse, use at most a 4-note PIMA pinch or a double-stop, not a 5/6-string downbeat strum.
   - Otherwise a full strum is allowed on ⬤. For a PIMA pinch, thumb \`p\` plays one bass string and \`i,m,a\` play up to three inner/treble strings.

3. **Protect the Melody:**
   - Map exact melody pitches on attack steps to the highest available strings. Melody wins every string collision.
   - On ●, prefer a double-stop. Bass-role notes may appear only on weighted steps (⬤, ●, or *).

4. **Fills and Sustain:**
   - fill_density none allows 0 fills; few allows at most 4 per measure; all allows dense fills.
   - Never pluck a fill on a string sustaining the melody.

5. **Cross-Measure Consistency:**
   - Continue established picking, bass, and fill patterns from Previous Lines unless the musical context requires a change.

6. **Validate & Submit:**
   - Call \`validate_fingerstyle_physics({ tablature_toon })\` with one complete table covering every measure in this line.
   - If valid, call \`submit_arranged_line({ tablature_toon })\` with the exact same table. Do not send full grids.`;
}

// ── Build user prompt with cumulative context ──────────────────────────

function buildLineUserPrompt(input: GenerateFingerstyleLineInput): string {
  const measureRange = input.lineMeasures.map(m => m.measure);
  const key = input.lineMeasures[0]?.style_profile.key || "G";
  
  let prompt = `Arrange Line (Measures ${measureRange[0]}–${measureRange[measureRange.length - 1]}) in ${key} key.\n\n`;
  
  // Add previous lines context
  if (input.previousLines.length > 0) {
    prompt += `## Previous Lines (Context — maintain consistency with these):\n\n`;
    for (const prev of input.previousLines) {
      prompt += `### Line ${prev.lineIndex + 1} — Input Melody:\n${prev.inputToon}\n\n`;
      prompt += `### Line ${prev.lineIndex + 1} — Arranged Output:\n${prev.outputToon}\n\n`;
    }
    prompt += `---\n\n`;
  }
  
  prompt += `## Current Line to Arrange:\n${formatLineAsToon(input.lineMeasures, { tablature: "omit" })}`;
  
  return prompt;
}

// ── Server action ──────────────────────────────────────────────────────

export async function generateAIFingerstyleLine(
  input: GenerateFingerstyleLineInput
): Promise<GenerateFingerstyleLineOutput> {
  const systemPrompt = buildLineSystemPrompt();
  const userPrompt = buildLineUserPrompt(input);
  
  let finalOutput: GenerateFingerstyleLineOutput | null = null;
  const logs: string[] = [];

  const writeLogToDisk = async () => {
    try {
      const lineIndex = input.lineMeasures[0]?.lineIndex ?? input.previousLines.length;
      const absoluteDir = path.join(process.cwd(), FINGERSTYLE_DIAGNOSTICS_DIR);
      await fs.mkdir(absoluteDir, { recursive: true });
      await fs.writeFile(
        path.join(absoluteDir, `line-${lineIndex + 1}-last-run.log`),
        logs.join("\n"),
        "utf-8"
      );
    } catch (fsError) {
      console.error("Failed to write diagnostic log:", fsError);
    }
  };

  logs.push(`=== SYSTEM PROMPT ===\n${systemPrompt}\n`);
  logs.push(`=== USER PROMPT ===\n${userPrompt}\n`);

  try {
    await requestOpenAiCompatibleToolLoop({
      systemPrompt,
      userPrompt,
      onDiagnostic: (event: ToolDiagnosticEvent) => {
        if (event.type === "tool-call") {
          logs.push(`[TOOL IN] ${event.toolName}(${formatFingerstyleToolDiagnostic(event.input)})`);
        } else if (event.type === "tool-result") {
          logs.push(`[TOOL OUT] ${event.toolName} => ${formatFingerstyleToolDiagnostic(event.result)}`);
        } else if (event.type === "final-validation") {
          logs.push(`[VALIDATION] ${event.valid ? "PASSED" : "FAILED"}: ${event.message || ""}`);
        } else if (event.type === "chat-request") {
          logs.push(`[LLM QUERY] Sending ${event.messageCount} messages. Available tools: ${event.toolNames.join(", ")}`);
        } else if (event.type === "chat-response") {
          logs.push(`[LLM RESPONSE] Tools called: ${event.toolCallNames.join(", ")}`);
        } else if (event.type === "chat-error" || event.type === "loop-exhausted") {
          logs.push(`[ERROR] ${(event as Record<string, unknown>).message || (event as Record<string, unknown>).lastValidationMessage}`);
        }
      },
      tools: [
        buildFingerstyleTablatureToolDefinition(
          "submit_arranged_line",
          "Submit the final compact tablature table for every measure in the line.",
        ),
        GUITAR_VOICING_TOOL_DEFINITION,
        buildFingerstyleTablatureToolDefinition(
          "validate_fingerstyle_physics",
          "Validate the complete compact tablature table for every measure in the line.",
        ),
      ],
      finalToolName: "submit_arranged_line",
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
              input.lineMeasures,
            );
            if (!decoded.ok) {
              return { valid: false, code: decoded.error.code, message: decoded.error.message };
            }

            const allMessages: string[] = [];
            for (const measure of decoded.measures) {
              const result = validateFingerstylePhysics(measure.grid, {
                fillDensity: measure.style_profile.fill_density,
              });
              if (!result.valid) allMessages.push(`Measure ${measure.measure}: ${result.message}`);
            }
            return allMessages.length > 0
              ? { valid: false, message: allMessages.join(" ") }
              : { valid: true, message: "Valid." };
          },
        },
      ],
      validateFinalResult: (args) => {
        const decoded = applyFingerstyleTablatureToon(
          (args as { tablature_toon?: unknown }).tablature_toon,
          input.lineMeasures,
        );
        if (!decoded.ok) {
          return {
            valid: false,
            message: decoded.error.message,
            toolResult: { valid: false, code: decoded.error.code, message: decoded.error.message },
          };
        }

        const allMessages: string[] = [];
        for (const measure of decoded.measures) {
          const result = validateFingerstylePhysics(measure.grid, {
            fillDensity: measure.style_profile.fill_density,
          });
          if (!result.valid) allMessages.push(`Measure ${measure.measure}: ${result.message}`);
        }
        if (allMessages.length > 0) {
          const message = allMessages.join(" ");
          return { valid: false, message, toolResult: { valid: false, message } };
        }

        let updatedMeasures: TimeSliceMeasure[] = decoded.measures;

        // --- Apply DP Optimization ---
        try {
          // Use standard 120 bpm since it's just a line generator without tempo context
          const dpResult = applyDPToTimeSliceMeasures(updatedMeasures, 120, { 
            skillLevel: "intermediate",
            autoCapo: false, // Don't sweep capo per line, assume 0 for now (could parse from ABC later)
            capo: 0 
          });
          updatedMeasures = dpResult.measures;
          logs.push(...dpResult.logs);
        } catch (dpError) {
          logs.push(`\n[DP OPTIMIZER ERROR] ${dpError instanceof Error ? dpError.message : String(dpError)}\n`);
        }
        // -----------------------------
        
        // Append ASCII tab + summary to logs
        for (const um of updatedMeasures) {
          const tab = renderAsciiTab(um.grid);
          if (tab) {
            logs.push(`\n## Measure ${um.measure} — ASCII Tab\n\n${tab}`);
          }
        }
        
        finalOutput = {
          success: true,
          measures: updatedMeasures,
          logs
        };
        return { valid: true };
      },
      temperature: 0.25,
      maxIterations: 10,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error during AI generation.";
    await writeLogToDisk();
    return {
      success: false,
      logs,
      error: message
    };
  }

  if (!finalOutput) {
    await writeLogToDisk();
    return {
      success: false,
      logs,
      error: "LLM failed to return valid arranged measures for the line."
    };
  }

  await writeLogToDisk();
  return finalOutput;
}
