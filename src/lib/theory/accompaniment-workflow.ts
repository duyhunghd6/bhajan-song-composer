import { splitAbcMeasureSegments, splitAbcMeasureSegmentsWithBarlines, type AbcBarlineInfo, joinAbcMeasuresWithBarlines } from "./abc-duration";
import { normalizeAbcVoiceSyntax } from "./abc-voice-normalization";
import { resolveProgression } from "./arranger-utils";
import { buildChordToneReferenceTable, validateGuitarVoiceChordTones } from "./chord-tone-reference";
import { convertAbcToTimeSliceGrid } from "./fingerstyle-arranger/time-slice";
import {
  ACCOMPANIMENT_CHORD_INGESTION_STEP_IDS,
  ACCOMPANIMENT_GUITAR_TAB_VALIDATION_STEP_IDS,
  ACCOMPANIMENT_INSTRUMENT_LABELS,
  ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_SHARED_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_STEPS,
  ACCOMPANIMENT_WORKFLOW_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_VERSION,
  type AccompanimentInstrumentId,
  type AccompanimentInstrumentSelection,
  type AccompanimentLyricChordAnnotation,
  type AccompanimentWorkflowMetadata,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowScope,
  type AccompanimentWorkflowSelectedContext,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowSetup,
  type AccompanimentWorkflowStepDefinition,
  type AccompanimentWorkflowStepId,
  type AccompanimentWorkflowStepState,
} from "./accompaniment-workflow/definition";
export * from "./accompaniment-workflow/definition";
export { convertGuitarClassicEventsToAbc } from "./accompaniment-workflow/guitar-classic-abc";
export { realizeGuitarClassicAccompaniment } from "./accompaniment-workflow/guitar-classic-realization";
export { buildChordToneReferenceTable, validateGuitarVoiceChordTones } from "./chord-tone-reference";
export {
  buildAccompanimentWorkflowToolSchema,
  buildAddStrongBeatIconsToolSchema,
  buildBreakMeasuresLineToolSchema,
  buildConsolidatedChordIngestionToolSchema,
  buildQueryGuitarVoicingsToolSchema,
  expandCompactTabEvent,
  getAccompanimentWorkflowLlmToolNames,
  hasCompactTabKeys,
  normalizeGuitarTabEvents,
} from "./accompaniment-workflow/tool-schema";
export {
  emptyStepState,
  extractProfile,
  hasWorkflowStepResults,
  makeSkippedOption,
  mergeRun,
  mergeRuns,
  selectOption,
  skipWorkflowSteps,
} from "./accompaniment-workflow/session-transitions";

