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

export interface AccompanimentWorkflowRun {
  id: string;
  createdAt: string;
  stepId: AccompanimentWorkflowStepId;
  requestPrompt: string;
  userNote: string;
  options: AccompanimentWorkflowOption[];
  rawResult?: unknown;
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
const LYRIC_CHORD_PATTERN = /\[([A-G](?:#|b)?(?:(?:maj|min|m|dim|aug|sus|add)\d*|\d+)?(?:[#b]\d+)*(?:\/[A-G](?:#|b)?)?)\]/g;
const LYRIC_CHORD_STRIP_PATTERN = /\[[^\]]+\]/g;

export function getAccompanimentWorkflowStep(stepId: AccompanimentWorkflowStepId): AccompanimentWorkflowStepDefinition {
  const step = STEP_BY_ID.get(stepId);
  if (!step) throw new Error(`Unknown accompaniment workflow step: ${stepId}`);
  return step;
}

export function extractLyricChordAnnotations(sourceAbc: string): AccompanimentLyricChordAnnotation[] {
  return sourceAbc.split(/\r?\n/).flatMap((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("w:")) return [];

    const lyricText = trimmed.slice(2).trim();
    const measures = lyricText.split("|");
    return measures.flatMap((measureText, measureIndex) => {
      LYRIC_CHORD_PATTERN.lastIndex = 0;
      const matches: AccompanimentLyricChordAnnotation[] = [];
      let match: RegExpExecArray | null;
      while ((match = LYRIC_CHORD_PATTERN.exec(measureText)) !== null) {
        const lyricFragment = measureText
          .slice(match.index)
          .replace(LYRIC_CHORD_STRIP_PATTERN, "")
          .replace(/[_*-]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        matches.push({
          chord: match[1],
          lineNumber: lineIndex + 1,
          measureIndex: measureIndex + 1,
          lyricFragment,
          rawLyricLine: lyricText,
        });
      }
      return matches;
    });
  });
}

export function hasLyricChordAnnotations(sourceAbc: string): boolean {
  return extractLyricChordAnnotations(sourceAbc).length > 0;
}

export function isChordIngestionWorkflowStep(stepId: AccompanimentWorkflowStepId): boolean {
  return ACCOMPANIMENT_CHORD_INGESTION_STEP_IDS.some((candidate) => candidate === stepId);
}

function formatLyricChordAnnotations(sourceAbc: string): string {
  const annotations = extractLyricChordAnnotations(sourceAbc);
  if (annotations.length === 0) return "No lyric chord annotations detected.";

  const progression = annotations.map((annotation) => annotation.chord).join(" → ");
  const details = annotations.map((annotation, index) => (
    `${index + 1}. ${annotation.chord} — lyric line ${annotation.lineNumber}, measure ${annotation.measureIndex}${annotation.lyricFragment ? ` near “${annotation.lyricFragment}”` : ""}`
  ));

  return [`Detected lyric chord progression: ${progression}`, ...details].join("\n");
}

export function getInitialAccompanimentWorkflowSteps(): Record<AccompanimentWorkflowStepId, AccompanimentWorkflowStepState> {
  return ACCOMPANIMENT_WORKFLOW_STEP_IDS.reduce((acc, stepId) => {
    acc[stepId] = {
      runs: [],
      activeRunId: null,
      selectedOptionId: null,
      selectedAt: null,
      promptNote: "",
    };
    return acc;
  }, {} as Record<AccompanimentWorkflowStepId, AccompanimentWorkflowStepState>);
}

export function fingerprintAccompanimentSource(sourceAbc: string): string {
  let hash = 2166136261;
  for (let index = 0; index < sourceAbc.length; index += 1) {
    hash ^= sourceAbc.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createAccompanimentWorkflowSession(sourceAbc: string): AccompanimentWorkflowSession {
  return {
    version: ACCOMPANIMENT_WORKFLOW_VERSION,
    sourceAbc,
    sourceAbcFingerprint: fingerprintAccompanimentSource(sourceAbc),
    currentStepId: "melody-snapshot",
    steps: getInitialAccompanimentWorkflowSteps(),
    guitarProfileHint: null,
    pianoProfileHint: null,
  };
}

export function isAccompanimentWorkflowSourceCurrent(session: AccompanimentWorkflowSession | null, sourceAbc: string): boolean {
  return Boolean(session && session.sourceAbcFingerprint === fingerprintAccompanimentSource(sourceAbc));
}

export function getWorkflowRun(stepState: AccompanimentWorkflowStepState, runId: string | null): AccompanimentWorkflowRun | null {
  if (!runId) return null;
  return stepState.runs.find((run) => run.id === runId) ?? null;
}

export function getSelectedWorkflowOption(
  session: AccompanimentWorkflowSession,
  stepId: AccompanimentWorkflowStepId
): AccompanimentWorkflowOption | null {
  const stepState = session.steps[stepId];
  const activeRun = getWorkflowRun(stepState, stepState.activeRunId);
  if (!activeRun || !stepState.selectedOptionId) return null;
  return activeRun.options.find((option) => option.id === stepState.selectedOptionId) ?? null;
}

export function isAccompanimentWorkflowStepComplete(
  session: AccompanimentWorkflowSession,
  stepId: AccompanimentWorkflowStepId
): boolean {
  return Boolean(getSelectedWorkflowOption(session, stepId));
}

export function isAccompanimentWorkflowStepUnlocked(
  session: AccompanimentWorkflowSession,
  stepId: AccompanimentWorkflowStepId
): boolean {
  return getAccompanimentWorkflowStep(stepId).dependencies.every((dependency) =>
    isAccompanimentWorkflowStepComplete(session, dependency)
  );
}

export function getNextUncompletedWorkflowStepId(session: AccompanimentWorkflowSession): AccompanimentWorkflowStepId | null {
  return ACCOMPANIMENT_WORKFLOW_STEP_IDS.find((stepId) =>
    isAccompanimentWorkflowStepUnlocked(session, stepId) && !isAccompanimentWorkflowStepComplete(session, stepId)
  ) ?? null;
}

export function clearAccompanimentWorkflowStepResults(
  session: AccompanimentWorkflowSession,
  stepIds: readonly AccompanimentWorkflowStepId[]
): AccompanimentWorkflowSession {
  const clearedStepIdSet = new Set<AccompanimentWorkflowStepId>(stepIds);
  const clearedSteps = ACCOMPANIMENT_WORKFLOW_STEP_IDS.reduce((acc, stepId) => {
    const stepState = session.steps[stepId];
    acc[stepId] = clearedStepIdSet.has(stepId)
      ? {
          runs: [],
          activeRunId: null,
          selectedOptionId: null,
          selectedAt: null,
          promptNote: stepState?.promptNote ?? "",
        }
      : stepState;
    return acc;
  }, {} as Record<AccompanimentWorkflowStepId, AccompanimentWorkflowStepState>);
  const clearedSession: AccompanimentWorkflowSession = {
    ...session,
    steps: clearedSteps,
  };

  return {
    ...clearedSession,
    currentStepId: getNextUncompletedWorkflowStepId(clearedSession) ?? clearedSession.currentStepId,
  };
}

export function getSelectedWorkflowContext(
  session: AccompanimentWorkflowSession,
  upToStepId?: AccompanimentWorkflowStepId
): AccompanimentWorkflowSelectedContext[] {
  const stopIndex = upToStepId ? ACCOMPANIMENT_WORKFLOW_STEP_IDS.indexOf(upToStepId) : ACCOMPANIMENT_WORKFLOW_STEP_IDS.length;
  const stepIds = ACCOMPANIMENT_WORKFLOW_STEP_IDS.slice(0, Math.max(stopIndex, 0));

  return stepIds.flatMap((stepId) => {
    const option = getSelectedWorkflowOption(session, stepId);
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

export function getLatestSelectedWorkflowStep(session: AccompanimentWorkflowSession | null): AccompanimentWorkflowStepDefinition | null {
  if (!session) return null;

  for (const stepId of [...ACCOMPANIMENT_WORKFLOW_STEP_IDS].reverse()) {
    if (getSelectedWorkflowOption(session, stepId)) return getAccompanimentWorkflowStep(stepId);
  }

  return null;
}

function toAbcComment(value: string): string {
  return `% ${value.replace(/\s+/g, " ").trim()}`;
}

function optionStringData(option: AccompanimentWorkflowOption | null, keys: string[]): string | null {
  if (!option) return null;

  for (const key of keys) {
    const value = option.data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

export function getWorkflowAppliedMusicAbc(session: AccompanimentWorkflowSession | null, fallbackAbc: string): string {
  if (!session) return fallbackAbc;

  const validationOption = getSelectedWorkflowOption(session, "voice-leading-validation");
  const progressionOption = getSelectedWorkflowOption(session, "chord-progression");
  const appliedAbc = optionStringData(validationOption, ["harmonizedAbc", "chordAnnotatedAbc", "abc", "validatedAbc"])
    ?? optionStringData(progressionOption, ["harmonizedAbc", "chordAnnotatedAbc", "abc"]);

  return appliedAbc ?? fallbackAbc;
}

export function buildAccompanimentWorkflowAbcAnnotation(session: AccompanimentWorkflowSession | null): string {
  const latestStep = getLatestSelectedWorkflowStep(session);
  if (!session || !latestStep) return "";

  const selectedContexts = getSelectedWorkflowContext(session);
  const latestOption = getSelectedWorkflowOption(session, latestStep.id);
  const lines = [
    "% --- Human-in-the-loop Accompaniment Workflow Applied ---",
    toAbcComment(`ABCNotation applied after Step ${latestStep.index}: ${latestStep.label}`),
    latestOption ? toAbcComment(`Latest selected option: ${latestOption.label}`) : null,
    "% Selected workflow decisions:",
    ...selectedContexts.flatMap((selection) => {
      const step = getAccompanimentWorkflowStep(selection.stepId);
      return [
        toAbcComment(`Step ${step.index} ${step.label}: ${selection.label}`),
        toAbcComment(`Summary: ${selection.summary}`),
      ];
    }),
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

export function getAccompanimentWorkflowPromptSummary(stepId: AccompanimentWorkflowStepId): string {
  const step = getAccompanimentWorkflowStep(stepId);
  return [
    `${step.label}: ${step.description}`,
    `Theory reference: ${step.theoryReference}`,
    `The LLM must return 1-5 options with justification, warnings, and validation notes.`,
  ].join("\n");
}

function formatMetadata(metadata: AccompanimentWorkflowMetadata): string {
  return [
    `- Key: ${metadata.key}`,
    `- Scale/Mode: ${metadata.scale}`,
    `- Time Signature: ${metadata.timeSignature}`,
    metadata.title ? `- Song Title: ${metadata.title}` : null,
    metadata.devotionalMood ? `- Devotional Mood: ${metadata.devotionalMood}` : null,
  ].filter(Boolean).join("\n");
}

function formatPreviousSelections(previousSelections: AccompanimentWorkflowSelectedContext[]): string {
  if (previousSelections.length === 0) return "No previous selections yet. Treat this as the first workflow decision.";

  return previousSelections.map((selection) => [
    `Step: ${getAccompanimentWorkflowStep(selection.stepId).label}`,
    `Selected: ${selection.label}`,
    `Summary: ${selection.summary}`,
    `Justification: ${selection.justification}`,
    `Data: ${JSON.stringify(selection.data)}`,
  ].join("\n")).join("\n\n");
}

export function buildAccompanimentWorkflowPrompt(input: {
  stepId: AccompanimentWorkflowStepId;
  sourceAbc: string;
  metadata: AccompanimentWorkflowMetadata;
  previousSelections: AccompanimentWorkflowSelectedContext[];
  userNote?: string;
}): string {
  const step = getAccompanimentWorkflowStep(input.stepId);
  const userNote = input.userNote?.trim();
  const lyricChordAnnotations = extractLyricChordAnnotations(input.sourceAbc);
  const abcDataInstruction = input.stepId === "chord-progression"
    ? "\nStep-specific data requirement: each option.data MUST include harmonizedAbc containing the full source ABC with the proposed chord symbols applied, so the user can immediately hear this progression in Music Staff Playback."
    : input.stepId === "voice-leading-validation"
      ? "\nStep-specific data requirement: each option.data MUST include harmonizedAbc or validatedAbc containing the full final chord-annotated ABC after voice-leading validation, so the user can immediately hear it in Music Staff Playback."
      : "";
  const lyricChordInstruction = lyricChordAnnotations.length > 0 && isChordIngestionWorkflowStep(input.stepId)
    ? "\n- The source ABC has chord symbols embedded inside the lyric w: lines. Treat those lyric chord symbols as the user-supplied chord progression. Do not invent a different progression; map roles, progression, and validation around these chords."
    : "";

  return `DEFAULT PROMPT — MUSIC ACCOMPANIMENT WORKFLOW STEP ${step.index}\n\nTask: ${step.label}\n${step.description}\n\nTheory reference to follow:\n${step.theoryReference}\n\nOutput focus:\n${step.outputFocus.map((item) => `- ${item}`).join("\n")}\n\nGlobal hard rules:\n- Return between 1 and 5 distinct options.\n- Every option must include a concise label, summary, justification, warnings, and validation notes.\n- Preserve the source melody ABC exactly unless this step explicitly asks for chord annotations.\n- Respect previously selected workflow decisions.\n- If a choice is musically risky, include a warning instead of hiding the risk.\n- Prefer devotional/bhajan-appropriate support unless the user's note asks otherwise.${abcDataInstruction}${lyricChordInstruction}\n\nMetadata:\n${formatMetadata(input.metadata)}\n\nPreviously selected workflow context:\n${formatPreviousSelections(input.previousSelections)}\n\nLyric chord annotations:\n${formatLyricChordAnnotations(input.sourceAbc)}\n\nSource ABC:\n\`\`\`abc\n${input.sourceAbc}\n\`\`\`\n\nUSER NOTE TO ADD TO PROMPT:\n${userNote || "(none)"}`;
}

export function buildConsolidatedChordIngestionPrompt(input: {
  sourceAbc: string;
  metadata: AccompanimentWorkflowMetadata;
  previousSelections: AccompanimentWorkflowSelectedContext[];
  userNote?: string;
}): string {
  const userNote = input.userNote?.trim();

  return `DEFAULT PROMPT — MUSIC ACCOMPANIMENT WORKFLOW CONSOLIDATED CHORD INGESTION\n\nTask: The lyrics contain chord symbols like [Em]Hari Bol, Hari [D]Bol. In one LLM decision, ingest the lyric chord progression and produce reviewable results for these three workflow steps:\n1. Chord-tone Role Mapping\n2. Chord Progression Selection\n3. Voice-leading & Harmonized ABC Validation\n\nHard rules:\n- Use the lyric chord annotations below as the supplied chord progression. Do not invent a replacement progression.\n- Return between 1 and 5 options for each of the three result groups.\n- Chord-tone options explain how strong melody notes function over the supplied chords.\n- Progression options preserve the supplied chord order and provide roman numerals/function labels.\n- Validation options must include option.data.harmonizedAbc or option.data.validatedAbc containing the full source ABC with playable chord symbols applied outside the w: lyric lines, so Music Staff Playback can render the harmony.\n- Preserve the source melody ABC exactly except for adding/moving chord annotations into playable ABC chord positions.\n- Include warnings for any lyric chord that conflicts with strong melody tones, raga/scale expectations, or cadence support.\n\nMetadata:\n${formatMetadata(input.metadata)}\n\nPreviously selected workflow context:\n${formatPreviousSelections(input.previousSelections)}\n\nLyric chord annotations to ingest:\n${formatLyricChordAnnotations(input.sourceAbc)}\n\nSource ABC:\n\`\`\`abc\n${input.sourceAbc}\n\`\`\`\n\nUSER NOTE TO ADD TO PROMPT:\n${userNote || "(none)"}`;
}

function buildWorkflowOptionsProperty(description: string) {
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
        data: {
          type: "object",
          description: "Step-specific structured decision data. Include profile/style ids when relevant.",
          additionalProperties: true,
        },
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
      options: buildWorkflowOptionsProperty(`One to five options for ${step.label}.`),
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
          options: buildWorkflowOptionsProperty("One to five options for the user to choose from."),
        },
        required: ["options"],
      },
    },
  };
}
