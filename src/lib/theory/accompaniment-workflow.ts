import { splitAbcMeasureSegments } from "./abc-duration";
import { normalizeAbcVoiceSyntax } from "./abc-voice-normalization";
import { resolveProgression } from "./arranger-utils";
import { convertAbcToTimeSliceGrid } from "./fingerstyle-arranger/time-slice";
import {
  ACCOMPANIMENT_CHORD_INGESTION_STEP_IDS,
  ACCOMPANIMENT_GUITAR_TAB_VALIDATION_STEP_IDS,
  ACCOMPANIMENT_INSTRUMENT_LABELS,
  ACCOMPANIMENT_STYLE_LABELS,
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
export {
  buildAccompanimentWorkflowToolSchema,
  buildAddStrongBeatIconsToolSchema,
  buildBreakMeasuresLineToolSchema,
  buildConsolidatedChordIngestionToolSchema,
  buildQueryGuitarVoicingsToolSchema,
  getAccompanimentWorkflowLlmToolNames,
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
  "guitar-acoustic",
  "piano",
  "indian-harmonium",
  "flute",
  "djembe",
  "violin",
];

const LEGACY_ENABLED_INSTRUMENTS = new Set<AccompanimentInstrumentId>(["guitar-classic", "piano"]);
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
  if (id === "piano") return "piano";
  if (id === "indian-harmonium") return "harmonium";
  if (id === "djembe") return "djembe";
  if (id === "flute") return "flute";
  if (id === "violin") return "violin";
  return "guitar";
}

