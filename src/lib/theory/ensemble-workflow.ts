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

const INSTRUMENT_STEP_IDS: Record<EnsembleInstrument, EnsembleWorkflowStepId[]> = {
  djembe: ["djembe-groove-interlock", "djembe-fill-validation"],
  flute: ["flute-yield-register", "flute-breath-fill-validation"],
  violin: ["violin-bed-register", "violin-expression-validation"],
};

export function getEnsembleInstrumentStepIds(instrument: EnsembleInstrument): EnsembleWorkflowStepId[] {
  return INSTRUMENT_STEP_IDS[instrument];
}

export function getEnsembleStepInstrument(stepId: EnsembleWorkflowStepId): EnsembleInstrument | null {
  if (stepId.startsWith("djembe")) return "djembe";
  if (stepId.startsWith("flute")) return "flute";
  if (stepId.startsWith("violin")) return "violin";
  return null;
}

export function getEnsembleWorkflowStep(stepId: EnsembleWorkflowStepId): EnsembleWorkflowStepDefinition {
  const step = STEP_BY_ID.get(stepId);
  if (!step) throw new Error(`Unknown ensemble workflow step: ${stepId}`);
  return step;
}

export function getInitialEnsembleWorkflowSteps(): Record<EnsembleWorkflowStepId, EnsembleWorkflowStepState> {
  return ENSEMBLE_WORKFLOW_STEP_IDS.reduce((acc, stepId) => {
    acc[stepId] = {
      runs: [],
      activeRunId: null,
      selectedOptionId: null,
      selectedAt: null,
      promptNote: "",
    };
    return acc;
  }, {} as Record<EnsembleWorkflowStepId, EnsembleWorkflowStepState>);
}

