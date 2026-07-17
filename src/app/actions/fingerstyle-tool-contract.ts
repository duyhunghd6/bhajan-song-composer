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

export const INSPECT_FILL_RESERVATION_SLOTS_TOOL_DEFINITION = {
  type: "function",
  function: {
    name: "inspect_fill_reservation_slots",
    description: "Inspect source-only fill reservation locations before bass planning. These are musical time positions only, never physical notes.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
};

export const SELECT_FILL_RESERVATIONS_TOOL_DEFINITION = buildStringPayloadToolDefinition(
  "select_fill_reservations",
  "Choose use or skip for every source-only fill reservation slot.",
  "reservations_toon",
  "Strict fill-reservations:v1 payload without Markdown fences.",
);

export const INSPECT_BASS_POSITIONS_TOOL_DEFINITION = {
  type: "function",
  function: {
    name: "inspect_bass_positions",
    description: "Inspect legal structural bass positions after fill reservations are selected.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
};

export const SELECT_BASS_POSITIONS_TOOL_DEFINITION = buildStringPayloadToolDefinition(
  "select_bass_positions",
  "Choose use or skip for every legal bass position.",
  "bass_positions_toon",
  "Strict bass-position-selection:v1 payload without Markdown fences.",
);

export const INSPECT_BASS_PITCH_CANDIDATES_TOOL_DEFINITION = {
  type: "function",
  function: {
    name: "inspect_bass_pitch_candidates",
    description: "Inspect server-generated chord-derived bass pitch candidates for selected positions.",
    parameters: { type: "object", additionalProperties: false, properties: {} },
  },
};

export const SELECT_BASS_PITCHES_TOOL_DEFINITION = buildStringPayloadToolDefinition(
  "select_bass_pitches",
  "Choose exactly one server-generated bass candidate for each selected bass position.",
  "bass_pitches_toon",
  "Strict bass-pitch-selection:v1 payload without Markdown fences.",
);

export const INSPECT_FILL_OPPORTUNITIES_TOOL_DEFINITION = {
  type: "function",
  function: {
    name: "inspect_fill_opportunities",
    description: "After selected bass pitches have materialized the frozen TimeGrid, inspect the next compact page of deterministically scored legal fill windows and atomic candidates. Start at cursor 0 and follow nextCursor until end.",
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
  "Submit one use/skip decision for every inspected fill window. Fills are discretionary: an all-skip selection finalizes the bass foundation without fills. Every use decision must later have at least one composed note for that exact window; choose skip when no legal note will be submitted.",
  "selection_toon",
  "Strict fill-selection:v1 payload without Markdown fences.",
);

export const VALIDATE_COMPOSED_FILLS_TOOL_DEFINITION = buildStringPayloadToolDefinition(
  "validate_composed_fills",
  "Propose up to ten distinct complete fill alternatives. Each alternative owns use/skip window decisions and candidate/duration/finger rows and is independently validated against the frozen post-bass catalog.",
  "variants_toon",
  "Strict fill-variants:v1 payload without Markdown fences.",
);

export const SUBMIT_ARRANGED_LINE_TOOL_DEFINITION = buildStringPayloadToolDefinition(
  "submit_arranged_line",
  "Finalize the arrangement by referencing the exact fill-variants:v1 payload accepted by validate_fill_variants.",
  "variants_toon",
  "The exact previously accepted fill-variants:v1 payload.",
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
