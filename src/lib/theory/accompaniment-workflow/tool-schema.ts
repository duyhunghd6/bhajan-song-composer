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
    description: "Validated one-physical-guitar tab event data required for string assignment, fretboard range, and left-hand reach checks.",
    additionalProperties: false,
    properties: {
      profileId: {
        type: "string",
        enum: ["guitar-classic", "guitar-acoustic", "standard-six-string"],
        description: "Physical guitar profile used for max-fret range and left-hand validation.",
      },
      voicingProfileId: {
        type: "string",
        description: "Voicing/playability profile such as open-position, barre, fingerstyle-melody-bass, or power-chord.",
      },
      events: {
        type: "array",
        minItems: 1,
        description: "Concrete guitar tab events covering every source/body measure. Events sharing measureIndex + beat + subdivision or simultaneousGroupId are simultaneous; each source event must map to one string and each physical string may appear only once per simultaneous group. Final solo fingerstyle plans must include treble-string melody events and bass-string beat-1/internal anchors for every body measure.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            measureIndex: { type: "number", description: "Measure index for this tab event." },
            beat: { type: "number", description: "Beat or subdivision time within the measure." },
            subdivision: { type: ["string", "number"], description: "Optional subdivision label." },
            simultaneousGroupId: { type: "string", description: "Optional explicit id for notes that sound together." },
            sourceEventId: { type: "string", description: "Stable id for the musical source note/event. The same source event must not be assigned to multiple strings in one simultaneous group." },
            note: { type: "string", description: "Sounding pitch with octave/register, e.g. E2, B3, or F#4." },
            string: { type: "integer", enum: [1, 2, 3, 4, 5, 6], description: "Guitar string number, 1 high E through 6 low E." },
            fret: { type: "number", description: "Fret number, 0 for open string and no higher than the selected guitar profile allows." },
            role: { type: "string", description: "Musical role: melody, bass, root, third, seventh, fill, percussion, etc." },
          },
          required: ["measureIndex", "beat", "sourceEventId", "note", "string", "fret", "role"],
        },
      },
    },
    required: ["profileId", "events"],
  };
}

function buildFingerstyleFormPlanProperty() {
  const sectionProperty = (description: string) => ({
    type: "object",
    description,
    additionalProperties: true,
    properties: {
      measureCount: { type: "number", description: "Planned number of measures for this fingerstyle form section." },
      source: { type: "string", description: "Musical source material: tonic/dominant arpeggio, first motive, cadence turnaround, etc." },
      placement: { type: "string", description: "Where this section appears relative to the melody body or phrase boundary." },
      cadence: { type: "string", description: "Cadence or arrival target for this section." },
    },
  });

  return {
    type: "object",
    description: "Solo fingerstyle form plan for guitar-only intro, interlude, and outro material.",
    additionalProperties: false,
    properties: {
      intro: sectionProperty("Intro plan before the melody body."),
      interlude: sectionProperty("Interlude plan at a phrase or cadence boundary."),
      outro: sectionProperty("Outro plan after the melody body."),
    },
    required: ["intro", "interlude", "outro"],
  };
}

function buildGuitarFingerstyleDataProperty() {
  return {
    type: "object",
    description: "Final solo guitar fingerstyle decision. The local arranger generates final ABC from this profile/form plan; the LLM must provide playable, validated tab events covering every source/body measure.",
    additionalProperties: true,
    properties: {
      mode: {
        type: "string",
        enum: ["solo-fingerstyle"],
        description: "Must be solo-fingerstyle: the Guitar voice carries the melody itself.",
      },
      carriesMelody: {
        type: "boolean",
        description: "Must be true; this fingerstyle part plays the melody, not only accompaniment.",
      },
      pickingProfile: {
        type: "string",
        enum: ["strict-pima", "folk-travis"],
        description: "Fingerstyle picking profile for local generation.",
      },
      bassStrategy: {
        type: "string",
        description: "How roots/fifths/approaches from the selected chord progression become bass events on strings 6/5/4.",
      },
      formPlan: buildFingerstyleFormPlanProperty(),
      guitarTab: buildGuitarTabDataProperty(),
    },
    required: ["mode", "carriesMelody", "pickingProfile", "bassStrategy", "formPlan", "guitarTab"],
  };
}

function buildWorkflowOptionDataProperty(stepId?: AccompanimentWorkflowStepId) {
  if (stepId === "guitar-fingerstyle") {
    return buildGuitarFingerstyleDataProperty();
  }

  if (isGuitarTabValidationWorkflowStep(stepId ?? "key-scale-cadence")) {
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

  if (stepId === "strong-beat-targets") {
    return {
      type: "object",
      description: "Step-specific structured decision data. The LLM chooses only the reviewable Strong Beats emphasis; concrete beat positions and ABC lyric beat rows are computed locally.",
      additionalProperties: false,
      properties: {
        strongBeatEmphasis: {
          type: "string",
          enum: ["all-metric-beats", "primary-strong-beats", "downbeats-only"],
          description: "Reviewable emphasis direction. The local add_strong_beat_icons algorithm computes concrete strongBeatDirectives and beat-only w: lyric rows from this value.",
        },
      },
      required: ["strongBeatEmphasis"],
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
          description: "Full source ABC with proposed chord symbols applied. Must be copied exactly from the break_measures_line tool result so it preserves the same Melody music line count and same measures per line as Source ABC."
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
          description: "Full final chord-annotated ABC after voice-leading validation. Must be copied exactly from the break_measures_line tool result so it preserves the same Melody music line count and same measures per line as Source ABC."
        },
        harmonizedAbc: {
          type: "string",
          description: "Fallback full final harmonized ABC. Must also be copied exactly from the break_measures_line tool result so Melody line breaks match Source ABC."
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
      description: "Call this during the Strong Beats step before final output. The LLM chooses an emphasis direction only; this local algorithm computes concrete beat directives and an ABC preview using beat-only w: lyric rows. Do not copy abcNotation, annotatedAbc, strongBeatDirectives, measureIndex, or beatTime into the final generate_strong_beat_targets payload. Later ABC rendering inserts the beat lyric rows after the Melody line inside each staff-system/sentence group.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          emphasis: {
            type: "string",
            enum: ["all-metric-beats", "primary-strong-beats", "downbeats-only"],
            description: "Reviewable emphasis direction. all-metric-beats marks strong, medium, and soft metric beats; primary-strong-beats keeps strong and medium beats; downbeats-only keeps only primary downbeats.",
          },
          rationale: {
            type: "string",
            description: "Short musical reason for this emphasis direction. This guides the option text only; concrete icons are computed locally.",
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
      description: "Normalize generated ABCNotation so its Melody music body uses the same number of music lines and the same number of measures per line as the source Melody. For multi-voice ABC, the final body must be grouped by staff system: Melody line N, then each instrument line N for the same measure range. Call this before any final workflow tool output that includes harmonizedAbc, validatedAbc, chordAnnotatedAbc, or abc for Music Staff Playback.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          generatedAbc: {
            type: "string",
            description: "The full generated ABCNotation that should be regrouped to match the source Melody measure-line pattern.",
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

export function buildQueryGuitarVoicingsToolSchema() {
  return {
    type: "function",
    function: {
      name: "query_guitar_voicings",
      description: "Retrieve valid guitar voicings for a chord. Use this tool BEFORE trying to fret any notes manually. You are forbidden from inventing fretted notes.",
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