export function fingerprintEnsembleSource(sourceAbc: string): string {
  let hash = 2166136261;
  for (let index = 0; index < sourceAbc.length; index += 1) {
    hash ^= sourceAbc.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createEnsembleWorkflowSession(sourceAbc: string): EnsembleWorkflowSession {
  return {
    version: ENSEMBLE_WORKFLOW_VERSION,
    sourceAbc,
    sourceAbcFingerprint: fingerprintEnsembleSource(sourceAbc),
    currentStepId: "foundation-handshake",
    steps: getInitialEnsembleWorkflowSteps(),
    appliedAt: null,
    appliedSelectionFingerprint: null,
  };
}

export function isEnsembleWorkflowSourceCurrent(session: EnsembleWorkflowSession | null, sourceAbc: string): boolean {
  return Boolean(session && session.sourceAbcFingerprint === fingerprintEnsembleSource(sourceAbc));
}

export function getEnsembleWorkflowRun(stepState: EnsembleWorkflowStepState, runId: string | null): EnsembleWorkflowRun | null {
  if (!runId) return null;
  return stepState.runs.find((run) => run.id === runId) ?? null;
}

export function getSelectedEnsembleWorkflowOption(
  session: EnsembleWorkflowSession,
  stepId: EnsembleWorkflowStepId
): EnsembleWorkflowOption | null {
  const stepState = session.steps[stepId];
  const activeRun = getEnsembleWorkflowRun(stepState, stepState.activeRunId);
  if (!activeRun || !stepState.selectedOptionId) return null;
  return activeRun.options.find((option) => option.id === stepState.selectedOptionId) ?? null;
}

export function isEnsembleWorkflowStepComplete(
  session: EnsembleWorkflowSession,
  stepId: EnsembleWorkflowStepId
): boolean {
  return Boolean(getSelectedEnsembleWorkflowOption(session, stepId));
}

export function isEnsembleInstrumentSkipped(session: EnsembleWorkflowSession | null, instrument: EnsembleInstrument): boolean {
  if (!session) return false;
  return getEnsembleInstrumentStepIds(instrument).some((stepId) =>
    getSelectedEnsembleWorkflowOption(session, stepId)?.data.skipInstrument === true
  );
}

export function getSkippedEnsembleInstruments(session: EnsembleWorkflowSession | null): EnsembleInstrument[] {
  return (["djembe", "flute", "violin"] as const).filter((instrument) =>
    isEnsembleInstrumentSkipped(session, instrument)
  );
}

export function isEnsembleWorkflowStepUnlocked(
  session: EnsembleWorkflowSession,
  stepId: EnsembleWorkflowStepId
): boolean {
  return getEnsembleWorkflowStep(stepId).dependencies.every((dependency) =>
    isEnsembleWorkflowStepComplete(session, dependency)
  );
}

export function getSelectedEnsembleWorkflowContext(
  session: EnsembleWorkflowSession,
  upToStepId?: EnsembleWorkflowStepId
): EnsembleWorkflowSelectedContext[] {
  const stopIndex = upToStepId ? ENSEMBLE_WORKFLOW_STEP_IDS.indexOf(upToStepId) : ENSEMBLE_WORKFLOW_STEP_IDS.length;
  const stepIds = ENSEMBLE_WORKFLOW_STEP_IDS.slice(0, Math.max(stopIndex, 0));

  return stepIds.flatMap((stepId) => {
    const option = getSelectedEnsembleWorkflowOption(session, stepId);
    if (!option) return [];
    return [{
      stepId,
      label: option.label,
      summary: option.summary,
      justification: option.justification,
      data: option.data,
    }];
  });
}

export function getLatestSelectedEnsembleWorkflowStep(session: EnsembleWorkflowSession | null): EnsembleWorkflowStepDefinition | null {
  if (!session) return null;

  for (const stepId of [...ENSEMBLE_WORKFLOW_STEP_IDS].reverse()) {
    if (getSelectedEnsembleWorkflowOption(session, stepId)) return getEnsembleWorkflowStep(stepId);
  }

  return null;
}

function toAbcComment(value: string): string {
  return `% ${value.replace(/\s+/g, " ").trim()}`;
}

function stringEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

function booleanData(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberData(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function stringData(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function selectedData(session: EnsembleWorkflowSession, stepIds: EnsembleWorkflowStepId[]): Record<string, unknown> {
  return stepIds.reduce((acc, stepId) => ({
    ...acc,
    ...(getSelectedEnsembleWorkflowOption(session, stepId)?.data ?? {}),
  }), {} as Record<string, unknown>);
}

export function getEnsembleGenerationPlan(session: EnsembleWorkflowSession | null): EnsembleGenerationPlan {
  if (!session) return DEFAULT_ENSEMBLE_GENERATION_PLAN;

  const djembeData = selectedData(session, ["djembe-groove-interlock", "djembe-fill-validation"]);
  const fluteData = selectedData(session, ["flute-yield-register", "flute-breath-fill-validation"]);
  const violinData = selectedData(session, ["violin-bed-register", "violin-expression-validation"]);

  return {
    djembe: {
      grooveProfile: stringEnum(djembeData.grooveProfile ?? djembeData.profile, ["devotional", "folk-upbeat", "compound-flow", "sparse"], DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.grooveProfile),
      density: stringEnum(djembeData.density, ["minimal", "moderate", "active"], DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.density),
      bassSync: booleanData(djembeData.bassSync, DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.bassSync),
      backbeatSlaps: booleanData(djembeData.backbeatSlaps, DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.backbeatSlaps),
      fillPolicy: stringEnum(djembeData.fillPolicy, ["none", "gap-only", "cadence-only"], DEFAULT_ENSEMBLE_GENERATION_PLAN.djembe.fillPolicy),
    },
    flute: {
      role: stringEnum(fluteData.role, ["halo", "gap-fills", "sustained-pad"], DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.role),
      fillDensity: stringEnum(fluteData.fillDensity ?? fluteData.density, ["minimal", "moderate", "active"], DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.fillDensity),
      preferredRegister: stringData(fluteData.preferredRegister, DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.preferredRegister),
      breathEveryMeasures: numberData(fluteData.breathEveryMeasures, DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.breathEveryMeasures, 1, 8),
      yieldWhenMelodyActive: booleanData(fluteData.yieldWhenMelodyActive, DEFAULT_ENSEMBLE_GENERATION_PLAN.flute.yieldWhenMelodyActive),
    },
    violin: {
      role: stringEnum(violinData.role, ["harmonic-bed", "counterline", "drone-pad"], DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.role),
      registerStrategy: stringEnum(violinData.registerStrategy, ["below-melody", "interlock"], DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.registerStrategy),
      doubleStopPolicy: stringEnum(violinData.doubleStopPolicy, ["single-note", "safe-double-stops"], DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.doubleStopPolicy),
      expressionProfile: stringEnum(violinData.expressionProfile, ["plain", "swell-vibrato"], DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.expressionProfile),
      yieldWhenMelodyActive: booleanData(violinData.yieldWhenMelodyActive, DEFAULT_ENSEMBLE_GENERATION_PLAN.violin.yieldWhenMelodyActive),
    },
  };
}

export function fingerprintEnsembleSelections(session: EnsembleWorkflowSession | null): string {
  if (!session) return "";
  return fingerprintEnsembleSource(JSON.stringify(getSelectedEnsembleWorkflowContext(session)));
}

export function buildEnsembleWorkflowAbcAnnotation(session: EnsembleWorkflowSession | null): string {
  if (!session || !session.appliedAt) return "";

  const selectedContexts = getSelectedEnsembleWorkflowContext(session);
  const lines = [
    "% --- Human-in-the-loop Ensemble Workflow Applied ---",
    toAbcComment(`ABCNotation applied after Step 8: Final Conflict Review & Apply`),
    toAbcComment(`Applied at: ${session.appliedAt}`),
    "% Selected ensemble workflow decisions:",
    ...selectedContexts.flatMap((selection) => {
      const step = getEnsembleWorkflowStep(selection.stepId);
      return [
        toAbcComment(`Step ${step.index} ${step.label}: ${selection.label}`),
        toAbcComment(`Summary: ${selection.summary}`),
      ];
    }),
  ];

  return lines.join("\n");
}

export function getEnsembleWorkflowPromptSummary(stepId: EnsembleWorkflowStepId): string {
  const step = getEnsembleWorkflowStep(stepId);
  return [
    `${step.label}: ${step.description}`,
    `Theory reference: ${step.theoryReference}`,
    `The LLM must return 1-5 options with justification, warnings, validation notes, and structured plan data.`,
  ].join("\n");
}

function formatMetadata(metadata: EnsembleWorkflowMetadata): string {
  return [
    `- Key: ${metadata.key}`,
    `- Scale/Mode: ${metadata.scale}`,
    `- Time Signature: ${metadata.timeSignature}`,
    metadata.title ? `- Song Title: ${metadata.title}` : null,
    metadata.devotionalMood ? `- Devotional Mood: ${metadata.devotionalMood}` : null,
  ].filter(Boolean).join("\n");
}

function formatPreviousSelections(previousSelections: EnsembleWorkflowSelectedContext[]): string {
  if (previousSelections.length === 0) return "No previous selections yet. Treat this as the first ensemble workflow decision.";

  return previousSelections.map((selection) => [
    `Step: ${getEnsembleWorkflowStep(selection.stepId).label}`,
    `Selected: ${selection.label}`,
    `Summary: ${selection.summary}`,
    `Justification: ${selection.justification}`,
    `Data: ${JSON.stringify(selection.data)}`,
  ].join("\n")).join("\n\n");
}

function stepSpecificDataRequirement(stepId: EnsembleWorkflowStepId): string {
  if (stepId.startsWith("djembe")) {
    return "\nStep-specific data requirement: option.data should include any of grooveProfile ('devotional'|'folk-upbeat'|'compound-flow'|'sparse'), density ('minimal'|'moderate'|'active'), bassSync, backbeatSlaps, and fillPolicy ('none'|'gap-only'|'cadence-only').";
  }

  if (stepId.startsWith("flute")) {
    return "\nStep-specific data requirement: option.data should include any of role ('halo'|'gap-fills'|'sustained-pad'), fillDensity ('minimal'|'moderate'|'active'), preferredRegister, breathEveryMeasures, and yieldWhenMelodyActive.";
  }

  if (stepId.startsWith("violin")) {
    return "\nStep-specific data requirement: option.data should include any of role ('harmonic-bed'|'counterline'|'drone-pad'), registerStrategy ('below-melody'|'interlock'), doubleStopPolicy ('single-note'|'safe-double-stops'), expressionProfile ('plain'|'swell-vibrato'), and yieldWhenMelodyActive.";
  }

  if (stepId === "final-conflict-review-apply") {
    return "\nStep-specific data requirement: option.data should include conflictReview, readyToApply, and any finalWarnings. Do not include raw ABC unless specifically needed for a warning; deterministic generators will create the ABC layers.";
  }

  return "\nStep-specific data requirement: option.data should summarize foundation readiness, density grid assumptions, bass map assumptions, and melodic gap assumptions.";
}

export function buildEnsembleWorkflowPrompt(input: {
  stepId: EnsembleWorkflowStepId;
  sourceAbc: string;
  metadata: EnsembleWorkflowMetadata;
  previousSelections: EnsembleWorkflowSelectedContext[];
  userNote?: string;
}): string {
  const step = getEnsembleWorkflowStep(input.stepId);
  const userNote = input.userNote?.trim();

  return `DEFAULT PROMPT — MUSIC ENSEMBLE WORKFLOW STEP ${step.index}\n\nTask: ${step.label}\n${step.description}\n\nTheory reference to follow:\n${step.theoryReference}\n\nOutput focus:\n${step.outputFocus.map((item) => `- ${item}`).join("\n")}\n\nGlobal hard rules:\n- Return between 1 and 5 distinct options.\n- Every option must include a concise label, summary, justification, warnings, validation notes, and structured data.\n- Preserve Layer 1 melody as highest priority; do not crowd the singer.\n- Preserve Layer 2 accompaniment foundation as second priority; Djembe must sync bass strokes to Layer 2 bass/transient points.\n- Djembe may use unused subdivisions, but must avoid duplicate transient ownership and over-busy devotional texture.\n- Flute must yield while the primary melody is active unless sustaining a soft halo; melodic fills belong in melodic gaps and must include breath constraints.\n- Violin must behave as harmonic bed/counterline/drone support, avoid melody-register collisions, and obey playable double-stop/bowing constraints.\n- Final conflict hierarchy: preserve melody, preserve Layer 2, flatten Flute/Violin melodic runs to background, then remove Djembe fills if still overloaded.\n- Respect previously selected workflow decisions.\n- If a choice is musically risky, include a warning instead of hiding the risk.\n- Prefer devotional/bhajan-appropriate support unless the user's note asks otherwise.${stepSpecificDataRequirement(input.stepId)}\n\nMetadata:\n${formatMetadata(input.metadata)}\n\nPreviously selected workflow context:\n${formatPreviousSelections(input.previousSelections)}\n\nCurrent foundation ABC:\n\`\`\`abc\n${input.sourceAbc}\n\`\`\`\n\nUSER NOTE TO ADD TO PROMPT:\n${userNote || "(none)"}`;
}

export function buildEnsembleWorkflowToolSchema(stepId: EnsembleWorkflowStepId) {
  const step = getEnsembleWorkflowStep(stepId);

  return {
    type: "function",
    function: {
      name: `generate_${stepId.replaceAll("-", "_")}`,
      description: `Generate 1-5 human-reviewable options for ${step.label}.`,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          options: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            description: "One to five options for the user to choose from.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string", description: "Stable kebab-case option id." },
                label: { type: "string", description: "Short human-readable option label." },
                summary: { type: "string", description: "One or two sentence summary." },
                justification: { type: "string", description: "Music-theory and orchestration justification for this option." },
                data: {
                  type: "object",
                  description: "Step-specific structured ensemble decision data. Include profile, density, yield, breath, expression, and validation fields when relevant.",
                  additionalProperties: true,
                },
                warnings: {
                  type: "array",
                  items: { type: "string" },
                  description: "Warnings for density, register, melody collision, transient conflict, playability, or ABC readiness choices.",
                },
                validationNotes: {
                  type: "array",
                  items: { type: "string" },
                  description: "Notes showing how the option satisfies this step's ensemble validation rules.",
                },
              },
              required: ["id", "label", "summary", "justification", "data", "warnings", "validationNotes"],
            },
          },
        },
        required: ["options"],
      },
    },
  };
}