const STEP_BY_ID = new Map(ACCOMPANIMENT_WORKFLOW_STEPS.map((step) => [step.id, step]));
const LYRIC_CHORD_PATTERN = /\[([A-G](?:#|b)?(?:(?:maj|min|m|dim|aug|sus|add)\d*|\d+)?(?:[#b]\d+)*(?:\/[A-G](?:#|b)?)?)\]/g;
const LYRIC_CHORD_STRIP_PATTERN = /\[[^\]]+\]/g;

const DEFAULT_INSTRUMENT_ORDER: AccompanimentInstrumentId[] = [
  "guitar-classic",
];

const LEGACY_ENABLED_INSTRUMENTS = new Set<AccompanimentInstrumentId>(DEFAULT_INSTRUMENT_ORDER);
const NEW_WORKFLOW_ENABLED_INSTRUMENTS = new Set<AccompanimentInstrumentId>(DEFAULT_INSTRUMENT_ORDER);

function makeSetup(enabled: Set<AccompanimentInstrumentId>, style: AccompanimentWorkflowSetup["style"]): AccompanimentWorkflowSetup {
  return {
    style,
    instruments: DEFAULT_INSTRUMENT_ORDER.map((id, index) => ({
      id,
      enabled: enabled.has(id),
      order: index,
      roleNote: defaultInstrumentRoleNote(id, index, DEFAULT_INSTRUMENT_ORDER.length),
    })),
  };
}

export function getDefaultAccompanimentWorkflowSetup(): AccompanimentWorkflowSetup {
  return makeSetup(NEW_WORKFLOW_ENABLED_INSTRUMENTS, "accompaniment");
}

export function getLegacyAccompanimentWorkflowSetup(): AccompanimentWorkflowSetup {
  return makeSetup(LEGACY_ENABLED_INSTRUMENTS, "accompaniment");
}

function instrumentScope(id: AccompanimentInstrumentId): Exclude<AccompanimentWorkflowScope, "shared"> {
  return "guitar";
}

function isAccompanimentStyleId(value: unknown): value is AccompanimentWorkflowSetup["style"] {
  return value === "accompaniment";
}

function isAccompanimentInstrumentId(value: unknown): value is AccompanimentInstrumentId {
  return DEFAULT_INSTRUMENT_ORDER.some((id) => id === value);
}

export function orderedAccompanimentInstruments(setup: AccompanimentWorkflowSetup): AccompanimentInstrumentSelection[] {
  return [...setup.instruments].sort((a, b) => a.order - b.order);
}

export function defaultInstrumentRoleNote(id: AccompanimentInstrumentId, order: number, total: number): string {
  const altitude = order <= 1
    ? "bottom/foundation priority"
    : order >= total - 2
      ? "top/treble or transient color"
      : "middle comping/support lane";

  return `${altitude}; acoustic steel-string guitar with arpeggiated/staggered notes and no block-chord clutter.`;
}

export function normalizeAccompanimentWorkflowSetup(setup?: Partial<AccompanimentWorkflowSetup> | null): AccompanimentWorkflowSetup {
  if (!setup) return getLegacyAccompanimentWorkflowSetup();

  const byId = new Map<AccompanimentInstrumentId, Partial<AccompanimentInstrumentSelection>>();
  for (const instrument of Array.isArray(setup.instruments) ? setup.instruments : []) {
    if (isAccompanimentInstrumentId(instrument?.id)) byId.set(instrument.id, instrument);
  }

  const normalized = DEFAULT_INSTRUMENT_ORDER.map((id, defaultOrder) => {
    const candidate = byId.get(id);
    const order = typeof candidate?.order === "number" && Number.isFinite(candidate.order)
      ? candidate.order
      : defaultOrder;
    return {
      id,
      enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : false,
      order,
      roleNote: typeof candidate?.roleNote === "string" && candidate.roleNote.trim()
        ? candidate.roleNote.trim()
        : defaultInstrumentRoleNote(id, order, DEFAULT_INSTRUMENT_ORDER.length),
    };
  });

  return {
    // Legacy Solo/Fingerstyle setup values now use the combined accompaniment workflow.
    style: isAccompanimentStyleId(setup.style) ? setup.style : "accompaniment",
    instruments: normalized
      .sort((a, b) => a.order - b.order)
      .map((instrument, order) => ({
        ...instrument,
        order,
        roleNote: instrument.roleNote || defaultInstrumentRoleNote(instrument.id, order, normalized.length),
      })),
  };
}

export function getEnabledAccompanimentWorkflowStepIds(setupInput?: Partial<AccompanimentWorkflowSetup> | null): AccompanimentWorkflowStepId[] {
  const setup = normalizeAccompanimentWorkflowSetup(setupInput);
  const stepIds: AccompanimentWorkflowStepId[] = [...ACCOMPANIMENT_WORKFLOW_SHARED_STEP_IDS];
  const seenScopes = new Set<AccompanimentWorkflowScope>(["shared"]);
  const enabledInstruments = orderedAccompanimentInstruments(setup).filter((instrument) => instrument.enabled);

  for (const instrument of enabledInstruments) {
    const scope = instrumentScope(instrument.id);
    if (seenScopes.has(scope)) continue;
    seenScopes.add(scope);
    stepIds.push(...ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS[scope]);
  }

  return stepIds;
}

function sessionSetup(session: AccompanimentWorkflowSession): AccompanimentWorkflowSetup {
  return normalizeAccompanimentWorkflowSetup((session as Partial<AccompanimentWorkflowSession>).setup);
}

function sessionEnabledStepIds(session: AccompanimentWorkflowSession): AccompanimentWorkflowStepId[] {
  const enabledStepIds = (session as Partial<AccompanimentWorkflowSession>).enabledStepIds;
  if (Array.isArray(enabledStepIds) && enabledStepIds.length > 0) {
    return enabledStepIds.filter((stepId): stepId is AccompanimentWorkflowStepId => ACCOMPANIMENT_WORKFLOW_STEP_IDS.some((candidate) => candidate === stepId));
  }
  return getEnabledAccompanimentWorkflowStepIds(sessionSetup(session));
}

export function isAccompanimentWorkflowStepEnabled(session: AccompanimentWorkflowSession, stepId: AccompanimentWorkflowStepId): boolean {
  return sessionEnabledStepIds(session).some((candidate) => candidate === stepId);
}

export function getVisibleAccompanimentWorkflowStepsForSetup(setupInput?: Partial<AccompanimentWorkflowSetup> | null): AccompanimentWorkflowStepDefinition[] {
  return getEnabledAccompanimentWorkflowStepIds(setupInput).map((stepId) => getAccompanimentWorkflowStep(stepId));
}

export function getVisibleAccompanimentWorkflowSteps(session: AccompanimentWorkflowSession | null): AccompanimentWorkflowStepDefinition[] {
  if (!session) return ACCOMPANIMENT_WORKFLOW_STEPS;
  return sessionEnabledStepIds(session).map((stepId) => getAccompanimentWorkflowStep(stepId));
}

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

export function isGuitarTabValidationWorkflowStep(stepId: AccompanimentWorkflowStepId): boolean {
  return ACCOMPANIMENT_GUITAR_TAB_VALIDATION_STEP_IDS.some((candidate) => candidate === stepId);
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

export function createAccompanimentWorkflowSession(
  sourceAbc: string,
  setupInput?: Partial<AccompanimentWorkflowSetup> | null
): AccompanimentWorkflowSession {
  const setup = setupInput ? normalizeAccompanimentWorkflowSetup(setupInput) : getLegacyAccompanimentWorkflowSetup();
  const enabledStepIds = getEnabledAccompanimentWorkflowStepIds(setup);
  return {
    version: ACCOMPANIMENT_WORKFLOW_VERSION,
    sourceAbc,
    sourceAbcFingerprint: fingerprintAccompanimentSource(sourceAbc),
    currentStepId: enabledStepIds[0] ?? "key-beats",
    steps: getInitialAccompanimentWorkflowSteps(),
    guitarProfileHint: null,
    setup,
    enabledStepIds,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizePersistedStepState(value: unknown): AccompanimentWorkflowStepState | null {
  if (!isRecord(value) || !Array.isArray(value.runs)) return null;

  const runs = value.runs.filter((run): run is AccompanimentWorkflowRun => (
    isRecord(run)
    && typeof run.id === "string"
    && typeof run.stepId === "string"
    && Array.isArray(run.options)
  ));

  return {
    runs,
    activeRunId: typeof value.activeRunId === "string" ? value.activeRunId : null,
    selectedOptionId: typeof value.selectedOptionId === "string" ? value.selectedOptionId : null,
    selectedAt: typeof value.selectedAt === "string" ? value.selectedAt : null,
    promptNote: typeof value.promptNote === "string" ? value.promptNote : "",
  };
}

export function normalizeAccompanimentWorkflowSession(value: unknown): AccompanimentWorkflowSession | null {
  if (!isRecord(value) || typeof value.sourceAbc !== "string") return null;

  const setupInput = isRecord(value.setup)
    ? value.setup as Partial<AccompanimentWorkflowSetup>
    : getLegacyAccompanimentWorkflowSetup();
  const setup = normalizeAccompanimentWorkflowSetup(setupInput);
  const enabledStepIds = getEnabledAccompanimentWorkflowStepIds(setup);
  const rawSteps = isRecord(value.steps) ? value.steps : {};
  const steps = getInitialAccompanimentWorkflowSteps();

  for (const stepId of ACCOMPANIMENT_WORKFLOW_STEP_IDS) {
    const restored = normalizePersistedStepState(rawSteps[stepId]);
    if (restored) steps[stepId] = restored;
  }

  const persistedVersion = typeof value.version === "number" ? value.version : 0;
  if (persistedVersion < ACCOMPANIMENT_WORKFLOW_VERSION) {
    // Earlier Guitar selections have only sparse physical anchors and
    // no explicit Step 4 realization technique. Regenerate this branch rather
    // than guessing which arpeggio/strum the user intended.
    for (const stepId of ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.guitar) {
      steps[stepId] = getInitialAccompanimentWorkflowSteps()[stepId];
    }
  }

  const normalized: AccompanimentWorkflowSession = {
    version: ACCOMPANIMENT_WORKFLOW_VERSION,
    sourceAbc: value.sourceAbc,
    sourceAbcFingerprint: typeof value.sourceAbcFingerprint === "string"
      ? value.sourceAbcFingerprint
      : fingerprintAccompanimentSource(value.sourceAbc),
    currentStepId: enabledStepIds[0] ?? "key-beats",
    steps,
    guitarProfileHint: typeof value.guitarProfileHint === "string" ? value.guitarProfileHint : null,
    setup,
    enabledStepIds,
  };
  const persistedCurrentStepId = typeof value.currentStepId === "string"
    && enabledStepIds.some((stepId) => stepId === value.currentStepId)
      ? value.currentStepId as AccompanimentWorkflowStepId
      : null;

  return {
    ...normalized,
    currentStepId: persistedCurrentStepId
      ?? getNextUncompletedWorkflowStepId(normalized)
      ?? enabledStepIds[0]
      ?? "key-beats",
  };
}

export function applyAccompanimentWorkflowSetupToSession(
  session: AccompanimentWorkflowSession,
  setupInput: Partial<AccompanimentWorkflowSetup>
): AccompanimentWorkflowSession {
  const setup = normalizeAccompanimentWorkflowSetup(setupInput);
  const enabledStepIds = getEnabledAccompanimentWorkflowStepIds(setup);
  const enabledStepIdSet = new Set<AccompanimentWorkflowStepId>(enabledStepIds);
  const updatedSession: AccompanimentWorkflowSession = {
    ...session,
    setup,
    enabledStepIds,
  };
  const nextUncompletedStepId = getNextUncompletedWorkflowStepId(updatedSession);
  const currentStepId = nextUncompletedStepId
    ?? (enabledStepIdSet.has(session.currentStepId) ? session.currentStepId : enabledStepIds[0] ?? "key-beats");

  return {
    ...updatedSession,
    currentStepId,
    guitarProfileHint: enabledStepIds.some((stepId) => ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.guitar.includes(stepId))
      ? updatedSession.guitarProfileHint
      : null,
  };
}

export function isAccompanimentWorkflowSourceCurrent(session: AccompanimentWorkflowSession | null, sourceAbc: string): boolean {
  return Boolean(session && session.sourceAbcFingerprint === fingerprintAccompanimentSource(sourceAbc));
}

export function getWorkflowRun(stepState: AccompanimentWorkflowStepState | undefined | null, runId: string | null): AccompanimentWorkflowRun | null {
  if (!stepState || !runId) return null;
  return stepState.runs.find((run) => run.id === runId) ?? null;
}

export function getSelectedWorkflowOption(
  session: AccompanimentWorkflowSession,
  stepId: AccompanimentWorkflowStepId
): AccompanimentWorkflowOption | null {
  const stepState = session.steps[stepId];
  if (!stepState) return null;
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
  if (!isAccompanimentWorkflowStepEnabled(session, stepId)) return false;
  const enabled = new Set(sessionEnabledStepIds(session));
  return getAccompanimentWorkflowStep(stepId).dependencies
    .filter((dependency) => enabled.has(dependency))
    .every((dependency) => isAccompanimentWorkflowStepComplete(session, dependency));
}

export function getNextUncompletedWorkflowStepId(session: AccompanimentWorkflowSession): AccompanimentWorkflowStepId | null {
  return sessionEnabledStepIds(session).find((stepId) =>
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
      : (stepState || {
          runs: [],
          activeRunId: null,
          selectedOptionId: null,
          selectedAt: null,
          promptNote: "",
        });
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
  const orderedStepIds = sessionEnabledStepIds(session);
  const stopIndex = upToStepId ? orderedStepIds.indexOf(upToStepId) : orderedStepIds.length;
  const stepIds = orderedStepIds.slice(0, Math.max(stopIndex, 0));

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

  for (const stepId of [...sessionEnabledStepIds(session)].reverse()) {
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

export function getHarmonyValidationAbc(session: AccompanimentWorkflowSession | null): string | null {
  if (!session) return null;
  const validationOption = getSelectedWorkflowOption(session, "voice-leading-validation");
  return optionStringData(validationOption, ["validatedAbc", "harmonizedAbc", "chordAnnotatedAbc", "abc"]);
}

export function getWorkflowAppliedMusicAbc(session: AccompanimentWorkflowSession | null, fallbackAbc: string): string {
  if (!session) return fallbackAbc;

  const progressionOption = getSelectedWorkflowOption(session, "chord-roles-progression");
  const appliedAbc = getHarmonyValidationAbc(session)
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

function formatWorkflowSetup(setupInput?: Partial<AccompanimentWorkflowSetup> | null): string {
  const setup = normalizeAccompanimentWorkflowSetup(setupInput ?? getLegacyAccompanimentWorkflowSetup());
  const enabled = orderedAccompanimentInstruments(setup).filter((instrument) => instrument.enabled);
  const disabled = orderedAccompanimentInstruments(setup).filter((instrument) => !instrument.enabled);
  return [
    `- Enabled instrument order: ${enabled.length ? enabled.map((instrument) => ACCOMPANIMENT_INSTRUMENT_LABELS[instrument.id]).join(" → ") : "none selected"}`,
    "- Role hints:",
    ...enabled.map((instrument, index) => `  ${index + 1}. ${ACCOMPANIMENT_INSTRUMENT_LABELS[instrument.id]} — ${instrument.roleNote ?? defaultInstrumentRoleNote(instrument.id, instrument.order, setup.instruments.length)}`),
    disabled.length ? `- Disabled/skipped instruments: ${disabled.map((instrument) => ACCOMPANIMENT_INSTRUMENT_LABELS[instrument.id]).join(", ")}` : "- Disabled/skipped instruments: none",
    "- Combined accompaniment rule: respect the ordered stack; lower instruments carry foundation/bass duties, upper instruments carry treble fills or transient color while yielding to melody.",
  ].join("\n");
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

function isMusicBodyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("%")) return false;
  if (/^[A-Za-z]:/.test(trimmed)) return false;
  return true;
}

function isLyricLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("w:") || trimmed.startsWith("+:");
}

function hasLyricGroups(groups: string[][], expectedLineCount: number): boolean {
  return groups.length === expectedLineCount && groups.some((group) => group.length > 0);
}

function extractSequentialLyricLineGroups(lines: string[]): string[][] {
  const groups: string[][] = [];
  let currentMusicLineIndex = -1;

  for (const line of lines) {
    if (isMusicBodyLine(line)) {
      currentMusicLineIndex += 1;
      groups[currentMusicLineIndex] ??= [];
      continue;
    }

    if (isLyricLine(line) && currentMusicLineIndex >= 0) {
      groups[currentMusicLineIndex] ??= [];
      groups[currentMusicLineIndex].push(line);
    }
  }

  return groups;
}

function extractInlineMelodyLyricLineGroups(lines: string[]): string[][] {
  const groups: string[][] = [];
  let currentMelodyLineIndex = -1;
  let acceptsLyrics = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\[V:([^\]]+)\]\s*(.*)$/);

    if (match) {
      acceptsLyrics = match[1] === "Melody";
      if (acceptsLyrics) {
        currentMelodyLineIndex += 1;
        groups[currentMelodyLineIndex] ??= [];
      }
      continue;
    }

    if (isLyricLine(line) && acceptsLyrics && currentMelodyLineIndex >= 0) {
      groups[currentMelodyLineIndex] ??= [];
      groups[currentMelodyLineIndex].push(line);
    }
  }

  return groups;
}

function measureLinePatternFromLines(lines: string[]): number[] {
  return lines
    .filter(isMusicBodyLine)
    .map((line) => splitAbcMeasureSegments(line).length)
    .filter((count) => count > 0);
}

function stripInlineVoicePrefix(line: string): string {
  return line.replace(/^\[V:[^\]]+\]\s*/, "");
}

export function getAbcMeasureLinePattern(abcString: string): number[] {
  const lines = normalizeAbcVoiceSyntax(abcString).split(/\r?\n/);
  const inlineMelodyLines = lines
    .map((line) => line.trim())
    .filter((line) => /^\[V:Melody\]\s*/.test(line));

  if (inlineMelodyLines.length > 0) {
    return measureLinePatternFromLines(inlineMelodyLines.map(stripInlineVoicePrefix));
  }

  const melodyStart = lines.findIndex((line) => /^V:Melody\b/.test(line.trim()));

  if (melodyStart >= 0) {
    const nextVoiceOffset = lines.slice(melodyStart + 1).findIndex((line) => /^V:/.test(line.trim()));
    const melodyEnd = nextVoiceOffset >= 0 ? melodyStart + 1 + nextVoiceOffset : lines.length;
    return measureLinePatternFromLines(lines.slice(melodyStart + 1, melodyEnd));
  }

  return measureLinePatternFromLines(lines);
}

function getReferenceBarlines(abcString: string): AbcBarlineInfo[] {
  const lines = normalizeAbcVoiceSyntax(abcString).split(/\r?\n/);
  
  const extractFromLines = (targetLines: string[]) => 
    targetLines.filter(isMusicBodyLine).flatMap((line) => 
      splitAbcMeasureSegmentsWithBarlines(line).map(s => s.barline)
    );

  const inlineMelodyLines = lines
    .map((line) => line.trim())
    .filter((line) => /^\[V:Melody\]\s*/.test(line));

  if (inlineMelodyLines.length > 0) {
    return extractFromLines(inlineMelodyLines.map(stripInlineVoicePrefix));
  }

  const melodyStart = lines.findIndex((line) => /^V:Melody\b/.test(line.trim()));

  if (melodyStart >= 0) {
    const nextVoiceOffset = lines.slice(melodyStart + 1).findIndex((line) => /^V:/.test(line.trim()));
    const melodyEnd = nextVoiceOffset >= 0 ? melodyStart + 1 + nextVoiceOffset : lines.length;
    return extractFromLines(lines.slice(melodyStart + 1, melodyEnd));
  }

  return extractFromLines(lines);
}

function referenceMeasureLinePattern(referenceAbc: string): number[] {
  return getAbcMeasureLinePattern(referenceAbc);
}

export function abcMatchesReferenceMeasureLinePattern(generatedAbc: string, referenceAbc: string): boolean {
  const expectedPattern = referenceMeasureLinePattern(referenceAbc);
  if (expectedPattern.length === 0) return true;

  const actualPattern = getAbcMeasureLinePattern(generatedAbc);
  return actualPattern.length === expectedPattern.length
    && actualPattern.every((count, index) => count === expectedPattern[index]);
}

function regroupMeasures(measures: string[], pattern: number[], fallbackLineCount: number, barlines: AbcBarlineInfo[] = []): string[] {
  const effectivePattern = pattern.length > 0 ? pattern : [Math.max(measures.length, 1)];
  const output: string[] = [];
  let cursor = 0;

  for (const count of effectivePattern) {
    const group = measures.slice(cursor, cursor + count);
    if (group.length === 0) break;
    const groupBarlines = barlines.slice(cursor, cursor + count);
    output.push(joinAbcMeasuresWithBarlines(group, groupBarlines));
    cursor += count;
  }

  if (cursor < measures.length) {
    const remainingLineCount = Math.max(fallbackLineCount - output.length, 1);
    const remaining = measures.slice(cursor);
    const chunkSize = Math.max(1, Math.ceil(remaining.length / remainingLineCount));
    for (let index = 0; index < remaining.length; index += chunkSize) {
      output.push(joinAbcMeasuresWithBarlines(
        remaining.slice(index, index + chunkSize),
        barlines.slice(cursor + index, cursor + index + chunkSize)
      ));
    }
  }

  return output;
}

function rebuildMusicLinesForPattern(
  lines: string[],
  pattern: number[],
  fallbackLyricLineGroups: string[][] = [],
  referenceBarlines?: AbcBarlineInfo[]
): string[] {
  const musicLineIndices = lines.flatMap((line, index) => isMusicBodyLine(line) ? [index] : []);
  if (musicLineIndices.length === 0) return lines;

  const segmentsWithBarlines = musicLineIndices.flatMap((index) => splitAbcMeasureSegmentsWithBarlines(stripInlineVoicePrefix(lines[index])));
  const measures = segmentsWithBarlines.map((s) => s.content);
  // Default to extracted barlines, but override with referenceBarlines if provided
  // (to force the LLM-generated string to retain the reference repeats).
  const barlines = referenceBarlines ?? segmentsWithBarlines.map((s) => s.barline);
  if (measures.length === 0) return lines;

  const regroupedMusicLines = regroupMeasures(measures, pattern, musicLineIndices.length, barlines);
  const generatedLyricLineGroups = extractSequentialLyricLineGroups(lines);
  const lyricLineGroups = hasLyricGroups(generatedLyricLineGroups, regroupedMusicLines.length)
    ? generatedLyricLineGroups
    : fallbackLyricLineGroups;
  const output: string[] = [];
  let inserted = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isMusicBodyLine(line)) {
      if (!inserted) {
        for (let lineIndex = 0; lineIndex < regroupedMusicLines.length; lineIndex += 1) {
          output.push(regroupedMusicLines[lineIndex]);
          output.push(...(lyricLineGroups[lineIndex] ?? []));
        }
        inserted = true;
      }
      continue;
    }

    if (isLyricLine(line)) continue;
    output.push(line);
  }

  return output;
}

function splitInlineVoiceBody(lines: string[]): { prefix: string[]; voiceLines: Map<string, string[]>; suffix: string[] } {
  const voiceLines = new Map<string, string[]>();
  const prefix: string[] = [];
  const suffix: string[] = [];
  let sawInlineVoice = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\[V:([^\]]+)\]\s*(.*)$/);
    if (match) {
      sawInlineVoice = true;
      const voiceName = match[1];
      const bodyLine = match[2];
      const entries = voiceLines.get(voiceName) ?? [];
      entries.push(bodyLine);
      voiceLines.set(voiceName, entries);
      continue;
    }

    if (sawInlineVoice && (isLyricLine(line) || trimmed.startsWith("% Staff system"))) continue;
    if (sawInlineVoice && trimmed && !/^[A-Za-z]:/.test(trimmed) && !trimmed.startsWith("%")) {
      suffix.push(line);
      continue;
    }

    if (sawInlineVoice) suffix.push(line);
    else prefix.push(line);
  }

  return { prefix, voiceLines, suffix };
}

