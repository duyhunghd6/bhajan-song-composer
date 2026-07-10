"use server";

import { requestOpenAiCompatibleTool } from "./ai-config";

const validateAbcSystemPrompt = `You are an expert in ABC notation (v2.1) and music theory.
Your task is to validate and reformat ABC notation input by the user, making it clean, readable, and structured for downstream processing.
If there are minor errors or missing spaces, fix them.

Important structural rules for output formatting:
1. Divide the music into logical sections or lines by inserting "% Line X" comments before each logical musical phrase or system.
2. If lyrics are present, keep them and align them reasonably with the notes. Ensure each lyrical line is preceded by a % Line X comment (e.g. % Line 1) if possible, to help segment the song structure.
3. Ensure standard headers are present (e.g., X:, T:, M:, L:, K:).
4. Ensure the directive %%MIDI program 52 is present after the headers. This makes the Melody playback sound like singing (Choir Aahs), allowing it to stand out against accompaniment. If it is missing, suggest adding it.
5. Do not alter the fundamental pitches or rhythm unless there is an obvious typo that breaks ABC rendering.
6. Remove all voice and score directives, such as %%score, V:Melody treble nm="Voice" snm="Voice", or V:Melody. The resulting ABC should only have the main standard headers, MIDI program, % Line X markers, notes, and lyrics.
7. Do not return the full ABC notation string. Instead, return a list of specific text replacements (\`edits\`) to apply to the input string.
8. In your feedback, briefly describe the formatting you applied or any errors you fixed.`;

export type AbcValidationEdit = {
  originalLines: string;
  newLines: string;
  explanation: string;
};

export async function validateAbcNotation(abcString: string) {
  const result = await requestOpenAiCompatibleTool({
    systemPrompt: validateAbcSystemPrompt,
    userPrompt: `Please validate and format this ABC notation:\n\n${abcString}`,
    toolName: "applyAbcValidation",
    toolSchema: {
      type: "function",
      function: {
        name: "applyAbcValidation",
        description: "Applies validation and formatting to ABC notation.",
        parameters: {
          type: "object",
          properties: {
            isValid: {
              type: "boolean",
              description: "Whether the original ABC notation was structurally sound and parsable.",
            },
            feedback: {
              type: "string",
              description: "A short, user-friendly description of what was fixed or formatted.",
            },
            edits: {
              type: "array",
              description: "A list of text replacements to apply.",
              items: {
                type: "object",
                properties: {
                  originalLines: {
                    type: "string",
                    description: "The exact substring/lines from the input to find and replace. Include enough context to be unique.",
                  },
                  newLines: {
                    type: "string",
                    description: "The new substring/lines to replace it with. Use an empty string to delete.",
                  },
                  explanation: {
                    type: "string",
                    description: "Why this change is needed.",
                  },
                },
                required: ["originalLines", "newLines", "explanation"],
              },
            },
          },
          required: ["isValid", "feedback", "edits"],
        },
      },
    },
    temperature: 0.1,
  });

  return result as {
    isValid: boolean;
    feedback: string;
    edits: AbcValidationEdit[];
  };
}
