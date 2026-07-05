export const ENSEMBLE_WORKFLOW_VERSION = 1;

export const ENSEMBLE_WORKFLOW_STEP_IDS = [
  "foundation-handshake",
  "djembe-groove-interlock",
  "djembe-fill-validation",
  "flute-yield-register",
  "flute-breath-fill-validation",
  "violin-bed-register",
  "violin-expression-validation",
  "final-conflict-review-apply",
] as const;

export type EnsembleWorkflowStepId = (typeof ENSEMBLE_WORKFLOW_STEP_IDS)[number];
export type EnsembleWorkflowScope = "shared" | "djembe" | "flute" | "violin" | "final";
export type EnsembleInstrument = "djembe" | "flute" | "violin";

export type DjembeGrooveProfile = "devotional" | "folk-upbeat" | "compound-flow" | "sparse";
export type EnsembleDensityPlan = "minimal" | "moderate" | "active";
export type EnsembleFillPolicy = "none" | "gap-only" | "cadence-only";
export type FluteRole = "halo" | "gap-fills" | "sustained-pad";
export type ViolinRole = "harmonic-bed" | "counterline" | "drone-pad";
export type ViolinRegisterStrategy = "below-melody" | "interlock";
export type ViolinDoubleStopPolicy = "single-note" | "safe-double-stops";
export type ViolinExpressionProfile = "plain" | "swell-vibrato";

export interface EnsembleGenerationPlan {
  djembe: {
    grooveProfile: DjembeGrooveProfile;
    density: EnsembleDensityPlan;
    bassSync: boolean;
    backbeatSlaps: boolean;
    fillPolicy: EnsembleFillPolicy;
  };
  flute: {
    role: FluteRole;
    fillDensity: EnsembleDensityPlan;
    preferredRegister: string;
    breathEveryMeasures: number;
    yieldWhenMelodyActive: boolean;
  };
  violin: {
    role: ViolinRole;
    registerStrategy: ViolinRegisterStrategy;
    doubleStopPolicy: ViolinDoubleStopPolicy;
    expressionProfile: ViolinExpressionProfile;
    yieldWhenMelodyActive: boolean;
  };
}

export interface EnsembleWorkflowMetadata {
  key: string;
  scale: string;
  timeSignature: string;
  title?: string;
  devotionalMood?: string;
}

export interface EnsembleWorkflowOption {
  id: string;
  label: string;
  summary: string;
  justification: string;
  data: Record<string, unknown>;
  warnings: string[];
  validationNotes: string[];
}

export interface EnsembleWorkflowRun {
  id: string;
  createdAt: string;
  stepId: EnsembleWorkflowStepId;
  requestPrompt: string;
  userNote: string;
  options: EnsembleWorkflowOption[];
  rawResult?: unknown;
}

export interface EnsembleWorkflowStepState {
  runs: EnsembleWorkflowRun[];
  activeRunId: string | null;
  selectedOptionId: string | null;
  selectedAt: string | null;
  promptNote: string;
}

export interface EnsembleWorkflowSession {
  version: number;
  sourceAbc: string;
  sourceAbcFingerprint: string;
  currentStepId: EnsembleWorkflowStepId;
  steps: Record<EnsembleWorkflowStepId, EnsembleWorkflowStepState>;
  appliedAt: string | null;
  appliedSelectionFingerprint: string | null;
}

export interface EnsembleWorkflowSelectedContext {
  stepId: EnsembleWorkflowStepId;
  label: string;
  summary: string;
  justification: string;
  data: Record<string, unknown>;
}

export interface EnsembleWorkflowStepDefinition {
  id: EnsembleWorkflowStepId;
  index: number;
  label: string;
  shortLabel: string;
  scope: EnsembleWorkflowScope;
  description: string;
  dependencies: EnsembleWorkflowStepId[];
  outputFocus: string[];
  theoryReference: string;
}

export const DEFAULT_ENSEMBLE_GENERATION_PLAN: EnsembleGenerationPlan = {
  djembe: {
    grooveProfile: "devotional",
    density: "moderate",
    bassSync: true,
    backbeatSlaps: true,
    fillPolicy: "gap-only",
  },
  flute: {
    role: "halo",
    fillDensity: "moderate",
    preferredRegister: "C5-C6",
    breathEveryMeasures: 2,
    yieldWhenMelodyActive: true,
  },
  violin: {
    role: "harmonic-bed",
    registerStrategy: "below-melody",
    doubleStopPolicy: "safe-double-stops",
    expressionProfile: "swell-vibrato",
    yieldWhenMelodyActive: true,
  },
};

