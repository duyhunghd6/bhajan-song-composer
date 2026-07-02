"use server";

import fs from "fs/promises";
import path from "path";

import type { AccompanimentOption, AccompanimentResult } from "@/lib/theory/accompaniment-candidates";

export async function generateAccompanimentOptions(
  abcString: string,
  metadata: { key: string; scale: string; timeSignature: string }
): Promise<AccompanimentResult> {
  try {
    // 1. Read the config
    const configPath = path.join(process.cwd(), "ai-config.json");
    const rawConfig = await fs.readFile(configPath, "utf-8");
    const encoded = JSON.parse(rawConfig).encoded;
    
    // 2. Decode the config
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const config = JSON.parse(decoded) as { url: string; apiKey: string; model: string };

    // 3. Prepare the prompt
    const systemPrompt = `You are an expert music theory arranger specialized in Indian devotional music, piano accompaniment, and guitar accompaniment.`;
    
    const userPrompt = `
Task: Analyze the provided ABC notation (melody + chords) and generate 5 distinctly different accompaniment concepts.

CRITICAL INSTRUCTIONS:
1. Provide a mix of piano and guitar options.
2. For Piano, the style MUST be one of: "pop-ballad", "rock-rnb", "classical-folk".
3. For Guitar, the style MUST be one of: "strict-pima", "folk-travis".
4. Provide a 2-sentence theoretical explanation for why this style fits the melody and chords.

Metadata:
- Key: ${metadata.key}
- Scale/Mode: ${metadata.scale}
- Time Signature: ${metadata.timeSignature}

Raw ABC:
\`\`\`abc
${abcString}
\`\`\`
`;

    // 4. Call the LLM
    const res = await fetch(`${config.url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_accompaniments",
              description: "Suggests 5 different accompaniment concepts.",
              parameters: {
                type: "object",
                properties: {
                  options: {
                    type: "array",
                    description: "Exactly 5 different accompaniment options.",
                    minItems: 5,
                    maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          description: "A short, unique identifier for this option (e.g., 'piano-pop-1')."
                        },
                        label: {
                          type: "string",
                          description: "A descriptive name for this arrangement style (e.g., 'Flowing Pop/Ballad Piano')."
                        },
                        instrument: {
                          type: "string",
                          enum: ["piano", "guitar"],
                          description: "The primary instrument for this accompaniment."
                        },
                        style: {
                          type: "string",
                          enum: ["pop-ballad", "rock-rnb", "classical-folk", "strict-pima", "folk-travis"],
                          description: "The specific rule engine profile to use."
                        },
                        explanation: {
                          type: "string",
                          description: "A 2-sentence theoretical explanation for this choice."
                        }
                      },
                      required: ["id", "label", "instrument", "style", "explanation"]
                    }
                  }
                },
                required: ["options"]
              }
            }
          }
        ],
        tool_choice: {
          type: "function",
          function: { name: "suggest_accompaniments" }
        },
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("LLM API Error:", err);
      throw new Error(`LLM API returned status: ${res.status}`);
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "suggest_accompaniments") {
      throw new Error("LLM did not return the expected tool call");
    }

    const parsed = JSON.parse(toolCall.function.arguments) as AccompanimentResult;
    return parsed;
    
  } catch (error) {
    console.error("Error during accompaniment generation:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during accompaniment generation.");
  }
}
