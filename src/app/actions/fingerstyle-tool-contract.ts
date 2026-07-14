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

function buildStringPayloadToolDefinition(
  name: string,
  description: string,
  propertyName: string,
  propertyDescription: string,
) {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          [propertyName]: { type: "string", description: propertyDescription },
        },
        required: [propertyName],
      },
    },
  };
}

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

export const INSPECT_FILL_OPPORTUNITIES_TOOL_DEFINITION = {
  type: "function",
  function: {
    name: "inspect_fill_opportunities",
    description: "Inspect the next compact page of deterministically scored legal fill windows and atomic candidates. Start at cursor 0 and follow nextCursor until end.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        cursor: { type: "integer", minimum: 0 },
      },
      required: ["cursor"],
    },
  },
};

export const SELECT_FILL_WINDOWS_TOOL_DEFINITION = buildStringPayloadToolDefinition(
  "select_fill_windows",
  "Submit one use/skip decision for every inspected fill window.",
  "selection_toon",
  "Strict fill-selection:v1 payload without Markdown fences.",
);

export const VALIDATE_COMPOSED_FILLS_TOOL_DEFINITION = buildStringPayloadToolDefinition(
  "validate_composed_fills",
  "Validate creative fill candidate sequence, durations, and right-hand fingers against the accepted window selection.",
  "fills_toon",
  "Strict fills:v1 payload without Markdown fences.",
);

export const SUBMIT_ARRANGED_LINE_TOOL_DEFINITION = buildStringPayloadToolDefinition(
  "submit_arranged_line",
  "Finalize the arrangement by referencing the exact fills:v1 payload accepted by validate_composed_fills.",
  "fills_toon",
  "The exact previously accepted fills:v1 payload.",
);

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
