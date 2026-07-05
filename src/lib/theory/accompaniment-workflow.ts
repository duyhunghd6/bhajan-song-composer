import { splitAbcMeasureSegments } from "./abc-duration";
import {
  ACCOMPANIMENT_CHORD_INGESTION_STEP_IDS,
  ACCOMPANIMENT_GUITAR_TAB_VALIDATION_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_STEPS,
  ACCOMPANIMENT_WORKFLOW_STEP_IDS,
  ACCOMPANIMENT_WORKFLOW_VERSION,
  type AccompanimentLyricChordAnnotation,
  type AccompanimentWorkflowMetadata,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowSelectedContext,
  type AccompanimentWorkflowSession,
  type AccompanimentWorkflowStepDefinition,
  type AccompanimentWorkflowStepId,
  type AccompanimentWorkflowStepState,
} from "./accompaniment-workflow/definition";
export * from "./accompaniment-workflow/definition";
export {
  buildAccompanimentWorkflowToolSchema,
  buildBreakMeasuresLineToolSchema,
  buildConsolidatedChordIngestionToolSchema,
  getAccompanimentWorkflowLlmToolNames,
} from "./accompaniment-workflow/tool-schema";


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

function isMusicBodyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("%")) return false;
  if (/^[A-Za-z]:/.test(trimmed)) return false;
  return true;
}

function measureLinePatternFromLines(lines: string[]): number[] {
  return lines
    .filter(isMusicBodyLine)
    .map((line) => splitAbcMeasureSegments(line).length)
    .filter((count) => count > 0);
}

export function getAbcMeasureLinePattern(abcString: string): number[] {
  const lines = abcString.split(/\r?\n/);
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

function rebuildMusicLinesForPattern(lines: string[], pattern: number[]): string[] {
  const musicLineIndices = lines.flatMap((line, index) => isMusicBodyLine(line) ? [index] : []);
  if (musicLineIndices.length === 0) return lines;

  const measures = musicLineIndices.flatMap((index) => splitAbcMeasureSegments(lines[index]));
  if (measures.length === 0) return lines;

  const regroupedMusicLines = regroupMeasures(measures, pattern, musicLineIndices.length);
  const lyricLines = lines.filter((line) => line.trim().startsWith("w:"));
  const output: string[] = [];
  let inserted = false;
  let lyricIndex = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (isMusicBodyLine(line)) {
      if (!inserted) {
        for (const musicLine of regroupedMusicLines) {
          output.push(musicLine);
          if (lyricIndex < lyricLines.length) {
            output.push(lyricLines[lyricIndex]);
            lyricIndex += 1;
          }
        }
        inserted = true;
      }
      continue;
    }

    if (line.trim().startsWith("w:")) continue;
    output.push(line);
  }

  while (lyricIndex < lyricLines.length) {
    output.push(lyricLines[lyricIndex]);
    lyricIndex += 1;
  }

  return output;
}