export const ENSEMBLE_WORKFLOW_STEPS: EnsembleWorkflowStepDefinition[] = [
  {
    id: "foundation-handshake",
    index: 1,
    label: "Foundation Handshake",
    shortLabel: "Foundation",
    scope: "shared",
    description: "Confirm Layer 1 melody, Layer 2 accompaniment foundation, rhythmic density grid, bass map, and melodic gap strategy before adding ensemble instruments.",
    dependencies: [],
    outputFocus: ["Layer 1 melody readiness", "Layer 2 foundation readiness", "density grid", "bass map", "melodic gaps"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md integration handshake, frequency stratification, and Layer 1/2 prerequisite rules.",
  },
  {
    id: "djembe-groove-interlock",
    index: 2,
    label: "Djembe Groove Interlock",
    shortLabel: "Djembe Groove",
    scope: "djembe",
    description: "Choose the Djembe groove profile and how bass strokes interlock with the Layer 2 bass/transient foundation.",
    dependencies: ["foundation-handshake"],
    outputFocus: ["groove profile", "density", "bass sync", "devotional feel"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md Djembe layer rules: bass transient alignment and unused subdivision support.",
  },
  {
    id: "djembe-fill-validation",
    index: 3,
    label: "Djembe Fill & Transient Validation",
    shortLabel: "Djembe Fills",
    scope: "djembe",
    description: "Choose fill policy, backbeat/slap behavior, and transient conflict limits so Djembe supports without overcrowding the melody.",
    dependencies: ["djembe-groove-interlock"],
    outputFocus: ["fill policy", "backbeat slaps", "transient conflicts", "validation notes"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md Djembe validation and conflict-resolution hierarchy.",
  },
  {
    id: "flute-yield-register",
    index: 4,
    label: "Flute Yield & Register",
    shortLabel: "Flute Yield",
    scope: "flute",
    description: "Choose Flute halo/fill role, preferred register, and yield behavior while the primary melody is active.",
    dependencies: ["djembe-fill-validation"],
    outputFocus: ["flute role", "register", "yield when melody active", "melodic gap strategy"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md Flute melodic highlight rules and yield logic.",
  },
  {
    id: "flute-breath-fill-validation",
    index: 5,
    label: "Flute Breath, Fill & Validation",
    shortLabel: "Flute Polish",
    scope: "flute",
    description: "Choose fill density, breath interval, and melodic-gap handling for playable Flute support.",
    dependencies: ["flute-yield-register"],
    outputFocus: ["fill density", "breath map", "gap fills", "validation notes"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md Flute breath constraints, melodic gap fills, and validation rules.",
  },
  {
    id: "violin-bed-register",
    index: 6,
    label: "Violin Bed & Register",
    shortLabel: "Violin Bed",
    scope: "violin",
    description: "Choose Violin harmonic bed, counterline, or drone-pad strategy and the register relationship to the melody.",
    dependencies: ["flute-breath-fill-validation"],
    outputFocus: ["violin role", "register strategy", "melody avoidance", "harmonic support"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md Violin harmonic bed and frequency stratification rules.",
  },
  {
    id: "violin-expression-validation",
    index: 7,
    label: "Violin Expression & Validation",
    shortLabel: "Violin Polish",
    scope: "violin",
    description: "Choose bow expression, vibrato/swell profile, double-stop policy, and final playability constraints.",
    dependencies: ["violin-bed-register"],
    outputFocus: ["expression profile", "double-stop policy", "bowing constraints", "validation notes"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md Violin expression, playable double-stops, and conflict validation.",
  },
  {
    id: "final-conflict-review-apply",
    index: 8,
    label: "Final Conflict Review & Apply",
    shortLabel: "Final Apply",
    scope: "final",
    description: "Review all selected Djembe, Flute, and Violin choices, confirm conflict resolution, and prepare the final Layer 3 ABC bundle for user-applied ABCNotation.",
    dependencies: ["violin-expression-validation"],
    outputFocus: ["selected plan summary", "conflict-resolution hierarchy", "Layer 3 ABC readiness", "final warnings"],
    theoryReference: "ARRANGEMENT03-ESSEMBLE.md final conflict resolution: preserve melody, preserve Layer 2, flatten melodic runs, then remove percussion fills.",
  },
];

const STEP_BY_ID = new Map(ENSEMBLE_WORKFLOW_STEPS.map((step) => [step.id, step]));
