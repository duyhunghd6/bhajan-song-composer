export const ACCOMPANIMENT_WORKFLOW_VERSION = 8;

/**
 * Step 4 selects the deterministic right-hand realization used by Step 6.
 * Step 5 supplies the selected fretboard anchors/voicings; it does not need
 * to enumerate every sounding chord tone for the Music Sheet support voice.
 */
export const GUITAR_CLASSIC_COMPING_PROFILE_IDS = [
  "devotional-pima-arpeggio",
  "devotional-pinch-arpeggio",
  "bhajan-strum",
] as const;

export type GuitarClassicCompingProfileId = (typeof GUITAR_CLASSIC_COMPING_PROFILE_IDS)[number];

export interface GuitarClassicCompingProfileDefinition {
  id: GuitarClassicCompingProfileId;
  label: string;
  technique: "arpeggio" | "pinch" | "strum";
  summary: string;
}

export const GUITAR_CLASSIC_COMPING_PROFILES: Record<GuitarClassicCompingProfileId, GuitarClassicCompingProfileDefinition> = {
  "devotional-pima-arpeggio": {
    id: "devotional-pima-arpeggio",
    label: "Devotional PIMA Arpeggio",
    technique: "arpeggio",
    summary: "Alternating bass with staggered inner and treble chord tones.",
  },
  "devotional-pinch-arpeggio": {
    id: "devotional-pinch-arpeggio",
    label: "Devotional Pinch Arpeggio",
    technique: "pinch",
    summary: "Bass-and-treble pinches on strong beats followed by chord-tone arpeggios.",
  },
  "bhajan-strum": {
    id: "bhajan-strum",
    label: "Bhajan Strum",
    technique: "strum",
    summary: "Measured multi-string chord strokes with devotional downbeat emphasis.",
  },
};

export function isGuitarClassicCompingProfileId(value: unknown): value is GuitarClassicCompingProfileId {
  return typeof value === "string" && (GUITAR_CLASSIC_COMPING_PROFILE_IDS as readonly string[]).includes(value);
}

export const ACCOMPANIMENT_WORKFLOW_SHARED_STEP_IDS = [
  "key-beats",
  "chord-roles-progression",
  "voice-leading-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS = [
  "guitar-comping-profile",
  "guitar-voicing-bass",
  "guitar-classic-abc-notation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_HARMONIUM_STEP_IDS = [
  "harmonium-drone-register",
  "harmonium-chord-voicing-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_DJEMBE_STEP_IDS = [
  "djembe-groove-interlock",
  "djembe-fill-validation",
] as const;

export const ACCOMPANIMENT_WORKFLOW_STEP_IDS = [
  ...ACCOMPANIMENT_WORKFLOW_SHARED_STEP_IDS,
  ...ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS,
  ...ACCOMPANIMENT_WORKFLOW_HARMONIUM_STEP_IDS,
  ...ACCOMPANIMENT_WORKFLOW_DJEMBE_STEP_IDS,
] as const;

export type AccompanimentWorkflowStepId = (typeof ACCOMPANIMENT_WORKFLOW_STEP_IDS)[number];
export type AccompanimentWorkflowScope = "shared" | "guitar" | "harmonium" | "djembe";
export type AccompanimentInstrumentId = "guitar-classic" | "indian-harmonium" | "djembe";
export type AccompanimentStyleId = "accompaniment";

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
  "indian-harmonium": "Indian Harmonium",
  djembe: "Djembe",
};