function getReferenceLyricLineGroups(referenceAbc: string): string[][] {
  const lines = normalizeAbcVoiceSyntax(referenceAbc).split(/\r?\n/);

  if (lines.some((line) => /^\[V:Melody\]\s*/.test(line.trim()))) {
    return extractInlineMelodyLyricLineGroups(lines);
  }

  const melodyStart = lines.findIndex((line) => /^V:Melody\b/.test(line.trim()));

  if (melodyStart >= 0) {
    const nextVoiceOffset = lines.slice(melodyStart + 1).findIndex((line) => /^V:/.test(line.trim()));
    const melodyEnd = nextVoiceOffset >= 0 ? melodyStart + 1 + nextVoiceOffset : lines.length;
    return extractSequentialLyricLineGroups(lines.slice(melodyStart + 1, melodyEnd));
  }

  return extractSequentialLyricLineGroups(lines);
}

function regroupInlineVoiceLines(
  lines: string[],
  pattern: number[],
  fallbackLyricLineGroups: string[][] = [],
  referenceBarlines?: AbcBarlineInfo[]
): string[] {
  const { prefix, voiceLines, suffix } = splitInlineVoiceBody(lines);
  const melodyLines = voiceLines.get("Melody");
  if (!melodyLines || melodyLines.length === 0) return lines;

  const regroupedByVoice = new Map<string, string[]>();
  for (const [voiceName, bodyLines] of voiceLines) {
    regroupedByVoice.set(voiceName, rebuildMusicLinesForPattern(bodyLines, pattern, [], voiceName === "Melody" ? referenceBarlines : undefined));
  }

  const orderedVoiceNames = Array.from(voiceLines.keys());
  const lineCount = regroupedByVoice.get("Melody")?.length ?? 0;
  const generatedLyricLineGroups = extractInlineMelodyLyricLineGroups(lines);
  const lyricLineGroups = hasLyricGroups(generatedLyricLineGroups, lineCount)
    ? generatedLyricLineGroups
    : fallbackLyricLineGroups;
  const output = [...prefix];

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    output.push(`% Staff system ${lineIndex + 1}: Melody and visible instruments share this measure range.`);
    for (const voiceName of orderedVoiceNames) {
      const bodyLine = regroupedByVoice.get(voiceName)?.[lineIndex];
      if (bodyLine) output.push(`[V:${voiceName}] ${bodyLine}`);
      if (voiceName === "Melody") output.push(...(lyricLineGroups[lineIndex] ?? []));
    }
  }

  return [...output, ...suffix.filter((line) => line.trim())];
}

