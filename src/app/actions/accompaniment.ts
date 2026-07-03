"use server";

import fs from "fs/promises";
import path from "path";

import type { AccompanimentOption, AccompanimentResult } from "@/lib/theory/accompaniment-candidates";

async function loadAiConfig() {
  const configPath = path.join(process.cwd(), "ai-config.json");
  const rawConfig = await fs.readFile(configPath, "utf-8");
  const encoded = JSON.parse(rawConfig).encoded;
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  return JSON.parse(decoded) as { url: string; apiKey: string; model: string };
}

async function callLlmForAccompaniment(
  systemPrompt: string,
  userPrompt: string,
  toolName: string,
  toolDescription: string,
  optionConstraints: { instruments: string[]; styles: string[] }
): Promise<AccompanimentResult> {
  const config = await loadAiConfig();

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
            name: toolName,
            description: toolDescription,
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
                        description: "A short, unique identifier for this option."
                      },
                      label: {
                        type: "string",
                        description: "A descriptive name for this arrangement style."
                      },
                      instrument: {
                        type: "string",
                        enum: optionConstraints.instruments,
                        description: "The primary instrument for this accompaniment."
                      },
                      style: {
                        type: "string",
                        enum: optionConstraints.styles,
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
        function: { name: toolName }
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

  if (!toolCall || toolCall.function.name !== toolName) {
    throw new Error("LLM did not return the expected tool call");
  }

  return JSON.parse(toolCall.function.arguments) as AccompanimentResult;
}

export async function generateAccompanimentOptions(
  abcString: string,
  metadata: { key: string; scale: string; timeSignature: string }
): Promise<AccompanimentResult> {
  try {
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

    return await callLlmForAccompaniment(
      systemPrompt,
      userPrompt,
      "suggest_accompaniments",
      "Suggests 5 different accompaniment concepts.",
      { instruments: ["piano", "guitar"], styles: ["pop-ballad", "rock-rnb", "classical-folk", "strict-pima", "folk-travis"] }
    );
  } catch (error) {
    console.error("Error during accompaniment generation:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during accompaniment generation.");
  }
}

export async function generateGuitarOptions(
  abcString: string,
  metadata: { key: string; scale: string; timeSignature: string }
): Promise<AccompanimentResult> {
  try {
    const systemPrompt = `You are an expert guitar arranger specialized in Indian devotional music and accompaniment guitar.

ARRANGEMENT RULES (from ARRANGEMENT01-GUITAR.md):
- Open voicings preferred: Use standard open chord shapes (C, G, Am, Em, D) in first position when possible.
- Barre for out-of-key chords.
- Avoid melody register: If the melody sits in the high-E / B string range, emphasize the lower 4 strings.
- Guide tones: Ensure the 3rd and 7th of each chord are present.
- Bass Line: Root on beat 1, 5th on beat 3, walking bass on transitions (stepwise chromatic or scalar approach notes on beat 4).
- Max fret stretch: 4-5 frets across all strings.
- Max simultaneous fretted notes: 4 (one per finger).

You MUST strictly follow the chord progression provided in the ABC notation. Do NOT change, substitute, or reharmonize any chords.`;

    const userPrompt = `
Task: Analyze the provided ABC notation (melody + chords from the Harmonization step) and generate 5 distinctly different GUITAR accompaniment concepts.

CRITICAL INSTRUCTIONS:
1. ALL 5 options must be for guitar (instrument = "guitar").
2. The style MUST be one of: "strict-pima", "folk-travis", "strummed-pop", "ballad-arpeggio", "rock-power".
3. Each option MUST describe how it handles these 5 elements:
   a) Intro (2-4 bars before the singer enters)
   b) Walking bass / bè trầm (bass line movement between chords)
   c) Fill notes during melodic rests (short fills when the melody rests)
   d) Interlude / giang tấu (instrumental bridge between vocal sections)
   e) Outro (ending section after the final vocal phrase)
4. Strictly use the melody and chords from the provided ABC — do NOT reharmonize.
5. Provide a 2-sentence theoretical explanation for why this style fits.

Metadata:
- Key: ${metadata.key}
- Scale/Mode: ${metadata.scale}
- Time Signature: ${metadata.timeSignature}

Raw ABC (Melody + Chords from Harmonize step):
\`\`\`abc
${abcString}
\`\`\`
`;

    return await callLlmForAccompaniment(
      systemPrompt,
      userPrompt,
      "suggest_guitar_accompaniments",
      "Suggests 5 different guitar accompaniment concepts including intro, interlude, walking bass, fills, and outro.",
      { instruments: ["guitar"], styles: ["strict-pima", "folk-travis", "strummed-pop", "ballad-arpeggio", "rock-power"] }
    );
  } catch (error) {
    console.error("Error during guitar accompaniment generation:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during guitar accompaniment generation.");
  }
}

