import {
  ACCOMPANIMENT_GUITAR_TAB_VALIDATION_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_STEPS,
  type AccompanimentWorkflowStepId,
} from "./definition";

function getAccompanimentWorkflowStep(stepId: AccompanimentWorkflowStepId) {
  const step = ACCOMPANIMENT_WORKFLOW_STEPS.find((candidate) => candidate.id === stepId);
  if (!step) throw new Error(`Unknown accompaniment workflow step: ${stepId}`);
  return step;
}

function isGuitarTabValidationWorkflowStep(stepId: AccompanimentWorkflowStepId): boolean {
  return (ACCOMPANIMENT_GUITAR_TAB_VALIDATION_STEP_IDS as readonly AccompanimentWorkflowStepId[]).includes(stepId);
}

/**
 * Compact guitar tab event schema.
 * Key map: m=measureIndex, b=beat, n=note, s=string, f=fret, r=role,
 * sid=sourceEventId, sd=subdivision, gid=simultaneousGroupId.
 */
function buildGuitarTabDataProperty() {
  return {
    type: "object",
    description: "Validated guitar tab data with compact event keys.",
    additionalProperties: false,
    properties: {
      profileId: {
        type: "string",
        enum: ["guitar-classic", "standard-six-string"],
        description: "Guitar profile for fret range validation.",
      },
      voicingProfileId: {
        type: "string",
        description: "Voicing profile: open-position, barre, fingerstyle, etc.",
      },
      events: {
        type: "array",
        minItems: 1,
        description: "Tab events using compact keys: m=measure, b=beat, n=note, s=string(1-6), f=fret, r=role, sid=sourceEventId, sd=subdivision, gid=simultaneousGroupId.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            m: { type: "number", description: "Measure index." },
            b: { type: "number", description: "Beat within measure." },
            sd: { type: ["string", "number"], description: "Subdivision label." },
            gid: { type: "string", description: "Simultaneous group id." },
            sid: { type: "string", description: "Source event id." },
            n: { type: "string", description: "Pitch, e.g. E2, B3, F#4." },
            s: { type: "integer", enum: [1, 2, 3, 4, 5, 6], description: "String 1(high E)-6(low E)." },
            f: { type: "number", description: "Fret number." },
            r: { type: "string", description: "Role: melody, bass, root, fill, etc." },
          },
          required: ["m", "b", "sid", "n", "s", "f", "r"],
        },
      },
    },
    required: ["profileId", "events"],
  };
}

/** Expand compact tab event keys to full names for downstream consumers. */
export function expandCompactTabEvent(compact: Record<string, unknown>): Record<string, unknown> {
  return {
    measureIndex: compact.m ?? compact.measureIndex,
    beat: compact.b ?? compact.beat,
    subdivision: compact.sd ?? compact.subdivision,
    simultaneousGroupId: compact.gid ?? compact.simultaneousGroupId,
    sourceEventId: compact.sid ?? compact.sourceEventId,
    note: compact.n ?? compact.note,
    string: compact.s ?? compact.string,
    fret: compact.f ?? compact.fret,
    role: compact.r ?? compact.role,
  };
}

/** Convert LLM wire events to the canonical validator/domain shape. */
export function normalizeGuitarTabEvents(events: unknown): Record<string, unknown>[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter((event): event is Record<string, unknown> => Boolean(event && typeof event === "object" && !Array.isArray(event)))
    .map(expandCompactTabEvent);
}

/** Check if tab events use compact keys and need expansion. */
export function hasCompactTabKeys(event: Record<string, unknown>): boolean {
  return "m" in event && "b" in event && "s" in event;
}

function buildWorkflowOptionDataProperty(stepId?: AccompanimentWorkflowStepId) {
  if (isGuitarTabValidationWorkflowStep(stepId ?? "key-beats")) {
    return {
      type: "object",
      description: "Step data with guitarTab.events using compact keys (m/b/n/s/f/r).",
      additionalProperties: true,
      properties: {
        guitarTab: buildGuitarTabDataProperty(),
      },
      required: ["guitarTab"],
    };
  }

  if (stepId === "key-beats") {
    return {
      type: "object",
      description: "Key/scale/cadence analysis plus strong-beat emphasis direction.",
      additionalProperties: true,
      properties: {
        strongBeatEmphasis: {
          type: "string",
          enum: ["all-metric-beats", "primary-strong-beats", "downbeats-only"],
          description: "Strong-beat emphasis direction.",
        },
      },
      required: ["strongBeatEmphasis"],
    };
  }

  if (stepId === "chord-roles-progression") {
    return {
      type: "object",
      description: "Chord-tone roles, progression, and harmonized ABC.",
      additionalProperties: true,
      properties: {
        harmonizedAbc: {
          type: "string",
          description: "Full ABC with chord symbols applied. Copy from break_measures_line result. Inline chord quotes begin exactly at the note/rest where the harmony changes."
        },
        noteChordAssignments: {
          type: "array",
          description: "Server-derived note-to-active-chord timeline. Do not provide this field; it is rebuilt from harmonizedAbc."
        },
      },
      required: ["harmonizedAbc"],
    };
  }

  if (stepId === "voice-leading-validation") {
    return {
      type: "object",
      description: "Validated harmonized ABC after voice-leading smoothing.",
      additionalProperties: true,
      properties: {
        validatedAbc: {
          type: "string",
          description: "Final chord-annotated ABC. Copy from break_measures_line result."
        },
        harmonizedAbc: {
          type: "string",
          description: "Fallback harmonized ABC if validatedAbc is not available."
        },
        noteChordAssignments: {
          type: "array",
          description: "Server-derived note-to-active-chord timeline. Do not provide this field; it is rebuilt from the playable ABC."
        },
      },
    };
  }

  return {
    type: "object",
    description: "Step-specific structured data.",
    additionalProperties: true,
  };
}

