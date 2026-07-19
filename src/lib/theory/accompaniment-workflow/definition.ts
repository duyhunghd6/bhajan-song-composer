export const ACCOMPANIMENT_WORKFLOW_VERSION = 3;

export const ACCOMPANIMENT_WORKFLOW_SHARED_STEP_IDS = [
  "key-beats",
  "chord-roles-progression",
  "voice-leading-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS = [
  "guitar-comping-profile",
  "guitar-voicing-bass",
  "guitar-fills-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_PIANO_STEP_IDS = [
  "piano-comping-bass",
  "piano-rh-voicing",
  "piano-fills-pedal-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_HARMONIUM_STEP_IDS = [
  "harmonium-drone-register",
  "harmonium-chord-voicing-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_DJEMBE_STEP_IDS = [
  "djembe-groove-interlock",
  "djembe-fill-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_FLUTE_STEP_IDS = [
  "flute-yield-register",
  "flute-breath-fill-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_VIOLIN_STEP_IDS = [
  "violin-bed-register",
  "violin-expression-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_STEP_IDS = [
  ...ACCOMPANIMENT_WORKFLOW_SHARED_STEP_IDS,
  ...ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS,
  ...ACCOMPANIMENT_WORKFLOW_PIANO_STEP_IDS,
  ...ACCOMPANIMENT_WORKFLOW_HARMONIUM_STEP_IDS,
  ...ACCOMPANIMENT_WORKFLOW_DJEMBE_STEP_IDS,
  ...ACCOMPANIMENT_WORKFLOW_FLUTE_STEP_IDS,
  ...ACCOMPANIMENT_WORKFLOW_VIOLIN_STEP_IDS,
] as const;

export type AccompanimentWorkflowStepId = (typeof ACCOMPANIMENT_WORKFLOW_STEP_IDS)[number];
export type AccompanimentWorkflowScope = "shared" | "guitar" | "piano" | "harmonium" | "djembe" | "flute" | "violin";

export type AccompanimentInstrumentId =
  | "guitar-classic"
  | "guitar-acoustic"
  | "piano"
  | "indian-harmonium"
  | "flute"
  | "djembe"
  | "violin";

export type AccompanimentStyleId = "solo-fingerstyle" | "accompaniment";

export interface AccompanimentInstrumentSelection {
  id: AccompanimentInstrumentId;
  enabled: boolean;
  order: number;
  roleNote?: string;
}

export interface AccompanimentWorkflowSetup {
  style: AccompanimentStyleId;
  instruments: AccompanimentInstrumentSelection[];
}

export const ACCOMPANIMENT_INSTRUMENT_LABELS: Record<AccompanimentInstrumentId, string> = {
  "guitar-classic": "Guitar Classic",
  "guitar-acoustic": "Guitar Acoustic",
  piano: "Piano",
  "indian-harmonium": "Indian Harmonium",
  flute: "Flute",
  djembe: "Djembe",
  violin: "Violin",
};

export const ACCOMPANIMENT_STYLE_LABELS: Record<AccompanimentStyleId, string> = {
  "solo-fingerstyle": "Solo/Fingerstyle",
  accompaniment: "Accompaniment (combined instruments)",
};

export const ACCOMPANIMENT_GUITAR_TAB_VALIDATION_STEP_IDS = [
  "guitar-comping-profile",
  "guitar-voicing-bass",
  "guitar-fills-validation",
] as const satisfies readonly AccompanimentWorkflowStepId[];

export const ACCOMPANIMENT_CHORD_INGESTION_STEP_IDS = [
  "chord-roles-progression",
  "voice-leading-validation",
] as const satisfies readonly AccompanimentWorkflowStepId[];

export interface AccompanimentLyricChordAnnotation {
  chord: string;
  lineNumber: number;
  measureIndex: number;
  lyricFragment: string;
  rawLyricLine: string;
}

export interface AccompanimentWorkflowMetadata {
  key: string;
  scale: string;
  timeSignature: string;
  title?: string;
  devotionalMood?: string;
}

export interface AccompanimentWorkflowOption {
  id: string;
  label: string;
  summary: string;
  justification: string;
  data: Record<string, unknown>;
  warnings: string[];
  validationNotes: string[];
}

export type AccompanimentWorkflowLlmLogStatus = "started" | "success" | "warning" | "failed";