function isAccompanimentStyleId(value: unknown): value is AccompanimentWorkflowSetup["style"] {
  return value === "solo-fingerstyle" || value === "accompaniment";
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

  if (id === "djembe") return `${altitude}; Bass (Dum) supports low transients, Tone/Slap support upper rhythmic color.`;
  if (id === "flute") return `${altitude}; breathe between melody phrases and yield while vocals are active.`;
  if (id === "violin") return `${altitude}; sustain harmonic beds, counterlines, or drone pads while yielding to the melody.`;
  if (id === "indian-harmonium") return `${altitude}; sustain devotional drones, root-fifth anchors, and soft chordal support.`;
  if (id === "piano") return `${altitude}; split LH foundation and RH guide-tone/response duties.`;
  return `${altitude}; arpeggiate/stagger notes and avoid block-chord clutter.`;
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
    currentStepId: enabledStepIds[0] ?? "key-scale-cadence",
    steps: getInitialAccompanimentWorkflowSteps(),
    guitarProfileHint: null,
    pianoProfileHint: null,
    setup,
    enabledStepIds,
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
    ?? (enabledStepIdSet.has(session.currentStepId) ? session.currentStepId : enabledStepIds[0] ?? "key-scale-cadence");

  return {
    ...updatedSession,
    currentStepId,
    guitarProfileHint: enabledStepIds.some((stepId) => ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.guitar.includes(stepId))
      ? updatedSession.guitarProfileHint
      : null,
    pianoProfileHint: enabledStepIds.some((stepId) => ACCOMPANIMENT_WORKFLOW_BRANCH_STEP_IDS.piano.includes(stepId))
      ? updatedSession.pianoProfileHint
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

function formatWorkflowSetup(setupInput?: Partial<AccompanimentWorkflowSetup> | null): string {
  const setup = normalizeAccompanimentWorkflowSetup(setupInput ?? getLegacyAccompanimentWorkflowSetup());
  const enabled = orderedAccompanimentInstruments(setup).filter((instrument) => instrument.enabled);
  const disabled = orderedAccompanimentInstruments(setup).filter((instrument) => !instrument.enabled);
  const lines = [
    `- Style: ${ACCOMPANIMENT_STYLE_LABELS[setup.style]}`,
    `- Enabled instrument order: ${enabled.length ? enabled.map((instrument) => ACCOMPANIMENT_INSTRUMENT_LABELS[instrument.id]).join(" → ") : "none selected"}`,
    "- Role hints:",
    ...enabled.map((instrument, index) => `  ${index + 1}. ${ACCOMPANIMENT_INSTRUMENT_LABELS[instrument.id]} — ${instrument.roleNote ?? defaultInstrumentRoleNote(instrument.id, instrument.order, setup.instruments.length)}`),
    disabled.length ? `- Disabled/skipped instruments: ${disabled.map((instrument) => ACCOMPANIMENT_INSTRUMENT_LABELS[instrument.id]).join(", ")}` : "- Disabled/skipped instruments: none",
  ];
  if (setup.style === "solo-fingerstyle") {
    const enabledLabels = enabled.map((instrument) => ACCOMPANIMENT_INSTRUMENT_LABELS[instrument.id]);
    lines.push(`- Solo/Fingerstyle rule: generate only the enabled instrument branches${enabledLabels.length ? ` (${enabledLabels.join(", ")})` : ""}; do not propose or wait for disabled instrument branches. Guitar branches must carry the melody as fingerstyle when a guitar is enabled.`);
  } else {
    lines.push("- Combined accompaniment rule: respect the ordered stack; lower instruments carry foundation/bass duties, upper instruments carry treble fills or transient color while yielding to melody.");
  }
  return lines.join("\n");
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

function regroupMeasures(measures: string[], pattern: number[], fallbackLineCount: number): string[] {
  const effectivePattern = pattern.length > 0 ? pattern : [Math.max(measures.length, 1)];
  const output: string[] = [];
  let cursor = 0;

  for (const count of effectivePattern) {
    const group = measures.slice(cursor, cursor + count);
    if (group.length === 0) break;
    output.push(`| ${group.join(" | ")} |`);
    cursor += count;
  }

  if (cursor < measures.length) {
    const remainingLineCount = Math.max(fallbackLineCount - output.length, 1);
    const remaining = measures.slice(cursor);
    const chunkSize = Math.max(1, Math.ceil(remaining.length / remainingLineCount));
    for (let index = 0; index < remaining.length; index += chunkSize) {
      output.push(`| ${remaining.slice(index, index + chunkSize).join(" | ")} |`);
    }
  }

  return output;
}

function rebuildMusicLinesForPattern(
  lines: string[],
  pattern: number[],
  fallbackLyricLineGroups: string[][] = []
): string[] {
  const musicLineIndices = lines.flatMap((line, index) => isMusicBodyLine(line) ? [index] : []);
  if (musicLineIndices.length === 0) return lines;

  const measures = musicLineIndices.flatMap((index) => splitAbcMeasureSegments(stripInlineVoicePrefix(lines[index])));
  if (measures.length === 0) return lines;

  const regroupedMusicLines = regroupMeasures(measures, pattern, musicLineIndices.length);
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

function regroupInlineVoiceLines(lines: string[], pattern: number[], fallbackLyricLineGroups: string[][] = []): string[] {
  const { prefix, voiceLines, suffix } = splitInlineVoiceBody(lines);
  const melodyLines = voiceLines.get("Melody");
  if (!melodyLines || melodyLines.length === 0) return lines;

  const regroupedByVoice = new Map<string, string[]>();
  for (const [voiceName, bodyLines] of voiceLines) {
    regroupedByVoice.set(voiceName, rebuildMusicLinesForPattern(bodyLines, pattern));
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
  if (lines.some((line) => /^\[V:Melody\]\s*/.test(line.trim()))) {
    return regroupInlineVoiceLines(lines, pattern, fallbackLyricLineGroups).join("\n");
  }

  const melodyStart = lines.findIndex((line) => /^V:Melody\b/.test(line.trim()));

  if (melodyStart >= 0) {
    const nextVoiceOffset = lines.slice(melodyStart + 1).findIndex((line) => /^V:/.test(line.trim()));
    const melodyEnd = nextVoiceOffset >= 0 ? melodyStart + 1 + nextVoiceOffset : lines.length;
    return [
      ...lines.slice(0, melodyStart + 1),
      ...rebuildMusicLinesForPattern(lines.slice(melodyStart + 1, melodyEnd), pattern, fallbackLyricLineGroups),
      ...lines.slice(melodyEnd),
    ].join("\n");
  }

  return rebuildMusicLinesForPattern(lines, pattern, fallbackLyricLineGroups).join("\n");
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
  const progression = previousSelections.find((s) => s.stepId === "chord-progression");

  const optionString = (selection: AccompanimentWorkflowSelectedContext | undefined, keys: string[]) => {
    if (!selection) return null;
    for (const key of keys) {
      const val = selection.data[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
    return null;
  };

  const appliedAbc = optionString(validation, ["harmonizedAbc", "chordAnnotatedAbc", "abc", "validatedAbc"])
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
  const abcDataInstruction = input.stepId === "chord-progression"
    ? "\nStep-specific data requirement: each option.data MUST include harmonizedAbc containing the full source ABC with the proposed chord symbols applied, so the user can immediately hear this progression in Music Staff Playback. Before calling the final generate_chord_progression tool, call the break_measures_line tool with the generated ABCNotation, then copy the returned abc exactly into option.data.harmonizedAbc. The output ABC Melody music body must have the same number of music lines and the same number of measures per line as the Source ABC. If Source ABC has 5 music lines of 4 measures each, harmonizedAbc must do the same."
    : input.stepId === "voice-leading-validation"
      ? "\nStep-specific data requirement: each option.data MUST include validatedAbc or harmonizedAbc containing the full final chord-annotated ABC after voice-leading validation, so the user can immediately hear it in Music Staff Playback. Before calling the final generate_voice_leading_validation tool, call the break_measures_line tool with the generated ABCNotation, then copy the returned abc exactly into option.data.validatedAbc or option.data.harmonizedAbc. The output ABC Melody music body must have the same number of music lines and the same number of measures per line as the Source ABC. Include a validation note confirming measure line breaks match the Source ABC."
      : "";
  const strongBeatInstruction = input.stepId === "strong-beat-targets"
    ? "\nStrong Beats local algorithm requirement: choose only the review direction/emphasis. Before calling the final generate_strong_beat_targets tool, call add_strong_beat_icons for each distinct emphasis direction you plan to offer so the local algorithm validates the concrete beat positions. Final option.data MUST include only strongBeatEmphasis. Do not include annotatedAbc, abcNotation, strongBeatDirectives, measureIndex, or beatTime in the final payload. Strong beat notation is generated locally as beat-only w: lyric rows, never as inline note annotations, and later inserted after the Melody line inside each staff-system/sentence group."
    : "";
  const guitarTabInstruction = isGuitarTabValidationWorkflowStep(input.stepId)
    ? `\nOne physical guitar validation requirement: each option must prove it is playable on one physical guitar. Each option.data MUST include guitarTab.profileId, guitarTab.voicingProfileId, and guitarTab.events with measureIndex, beat, note, string, fret, role, and sourceEventId when mapping a source melody/chord event. Use octave/register-bearing note labels such as E2, B3, and F#4. BEFORE trying to fret any notes manually, call query_guitar_voicings(chord, melody_pitch). You are strictly forbidden from inventing fretted notes. You must exclusively use the strings and frets provided by the tool's returned grip. Then, call valid_guitar_tab with the same profileId, voicingProfileId, and events. If valid_guitar_tab reports any issue, revise the tab and call valid_guitar_tab again. Hard physical rules to prove in validation notes: (1) Standard PIMA Rule: The Thumb (p) plays exactly 1 Bass String (usually strings 6, 5, or 4). The fingers (i, m, a) play a tight cluster of up to 3 Treble/Inner Strings to support the melody (unless playing a full strum, in which case assign 'p' to multiple bass/inner strings); (2) simultaneous notes may form a chord across multiple strings, but one physical string may appear only once and one source note/event may be assigned to only one string; (3) every string/fret/note is inside the selected guitar fretboard range; (4) one left hand can fret the simultaneous target positions for the selected profile/voicing. ${input.stepId === "guitar-comping-profile" ? "For Guitar Profile, guitarTab.events may be a representative one-measure pattern sample that proves the chosen comping/picking profile is playable on one guitar." : "For this step, guitarTab.events should represent the concrete voicing, fill, polish, or fingerstyle events being selected."}`
    : "";
  const guitarFingerstyleInstruction = input.stepId === "guitar-fingerstyle"
    ? "\nGuitar Fingerstyle step-specific requirement: finalize a solo guitar fingerstyle plan, not a rhythm-only accompaniment. Each option.data MUST include mode=\"solo-fingerstyle\", carriesMelody=true, pickingProfile (strict-pima or folk-travis), bassStrategy derived from the selected chord progression roots/fifths/approaches, formPlan.intro, formPlan.interlude, and formPlan.outro. The final playable result is one merged physical Guitar matrix covering every source/body measure: treble melody events on strings 1-3 plus bass-string chord anchors on strings 4-6, with beat-1 roots and internal root/fifth/approach bass aligned to the selected chord progression in every body measure. Include tab roles for both melody and bass in the merged final tab events, not only separate analytical Treb/Bass threads. Do not hand-write final ABC in this step; the local arranger will render ABC and GUITAR TAB from the selected profile/form plan."
    : "";
  const lyricChordInstruction = lyricChordAnnotations.length > 0 && isChordIngestionWorkflowStep(input.stepId)
    ? "\n- The source ABC has chord symbols embedded inside the lyric w: lines. Treat those lyric chord symbols as the user-supplied chord progression. Do not invent a different progression; map roles, progression, and validation around these chords."
    : "";
  const sustainRuleInstruction = isGuitarTabValidationWorkflowStep(input.stepId)
    ? "\n- The Sustain Rule: If a step has \"state\": \"sustain\" in the Time-Slice grid, the vocal melody is currently ringing out on a specific string. When you add fingerpicking/comping filler notes on empty steps, you are strictly forbidden from placing a note on the exact same string that holds the sustaining melody (treble string 1, 2, or 3)."
    : "";
  const midiInstruction = "\n- Any generated Guitar Classic/Classical Guitar ABC must include `%%MIDI program 24` immediately after the Guitar voice declaration.\n- Only an exact `Guitar Left Hand` target may be retargeted to Harmonium/Reed Organ, and it must use `%%MIDI program 20`; do not change `Guitar LH Accompaniment`, `Guitar Right Hand`, or generic Guitar layers.";
  const staffSystemInstruction = "\n- Multi-voice ABC line grouping requirement: when returning ABC with Melody plus Guitar/Piano/etc., preserve the source Melody visual staff systems/sentences. Emit/validate each staff-system group as Melody line N, then lyric/helper rows for that Melody line, then every instrument's line N for the same measure range before moving to Melody line N+1. Do not write all Melody lines first and all accompaniment lines later when the final ABC contains multiple instruments.";

  let timeSliceGridStr = "";
  if (isGuitarTabValidationWorkflowStep(input.stepId)) {
    try {
      const progressionSelection = input.previousSelections.find(s => s.stepId === "chord-progression");
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

  return `DEFAULT PROMPT — MUSIC ACCOMPANIMENT WORKFLOW STEP ${step.index}\n\nTask: ${step.label}\n${step.description}\n\nTheory reference to follow:\n${step.theoryReference}\n\nOutput focus:\n${step.outputFocus.map((item) => `- ${item}`).join("\n")}\n\nGlobal hard rules:\n- Return between 1 and 5 distinct options. Always try to provide at least 2 or 3 stylistically contrasting options (e.g. Option 1: sparse/minimal, Option 2: full strums/denser) to give the user creative choice.\n- Every option must include a concise label, summary, justification, warnings, and validation notes.\n- Preserve the source melody ABC exactly unless this step explicitly asks for chord annotations.\n- Respect previously selected workflow decisions.\n- If a choice is musically risky, include a warning instead of hiding the risk.\n- Prefer devotional/bhajan-appropriate support unless the user's note asks otherwise.${midiInstruction}${staffSystemInstruction}${abcDataInstruction}${strongBeatInstruction}${guitarTabInstruction}${guitarFingerstyleInstruction}${sustainRuleInstruction}${lyricChordInstruction}\n\nMetadata:\n${formatMetadata(input.metadata)}\n\nWorkflow setup:\n${formatWorkflowSetup(input.setup)}\n\nPreviously selected workflow context:\n${formatPreviousSelections(input.previousSelections)}\n\nLyric chord annotations:\n${formatLyricChordAnnotations(effectiveSourceAbc)}\n\nSource ABC:\n\`\`\`abc\n${effectiveSourceAbc}\n\`\`\`${timeSliceGridStr}\n\nUSER NOTE TO ADD TO PROMPT:\n${userNote || "(none)"}`;
}

export function buildConsolidatedChordIngestionPrompt(input: {
  sourceAbc: string;
  metadata: AccompanimentWorkflowMetadata;
  previousSelections: AccompanimentWorkflowSelectedContext[];
  setup?: Partial<AccompanimentWorkflowSetup> | null;
  userNote?: string;
}): string {
  const userNote = input.userNote?.trim();

  return `DEFAULT PROMPT — MUSIC ACCOMPANIMENT WORKFLOW CONSOLIDATED CHORD INGESTION\n\nTask: The lyrics contain chord symbols like [Em]Hari Bol, Hari [D]Bol. In one LLM decision, ingest the lyric chord progression and produce reviewable results for these three workflow steps:\n1. Chord-tone Role Mapping\n2. Chord Progression Selection\n3. Voice-leading & Harmonized ABC Validation\n\nHard rules:\n- Use the lyric chord annotations below as the supplied chord progression. Do not invent a replacement progression.\n- Return between 1 and 5 options for each of the three result groups.\n- Chord-tone options explain how strong melody notes function over the supplied chords.\n- Progression options preserve the supplied chord order and provide roman numerals/function labels.\n- Validation options must include option.data.validatedAbc or option.data.harmonizedAbc containing the full source ABC with playable chord symbols applied outside the w: lyric lines, so Music Staff Playback can render the harmony.\n- Before calling generate_consolidated_chord_ingestion, call the break_measures_line tool for every harmonizedAbc or validatedAbc candidate, then copy each returned abc exactly into the final tool payload.\n- The output ABC Melody music body must have the same number of music lines and the same number of measures per line as the Source ABC. If Source ABC has 5 music lines of 4 measures each, returned ABC must do the same.\n- For any multi-voice returned ABC, group by visual staff system: [V:Melody] source line N, then every instrument line N for the same measure range, then move to Melody line N+1.\n- Preserve the source melody ABC exactly except for adding/moving chord annotations into playable ABC chord positions.\n- Include warnings for any lyric chord that conflicts with strong melody tones, raga/scale expectations, cadence support, or measure-line preservation.\n\nMetadata:\n${formatMetadata(input.metadata)}\n\nWorkflow setup:\n${formatWorkflowSetup(input.setup)}\n\nPreviously selected workflow context:\n${formatPreviousSelections(input.previousSelections)}\n\nLyric chord annotations to ingest:\n${formatLyricChordAnnotations(input.sourceAbc)}\n\nSource ABC:\n\`\`\`abc\n${input.sourceAbc}\n\`\`\`\n\nUSER NOTE TO ADD TO PROMPT:\n${userNote || "(none)"}`;
}