function buildWorkflowOptionsProperty(description: string, stepId?: AccompanimentWorkflowStepId) {
  return {
    type: "array",
    minItems: 1,
    maxItems: 2,
    description,
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", description: "Stable kebab-case option id." },
        label: { type: "string", maxLength: 60, description: "Short label (max 60 chars)." },
        summary: { type: "string", maxLength: 100, description: "One sentence summary (max 100 chars)." },
        justification: { type: "string", maxLength: 120, description: "Music-theory justification (max 120 chars)." },
        data: buildWorkflowOptionDataProperty(stepId),
        warnings: {
          type: "array",
          maxItems: 2,
          items: { type: "string", maxLength: 80 },
          description: "Max 2 concise warnings.",
        },
        validationNotes: {
          type: "array",
          maxItems: 2,
          items: { type: "string", maxLength: 80 },
          description: "Max 2 concise validation notes.",
        },
      },
      required: ["id", "label", "summary", "justification", "data", "warnings", "validationNotes"],
    },
  };
}

function buildWorkflowResultGroupProperty(stepId: AccompanimentWorkflowStepId) {
  const step = getAccompanimentWorkflowStep(stepId);
  return {
    type: "object",
    additionalProperties: false,
    description: `Options for ${step.label}.`,
    properties: {
      options: buildWorkflowOptionsProperty(`1-2 options for ${step.label}.`, stepId),
    },
    required: ["options"],
  };
}

export function getAccompanimentWorkflowLlmToolNames(): string[] {
  return [
    ...ACCOMPANIMENT_WORKFLOW_STEPS.map((step) => `generate_${step.id.replaceAll("-", "_")}`),
    "generate_consolidated_chord_ingestion",
    "break_measures_line",
    "add_strong_beat_icons",
    "valid_guitar_tab",
    "query_guitar_voicings",
  ];
}

export function buildAddStrongBeatIconsToolSchema() {
  return {
    type: "function",
    function: {
      name: "add_strong_beat_icons",
      description: "Call during Key & Beats step. LLM chooses emphasis; local algorithm computes beat directives. Do not copy computed fields into the final tool payload.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          emphasis: {
            type: "string",
            enum: ["all-metric-beats", "primary-strong-beats", "downbeats-only"],
            description: "Emphasis direction for strong beats.",
          },
          rationale: {
            type: "string",
            description: "Short reason for this emphasis.",
          },
        },
        required: ["emphasis"],
      },
    },
  };
}

export function buildBreakMeasuresLineToolSchema() {
  return {
    type: "function",
    function: {
      name: "break_measures_line",
      description: "Normalize ABC measure-line layout to match Source ABC. Call before final output with harmonizedAbc/validatedAbc.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          generatedAbc: {
            type: "string",
            description: "The ABC to regroup to match source measure-line pattern.",
          },
        },
        required: ["generatedAbc"],
      },
    },
  };
}

export function buildConsolidatedChordIngestionToolSchema() {
  return {
    type: "function",
    function: {
      name: "generate_consolidated_chord_ingestion",
      description: "Generate chord roles/progression and voice-leading validation from lyric chord annotations.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          chordRolesProgression: buildWorkflowResultGroupProperty("chord-roles-progression"),
          voiceLeadingValidation: buildWorkflowResultGroupProperty("voice-leading-validation"),
        },
        required: ["chordRolesProgression", "voiceLeadingValidation"],
      },
    },
  };
}

export function buildAccompanimentWorkflowToolSchema(stepId: AccompanimentWorkflowStepId) {
  const step = getAccompanimentWorkflowStep(stepId);

  return {
    type: "function",
    function: {
      name: `generate_${stepId.replaceAll("-", "_")}`,
      description: `Generate 1-2 options for ${step.label}.`,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          options: buildWorkflowOptionsProperty("1-2 options for the user to choose from.", stepId),
        },
        required: ["options"],
      },
    },
  };
}

export function buildQueryGuitarVoicingsToolSchema() {
  return {
    type: "function",
    function: {
      name: "query_guitar_voicings",
      description: "Retrieve valid guitar voicings for a chord. Call BEFORE fretting notes manually.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          chord: { type: "string" },
          melody_pitch: { type: "string" },
          target_position: { type: "string", enum: ["open"] }
        },
        required: ["chord"]
      }
    }
  };
}