export type AccompanimentWorkflowLlmLogKind =
  | "chat-request"
  | "chat-response"
  | "chat-error"
  | "tool-call"
  | "tool-result"
  | "final-validation"
  | "loop-exhausted"
  | "context-budget-exceeded";

export interface AccompanimentWorkflowLlmLogEntry {
  id: string;
  createdAt: string;
  stepId: AccompanimentWorkflowStepId | "consolidated-chord-ingestion";
  kind: AccompanimentWorkflowLlmLogKind;
  status: AccompanimentWorkflowLlmLogStatus;
  message: string;
  iteration?: number;
  toolName?: string;
  toolCallNames?: string[];
  validationMessage?: string;
  payloadPreview?: unknown;
  logPath?: string;
  /** Wall-clock milliseconds for this LLM request (chat-response / chat-error). */
  elapsedMs?: number;
  /** Number of HTTP request attempts (includes retries). */
  requestAttempts?: number;
}

export interface AccompanimentWorkflowRunDiagnostics {
  logId: string;
  logPath: string;
  exposedTools: string[];
  validationAttempts: number;
  maxValidationAttempts: number;
  finalValidationValid?: boolean;
  finalValidationMessage?: string;
  llmLogs?: AccompanimentWorkflowLlmLogEntry[];
}

export interface AccompanimentWorkflowRun {
  id: string;
  createdAt: string;
  stepId: AccompanimentWorkflowStepId;
  requestPrompt: string;
  userNote: string;
  options: AccompanimentWorkflowOption[];
  rawResult?: unknown;
  diagnostics?: AccompanimentWorkflowRunDiagnostics;
}

export interface AccompanimentWorkflowStepState {
  runs: AccompanimentWorkflowRun[];
  activeRunId: string | null;
  selectedOptionId: string | null;
  selectedAt: string | null;
  promptNote: string;
}

export interface AccompanimentWorkflowSession {
  version: number;
  sourceAbc: string;
  sourceAbcFingerprint: string;
  currentStepId: AccompanimentWorkflowStepId;
  steps: Record<AccompanimentWorkflowStepId, AccompanimentWorkflowStepState>;
  guitarProfileHint: string | null;
  pianoProfileHint: string | null;
  setup: AccompanimentWorkflowSetup;
  enabledStepIds: AccompanimentWorkflowStepId[];
}

export interface AccompanimentWorkflowSelectedContext {
  stepId: AccompanimentWorkflowStepId;
  label: string;
  summary: string;
  justification: string;
  data: Record<string, unknown>;
}

export interface AccompanimentWorkflowStepDefinition {
  id: AccompanimentWorkflowStepId;
  index: number;
  label: string;
  shortLabel: string;
  scope: AccompanimentWorkflowScope;
  description: string;
  dependencies: AccompanimentWorkflowStepId[];
  outputFocus: string[];
  theoryReference: string;
}

const SHARED_DEPENDENCIES = [...ACCOMPANIMENT_WORKFLOW_SHARED_STEP_IDS] as const;

