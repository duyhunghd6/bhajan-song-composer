import { query_guitar_voicings } from "@/lib/theory/guitar-voicings";
import {
  FINGERSTYLE_TABLATURE_TOON_CONTRACT,
  formatGuitarVoicingsAsToon,
} from "@/lib/theory/fingerstyle-arranger/llm-codec";

export const GUITAR_VOICING_TOOL_DEFINITION = {
  type: "function",
  function: {
    name: "query_guitar_voicings",
    description: [
      "Retrieve valid guitar grips for a chord as a compact voicings:v1 table.",
      "Rows are sorted by ascending span. frets_6_to_1 is the authoritative six-string grip;",
      "bass and melody are string/fret, inner lists usable strings, and barre is fret/from-to.",
      "Use only returned frets and do not invent notes.",
    ].join(" "),
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        chord: { type: "string" },
        melody_pitch: { type: "string" },
        target_position: { type: "string", enum: ["open"] },
      },
      required: ["chord"],
    },
  },
};

export function buildFingerstyleTablatureToolDefinition(name: string, description: string) {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          tablature_toon: {
            type: "string",
            description: `${FINGERSTYLE_TABLATURE_TOON_CONTRACT} Send the complete replacement table without Markdown fences.`,
          },
        },
        required: ["tablature_toon"],
      },
    },
  };
}

export function executeGuitarVoicingQuery(args: unknown): string {
  const { chord, melody_pitch, target_position } = args as {
    chord: string;
    melody_pitch?: string;
    target_position?: "open";
  };
  return formatGuitarVoicingsAsToon(
    query_guitar_voicings(chord, melody_pitch, target_position),
  );
}

export function formatFingerstyleToolDiagnostic(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "null";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "[\n" + value.map((item) => `  ${JSON.stringify(item)}`).join(",\n") + "\n]";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const lines = Object.entries(record).map(([key, entry]) => {
      if (Array.isArray(entry) && entry.length > 0) {
        return `  "${key}": [\n${entry.map((item) => `    ${JSON.stringify(item)}`).join(",\n")}\n  ]`;
      }
      return `  "${key}": ${JSON.stringify(entry)}`;
    });
    return `{\n${lines.join(",\n")}\n}`;
  }
  return JSON.stringify(value);
}