export function break_measures_line(generatedAbc: string, referenceAbc: string): string {
  const normalizedGeneratedAbc = normalizeAbcVoiceSyntax(generatedAbc);
  const pattern = referenceMeasureLinePattern(referenceAbc);
  if (pattern.length === 0) return normalizedGeneratedAbc;

  const lines = normalizedGeneratedAbc.split(/\r?\n/);
  const fallbackLyricLineGroups = getReferenceLyricLineGroups(referenceAbc);
  const referenceBarlines = getReferenceBarlines(referenceAbc);
  if (lines.some((line) => /^\[V:Melody\]\s*/.test(line.trim()))) {
    return regroupInlineVoiceLines(lines, pattern, fallbackLyricLineGroups, referenceBarlines).join("\n");
  }

  const melodyStart = lines.findIndex((line) => /^V:Melody\b/.test(line.trim()));

  if (melodyStart >= 0) {
    const nextVoiceOffset = lines.slice(melodyStart + 1).findIndex((line) => /^V:/.test(line.trim()));
    const melodyEnd = nextVoiceOffset >= 0 ? melodyStart + 1 + nextVoiceOffset : lines.length;
    return [
      ...lines.slice(0, melodyStart + 1),
      ...rebuildMusicLinesForPattern(lines.slice(melodyStart + 1, melodyEnd), pattern, fallbackLyricLineGroups, referenceBarlines),
      ...lines.slice(melodyEnd),
    ].join("\n");
  }

  return rebuildMusicLinesForPattern(lines, pattern, fallbackLyricLineGroups, referenceBarlines).join("\n");
}

