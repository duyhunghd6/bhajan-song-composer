"use server";

import { requestOpenAiCompatibleToolLoop, type ToolDiagnosticEvent, type ToolLoopValidationResult } from "./ai-config";
import { query_guitar_voicings } from "@/lib/theory/guitar-voicings";
import type { TimeSliceMeasure, TimeSliceGridStep } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { type GuitarStringNumber } from "@/lib/theory/fingerstyle-compressor";
import { validateGuitarTab, type GuitarTabEvent } from "@/lib/theory/guitar-tab-validation";
import { scientificPitchForStringFret } from "@/lib/theory/guitar-playability";
import { formatMeasureAsToon } from "@/lib/theory/fingerstyle-arranger/toon-utils";

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

function formatToolJson(obj: any): string {
  if (!obj) return "null";
  if (typeof obj === "object" && obj.grid && Array.isArray(obj.grid)) {
    let output = "{\n";
    for (const key in obj) {
      if (key === "grid") {
        output += '  "grid": [\n';
        for (const item of obj.grid) {
          output += `    ${JSON.stringify(item)},\n`;
        }
        output = output.replace(/,\n$/, "\n");
        output += '  ]';
      } else {
        output += `  "${key}": ${JSON.stringify(obj[key])},\n`;
      }
    }
    output = output.replace(/,\n$/, "\n");
    output += "\n}";
    return output;
  }
  return JSON.stringify(obj, null, 2);
}

import { validateFingerstylePhysics } from "@/lib/theory/fingerstyle-arranger/physics-validation";

export async function generateAIFingerstyleMeasure(
  input: GenerateFingerstyleMeasureInput
): Promise<GenerateFingerstyleMeasureOutput> {
  const stepId = `fingerstyle-measure-${input.measure.measure}`;
  const systemPrompt = `You are an expert devotional fingerstyle guitar arranger. You will receive a 16-step TOON grid. Follow this exact tool-calling workflow sequentially:

1. **Lock the Grip & Voicings (Tool Call First):**
   - Scan the grid. On Step 1, Step 9, AND on any step where the \`chord\` symbol changes, you MUST call \`query_guitar_voicings(chord, melody_pitch)\`.
   - **Constraint Check:** You are strictly forbidden from inventing fretted notes. You must exclusively use the strings and frets provided by the tool's returned grip.
   - **Playability Rule:** The tool output now lists all possible bass notes sorted by \`fretDistance\` (the fret distance between the melody note and the bass note). You MUST choose the grip with the smallest \`fretDistance\` to ensure physical playability.

2. **Right-Hand Foundation (Strums vs Pinches):**
   - **Strumming on Downbeats:** Scan the grid for the strong downbeat weight marker ⬤ (Beat 1). You MUST establish a rich harmonic foundation using a full 5-string or 6-string **Strum** across all active strings from the grip.
     - *Strum Notation Rule:* To notate a strum, assign the Thumb (\\\`p\\\`) to ALL the bass and inner strings being strummed, leaving the fingers for the melody.
     - *Example of a full 6-string Em strum:* Str 6 (\\\`p\\\`), Str 5 (\\\`p\\\`), Str 4 (\\\`p\\\`), Str 3 (\\\`p\\\`), Str 2 (\\\`p\\\`), Str 1 (\\\`a\\\` - Melody).
   - **Standard PIMA Pinches (Max 4 strings):** On secondary strong beats ● (Beat 3) or non-downbeat chord changes, play a lighter 4-note **Pinch**. The Thumb (\\\`p\\\`) plays exactly 1 Bass String. The fingers (\\\`i, m, a\\\`) play up to 3 Treble/Inner Strings.
     - *Example of a 4-note C pinch (X32010):* Play Str 5 (\\\`p\\\`), Str 3 (\\\`i\\\`), Str 2 (\\\`m\\\`), Str 1 (\\\`a\\\`).
     - *Example of a 4-note D pinch (XX0232):* Play Str 4 (\\\`p\\\`), Str 3 (\\\`i\\\`), Str 2 (\\\`m\\\`), Str 1 (\\\`a\\\`).

3. **Protect the Melody & Double-Stops:**
   - The sung melody is absolute priority. Map the exact melody pitches to the exact \`attack\` steps on the highest available strings.
   - On secondary strong beats ● (Beat 3), do not play a heavy 4-note pinch. Play a simpler **double-stop** (1 Bass note + the Melody note, or Bass + 1 inner tone) to keep the rhythm balanced and flowing.
   - **Simultaneous String Collision:** If a chord voicing requires fretting an inner string, but the melody note is also mapped to that exact same string, the melody note wins. Drop the chord tone from your pinch.

4. **PIMA Fills & The Sustain Rule (Inner Arpeggios):**
   - Look at the \`null\` steps (the empty 16th-note spaces). You may add light, arpeggiated inner chord tones to keep the rhythm flowing. Keep fills sparse and subservient to the vocal melody.
   - **Sustain Protection Rule (CRITICAL):** If the vocal melody is marked as \`"state": "sustain"\` on a specific string across multiple steps, you are **physically forbidden** from plucking a fill note on that exact same string. Doing so will prematurely cut off the singer's note.

5. **Validate & Submit:**
   - Call \`validate_fingerstyle_physics()\` to verify your right-hand finger budget, string alignments, and sustain rules.
   - Once validated, submit your final work using \`submit_arranged_measure()\`.`;

  const userPrompt = `Arrange Measure ${input.measure.measure} in ${input.measure.style_profile.key} key.
Here is the TOON grid:
${formatMeasureAsToon(input.measure)}`;

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
          logs.push(`[TOOL IN] ${event.toolName}(${formatToolJson(event.input)})`);
        } else if (event.type === "tool-result") {
          logs.push(`[TOOL OUT] ${event.toolName} => ${formatToolJson(event.result)}`);
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
        {
          type: "function",
          function: {
            name: "submit_arranged_measure",
            description: "Submit the final arranged grid and visual markdown tablature.",
            parameters: {
              type: "object",
              properties: {
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
              },
              required: ["grid"]
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
            description: "Check if the proposed grid is physically playable without cutting off sustaining melody notes.",
            parameters: {
              type: "object",
              properties: {
                grid: {
                  type: "array",
                  description: "The grid of steps to validate.",
                  items: { type: "object" }
                }
              },
              required: ["grid"]
            }
          }
        }
      ],
      finalToolName: "submit_arranged_measure",
      localTools: [
        {
          name: "query_guitar_voicings",
          execute: (args) => {
            const { chord, melody_pitch, target_position } = args as { chord: string, melody_pitch?: string, target_position?: "open" };
            return query_guitar_voicings(chord, melody_pitch, target_position);
          }
        },
        {
          name: "validate_fingerstyle_physics",
          execute: (args) => {
            const { grid } = args as { grid: TimeSliceGridStep[] };
            return validateFingerstylePhysics(grid);
          }
        }
      ],
      validateFinalResult: (args) => {
        const { grid } = args as { grid: TimeSliceGridStep[] };
        const validation = validateFingerstylePhysics(grid);
        if (validation.valid) {
          finalOutput = {
            success: true,
            measure: { ...input.measure, grid },
            logs
          };
          return { valid: true };
        }
        return {
          valid: false,
          message: validation.message
        };
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
