"use server";

import { requestOpenAiCompatibleToolLoop, type ToolDiagnosticEvent } from "./ai-config";
import { query_guitar_voicings } from "@/lib/theory/guitar-voicings";
import type { TimeSliceMeasure, TimeSliceGridStep } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { validateFingerstylePhysics } from "@/lib/theory/fingerstyle-arranger/physics-validation";
import { formatLineAsToon, formatMeasureAsToon, renderAsciiTab } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import { applyDPToTimeSliceMeasures } from "@/lib/theory/fingerstyle-arranger/dp-integration";
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

// ── Formatting helper (compact JSON for logs) ──────────────────────────

function formatToolJson(obj: unknown): string {
  if (!obj) return "null";
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return "[\n" + obj.map(item => `  ${JSON.stringify(item)}`).join(",\n") + "\n]";
  }
  if (typeof obj === "object" && obj !== null) {
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record);
    let output = "{\n";
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const val = record[key];
      if (Array.isArray(val)) {
        if (val.length === 0) {
          output += `  "${key}": []`;
        } else {
          output += `  "${key}": [\n` + val.map(item => `    ${JSON.stringify(item)}`).join(",\n") + "\n  ]";
        }
      } else {
        output += `  "${key}": ${JSON.stringify(val)}`;
      }
      if (i < keys.length - 1) output += ",\n";
      else output += "\n";
    }
    output += "}";
    return output;
  }
  return JSON.stringify(obj);
}

// ── System prompt (line-level, with context) ───────────────────────────