const ABC_OPTION_DATA_KEYS = ["harmonizedAbc", "validatedAbc", "chordAnnotatedAbc", "abc"] as const;

export function normalizeWorkflowOptionDataLineBreaks(
  data: Record<string, unknown>,
  sourceAbc: string
): Record<string, unknown> {
  return ABC_OPTION_DATA_KEYS.reduce((nextData, key) => {
    const value = nextData[key];
    if (typeof value === "string" && value.trim()) {
      nextData[key] = break_measures_line(value, sourceAbc);
    }
    return nextData;
  }, { ...data });
}

export function getAppliedMusicAbcFromSelections(
  previousSelections: AccompanimentWorkflowSelectedContext[],
  fallbackAbc: string
): string {
  const validation = previousSelections.find((s) => s.stepId === "voice-leading-validation");
  const progression = previousSelections.find((s) => s.stepId === "chord-roles-progression");

  const optionString = (selection: AccompanimentWorkflowSelectedContext | undefined, keys: string[]) => {
    if (!selection) return null;
    for (const key of keys) {
      const val = selection.data[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
    return null;
  };

  const appliedAbc = optionString(validation, ["validatedAbc", "harmonizedAbc", "chordAnnotatedAbc", "abc"])
    ?? optionString(progression, ["harmonizedAbc", "chordAnnotatedAbc", "abc"]);

  return appliedAbc ?? fallbackAbc;
}

export function buildAccompanimentWorkflowPrompt(input: {
  stepId: AccompanimentWorkflowStepId;
  sourceAbc: string;
  metadata: AccompanimentWorkflowMetadata;
  previousSelections: AccompanimentWorkflowSelectedContext[];
  setup?: Partial<AccompanimentWorkflowSetup> | null;
  userNote?: string;
}): string {
  const step = getAccompanimentWorkflowStep(input.stepId);
  const userNote = input.userNote?.trim();

  // Resolve the actual source ABC to present to the LLM
  // If we are past the harmony validation step, we should present the chord-annotated ABC
  const isBranchStep = step.scope !== "shared";
  const effectiveSourceAbc = isBranchStep
    ? getAppliedMusicAbcFromSelections(input.previousSelections, input.sourceAbc)
    : input.sourceAbc;

  const lyricChordAnnotations = extractLyricChordAnnotations(effectiveSourceAbc);
  const abcDataInstruction = input.stepId === "chord-roles-progression"
    ? "\nStep data: option.data MUST include harmonizedAbc with chord symbols applied. Inline ABC chord quotes are temporal events: put each one immediately before the note/rest where its harmony begins, and let it persist until the next chord quote. Call break_measures_line first, copy returned abc into harmonizedAbc. Melody line count/measure-per-line must match Source ABC."
    : input.stepId === "voice-leading-validation"
      ? "\nStep data: option.data MUST include validatedAbc or harmonizedAbc after voice-leading fixes. Inline ABC chord quotes are temporal events: put each one immediately before the note/rest where its harmony begins, and let it persist until the next chord quote. Call break_measures_line first, copy returned abc into the field. Melody line breaks must match Source ABC."
      : "";
  const strongBeatInstruction = input.stepId === "key-beats"
    ? "\nStrong Beats: choose emphasis direction. Call add_strong_beat_icons for each emphasis direction before the final tool call. Final option.data MUST include strongBeatEmphasis only. Do not include annotatedAbc, strongBeatDirectives, measureIndex, or beatTime."
    : "";
  const guitarTabInstruction = isGuitarTabValidationWorkflowStep(input.stepId)
    ? "\nGuitar singer-support contract: use the default acoustic steel-string guitar. option.data MUST include guitarTab with compact keys m=measure, t=grid step, d=duration, b=beat, n=note, s=string, f=fret, r=role, sid=sourceEventId. Call query_guitar_voicings before proposing concrete frets, then call valid_guitar_tab on the exact final events. Step 4 provides only a representative profile sample; Step 5 provides bounded voicing/root-fifth/transition anchors, never the full accompaniment texture. Step 6 deterministically schedules it. Strings 4–6 are restrained bass anchors (30–45% of realized PIMA/pinch note attacks); strings 1–3 provide most motion (55–70%). Never plan more than two ordinary bass-only onsets in succession. Walking bass is optional and only immediately before a real chord change. Pinch is one bass plus one treble string on a strong metric step. Rules: (1) one string per simultaneous group per source event, (2) all frets within profile range, (3) one left hand can fret the position."
    : "";
  const guitarFingerstyleInstruction = "";
  const lyricChordInstruction = lyricChordAnnotations.length > 0 && isChordIngestionWorkflowStep(input.stepId)
    ? "\n- The source ABC has chord symbols embedded inside the lyric w: lines. Treat those lyric chord symbols as the user-supplied chord progression. Do not invent a different progression; map roles, progression, and validation around these chords."
    : "";
  const sustainRuleInstruction = isGuitarTabValidationWorkflowStep(input.stepId)
    ? "\n- Vocal-yield rule: this is singer accompaniment, not solo fingerstyle. Structural low-register root/fifth anchors may support active melody, but do not add decorative high-register fills, unison doubles, or an independent treble melody while the vocal is active or sustaining. Use upper chord tones as quiet support between vocal phrases."
    : "";
  const midiInstruction = "\n- Any generated acoustic steel-string Guitar ABC must include `%%MIDI program 25` immediately after the Guitar voice declaration.";
  const staffSystemInstruction = "\n- Multi-voice ABC line grouping requirement: when returning ABC with Melody plus Guitar, preserve the source Melody visual staff systems. Emit/validate each staff-system group as Melody line N, then lyric/helper rows for that Melody line, then the Guitar line N for the same measure range before moving to Melody line N+1.";

  let chordToneReferenceStr = "";
  if (isBranchStep && step.scope === "guitar") {
    try {
      const chordToneRef = buildChordToneReferenceTable(effectiveSourceAbc);
      if (chordToneRef.promptText) {
        chordToneReferenceStr = `\n\n${chordToneRef.promptText}`;
      }
    } catch (e) {
      console.error("Failed to generate chord-tone reference for prompt:", e);
    }
  }

  let timeSliceGridStr = "";
  if (isGuitarTabValidationWorkflowStep(input.stepId)) {
    try {
      const progressionSelection = input.previousSelections.find(s => s.stepId === "chord-roles-progression");
      const compingSelection = input.previousSelections.find(s => s.stepId === "guitar-comping-profile");
      const voicingSelection = input.previousSelections.find(s => s.stepId === "guitar-voicing-bass");

      const comping_style = (compingSelection?.data?.compingProfile as string)
        || compingSelection?.label
        || undefined;
      const voicing_plan = (voicingSelection?.data?.voicingPlan as string)
        || voicingSelection?.label
        || undefined;

      let chords: string[] = [];
      if (progressionSelection && Array.isArray(progressionSelection.data.progression)) {
        chords = progressionSelection.data.progression as string[];
      } else {
        chords = resolveProgression(effectiveSourceAbc).chords.map((c) => c.chordName);
      }
      const measures = convertAbcToTimeSliceGrid(effectiveSourceAbc, chords, {
        comping_style,
        voicing_plan,
      });
      const measureStrings = measures.map(m => {
        const gridLines = m.grid.map(s => "      " + JSON.stringify(s));
        return `  {\n    "measure": ${m.measure},\n    "style_profile": ${JSON.stringify(m.style_profile)},\n    "grid": [\n${gridLines.join(",\n")}\n    ]\n  }`;
      });
      timeSliceGridStr = `\n\n### Time-Slice Melodic Grid (Quantized 16-step grid per measure)\nUse this time-sliced grid to plan your fingerstyle arrangement. All durations, rests, and ties have been mapped to 16 steps per measure (4 steps per beat):\n\`\`\`json\n[\n${measureStrings.join(",\n")}\n]\n\`\`\``;
    } catch (e) {
      console.error("Failed to generate Time-Slice grid for prompt:", e);
    }
  }

  return `DEFAULT PROMPT — MUSIC ACCOMPANIMENT WORKFLOW STEP ${step.index}\n\nTask: ${step.label}\n${step.description}\n\nTheory: ${step.theoryReference}\n\nOutput focus: ${step.outputFocus.join(", ")}\n\nRules:\n- Return 1-2 options. Keep label<60 chars, summary<100 chars, justification<120 chars, max 2 warnings, max 2 validation notes.\n- Preserve melody ABC exactly unless this step adds chord annotations.\n- Respect previous workflow decisions.\n- Prefer devotional/bhajan support.${midiInstruction}${staffSystemInstruction}${abcDataInstruction}${strongBeatInstruction}${guitarTabInstruction}${guitarFingerstyleInstruction}${sustainRuleInstruction}${lyricChordInstruction}\n\nMetadata:\n${formatMetadata(input.metadata)}\n\nSetup:\n${formatWorkflowSetup(input.setup)}\n\nPrevious context:\n${formatPreviousSelections(input.previousSelections)}\n\nLyric chords:\n${formatLyricChordAnnotations(effectiveSourceAbc)}\n\nSource ABC:\n\`\`\`abc\n${effectiveSourceAbc}\n\`\`\`${chordToneReferenceStr}${timeSliceGridStr}\n\nUSER NOTE:\n${userNote || "(none)"}`;
}

export function buildConsolidatedChordIngestionPrompt(input: {
  sourceAbc: string;
  metadata: AccompanimentWorkflowMetadata;
  previousSelections: AccompanimentWorkflowSelectedContext[];
  setup?: Partial<AccompanimentWorkflowSetup> | null;
  userNote?: string;
}): string {
  const userNote = input.userNote?.trim();

  return `DEFAULT PROMPT — CONSOLIDATED CHORD INGESTION\n\nTask: Lyric chords detected (e.g. [Em]Hari Bol). Ingest and produce results for:\n1. Chord Roles & Progression (with harmonizedAbc)\n2. Voice-leading & Harmonized ABC Validation (with validatedAbc)\n\nRules:\n- Use lyric chord annotations as the progression. Do not replace them.\n- Return 1-2 options per result group. Keep fields concise (<100 chars each).\n- Chord roles options: map strong notes to chord functions, select a source-measure-aligned progression summary, and include harmonizedAbc.\n- Validation options: include validatedAbc with voice-leading fixes applied.\n- Inline ABC chord quotes are temporal events: place each immediately before the note/rest where its harmony begins; it remains active until the next inline chord quote.\n- Call break_measures_line before final output. Melody line breaks must match Source ABC.\n- Preserve melody ABC exactly except for chord symbol placement.\n\nMetadata:\n${formatMetadata(input.metadata)}\n\nSetup:\n${formatWorkflowSetup(input.setup)}\n\nPrevious context:\n${formatPreviousSelections(input.previousSelections)}\n\nLyric chords:\n${formatLyricChordAnnotations(input.sourceAbc)}\n\nSource ABC:\n\`\`\`abc\n${input.sourceAbc}\n\`\`\`\n\nUSER NOTE:\n${userNote || "(none)"}`;
}
