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

function validateFingerstylePhysics(grid: TimeSliceGridStep[]): { valid: boolean; message: string } {
  const messages: string[] = [];
  const tabEvents: GuitarTabEvent[] = [];

  for (let i = 0; i < grid.length; i++) {
    const step = grid[i];
    
    // Build tab events and do basic checks
    if (step.tablature && step.tablature.length > 0) {
      const stringsInUse = new Set<number>();
      for (const tab of step.tablature) {
        if (stringsInUse.has(tab.string)) {
          messages.push(`Step ${step.step}: Multiple notes assigned to string ${tab.string}.`);
        }
        stringsInUse.add(tab.string);

        const notePitch = scientificPitchForStringFret(tab.string, tab.fret);

        if (tab.role === "melody" && step.melody.pitch) {
          if (notePitch !== step.melody.pitch) {
            messages.push(`Step ${step.step}: Melody pitch mismatch. Expected ${step.melody.pitch}, got ${notePitch} on string ${tab.string} fret ${tab.fret}.`);
          }
        }

        tabEvents.push({
          measureIndex: 0,
          beat: step.step,
          note: notePitch,
          string: tab.string as 1 | 2 | 3 | 4 | 5 | 6,
          fret: tab.fret,
          role: tab.role
        });
      }
    }
  }

  const playabilityResult = validateGuitarTab(tabEvents, {
    guitarProfile: "guitar-classic",
    requireScientificPitch: true,
  });

  if (!playabilityResult.valid) {
    for (const issue of playabilityResult.issues) {
      messages.push(`Step ${issue.beat}: ${issue.message}`);
    }
  }

  // Check if any fill interrupts the melody
  // The melody pitch is mapped to a string. If step.melody.state === "sustain", 
  // no fill should be played on the string where the melody attack happened.
  let melodyString: GuitarStringNumber | null = null;
  for (let i = 0; i < grid.length; i++) {
    const step = grid[i];
    if (step.melody.state === "attack") {
      const melodyTab = step.tablature?.find(t => t.role === "melody");
      if (melodyTab) melodyString = melodyTab.string;
    }
    
    if (step.melody.state === "sustain" && melodyString !== null) {
      const fillOnMelodyString = step.tablature?.find(t => t.string === melodyString && t.role !== "melody");
      if (fillOnMelodyString) {
        messages.push(`Step ${step.step}: Fill played on string ${melodyString} which is currently sustaining the melody note.`);
      }
    }

    if (step.melody.state === "rest") {
      melodyString = null;
    }
  }

  return {
    valid: messages.length === 0,
    message: messages.length === 0 ? "Valid." : messages.join(" "),
  };
}

export async function generateAIFingerstyleMeasure(
  input: GenerateFingerstyleMeasureInput
): Promise<GenerateFingerstyleMeasureOutput> {
  const stepId = `fingerstyle-measure-${input.measure.measure}`;
  const systemPrompt = `You are an expert devotional fingerstyle guitar arranger. You will receive a 16-step TOON grid. Follow this exact tool-calling workflow:

1. Anchor the Bass: Scan the grid for the weight markers.
   - On ⬤ (Beat 1), you MUST place the lowest root Bass note (Thumb/P).
   - On ● (Beat 3), you MUST place a secondary root/5th Bass note.
   - On * (Soft beats), DO NOT play heavy bass notes.
2. Lock the Grip: Call query_guitar_voicings() on steps 1 and 9 to retrieve the valid open-position shapes.
3. Protect the Melody: Map the exact melody pitches to the exact attack steps on the highest available strings.
4. PIMA Fills: Look at the null steps (the empty 16th-note spaces). You may add light, arpeggiated inner chord tones (Index/Middle). Rule Check: Because this is a devotional bhajan, keep fills sparse. Avoid dense attacks during vocal phrases.
5. Validate & Submit: Call validate_fingerstyle_physics() before submitting your work using submit_arranged_measure().`;

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