export async function generatePianoOptions(
  abcString: string,
  metadata: { key: string; scale: string; timeSignature: string }
): Promise<AccompanimentResult> {
  try {
    const systemPrompt = `You are an expert piano arranger specialized in Indian devotional music.

ARRANGEMENT RULES (from ARRANGEMENT02-PIANO.md):

LEFT HAND (LH) — Bass Anchoring:
- Root note in C2–C3 register on beat 1.
- Expand to octave (1-8) or open fifth (1-5-8) for foundation.
- LOW INTERVAL LIMIT (LIL): Below C3, ONLY roots, 5ths, and octaves allowed. NO 3rds, 7ths, or dense clusters below C3.

RIGHT HAND (RH) — Voicing:
- Prioritize 3rd and 7th (guide tones) in mid-register (C3–C5).
- If melody is in C4–C5, invert RH chords to sit BELOW melody to prevent masking.
- Use Drop-2 or open voicings to avoid muddy clusters.

VOICE LEADING (Shortest Path Rule):
- Common tones stay stationary between adjacent chords.
- Inner voices move by ≤ 2 semitones. Use inversions instead of root position jumps.
- When LH leaps, RH moves in contrary motion.

GAP FILLING:
- When melody sustains > dotted half note OR has explicit rest: RH can insert a scalar fill.
- The INSTANT melody resumes active movement: yield immediately, return to comping.
- Fills use scale tones only, prefer descending runs, leave a 16th-note buffer before melody re-entry.

PHYSICAL CONSTRAINTS:
- Single hand span ≤ Major 10th (16 semitones), comfortable ≤ octave.
- LH and RH cannot occupy the same keys simultaneously.

You MUST strictly follow the chord progression provided in the ABC notation. Do NOT change, substitute, or reharmonize any chords.`;

    const userPrompt = `
Task: Analyze the provided ABC notation (melody + chords from the Harmonization step) and generate 5 distinctly different PIANO accompaniment concepts.

CRITICAL INSTRUCTIONS:
1. ALL 5 options must be for piano (instrument = "piano").
2. The style MUST be one of: "pop-ballad", "rock-rnb", "classical-folk", "devotional-sustained", "jazz-comping".
3. Each option should describe whether it is designed for:
   a) Piano Solo (playable LH + RH arrangement where the piano carries the melody)
   b) Vocal Backing (accompaniment that supports a singer, avoiding melody register)
4. Strictly use the melody and chords from the provided ABC — do NOT reharmonize.
5. Provide a 2-sentence theoretical explanation for why this style fits.

Metadata:
- Key: ${metadata.key}
- Scale/Mode: ${metadata.scale}
- Time Signature: ${metadata.timeSignature}

Raw ABC (Melody + Chords from Harmonize step):
\`\`\`abc
${abcString}
\`\`\`
`;

    return await callLlmForAccompaniment(
      systemPrompt,
      userPrompt,
      "suggest_piano_accompaniments",
      "Suggests 5 different piano accompaniment concepts for solo piano or vocal backing.",
      { instruments: ["piano"], styles: ["pop-ballad", "rock-rnb", "classical-folk", "devotional-sustained", "jazz-comping"] }
    );
  } catch (error) {
    console.error("Error during piano accompaniment generation:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during piano accompaniment generation.");
  }
}