export function break_measures_line(generatedAbc: string, referenceAbc: string): string {
  const pattern = referenceMeasureLinePattern(referenceAbc);
  if (pattern.length === 0) return generatedAbc;

  const lines = generatedAbc.split(/\r?\n/);
  const melodyStart = lines.findIndex((line) => /^V:Melody\b/.test(line.trim()));

  if (melodyStart >= 0) {
    const nextVoiceOffset = lines.slice(melodyStart + 1).findIndex((line) => /^V:/.test(line.trim()));
    const melodyEnd = nextVoiceOffset >= 0 ? melodyStart + 1 + nextVoiceOffset : lines.length;
    return [
      ...lines.slice(0, melodyStart + 1),
      ...rebuildMusicLinesForPattern(lines.slice(melodyStart + 1, melodyEnd), pattern),
      ...lines.slice(melodyEnd),
    ].join("\n");
  }

  return rebuildMusicLinesForPattern(lines, pattern).join("\n");
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
    ? "\nStep-specific data requirement: each option.data MUST include harmonizedAbc containing the full source ABC with the proposed chord symbols applied, so the user can immediately hear this progression in Music Staff Playback. Before calling the final generate_chord_progression tool, call the break_measures_line tool with the generated ABCNotation, then copy the returned abc exactly into option.data.harmonizedAbc. The output ABC Melody music body must have the same number of music lines and the same number of measures per line as the Source ABC. If Source ABC has 5 music lines of 4 measures each, harmonizedAbc must do the same."
    : input.stepId === "voice-leading-validation"
      ? "\nStep-specific data requirement: each option.data MUST include validatedAbc or harmonizedAbc containing the full final chord-annotated ABC after voice-leading validation, so the user can immediately hear it in Music Staff Playback. Before calling the final generate_voice_leading_validation tool, call the break_measures_line tool with the generated ABCNotation, then copy the returned abc exactly into option.data.validatedAbc or option.data.harmonizedAbc. The output ABC Melody music body must have the same number of music lines and the same number of measures per line as the Source ABC. Include a validation note confirming measure line breaks match the Source ABC."
      : "";
  const guitarTabInstruction = isGuitarTabValidationWorkflowStep(input.stepId)
    ? "\nGuitar tab validation requirement: each option.data MUST include guitarTab.events with measureIndex, beat, note, string, fret, and role. Before finalizing an option, call the valid_guitar_tab tool with those exact events. If valid_guitar_tab reports any issue, revise the tab and call valid_guitar_tab again. Hard physical rule: in any simultaneous group, a string number may appear only once; one guitar string cannot play E3 and G3 (or any two pitches) at the same time."
    : "";
  const lyricChordInstruction = lyricChordAnnotations.length > 0 && isChordIngestionWorkflowStep(input.stepId)
    ? "\n- The source ABC has chord symbols embedded inside the lyric w: lines. Treat those lyric chord symbols as the user-supplied chord progression. Do not invent a different progression; map roles, progression, and validation around these chords."
    : "";
  const midiInstruction = "\n- Any generated Guitar Classic/Classical Guitar ABC must include `%%MIDI program 24` immediately after the Guitar voice declaration.\n- Only an exact `Guitar Left Hand` target may be retargeted to Harmonium/Reed Organ, and it must use `%%MIDI program 20`; do not change `Guitar LH Accompaniment`, `Guitar Right Hand`, or generic Guitar layers.";

  return `DEFAULT PROMPT — MUSIC ACCOMPANIMENT WORKFLOW STEP ${step.index}\n\nTask: ${step.label}\n${step.description}\n\nTheory reference to follow:\n${step.theoryReference}\n\nOutput focus:\n${step.outputFocus.map((item) => `- ${item}`).join("\n")}\n\nGlobal hard rules:\n- Return between 1 and 5 distinct options.\n- Every option must include a concise label, summary, justification, warnings, and validation notes.\n- Preserve the source melody ABC exactly unless this step explicitly asks for chord annotations.\n- Respect previously selected workflow decisions.\n- If a choice is musically risky, include a warning instead of hiding the risk.\n- Prefer devotional/bhajan-appropriate support unless the user's note asks otherwise.${midiInstruction}${abcDataInstruction}${guitarTabInstruction}${lyricChordInstruction}\n\nMetadata:\n${formatMetadata(input.metadata)}\n\nPreviously selected workflow context:\n${formatPreviousSelections(input.previousSelections)}\n\nLyric chord annotations:\n${formatLyricChordAnnotations(input.sourceAbc)}\n\nSource ABC:\n\`\`\`abc\n${input.sourceAbc}\n\`\`\`\n\nUSER NOTE TO ADD TO PROMPT:\n${userNote || "(none)"}`;
}

export function buildConsolidatedChordIngestionPrompt(input: {
  sourceAbc: string;
  metadata: AccompanimentWorkflowMetadata;
  previousSelections: AccompanimentWorkflowSelectedContext[];
  userNote?: string;
}): string {
  const userNote = input.userNote?.trim();

  return `DEFAULT PROMPT — MUSIC ACCOMPANIMENT WORKFLOW CONSOLIDATED CHORD INGESTION\n\nTask: The lyrics contain chord symbols like [Em]Hari Bol, Hari [D]Bol. In one LLM decision, ingest the lyric chord progression and produce reviewable results for these three workflow steps:\n1. Chord-tone Role Mapping\n2. Chord Progression Selection\n3. Voice-leading & Harmonized ABC Validation\n\nHard rules:\n- Use the lyric chord annotations below as the supplied chord progression. Do not invent a replacement progression.\n- Return between 1 and 5 options for each of the three result groups.\n- Chord-tone options explain how strong melody notes function over the supplied chords.\n- Progression options preserve the supplied chord order and provide roman numerals/function labels.\n- Validation options must include option.data.validatedAbc or option.data.harmonizedAbc containing the full source ABC with playable chord symbols applied outside the w: lyric lines, so Music Staff Playback can render the harmony.\n- Before calling generate_consolidated_chord_ingestion, call the break_measures_line tool for every harmonizedAbc or validatedAbc candidate, then copy each returned abc exactly into the final tool payload.\n- The output ABC Melody music body must have the same number of music lines and the same number of measures per line as the Source ABC. If Source ABC has 5 music lines of 4 measures each, returned ABC must do the same.\n- Preserve the source melody ABC exactly except for adding/moving chord annotations into playable ABC chord positions.\n- Include warnings for any lyric chord that conflicts with strong melody tones, raga/scale expectations, cadence support, or measure-line preservation.\n\nMetadata:\n${formatMetadata(input.metadata)}\n\nPreviously selected workflow context:\n${formatPreviousSelections(input.previousSelections)}\n\nLyric chord annotations to ingest:\n${formatLyricChordAnnotations(input.sourceAbc)}\n\nSource ABC:\n\`\`\`abc\n${input.sourceAbc}\n\`\`\`\n\nUSER NOTE TO ADD TO PROMPT:\n${userNote || "(none)"}`;
}
