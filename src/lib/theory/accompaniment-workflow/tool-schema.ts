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

function buildGuitarTabDataProperty() {
  return {
    type: "object",
    description: "Validated guitar tab event data required for physical playability checks.",
    additionalProperties: false,
    properties: {
      events: {
        type: "array",
        minItems: 1,
        description: "Concrete guitar tab events. Events sharing measureIndex + beat + subdivision or simultaneousGroupId are simultaneous and must not reuse a string.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            measureIndex: { type: "number", description: "Measure index for this tab event." },
            beat: { type: "number", description: "Beat or subdivision time within the measure." },
            subdivision: { type: ["string", "number"], description: "Optional subdivision label." },
            simultaneousGroupId: { type: "string", description: "Optional explicit id for notes that sound together." },
            note: { type: "string", description: "Sounding pitch label, e.g. E3 or G3." },
            string: { type: "integer", enum: [1, 2, 3, 4, 5, 6], description: "Guitar string number, 1 high E through 6 low E." },
            fret: { type: "number", description: "Fret number, 0 for open string." },
            role: { type: "string", description: "Musical role: melody, bass, root, third, seventh, fill, percussion, etc." },
          },
          required: ["measureIndex", "beat", "note", "string", "fret", "role"],
        },
      },
    },
    required: ["events"],
  };
}

function buildWorkflowOptionDataProperty(stepId?: AccompanimentWorkflowStepId) {
  if (isGuitarTabValidationWorkflowStep(stepId ?? "melody-snapshot")) {
    return {
      type: "object",
      description: "Step-specific structured decision data. Must include guitarTab.events and those events must pass the valid_guitar_tab tool before final output.",
      additionalProperties: true,
      properties: {
        guitarTab: buildGuitarTabDataProperty(),
      },
      required: ["guitarTab"],
    };
  }

  if (stepId === "chord-progression") {
    return {
      type: "object",
      description: "Step-specific structured decision data. Must include harmonizedAbc for Music Staff Playback.",
      additionalProperties: true,
      properties: {
        harmonizedAbc: {
          type: "string",
          description: "Full source ABC with proposed chord symbols applied. Must follow break_measures_line: preserve the same melody music line count and same measures per line as Source ABC.",
        },
      },
      required: ["harmonizedAbc"],
    };
  }

  if (stepId === "voice-leading-validation") {
    return {
      type: "object",
      description: "Step-specific structured decision data. Prefer validatedAbc for the final Music Staff Playback source.",
      additionalProperties: true,
      properties: {
        validatedAbc: {
          type: "string",
          description: "Full final chord-annotated ABC after voice-leading validation. Must follow break_measures_line: preserve the same melody music line count and same measures per line as Source ABC.",
        },
        harmonizedAbc: {
          type: "string",
          description: "Fallback full final harmonized ABC. Must also follow break_measures_line so melody line breaks match Source ABC.",
        },
      },
    };
  }

  return {
    type: "object",
    description: "Step-specific structured decision data. Include profile/style ids when relevant.",
    additionalProperties: true,
  };
}

function buildWorkflowOptionsProperty(description: string, stepId?: AccompanimentWorkflowStepId) {
  return {
    type: "array",
    minItems: 1,
    maxItems: 5,
    description,
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", description: "Stable kebab-case option id." },
        label: { type: "string", description: "Short human-readable option label." },
        summary: { type: "string", description: "One or two sentence summary." },
        justification: { type: "string", description: "Music-theory justification for this option." },
        data: buildWorkflowOptionDataProperty(stepId),
        warnings: {
          type: "array",
          items: { type: "string" },
          description: "Warnings for risky harmony, playability, register, raga, or ABC validity choices.",
        },
        validationNotes: {
          type: "array",
          items: { type: "string" },
          description: "Notes showing how the option satisfies this step's validation rules.",
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
      options: buildWorkflowOptionsProperty(`One to five options for ${step.label}.`, stepId),
    },
    required: ["options"],
  };
}

export function buildConsolidatedChordIngestionToolSchema() {
  return {
    type: "function",
    function: {
      name: "generate_consolidated_chord_ingestion",
      description: "Generate chord role, progression, and voice-leading validation options from chord annotations embedded in ABC lyric lines.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          chordToneMapping: buildWorkflowResultGroupProperty("chord-tone-mapping"),
          chordProgression: buildWorkflowResultGroupProperty("chord-progression"),
          voiceLeadingValidation: buildWorkflowResultGroupProperty("voice-leading-validation"),
        },
        required: ["chordToneMapping", "chordProgression", "voiceLeadingValidation"],
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
      description: `Generate 1-5 human-reviewable options for ${step.label}.`,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          options: buildWorkflowOptionsProperty("One to five options for the user to choose from.", stepId),
        },
        required: ["options"],
      },
    },
  };
}
