"use server";

import fs from "fs/promises";
import path from "path";

export interface HarmonizationOption {
  progression_name: string;
  explanation: string;
  abc: string;
}

export interface HarmonizeResult {
  options: HarmonizationOption[];
}

export async function harmonizeMelody(abcString: string, metadata: { key: string; scale: string; timeSignature: string }): Promise<HarmonizeResult> {
  try {
    // 1. Read the config
    const configPath = path.join(process.cwd(), "ai-config.json");
    const rawConfig = await fs.readFile(configPath, "utf-8");
    const encoded = JSON.parse(rawConfig).encoded;
    
    // 2. Decode the config
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const config = JSON.parse(decoded) as { url: string; apiKey: string; model: string };

    // 3. Prepare the prompt
    const systemPrompt = `You are an expert music theory assistant specialized in Indian classical, devotional, and Western functional harmony.`;
    
    const userPrompt = `
Task: Analyze the provided ABC notation melody. Identify notes falling on structurally strong beats. 
You MUST provide 5 distinctly different harmonic progressions (e.g., Basic Diatonic, Jazz Reharmonization, Minor Substitution, etc.).

CRITICAL INSTRUCTIONS:
1. If the input ABC already contains chords (e.g., "G", "D7"), you MUST REPLACE them with your newly generated chords for each option! Do NOT just return the original chords. Every option MUST have its own unique progression of inline chords injected into the ABC string.
2. DO NOT REMOVE the lyrics (w: lines) or any other existing structural elements. Ensure the ABC formatting remains perfectly valid.

Metadata:
- Key: ${metadata.key}
- Scale/Mode: ${metadata.scale}
- Time Signature: ${metadata.timeSignature}

Raw ABC Melody:
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
              name: "apply_harmonization",
              description: "Applies 5 different suggested chord progressions to the ABC notation.",
              parameters: {
                type: "object",
                properties: {
                  options: {
                    type: "array",
                    description: "Exactly 5 different harmonic progression options, from basic diatonic to more advanced/jazz variations.",
                    minItems: 5,
                    maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        progression_name: {
                          type: "string",
                          description: "A short descriptive name for this progression style (e.g., 'Basic Diatonic', 'Jazz Reharmonization')."
                        },
                        explanation: {
                          type: "string",
                          description: "A 2-sentence theoretical explanation for the harmonic choices in this specific option."
                        },
                        abc: {
                          type: "string",
                          description: "The original ABC notation intact, but with inline chord annotations injected on strong beats corresponding to this progression."
                        }
                      },
                      required: ["progression_name", "explanation", "abc"]
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
          function: { name: "apply_harmonization" }
        },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("LLM API Error:", err);
      throw new Error(`LLM API returned status: ${res.status}`);
    }

    const data = await res.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "apply_harmonization") {
      throw new Error("LLM did not return the expected tool call");
    }

    const parsed = JSON.parse(toolCall.function.arguments) as HarmonizeResult;
    return parsed;
    
  } catch (error) {
    console.error("Error during harmonization:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during harmonization.");
  }
}