export const ACCOMPANIMENT_WORKFLOW_STEPS: AccompanimentWorkflowStepDefinition[] = [
  {
    id: "key-beats",
    index: 1,
    label: "Key, Scale, Cadence & Strong Beats",
    shortLabel: "Key & Beats",
    scope: "shared",
    description: "Analyze key/scale/raga context, phrase endings, cadence targets, and choose the strong-beat emphasis direction.",
    dependencies: [],
    outputFocus: ["detected key/scale", "cadence measures", "phrase boundary notes", "strong-beat emphasis direction"],
    theoryReference: "THEORY.md §1, §3, §4, §5, and ARRANGEMENT02-PIANO.md §1.1 cadence parsing.",
  },
  {
    id: "chord-roles-progression",
    index: 2,
    label: "Chord Roles & Progression",
    shortLabel: "Chords",
    scope: "shared",
    description: "Map strong melody notes to chord-tone roles, select a chord progression, and produce harmonized ABC.",
    dependencies: ["key-beats"],
    outputFocus: ["chord-tone roles", "progression", "roman numerals", "harmonized ABC", "cadence support"],
    theoryReference: "THEORY.md §2, §3, §6.4 Steps 2–6.",
  },
  {
    id: "voice-leading-validation",
    index: 3,
    label: "Voice-leading & Harmonized ABC Validation",
    shortLabel: "Validate Harmony",
    scope: "shared",
    description: "Smooth chord transitions, preserve the melody exactly, and validate beat counts and pitch alignment.",
    dependencies: ["chord-roles-progression"],
    outputFocus: ["final harmonized ABC", "voice-leading fixes", "validation notes", "bass root map"],
    theoryReference: "THEORY.md §3.3 voice leading, §6.2 validation, and §6.4 Steps 5, 7, 8.",
  },
  {
    id: "guitar-comping-profile",
    index: 4,
    label: "Guitar Comping Profile",
    shortLabel: "Guitar Profile",
    scope: "guitar",
    description: "Choose the rhythm-guitar profile with a representative one-guitar tab sample.",
    dependencies: [...SHARED_DEPENDENCIES],
    outputFocus: ["guitar style", "picking/strumming profile", "melody avoidance strategy", "representative one-guitar validation sample"],
    theoryReference: "ARRANGEMENT01-GUITAR.md §2.1–2.3 and §4 one-guitar validation checklist.",
  },
  {
    id: "guitar-voicing-bass",
    index: 5,
    label: "Guitar Voicing & Bass Plan",
    shortLabel: "Guitar Voicing",
    scope: "guitar",
    description: "Plan open/barre voicings, root/fifth anchors, and walking bass transitions that one guitarist can fret.",
    dependencies: ["guitar-comping-profile"],
    outputFocus: ["voicing map", "bass anchors", "walking bass notes", "fret/register warnings", "one-left-hand validation"],
    theoryReference: "ARRANGEMENT01-GUITAR.md §2.2, §2.4, and §4 validation checklist.",
  },
  {
    id: "guitar-fills-validation",
    index: 6,
    label: "Guitar Fills & Validation",
    shortLabel: "Guitar Polish",
    scope: "guitar",
    description: "Choose fills, intro/interlude/outro behavior, and validate one-physical-guitar playability.",
    dependencies: ["guitar-voicing-bass"],
    outputFocus: ["intro plan", "fill rules", "interlude/outro plan", "final guitar profile id", "one-guitar tab validation"],
    theoryReference: "ARRANGEMENT01-GUITAR.md §4 plus rhythm-guitar support rules.",
  },
  {
    id: "piano-comping-bass",
    index: 7,
    label: "Piano Comping + LH Bass Anchoring",
    shortLabel: "Piano Bass",
    scope: "piano",
    description: "Choose the piano comping profile and left-hand root/octave/open-fifth/tenth foundation.",
    dependencies: [...SHARED_DEPENDENCIES],
    outputFocus: ["piano style", "left-hand pattern", "low interval limit strategy", "comping profile id"],
    theoryReference: "ARRANGEMENT02-PIANO.md §1 and §3.",
  },
  {
    id: "piano-rh-voicing",
    index: 8,
    label: "Piano RH Voicing + Voice-leading",
    shortLabel: "Piano RH",
    scope: "piano",
    description: "Plan right-hand guide tones, inversions, drop/open voicings, shortest-path motion, and melody-register avoidance.",
    dependencies: ["piano-comping-bass"],
    outputFocus: ["RH voicing map", "guide tones", "inversions", "collision/register warnings"],
    theoryReference: "ARRANGEMENT02-PIANO.md §2.",
  },
  {
    id: "piano-fills-pedal-validation",
    index: 9,
    label: "Piano Fills / Pedal / Validation",
    shortLabel: "Piano Polish",
    scope: "piano",
    description: "Choose gap fills, yield behavior, sustain pedal automation, and validate hand span/collisions/LIL.",
    dependencies: ["piano-rh-voicing"],
    outputFocus: ["gap fill rules", "pedal automation", "validation report", "final piano profile id"],
    theoryReference: "ARRANGEMENT02-PIANO.md §4–§7.",
  },
  {
    id: "harmonium-drone-register",
    index: 10,
    label: "Harmonium Drone & Register Plan",
    shortLabel: "Harmonium Drone",
    scope: "harmonium",
    description: "Choose Indian Harmonium drone, register, bellows-like sustain, and root/fifth anchoring strategy.",
    dependencies: [...SHARED_DEPENDENCIES],
    outputFocus: ["drone tones", "register lane", "sustain density", "melody-yield strategy"],
    theoryReference: "THEORY.md §3 harmony support plus devotional harmonium MIDI guidance in SKILL.md.",
  },
  {
    id: "harmonium-chord-voicing-validation",
    index: 11,
    label: "Harmonium Chord Voicing & Validation",
    shortLabel: "Harmonium Voice",
    scope: "harmonium",
    description: "Validate harmonium chordal support, root-fifth drones, and sustained devotional comping without covering the melody.",
    dependencies: ["harmonium-drone-register"],
    outputFocus: ["voicing map", "sustain windows", "collision warnings", "final harmonium profile id"],
    theoryReference: "THEORY.md §3.3 voice leading and MIDI program 20 harmonium mapping.",
  },
  {
    id: "djembe-groove-interlock",
    index: 12,
    label: "Djembe Groove Interlock",
    shortLabel: "Djembe Groove",
    scope: "djembe",
    description: "Choose Djembe groove profile and align Bass/Tone/Slap strokes with accompaniment transients.",
    dependencies: [...SHARED_DEPENDENCIES],
    outputFocus: ["bass/tone/slap palette", "bass transient sync", "subdivision weave", "density guardrails"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md §2.1–2.4 Djembe interlock rules.",
  },
  {
    id: "djembe-fill-validation",
    index: 13,
    label: "Djembe Fill & Transient Validation",
    shortLabel: "Djembe Fills",
    scope: "djembe",
    description: "Choose Djembe fill policy, backbeat/slap behavior, and transient conflict limits.",
    dependencies: ["djembe-groove-interlock"],
    outputFocus: ["fill density", "backbeat policy", "conflict limits", "final djembe profile id"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md §2.3–2.5 and final conflict review hierarchy.",
  },
  {
    id: "flute-yield-register",
    index: 14,
    label: "Flute Yield & Register Plan",
    shortLabel: "Flute Register",
    scope: "flute",
    description: "Choose Flute role, register, and yield behavior while the devotional melody is active.",
    dependencies: [...SHARED_DEPENDENCIES],
    outputFocus: ["flute role", "register lane", "melody-yield rules", "safe fill zones"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md §3 melodic support and frequency stratification.",
  },
  {
    id: "flute-breath-fill-validation",
    index: 15,
    label: "Flute Breath, Fill & Validation",
    shortLabel: "Flute Fills",
    scope: "flute",
    description: "Choose playable flute gap fills, breath intervals, and validation notes for melody-safe highlights.",
    dependencies: ["flute-yield-register"],
    outputFocus: ["breath windows", "gap fills", "slur/rest policy", "final flute profile id"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md §3.3 fill zones and flute MIDI/breath guidance.",
  },
  {
    id: "violin-bed-register",
    index: 16,
    label: "Violin Bed & Register Plan",
    shortLabel: "Violin Bed",
    scope: "violin",
    description: "Choose Violin harmonic bed, counterline, or drone-pad strategy and register relationship to the devotional melody.",
    dependencies: [...SHARED_DEPENDENCIES],
    outputFocus: ["violin role", "register strategy", "melody-yield rules", "harmonic support lane"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md §4 violin harmonic bed and frequency stratification rules.",
  },
  {
    id: "violin-expression-validation",
    index: 17,
    label: "Violin Expression & Validation",
    shortLabel: "Violin Polish",
    scope: "violin",
    description: "Choose bow expression, vibrato/swell profile, double-stop policy, and final playability constraints for Violin support.",
    dependencies: ["violin-bed-register"],
    outputFocus: ["bow expression", "double-stop policy", "swell/vibrato profile", "final violin profile id"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md §4 violin expression, playable double-stops, and conflict validation.",
  },
];

export const ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS: Record<Exclude<AccompanimentWorkflowScope, "shared">, readonly AccompanimentWorkflowStepId[]> = {
  guitar: ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS,
  piano: ACCOMPANIMENT_WORKFLOW_PIANO_STEP_IDS,
  harmonium: ACCOMPANIMENT_WORKFLOW_HARMONIUM_STEP_IDS,
  djembe: ACCOMPANIMENT_WORKFLOW_DJEMBE_STEP_IDS,
  flute: ACCOMPANIMENT_WORKFLOW_FLUTE_STEP_IDS,
  violin: ACCOMPANIMENT_WORKFLOW_VIOLIN_STEP_IDS,
};
