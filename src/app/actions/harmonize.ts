"use server";

import { requestOpenAiCompatibleTool } from "./ai-config";
import {
  HARMONIZATION_CANDIDATE_STYLES,
  HarmonizationValidationError,
  normalizeHarmonizeResult,
  type HarmonizeMetadata,
  type HarmonizeResult,
} from "@/lib/theory/harmonization-candidates";

export type { HarmonizationOption } from "@/lib/theory/harmonization-candidates";

const TOOL_NAME = "apply_harmonization";

function formatMetadata(metadata: HarmonizeMetadata): string {
  return [
    `- Key: ${metadata.key}`,
    `- Scale/Mode: ${metadata.scale}`,
    `- Time Signature: ${metadata.timeSignature}`,
    metadata.raga ? `- Raga: ${metadata.raga}` : null,
    metadata.taal ? `- Taal: ${metadata.taal}` : null,
    metadata.title ? `- Song Title: ${metadata.title}` : null,
    metadata.language ? `- Language/Tradition: ${metadata.language}` : null,
    metadata.devotionalMood ? `- Devotional Mood: ${metadata.devotionalMood}` : null,
    metadata.constraints?.length ? `- Additional Constraints: ${metadata.constraints.join("; ")}` : null,
  ].filter(Boolean).join("\n");
}

function buildUserPrompt(abcString: string, metadata: HarmonizeMetadata, validationIssues: string[] = []): string {
  const repairText = validationIssues.length > 0
    ? `\nPrevious response failed validation. Fix every issue below and return a fresh ${TOOL_NAME} tool call only:\n${validationIssues.map((issue) => `- ${issue}`).join("\n")}\n`
    : "";

  return `
Task:
Generate exactly 5 distinct harmonic interpretations for the provided ABC melody.

Required styles, in this exact order:
1. simple-devotional — simple bhajan/devotional I-IV-V or tonic/subdominant/dominant support
2. emotional-ballad — softer vi/ii/min7/maj7 color where musically valid
3. raga-aware-minimal — sparse harmony, drone/pedal-friendly, avoids over-westernizing the melody
4. western-functional — clear tonic, predominant, dominant, cadence logic
5. rich-reharmonization — tasteful secondary dominants or borrowed color, still singable

Hard rules:
1. Do not change original melody notes, rests, note durations, bar structure, key signature, meter, lyrics, or headers.
2. Only inject inline ABC chord symbols before relevant existing melody notes or rests.
3. If input ABC already contains chord symbols, replace them with the newly generated chords for each option.
4. Do not add new V: voices, [V:] switches, %%score directives, bass clef, piano parts, guitar parts, drums, flute, violin, chord-note blocks, accompaniment, percussion, or extra melodic notes.
5. Prioritize structurally strong beats, especially beats 1 and 3 in 4/4.
6. Each chord should support the strong-beat melody note as root, 3rd, 5th, 7th, or a clearly explained suspension/tension.
7. Respect the provided key, scale/mode, raga, taal, language/tradition, and devotional mood if present.
8. If a chord is chromatic, borrowed, or outside the raga/scale, include a warning.
9. Return only the forced ${TOOL_NAME} tool call.
${repairText}
Metadata:
${formatMetadata(metadata)}

Raw ABC Melody:
\`\`\`abc
${abcString}
\`\`\`
`;
}

function harmonizationToolSchema() {
  return {
    type: "function",
    function: {
      name: TOOL_NAME,
      description: "Returns exactly 5 validated, chord-annotated harmonization candidates for an existing ABC melody.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          detectedKey: {
            type: "string",
            description: "Detected or confirmed key center for the melody.",
          },
          detectedScale: {
            type: "string",
            description: "Detected or confirmed scale/mode/raga context for the melody.",
          },
          timeSignature: {
            type: "string",
            description: "Confirmed meter/time signature.",
          },
          options: {
            type: "array",
            description: "Exactly 5 distinct harmonic interpretations in the requested style order.",
            minItems: 5,
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: {
                  type: "string",
                  description: "Stable kebab-case candidate id, matching one requested style id.",
                  enum: HARMONIZATION_CANDIDATE_STYLES,
                },
                label: {
                  type: "string",
                  description: "Short human-readable label for this candidate.",
                },
                style: {
                  type: "string",
                  description: "One requested style id.",
                  enum: HARMONIZATION_CANDIDATE_STYLES,
                },
                progression: {
                  type: "array",
                  description: "Chord symbols in order of harmonic events/measures.",
                  items: { type: "string" },
                },
                romanNumerals: {
                  type: "array",
                  description: "Roman numeral analysis aligned with progression.",
                  items: { type: "string" },
                },
                explanation: {
                  type: "string",
                  description: "Concise theoretical explanation for this option and strong-beat support.",
                },
                harmonizedAbc: {
                  type: "string",
                  description: "Original ABC intact with only inline chord symbols injected or replaced.",
                },
                confidence: {
                  type: "number",
                  description: "0 to 1 confidence that the option preserves melody and supports strong beats.",
                },
                warnings: {
                  type: "array",
                  description: "Warnings for chromatic, borrowed, outside-raga, or musically risky choices.",
                  items: { type: "string" },
                },
                validationNotes: {
                  type: "array",
                  description: "Notes explaining melody preservation, strong-beat support, and ABC validity.",
                  items: { type: "string" },
                },
              },
              required: [
                "id",
                "label",
                "style",
                "progression",
                "romanNumerals",
                "explanation",
                "harmonizedAbc",
                "confidence",
                "warnings",
                "validationNotes",
              ],
            },
          },
        },
        required: ["detectedKey", "detectedScale", "timeSignature", "options"],
      },
    },
  };
}

async function requestHarmonization(abcString: string, metadata: HarmonizeMetadata, validationIssues: string[] = []): Promise<unknown> {
  return requestOpenAiCompatibleTool({
    systemPrompt: "You are an expert music theory assistant specialized in Indian classical, devotional, bhajan, and Western functional harmony. You preserve user melody exactly and only add inline ABC chord symbols during the harmonization step.",
    userPrompt: buildUserPrompt(abcString, metadata, validationIssues),
    toolSchema: harmonizationToolSchema(),
    toolName: TOOL_NAME,
  });
}

export async function harmonizeMelody(abcString: string, metadata: HarmonizeMetadata): Promise<HarmonizeResult> {
  try {
    const raw = await requestHarmonization(abcString, metadata);

    try {
      return normalizeHarmonizeResult(raw, abcString, metadata);
    } catch (error) {
      if (!(error instanceof HarmonizationValidationError)) throw error;

      const repairedRaw = await requestHarmonization(abcString, metadata, error.issues);
      return normalizeHarmonizeResult(repairedRaw, abcString, metadata);
    }
  } catch (error) {
    console.error("Error during harmonization:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during harmonization.");
  }
}