export const ACCOMPANIMENT_GUITAR_TAB_VALIDATION_STEP_IDS = [
  "guitar-comping-profile",
  "guitar-voicing-bass",
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
export type AccompanimentWorkflowLlmLogKind = "chat-request" | "chat-response" | "chat-error" | "tool-call" | "tool-result" | "final-validation" | "loop-exhausted" | "context-budget-exceeded";

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
  elapsedMs?: number;
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
  { id: "key-beats", index: 1, label: "Key, Scale, Cadence & Strong Beats", shortLabel: "Key & Beats", scope: "shared", description: "Analyze key/scale/raga context, phrase endings, cadence targets, and choose the strong-beat emphasis direction.", dependencies: [], outputFocus: ["detected key/scale", "cadence measures", "phrase boundary notes", "strong-beat emphasis direction"], theoryReference: "THEORY.md §1, §3, §4, and §5." },
  { id: "chord-roles-progression", index: 2, label: "Chord Roles & Progression", shortLabel: "Chords", scope: "shared", description: "Map strong melody notes to chord-tone roles, select a chord progression, and produce harmonized ABC.", dependencies: ["key-beats"], outputFocus: ["chord-tone roles", "progression", "roman numerals", "harmonized ABC", "cadence support"], theoryReference: "THEORY.md §2, §3, §6.4 Steps 2–6." },
  { id: "voice-leading-validation", index: 3, label: "Voice-leading & Harmonized ABC Validation", shortLabel: "Validate Harmony", scope: "shared", description: "Smooth chord transitions, preserve the melody exactly, and validate beat counts and pitch alignment.", dependencies: ["chord-roles-progression"], outputFocus: ["final harmonized ABC", "voice-leading fixes", "validation notes", "bass root map"], theoryReference: "THEORY.md §3.3 voice leading and §6.2 validation." },
  { id: "guitar-comping-profile", index: 4, label: "Guitar Classic Comping Profile", shortLabel: "Guitar Profile", scope: "guitar", description: "Choose a singer-support PIMA, pinch, or strum profile with a representative physically validated sample.", dependencies: [...SHARED_DEPENDENCIES], outputFocus: ["guitar style", "picking profile", "treble-led singer-support policy", "representative one-guitar validation sample"], theoryReference: "ARRANGEMENT01-GUITAR.md §2.1–2.4 and §4 one-guitar validation checklist." },
  { id: "guitar-voicing-bass", index: 5, label: "Guitar Classic Voicing & Bass Plan", shortLabel: "Guitar Voicing", scope: "guitar", description: "Plan open/barre voicings and bounded root/fifth or transition anchors that one guitarist can fret; Step 6 realizes the full texture.", dependencies: ["guitar-comping-profile"], outputFocus: ["voicing map", "structural bass anchors", "bounded transition notes", "meter-grid anchor durations", "fret/register warnings", "one-left-hand validation"], theoryReference: "ARRANGEMENT01-GUITAR.md §2.2–2.4 and §4 validation checklist." },
  { id: "guitar-classic-abc-notation", index: 6, label: "Guitar Classic ABCNotation & Music Sheet", shortLabel: "Guitar ABC", scope: "guitar", description: "Deterministically convert the selected validated Guitar Classic voicing events into a standard-notation support voice for the Music Sheet.", dependencies: ["guitar-voicing-bass"], outputFocus: ["Guitar Classic support ABC", "measure-aligned durations", "standard notation playback", "conversion validation"], theoryReference: "ARRANGEMENT01-GUITAR.md §2.2 and ABC tablature/string-mapping rules." },
  { id: "harmonium-drone-register", index: 7, label: "Harmonium Drone & Register Plan", shortLabel: "Harmonium Drone", scope: "harmonium", description: "Choose Indian Harmonium drone, register, bellows-like sustain, and root/fifth anchoring strategy.", dependencies: [...SHARED_DEPENDENCIES], outputFocus: ["drone tones", "register lane", "sustain density", "melody-yield strategy"], theoryReference: "THEORY.md §3 harmony support and devotional harmonium MIDI guidance." },
  { id: "harmonium-chord-voicing-validation", index: 8, label: "Harmonium Chord Voicing & Validation", shortLabel: "Harmonium Voice", scope: "harmonium", description: "Validate harmonium chordal support, root-fifth drones, and sustained devotional comping without covering the melody.", dependencies: ["harmonium-drone-register"], outputFocus: ["voicing map", "sustain windows", "collision warnings", "final harmonium profile id"], theoryReference: "THEORY.md §3.3 voice leading and MIDI program 20 harmonium mapping." },
  { id: "djembe-groove-interlock", index: 9, label: "Djembe Groove Interlock", shortLabel: "Djembe Groove", scope: "djembe", description: "Choose Djembe groove profile and align Bass/Tone/Slap strokes with accompaniment transients.", dependencies: [...SHARED_DEPENDENCIES], outputFocus: ["bass/tone/slap palette", "bass transient sync", "subdivision weave", "density guardrails"], theoryReference: "ARRANGEMENT03-ENSEMBLE.md §2.1–2.4 Djembe interlock rules." },
  { id: "djembe-fill-validation", index: 10, label: "Djembe Fill & Transient Validation", shortLabel: "Djembe Fills", scope: "djembe", description: "Choose Djembe fill policy, backbeat/slap behavior, and transient conflict limits.", dependencies: ["djembe-groove-interlock"], outputFocus: ["fill density", "backbeat policy", "conflict limits", "final djembe profile id"], theoryReference: "ARRANGEMENT03-ENSEMBLE.md §2.3–2.5 and final conflict review hierarchy." },
];

export const ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS: Record<Exclude<AccompanimentWorkflowScope, "shared">, readonly AccompanimentWorkflowStepId[]> = {
  guitar: ACCOMPANIMENT_WORKFLOW_GUITAR_STEP_IDS,
  harmonium: ACCOMPANIMENT_WORKFLOW_HARMONIUM_STEP_IDS,
  djembe: ACCOMPANIMENT_WORKFLOW_DJEMBE_STEP_IDS,
};