function buildLineSystemPrompt(): string {
  return `You are an expert devotional fingerstyle guitar arranger. You will receive a TOON grid containing MULTIPLE measures (one line of a song). Follow this exact tool-calling workflow sequentially for EACH measure in the line:

0. **Pickup (Anacrusis) Measure Check:**
   - If a measure header contains \`pickup_beats:\`, this is a PICKUP measure. The melody only occupies the first N steps.
   - You MUST ONLY place tablature events on steps where the melody has \`"state": "attack"\` or \`"state": "sustain"\`. ALL other steps MUST have empty tablature \`[]\`.
   - Do NOT add bass notes, fills, pinches, or any other tablature events to the empty/padding steps after the melody ends.

1. **Lock the Grip & Voicings (Tool Call First):**
   - For EACH measure, on Step 1, Step 9, AND on any step where the \`chord\` symbol changes, you MUST call \`query_guitar_voicings(chord, melody_pitch)\`.
   - **Constraint Check:** You are strictly forbidden from inventing fretted notes. You must exclusively use the strings and frets provided by the tool's returned grip.
   - **Playability Rule:** The tool output lists all possible bass notes sorted by \`fretDistance\`. You MUST choose the grip with the smallest \`fretDistance\`.

2. **Right-Hand Foundation (Strums vs Pinches vs PIMA Anchors):**
   - **Style Profile Check (CRITICAL):** Inspect the \`style_profile\` under \`comping_style\` and \`voicing_plan\` in the input.
     - **PIMA-only / Sparse Anchors:** If \`comping_style\` or \`voicing_plan\` contains "PIMA" or "Sparse", you MUST NOT play a full 5-string or 6-string strum on downbeats. Instead, use standard 4-note PIMA **Pinches** (maximum 4 strings) or simpler **double-stops**.
     - **Strumming Style:** Only if the profile does not restrict to PIMA/Sparse, you may use full strums on ⬤ (Beat 1).
   - **PIMA Pinch Notation Rule (Max 4 strings):** Thumb (\`p\`) plays exactly 1 Bass String, fingers (\`i, m, a\`) play up to 3 Treble/Inner Strings.

3. **Protect the Melody & Double-Stops:**
   - The sung melody is absolute priority. Map the exact melody pitches to the exact \`attack\` steps on the highest available strings.
   - On secondary strong beats ● (Beat 3), play a simpler **double-stop** (1 Bass + Melody, or Bass + 1 inner tone).
   - **String Collision:** If melody is on a string needed for a chord tone, the melody note wins. Drop the chord tone.
   - **Bass Placement Rule (CRITICAL — Enforced by Validator):** Bass notes (role \`"bass"\`) MUST ONLY appear on steps that have a weight marker (⬤, ●, or *). Do NOT place bass on unweighted (null weight) steps. The validator WILL reject bass notes on unweighted steps.

4. **PIMA Fills & The Sustain Rule (Inner Arpeggios):**
   - **Sparse Fill Density Rule (CRITICAL — Enforced by Validator):** Inspect \`fill_density\`:
     - **"none":** 0 fills allowed. Validator rejects any fills.
     - **"few":** Maximum 2 to 4 fill attacks PER 16-step measure. Validator rejects more than 4.
     - **"all":** Up to 12-14 fills per measure.
   - **Sustain Protection Rule (CRITICAL):** If melody is \`"sustain"\` on a string, you are physically forbidden from plucking a fill on that same string.

5. **Cross-Measure Consistency:**
   - Review the "Previous Lines" context if provided. Maintain consistent picking patterns, bass rhythm, and fill placement across lines.
   - If previous lines established a pattern (e.g., bass on beats 1 and 3, fill on the "and" of beat 2), continue that pattern unless the musical context demands a change.

6. **Validate & Submit:**
   - Call \`validate_fingerstyle_physics()\` to verify ALL measures in the line at once.
   - Once validated, submit your final work using \`submit_arranged_line()\`.`;
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
  
  prompt += `## Current Line to Arrange:\n${formatLineAsToon(input.lineMeasures)}`;
  
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

  // Collect the fill density from the first measure (all measures in a line share the same profile)
  const fillDensity = input.lineMeasures[0]?.style_profile.fill_density;

  try {
    await requestOpenAiCompatibleToolLoop({
      systemPrompt,
      userPrompt,
      onDiagnostic: (event: ToolDiagnosticEvent) => {
        if (event.type === "tool-call") {
          logs.push(`[TOOL IN] ${event.toolName}(${formatToolJson(event.input)})`);
        } else if (event.type === "tool-result") {
          logs.push(`[TOOL OUT] ${event.toolName} => ${formatToolJson(event.result)}`);
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
        {
          type: "function",
          function: {
            name: "submit_arranged_line",
            description: "Submit the final arranged grids for all measures in the line.",
            parameters: {
              type: "object",
              properties: {
                measures: {
                  type: "array",
                  description: "Array of measure objects, one per measure in the line, in order.",
                  items: {
                    type: "object",
                    properties: {
                      measure_number: { type: "number", description: "The measure number." },
                      grid: {
                        type: "array",
                        description: "The 16-step grid populated with tablature events.",
                        items: {
                          type: "object",
                          properties: {
                            step: { type: "number" },
                            chord: { type: "string" },
                            weight: { type: ["string", "null"] },
                            melody: { type: "object" },
                            lyric: { type: ["string", "null"] },
                            tablature: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  string: { type: "number" },
                                  fret: { type: "number" },
                                  finger: { type: "string", enum: ["p", "i", "m", "a"] },
                                  role: { type: "string", enum: ["bass", "melody", "fill", "root", "fifth"] }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              required: ["measures"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "query_guitar_voicings",
            description: "Retrieve valid guitar voicings for a chord.",
            parameters: {
              type: "object",
              properties: {
                chord: { type: "string" },
                melody_pitch: { type: "string" },
                target_position: { type: "string", enum: ["open"] }
              },
              required: ["chord"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "validate_fingerstyle_physics",
            description: "Check if all proposed measure grids are physically playable. Pass ALL measure grids at once.",
            parameters: {
              type: "object",
              properties: {
                measures: {
                  type: "array",
                  description: "Array of objects with measure_number and grid.",
                  items: {
                    type: "object",
                    properties: {
                      measure_number: { type: "number" },
                      grid: { type: "array", items: { type: "object" } }
                    }
                  }
                }
              },
              required: ["measures"]
            }
          }
        }
      ],
      finalToolName: "submit_arranged_line",
      localTools: [
        {
          name: "query_guitar_voicings",
          execute: (args) => {
            const { chord, melody_pitch, target_position } = args as { chord: string; melody_pitch?: string; target_position?: "open" };
            return query_guitar_voicings(chord, melody_pitch, target_position);
          }
        },
        {
          name: "validate_fingerstyle_physics",
          execute: (args) => {
            const { measures } = args as { measures: { measure_number: number; grid: TimeSliceGridStep[] }[] };
            const allMessages: string[] = [];
            for (const m of measures) {
              const result = validateFingerstylePhysics(m.grid, { fillDensity });
              if (!result.valid) {
                allMessages.push(`Measure ${m.measure_number}: ${result.message}`);
              }
            }
            if (allMessages.length > 0) {
              return { valid: false, message: allMessages.join(" ") };
            }
            return { valid: true, message: "Valid." };
          }
        }
      ],
      validateFinalResult: (args) => {
        const { measures } = args as { measures: { measure_number: number; grid: TimeSliceGridStep[] }[] };
        const allMessages: string[] = [];
        for (const m of measures) {
          const result = validateFingerstylePhysics(m.grid, { fillDensity });
          if (!result.valid) {
            allMessages.push(`Measure ${m.measure_number}: ${result.message}`);
          }
        }
        if (allMessages.length > 0) {
          return { valid: false, message: allMessages.join(" ") };
        }
        
        // Map LLM output back to TimeSliceMeasure objects
        let updatedMeasures: TimeSliceMeasure[] = [];
        for (const submittedMeasure of measures) {
          const original = input.lineMeasures.find(m => m.measure === submittedMeasure.measure_number);
          if (original) {
            updatedMeasures.push({ ...original, grid: submittedMeasure.grid });
          }
        }
        
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
