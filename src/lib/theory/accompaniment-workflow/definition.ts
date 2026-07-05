export const ACCOMPANIMENT_WORKFLOW_VERSION = 1;

export const ACCOMPANIMENT_WORKFLOW_STEP_IDS = [
  "melody-snapshot",
  "key-scale-cadence",
  "strong-beat-targets",
  "chord-tone-mapping",
  "chord-progression",
  "voice-leading-validation",
  "guitar-comping-profile",
  "guitar-voicing-bass",
  "guitar-fills-validation",
  "piano-comping-bass",
  "piano-rh-voicing",
  "piano-fills-pedal-validation",
] as const;

export type AccompanimentWorkflowStepId = (typeof ACCOMPANIMENT_WORKFLOW_STEP_IDS)[number];
export type AccompanimentWorkflowScope = "shared" | "guitar" | "piano";

export const ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS = [
  "guitar-comping-profile",
  "guitar-voicing-bass",
  "guitar-fills-validation",
] as const satisfies readonly AccompanimentWorkflowStepId[];

export const ACCOMPANIMENT_WORKFLOW_PIANO_STEP_IDS = [
  "piano-comping-bass",
  "piano-rh-voicing",
  "piano-fills-pedal-validation",
] as const satisfies readonly AccompanimentWorkflowStepId[];

export const ACCOMPANIMENT_GUITAR_TAB_VALIDATION_STEP_IDS = [
  "guitar-voicing-bass",
  "guitar-fills-validation",
] as const satisfies readonly AccompanimentWorkflowStepId[];

export const ACCOMPANIMENT_CHORD_INGESTION_STEP_IDS = [
  "chord-tone-mapping",
  "chord-progression",
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
  | "loop-exhausted";

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
  logPath?: string;
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

const SHARED_DEPENDENCIES = [
  "melody-snapshot",
  "key-scale-cadence",
  "strong-beat-targets",
  "chord-tone-mapping",
  "chord-progression",
  "voice-leading-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_STEPS: AccompanimentWorkflowStepDefinition[] = [
  {
    id: "melody-snapshot",
    index: 1,
    label: "Melody Snapshot & Metadata",
    shortLabel: "Melody",
    scope: "shared",
    description: "Confirm the immutable source ABC, key/meter metadata, mood, and melody-preservation constraints.",
    dependencies: [],
    outputFocus: ["confirmed source ABC summary", "key and meter assumptions", "melody preservation risks"],
    theoryReference: "THEORY.md §6.4 Step 1 and §6.2 validation rules.",
  },
  {
    id: "key-scale-cadence",
    index: 2,
    label: "Key, Scale & Cadence Analysis",
    shortLabel: "Key/Cadence",
    scope: "shared",
    description: "Analyze K: header, pitch content, scale/raga context, phrase endings, and cadence targets.",
    dependencies: ["melody-snapshot"],
    outputFocus: ["detected key/scale", "cadence measures", "phrase boundary notes"],
    theoryReference: "THEORY.md §1, §3, §5, and ARRANGEMENT02-PIANO.md §1.1 cadence parsing.",
  },
  {
    id: "strong-beat-targets",
    index: 3,
    label: "Strong-beat Target Notes",
    shortLabel: "Strong Beats",
    scope: "shared",
    description: "Identify structurally strong melody notes per measure, including beat 1 in 3/4 and beats 1/3 in 4/4.",
    dependencies: ["key-scale-cadence"],
    outputFocus: ["measure-by-measure strong notes", "metric strength", "passing/neighbor notes to ignore"],
    theoryReference: "THEORY.md §4 rhythm/meter and §6.4 Steps 2–3.",
  },
  {
    id: "chord-tone-mapping",
    index: 4,
    label: "Chord-tone Role Mapping",
    shortLabel: "Chord Roles",
    scope: "shared",
    description: "Map each strong melody note to plausible root, 3rd, 5th, 7th, suspension, or tension roles.",
    dependencies: ["strong-beat-targets"],
    outputFocus: ["possible chord functions", "valid tensions/suspensions", "raga or chromatic warnings"],
    theoryReference: "THEORY.md §2 chords/extensions and §3 functional harmony.",
  },
  {
    id: "chord-progression",
    index: 5,
    label: "Chord Progression Selection",
    shortLabel: "Progression",
    scope: "shared",
    description: "Generate chord progression candidates and chord-annotated ABC without changing the melody.",
    dependencies: ["chord-tone-mapping"],
    outputFocus: ["progression", "roman numerals", "harmonized ABC", "cadence support"],
    theoryReference: "THEORY.md §6.4 Steps 4 and 6 plus common bhajan I-IV-V-I guidance.",
  },
  {
    id: "voice-leading-validation",
    index: 6,
    label: "Voice-leading & Harmonized ABC Validation",
    shortLabel: "Validate Harmony",
    scope: "shared",
    description: "Smooth chord transitions, preserve the melody exactly, and validate beat counts and pitch alignment.",
    dependencies: ["chord-progression"],
    outputFocus: ["final harmonized ABC", "voice-leading fixes", "validation notes", "bass root map"],
    theoryReference: "THEORY.md §3.3 voice leading, §6.2 validation, and §6.4 Steps 5, 7, 8.",
  },
  {
    id: "guitar-comping-profile",
    index: 7,
    label: "Guitar Comping Profile",
    shortLabel: "Guitar Profile",
    scope: "guitar",
    description: "Choose the rhythm-guitar profile: ballad arpeggio, folk strum, Travis/PIMA, or rock/power support.",
    dependencies: [...SHARED_DEPENDENCIES],
    outputFocus: ["guitar style", "picking/strumming profile", "melody avoidance strategy"],
    theoryReference: "ARRANGEMENT01-GUITAR.md §2.1–2.3.",
  },
  {
    id: "guitar-voicing-bass",
    index: 8,
    label: "Guitar Voicing & Bass Plan",
    shortLabel: "Guitar Voicing",
    scope: "guitar",
    description: "Plan open/barre voicings, guide tones, root/fifth anchors, and walking bass transitions.",
    dependencies: ["guitar-comping-profile"],
    outputFocus: ["voicing map", "bass anchors", "walking bass notes", "fret/register warnings"],
    theoryReference: "ARRANGEMENT01-GUITAR.md §2.2, §2.4, and §4 validation checklist.",
  },
  {
    id: "guitar-fills-validation",
    index: 9,
    label: "Guitar Fills / Intro / Interlude / Outro / Validation",
    shortLabel: "Guitar Polish",
    scope: "guitar",
    description: "Choose fills, intro/interlude/outro behavior, and validate playability before final guitar rendering.",
    dependencies: ["guitar-voicing-bass"],
    outputFocus: ["intro plan", "fill rules", "interlude/outro plan", "final guitar profile id"],
    theoryReference: "ARRANGEMENT01-GUITAR.md §4 plus rhythm-guitar support rules.",
  },
  {
    id: "piano-comping-bass",
    index: 10,
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
    index: 11,
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
    index: 12,
    label: "Piano Fills / Pedal / Validation",
    shortLabel: "Piano Polish",
    scope: "piano",
    description: "Choose gap fills, yield behavior, sustain pedal automation, and validate hand span/collisions/LIL.",
    dependencies: ["piano-rh-voicing"],
    outputFocus: ["gap fill rules", "pedal automation", "validation report", "final piano profile id"],
    theoryReference: "ARRANGEMENT02-PIANO.md §4–§7.",
  },
];

const STEP_BY_ID = new Map(ACCOMPANIMENT_WORKFLOW_STEPS.map((step) => [step.id, step]));
