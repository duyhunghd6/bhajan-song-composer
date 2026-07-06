"use server";

import fs from "fs/promises";
import path from "path";
import {
  requestOpenAiCompatibleTool,
  requestOpenAiCompatibleToolLoop,
  type ToolDiagnosticEvent,
  type ToolLoopValidationResult,
} from "./ai-config";
import {
  abcMatchesReferenceMeasureLinePattern,
  break_measures_line,
  buildAccompanimentWorkflowPrompt,
  buildAccompanimentWorkflowToolSchema,
  buildAddStrongBeatIconsToolSchema,
  buildBreakMeasuresLineToolSchema,
  buildConsolidatedChordIngestionPrompt,
  buildConsolidatedChordIngestionToolSchema,
  extractLyricChordAnnotations,
  getAbcMeasureLinePattern,
  getAccompanimentWorkflowLlmToolNames,
  isGuitarTabValidationWorkflowStep,
  normalizeWorkflowOptionDataLineBreaks,
  type AccompanimentWorkflowLlmLogEntry,
  type AccompanimentWorkflowLlmLogKind,
  type AccompanimentWorkflowLlmLogStatus,
  type AccompanimentWorkflowMetadata,
  type AccompanimentWorkflowOption,
  type AccompanimentWorkflowRun,
  type AccompanimentWorkflowSelectedContext,
  type AccompanimentWorkflowSetup,
  type AccompanimentWorkflowStepId,
} from "@/lib/theory/accompaniment-workflow";
import {
  addStrongBeatIconsToAbcNotation,
  type StrongBeatEmphasis,
  type StrongBeatIconGenerationResult,
} from "@/lib/theory/abc-beat-annotations";
import {
  buildValidGuitarTabToolSchema,
  validateGuitarTab,
  type GuitarTabEvent,
  type GuitarTabValidationResult,
} from "@/lib/theory/guitar-tab-validation";

interface RawWorkflowStepResult {
  options?: Array<Partial<AccompanimentWorkflowOption>>;
}

interface RawConsolidatedChordIngestionResult {
  chordToneMapping?: RawWorkflowStepResult;
  chordProgression?: RawWorkflowStepResult;
  voiceLeadingValidation?: RawWorkflowStepResult;
}

export interface GenerateAccompanimentWorkflowStepInput {
  stepId: AccompanimentWorkflowStepId;
  sourceAbc: string;
  metadata: AccompanimentWorkflowMetadata;
  previousSelections: AccompanimentWorkflowSelectedContext[];
  setup?: Partial<AccompanimentWorkflowSetup> | null;
  userNote?: string;
}

const MAX_VALIDATION_REPAIR_ATTEMPTS = 3;
const MAX_TOOL_LOOP_ITERATIONS = 8;
const DIAGNOSTICS_DIR = ".accompaniment-diagnostics";

interface WorkflowDiagnosticState {
  logId: string;
  logPath: string;
  logFileName: string;
  exposedTools: string[];
  validationAttempts: number;
  finalValidationValid?: boolean;
  finalValidationMessage?: string;
  llmLogs: AccompanimentWorkflowLlmLogEntry[];
}

function diagnosticDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function createDiagnosticState(stepId: string): WorkflowDiagnosticState {
  const logId = `${stepId}-${Date.now()}`;
  const logFileName = `accompaniment-workflow-${diagnosticDate()}.jsonl`;
  return {
    logId,
    logPath: path.join(DIAGNOSTICS_DIR, logFileName),
    logFileName,
    exposedTools: getAccompanimentWorkflowLlmToolNames(),
    validationAttempts: 0,
    llmLogs: [],
  };
}

function summarizeDiagnosticEvent(event: ToolDiagnosticEvent): ToolDiagnosticEvent {
  if (event.type !== "chat-request") return event;
  return {
    ...event,
    toolChoice: event.toolChoice,
    messageCount: event.messageCount,
  };
}

function diagnosticStatus(event: ToolDiagnosticEvent): AccompanimentWorkflowLlmLogStatus {
  if (event.type === "chat-request") return "started";
  if (event.type === "chat-error" || event.type === "loop-exhausted") return "failed";
  if (event.type === "chat-response" && event.toolCallNames.length === 0) return "warning";
  if (event.type === "final-validation" && !event.valid) return "warning";
  return "success";
}

function diagnosticMessage(event: ToolDiagnosticEvent): string {
  switch (event.type) {
    case "chat-request":
      return `LLM call started with ${event.messageCount} message${event.messageCount === 1 ? "" : "s"} and ${event.toolNames.length} exposed tool${event.toolNames.length === 1 ? "" : "s"}.`;
    case "chat-response":
      return event.toolCallNames.length > 0
        ? `LLM call succeeded and requested ${event.toolCallNames.join(", ")}.`
        : "LLM call succeeded but returned no tool calls.";
    case "chat-error":
      return event.status ? `LLM call failed with HTTP ${event.status}: ${event.message}` : `LLM call failed: ${event.message}`;
    case "tool-call":
      return `${event.local ? "Local validation" : "LLM"} tool call: ${event.toolName}${event.final ? " (final output)" : ""}.`;
    case "tool-result":
      return `Local tool ${event.toolName} returned a result.`;
    case "final-validation":
      return event.valid
        ? `Validated final ${event.toolName} output.`
        : `Final ${event.toolName} output failed validation: ${event.message ?? "no validation message"}`;
    case "loop-exhausted":
      return `LLM validation loop exhausted after ${event.maxIterations} iteration${event.maxIterations === 1 ? "" : "s"}: ${event.lastValidationMessage}`;
  }
}

function diagnosticKind(event: ToolDiagnosticEvent): AccompanimentWorkflowLlmLogKind {
  return event.type;
}

const MAX_PAYLOAD_PREVIEW_DEPTH = 4;
const MAX_PAYLOAD_PREVIEW_ITEMS = 5;
const MAX_PAYLOAD_PREVIEW_STRING_LENGTH = 240;

function compactStringPreview(value: string): string {
  if (value.length <= MAX_PAYLOAD_PREVIEW_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_PAYLOAD_PREVIEW_STRING_LENGTH)}… (${value.length} chars)`;
}

function compactPayloadPreview(value: unknown, depth = 0): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return compactStringPreview(value);
  if (typeof value !== "object") return String(value);
  if (depth >= MAX_PAYLOAD_PREVIEW_DEPTH) return Array.isArray(value) ? `[${value.length} items]` : "[object]";

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_PAYLOAD_PREVIEW_ITEMS).map((item) => compactPayloadPreview(item, depth + 1));
    return value.length > MAX_PAYLOAD_PREVIEW_ITEMS
      ? [...items, `… ${value.length - MAX_PAYLOAD_PREVIEW_ITEMS} more item${value.length - MAX_PAYLOAD_PREVIEW_ITEMS === 1 ? "" : "s"}`]
      : items;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, compactPayloadPreview(entry, depth + 1)])
  );
}

function diagnosticPayloadPreview(event: ToolDiagnosticEvent): unknown {
  switch (event.type) {
    case "tool-call":
      return event.input === undefined ? undefined : compactPayloadPreview(event.input);
    case "tool-result":
      return compactPayloadPreview(event.result);
    case "final-validation":
      return event.toolResult === undefined ? undefined : compactPayloadPreview(event.toolResult);
    default:
      return undefined;
  }
}

function llmLogEntryFromDiagnostic(input: {
  event: ToolDiagnosticEvent;
  state: WorkflowDiagnosticState;
  stepId: AccompanimentWorkflowStepId | "consolidated-chord-ingestion";
  createdAt: string;
}): AccompanimentWorkflowLlmLogEntry {
  const { event, state, stepId, createdAt } = input;
  return {
    id: `${state.logId}-${state.llmLogs.length + 1}`,
    createdAt,
    stepId,
    kind: diagnosticKind(event),
    status: diagnosticStatus(event),
    message: diagnosticMessage(event),
    iteration: "iteration" in event ? event.iteration : undefined,
    toolName: "toolName" in event ? event.toolName : undefined,
    toolCallNames: event.type === "chat-response" ? event.toolCallNames : undefined,
    validationMessage: event.type === "final-validation" ? event.message : event.type === "loop-exhausted" ? event.lastValidationMessage : undefined,
    payloadPreview: diagnosticPayloadPreview(event),
    logPath: state.logPath,
  };
}

function logDiagnosticToConsole(entry: AccompanimentWorkflowLlmLogEntry): void {
  const prefix = `[Accompaniment LLM][${entry.stepId}][${entry.status}]`;
  if (entry.status === "failed") {
    console.warn(prefix, entry.message);
    return;
  }
  if (entry.status === "warning") {
    console.warn(prefix, entry.message);
    return;
  }
  console.info(prefix, entry.message);
}

function makeDiagnosticRecorder(input: {
  state: WorkflowDiagnosticState;
  stepId: AccompanimentWorkflowStepId | "consolidated-chord-ingestion";
  promptSummary: string;
}) {
  return async (event: ToolDiagnosticEvent) => {
    const timestamp = new Date().toISOString();
    if (event.type === "final-validation") {
      input.state.validationAttempts += 1;
      input.state.finalValidationValid = event.valid;
      input.state.finalValidationMessage = event.message;
    }

    const llmLog = llmLogEntryFromDiagnostic({
      event,
      state: input.state,
      stepId: input.stepId,
      createdAt: timestamp,
    });
    input.state.llmLogs.push(llmLog);
    logDiagnosticToConsole(llmLog);

    const absoluteDir = path.join(process.cwd(), DIAGNOSTICS_DIR);
    await fs.mkdir(absoluteDir, { recursive: true });
    await fs.appendFile(
      path.join(absoluteDir, input.state.logFileName),
      `${JSON.stringify({
        timestamp,
        logId: input.state.logId,
        stepId: input.stepId,
        promptSummary: input.promptSummary,
        event: summarizeDiagnosticEvent(event),
      })}\n`,
      "utf-8"
    );
  };
}

function toolNameForStep(stepId: AccompanimentWorkflowStepId): string {
  return `generate_${stepId.replaceAll("-", "_")}`;
}

function normalizeId(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function guitarTabEventsFromOption(option: Partial<AccompanimentWorkflowOption>): GuitarTabEvent[] | null {
  const data = option.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const guitarTab = (data as { guitarTab?: unknown }).guitarTab;
  if (!guitarTab || typeof guitarTab !== "object" || Array.isArray(guitarTab)) return null;
  const events = (guitarTab as { events?: unknown }).events;
  return Array.isArray(events) ? events as GuitarTabEvent[] : null;
}

function hasObjectProperty(value: unknown, key: string): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && key in value);
}

function validateGuitarFingerstyleOption(optionId: string, option: Partial<AccompanimentWorkflowOption>, events: GuitarTabEvent[], messages: string[]): void {
  const data = optionData(option);
  if (!data) {
    messages.push(`${optionId} is missing fingerstyle option data.`);
    return;
  }

  if (data.mode !== "solo-fingerstyle") {
    messages.push(`${optionId} must set data.mode to "solo-fingerstyle".`);
  }
  if (data.carriesMelody !== true) {
    messages.push(`${optionId} must set data.carriesMelody=true because Guitar Fingerstyle plays the melody itself.`);
  }
  if (data.pickingProfile !== "strict-pima" && data.pickingProfile !== "folk-travis") {
    messages.push(`${optionId} must choose data.pickingProfile as strict-pima or folk-travis.`);
  }
  if (typeof data.bassStrategy !== "string" || data.bassStrategy.trim().length === 0) {
    messages.push(`${optionId} must describe a chord-derived data.bassStrategy.`);
  }

  const formPlan = data.formPlan;
  for (const section of ["intro", "interlude", "outro"]) {
    if (!hasObjectProperty(formPlan, section)) {
      messages.push(`${optionId} is missing data.formPlan.${section}.`);
    }
  }

  const roles = new Set(events.map((event) => event.role.toLowerCase()));
  if (!roles.has("melody")) {
    messages.push(`${optionId} guitarTab.events must include melody role events.`);
  }
  if (!roles.has("bass")) {
    messages.push(`${optionId} guitarTab.events must include bass role events.`);
  }
}

function validateGuitarWorkflowResult(raw: unknown, stepId?: AccompanimentWorkflowStepId): ToolLoopValidationResult {
  const result = raw as RawWorkflowStepResult;
  const options = Array.isArray(result.options) ? result.options.slice(0, 5) : [];
  const validations: Array<{ optionId: string; validation: GuitarTabValidationResult }> = [];
  const messages: string[] = [];

  if (options.length === 0) {
    return { valid: false, message: "Final guitar workflow output contained no options." };
  }

  for (const [index, option] of options.entries()) {
    const optionId = normalizeId(option.id, `option-${index + 1}`);
    const events = guitarTabEventsFromOption(option);
    if (!events || events.length === 0) {
      messages.push(`${optionId} is missing data.guitarTab.events.`);
      continue;
    }

    if (stepId === "guitar-fingerstyle") {
      validateGuitarFingerstyleOption(optionId, option, events, messages);
    }

    const validation = validateGuitarTab(events);
    validations.push({ optionId, validation });
    if (!validation.valid) {
      messages.push(`${optionId}: ${validation.issues.map((issue) => issue.message).join("; ")}`);
    }
  }

  return {
    valid: messages.length === 0,
    message: messages.join("\n"),
    toolResult: { valid: messages.length === 0, issues: messages, validations },
  };
}

function isStrongBeatEmphasis(value: unknown): value is StrongBeatEmphasis {
  return value === "all-metric-beats" || value === "primary-strong-beats" || value === "downbeats-only";
}

function makeAddStrongBeatIconsLocalTool(sourceAbc: string, onCalled?: (result: StrongBeatIconGenerationResult) => void) {
  return {
    name: "add_strong_beat_icons",
    execute: (args: unknown) => {
      const emphasis = isStrongBeatEmphasis((args as { emphasis?: unknown }).emphasis)
        ? (args as { emphasis: StrongBeatEmphasis }).emphasis
        : "all-metric-beats";
      const result = addStrongBeatIconsToAbcNotation({ abcNotation: sourceAbc, emphasis });
      onCalled?.(result);
      return result;
    },
  };
}

const STRONG_BEAT_LLM_DISALLOWED_DATA_KEYS = [
  "annotatedAbc",
  "abcNotation",
  "strongBeatDirectives",
  "abc",
  "harmonizedAbc",
  "validatedAbc",
  "chordAnnotatedAbc",
] as const;

function validateStrongBeatWorkflowResult(input: {
  raw: unknown;
  localToolCalled: boolean;
  localResults: StrongBeatIconGenerationResult[];
}): ToolLoopValidationResult {
  const result = input.raw as RawWorkflowStepResult;
  const options = Array.isArray(result.options) ? result.options.slice(0, 5) : [];
  const messages: string[] = [];
  const successfulLocalEmphases = new Set(
    input.localResults
      .filter((result) => result.valid)
      .map((result) => result.emphasis)
  );

  if (options.length === 0) {
    return { valid: false, message: "Final Strong Beats workflow output contained no options." };
  }

  if (!input.localToolCalled) {
    messages.push("Call add_strong_beat_icons before calling generate_strong_beat_targets so beat icons are computed by the local algorithm as beat-only w: lyric rows.");
  }

  for (const [index, option] of options.entries()) {
    const optionId = normalizeId(option.id, `option-${index + 1}`);
    const data = optionData(option);
    const emphasis = data?.strongBeatEmphasis;

    if (!isStrongBeatEmphasis(emphasis)) {
      messages.push(`${optionId} is missing data.strongBeatEmphasis. The Strong Beats final payload should include only the emphasis direction.`);
    } else if (!successfulLocalEmphases.has(emphasis)) {
      messages.push(`${optionId} uses strongBeatEmphasis="${emphasis}" but add_strong_beat_icons was not called successfully for that emphasis.`);
    }

    for (const key of STRONG_BEAT_LLM_DISALLOWED_DATA_KEYS) {
      if (data && key in data) {
        messages.push(`${optionId} must not include data.${key}. Strong Beat ABC notation and directives are generated locally as beat-only w: lyric rows after the final LLM payload.`);
      }
    }
  }

  return {
    valid: messages.length === 0,
    message: messages.join("\n"),
    toolResult: {
      valid: messages.length === 0,
      issues: messages,
      localResults: input.localResults.map((result) => ({
        emphasis: result.emphasis,
        valid: result.valid,
        directiveCount: result.strongBeatDirectives.length,
        issues: result.issues,
      })),
    },
  };
}

const ABC_WORKFLOW_STEP_IDS = new Set<AccompanimentWorkflowStepId>(["chord-progression", "voice-leading-validation"]);
const ABC_OPTION_DATA_KEYS = ["harmonizedAbc", "validatedAbc", "chordAnnotatedAbc", "abc"] as const;

function optionData(option: Partial<AccompanimentWorkflowOption>): Record<string, unknown> | null {
  const data = option.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function validateWorkflowAbcLineBreaks(input: {
  raw: unknown;
  sourceAbc: string;
  requireBreakToolCall: boolean;
  breakToolCalled: boolean;
  requireAbcField: boolean;
}): ToolLoopValidationResult {
  const result = input.raw as RawWorkflowStepResult;
  const options = Array.isArray(result.options) ? result.options.slice(0, 5) : [];
  const messages: string[] = [];
  const fieldPatterns: Array<{ optionId: string; field: string; actualMeasureLinePattern: number[] }> = [];
  const normalizedPattern = getAbcMeasureLinePattern(input.sourceAbc);

  if (options.length === 0) {
    return { valid: false, message: "Final workflow output contained no options." };
  }

  if (input.requireBreakToolCall && !input.breakToolCalled) {
    messages.push("Call break_measures_line with the generated ABCNotation before calling the final generation tool.");
  }

  for (const [index, option] of options.entries()) {
    const optionId = normalizeId(option.id, `option-${index + 1}`);
    const data = optionData(option);
    const abcFields = data
      ? ABC_OPTION_DATA_KEYS.filter((key) => typeof data[key] === "string" && String(data[key]).trim().length > 0)
      : [];

    if (input.requireAbcField && abcFields.length === 0) {
      messages.push(`${optionId} is missing playable ABC data (harmonizedAbc, validatedAbc, chordAnnotatedAbc, or abc).`);
      continue;
    }

    for (const key of abcFields) {
      const abcValue = String(data?.[key] ?? "");
      const actualPattern = getAbcMeasureLinePattern(abcValue);
      fieldPatterns.push({ optionId, field: key, actualMeasureLinePattern: actualPattern });
      if (!abcMatchesReferenceMeasureLinePattern(abcValue, input.sourceAbc)) {
        messages.push(`${optionId}.${key} must match source Melody measure-line pattern ${JSON.stringify(normalizedPattern)}; actual pattern was ${JSON.stringify(actualPattern)}. Call break_measures_line and copy its returned abc exactly.`);
      }
    }
  }

  return {
    valid: messages.length === 0,
    message: messages.join("\n"),
    toolResult: { valid: messages.length === 0, issues: messages, expectedMeasureLinePattern: normalizedPattern, fieldPatterns },
  };
}

function makeBreakMeasuresLineLocalTool(sourceAbc: string, onCalled?: () => void) {
  return {
    name: "break_measures_line",
    execute: (args: unknown) => {
      onCalled?.();
      const generatedAbc = typeof (args as { generatedAbc?: unknown }).generatedAbc === "string"
        ? (args as { generatedAbc: string }).generatedAbc
        : "";
      const abc = break_measures_line(generatedAbc, sourceAbc);
      return {
        abc,
        valid: abcMatchesReferenceMeasureLinePattern(abc, sourceAbc),
        measureLinePattern: getAbcMeasureLinePattern(abc),
        expectedMeasureLinePattern: getAbcMeasureLinePattern(sourceAbc),
      };
    },
  };
}

function normalizeStrongBeatOptionData(data: Record<string, unknown>, sourceAbc: string): Record<string, unknown> {
  const emphasis = isStrongBeatEmphasis(data.strongBeatEmphasis) ? data.strongBeatEmphasis : "all-metric-beats";
  const localResult = addStrongBeatIconsToAbcNotation({ abcNotation: sourceAbc, emphasis });
  const safeData = { ...data };

  for (const key of STRONG_BEAT_LLM_DISALLOWED_DATA_KEYS) {
    delete safeData[key];
  }

  return {
    ...safeData,
    strongBeatEmphasis: emphasis,
    strongBeatDirectives: localResult.strongBeatDirectives,
  };
}

function normalizeOptions(raw: unknown, sourceAbc: string, stepId?: AccompanimentWorkflowStepId): AccompanimentWorkflowOption[] {
  const result = raw as RawWorkflowStepResult;
  const options = Array.isArray(result.options) ? result.options.slice(0, 5) : [];

  if (options.length === 0) {
    throw new Error("LLM returned no workflow options");
  }

  return options.map((option, index) => {
    const data = option.data && typeof option.data === "object" && !Array.isArray(option.data)
      ? normalizeWorkflowOptionDataLineBreaks(option.data, sourceAbc)
      : {};
    const normalizedData = stepId === "strong-beat-targets"
      ? normalizeStrongBeatOptionData(data, sourceAbc)
      : data;

    return {
      id: normalizeId(option.id, `option-${index + 1}`),
      label: typeof option.label === "string" && option.label.trim() ? option.label.trim() : `Option ${index + 1}`,
      summary: typeof option.summary === "string" ? option.summary : "",
      justification: typeof option.justification === "string" ? option.justification : "",
      data: normalizedData,
      warnings: stringArray(option.warnings),
      validationNotes: stringArray(option.validationNotes),
    };
  });
}

function makeRun(input: {
  stepId: AccompanimentWorkflowStepId;
  requestPrompt: string;
  userNote?: string;
  options: AccompanimentWorkflowOption[];
  rawResult?: unknown;
  diagnostics?: WorkflowDiagnosticState;
}): AccompanimentWorkflowRun {
  return {
    id: `${input.stepId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    stepId: input.stepId,
    requestPrompt: input.requestPrompt,
    userNote: input.userNote?.trim() ?? "",
    options: input.options,
    rawResult: input.rawResult,
    diagnostics: input.diagnostics
      ? {
          logId: input.diagnostics.logId,
          logPath: input.diagnostics.logPath,
          exposedTools: input.diagnostics.exposedTools,
          validationAttempts: input.diagnostics.validationAttempts,
          maxValidationAttempts: MAX_VALIDATION_REPAIR_ATTEMPTS,
          finalValidationValid: input.diagnostics.finalValidationValid,
          finalValidationMessage: input.diagnostics.finalValidationMessage,
          llmLogs: input.diagnostics.llmLogs,
        }
      : undefined,
  };
}

export async function generateAccompanimentWorkflowStep(
  input: GenerateAccompanimentWorkflowStepInput
): Promise<AccompanimentWorkflowRun> {
  try {
    const requestPrompt = buildAccompanimentWorkflowPrompt(input);
    const toolSchema = buildAccompanimentWorkflowToolSchema(input.stepId);
    const toolName = toolNameForStep(input.stepId);
    const systemPrompt = "You are an expert music theory arranger for Indian devotional/bhajan music. You make one small human-reviewable accompaniment decision at a time and always justify options with concrete theory and playability constraints.";
    const diagnostics = createDiagnosticState(input.stepId);
    const onDiagnostic = makeDiagnosticRecorder({
      state: diagnostics,
      stepId: input.stepId,
      promptSummary: `${input.stepId}: ${input.metadata.key} ${input.metadata.timeSignature}`,
    });
    let rawResult: unknown;

    if (input.stepId === "strong-beat-targets") {
      let strongBeatToolCalled = false;
      const strongBeatResults: StrongBeatIconGenerationResult[] = [];
      rawResult = await requestOpenAiCompatibleToolLoop({
        systemPrompt: `${systemPrompt} For the Strong Beats step, the model chooses an emphasis direction only. Call add_strong_beat_icons before the final generation tool for each distinct emphasis you will offer so the local algorithm computes and validates concrete beat positions. The final generate_strong_beat_targets payload must include only option.data.strongBeatEmphasis; do not include abcNotation, annotatedAbc, strongBeatDirectives, measureIndex, or beatTime.`,
        userPrompt: requestPrompt,
        tools: [buildAddStrongBeatIconsToolSchema(), toolSchema],
        finalToolName: toolName,
        localTools: [makeAddStrongBeatIconsLocalTool(input.sourceAbc, (result) => {
          strongBeatToolCalled = true;
          strongBeatResults.push(result);
        })],
        validateFinalResult: (args) => validateStrongBeatWorkflowResult({
          raw: args,
          localToolCalled: strongBeatToolCalled,
          localResults: strongBeatResults,
        }),
        temperature: 0.25,
        maxIterations: MAX_TOOL_LOOP_ITERATIONS,
        maxValidationAttempts: MAX_VALIDATION_REPAIR_ATTEMPTS,
        onDiagnostic,
      });
    } else if (isGuitarTabValidationWorkflowStep(input.stepId)) {
      rawResult = await requestOpenAiCompatibleToolLoop({
        systemPrompt: `${systemPrompt} For guitar tab-bearing steps, call valid_guitar_tab with concrete string/fret events before calling the final generation tool. Revise and revalidate until valid_guitar_tab reports valid=true.`,
        userPrompt: requestPrompt,
        tools: [buildValidGuitarTabToolSchema(), toolSchema],
        finalToolName: toolName,
        localTools: [{
          name: "valid_guitar_tab",
          execute: (args) => {
            const events = (args as { events?: unknown }).events;
            return validateGuitarTab(Array.isArray(events) ? events as GuitarTabEvent[] : []);
          },
        }],
        validateFinalResult: (args) => validateGuitarWorkflowResult(args, input.stepId),
        temperature: 0.25,
        maxIterations: MAX_TOOL_LOOP_ITERATIONS,
        maxValidationAttempts: MAX_VALIDATION_REPAIR_ATTEMPTS,
        onDiagnostic,
      });
    } else if (ABC_WORKFLOW_STEP_IDS.has(input.stepId)) {
      let breakToolCalled = false;
      rawResult = await requestOpenAiCompatibleToolLoop({
        systemPrompt: `${systemPrompt} For ABCNotation-bearing steps, call break_measures_line with generated ABC before calling the final generation tool. Copy the returned abc exactly into every playable ABC field in the final tool payload.`,
        userPrompt: requestPrompt,
        tools: [buildBreakMeasuresLineToolSchema(), toolSchema],
        finalToolName: toolName,
        localTools: [makeBreakMeasuresLineLocalTool(input.sourceAbc, () => { breakToolCalled = true; })],
        validateFinalResult: (args) => validateWorkflowAbcLineBreaks({
          raw: args,
          sourceAbc: input.sourceAbc,
          requireBreakToolCall: true,
          breakToolCalled,
          requireAbcField: true,
        }),
        temperature: 0.25,
        maxIterations: MAX_TOOL_LOOP_ITERATIONS,
        maxValidationAttempts: MAX_VALIDATION_REPAIR_ATTEMPTS,
        onDiagnostic,
      });
    } else {
      rawResult = await requestOpenAiCompatibleTool({
        systemPrompt,
        userPrompt: requestPrompt,
        toolSchema,
        toolName,
        temperature: 0.25,
        onDiagnostic,
      });
    }

    let options: AccompanimentWorkflowOption[];
    try {
      options = normalizeOptions(rawResult, input.sourceAbc, input.stepId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown normalization error";
      throw new Error(`Validated ${toolName} output could not be normalized into selectable options: ${message}`);
    }

    return makeRun({
      stepId: input.stepId,
      requestPrompt,
      userNote: input.userNote,
      options,
      rawResult,
      diagnostics,
    });
  } catch (error) {
    console.error("Error during accompaniment workflow generation:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during accompaniment workflow generation.");
  }
}

export async function generateConsolidatedChordIngestionWorkflowSteps(
  input: Omit<GenerateAccompanimentWorkflowStepInput, "stepId">
): Promise<AccompanimentWorkflowRun[]> {
  try {
    const lyricChordAnnotations = extractLyricChordAnnotations(input.sourceAbc);
    if (lyricChordAnnotations.length === 0) {
      throw new Error("No chord annotations were found in ABC lyric lines.");
    }

    const requestPrompt = buildConsolidatedChordIngestionPrompt(input);
    const diagnostics = createDiagnosticState("consolidated-chord-ingestion");
    const onDiagnostic = makeDiagnosticRecorder({
      state: diagnostics,
      stepId: "consolidated-chord-ingestion",
      promptSummary: `consolidated-chord-ingestion: ${input.metadata.key} ${input.metadata.timeSignature}`,
    });
    let breakToolCalled = false;
    const rawResult = await requestOpenAiCompatibleToolLoop({
      systemPrompt: "You are an expert music theory arranger for Indian devotional/bhajan music. You ingest user-provided lyric chord symbols as authoritative harmony and return three human-reviewable workflow decisions from one tool call. Call break_measures_line with generated ABC before calling generate_consolidated_chord_ingestion, then copy the returned abc exactly into playable ABC fields.",
      userPrompt: requestPrompt,
      tools: [buildBreakMeasuresLineToolSchema(), buildConsolidatedChordIngestionToolSchema()],
      finalToolName: "generate_consolidated_chord_ingestion",
      localTools: [makeBreakMeasuresLineLocalTool(input.sourceAbc, () => { breakToolCalled = true; })],
      validateFinalResult: (args) => {
        const result = args as RawConsolidatedChordIngestionResult;
        const progression = validateWorkflowAbcLineBreaks({
          raw: result.chordProgression,
          sourceAbc: input.sourceAbc,
          requireBreakToolCall: true,
          breakToolCalled,
          requireAbcField: true,
        });
        const voiceLeading = validateWorkflowAbcLineBreaks({
          raw: result.voiceLeadingValidation,
          sourceAbc: input.sourceAbc,
          requireBreakToolCall: true,
          breakToolCalled,
          requireAbcField: true,
        });
        const valid = progression.valid && voiceLeading.valid;
        const message = [progression.message, voiceLeading.message].filter(Boolean).join("\n");
        return {
          valid,
          message,
          toolResult: {
            valid,
            issues: [progression.message, voiceLeading.message].filter(Boolean),
            chordProgression: progression.toolResult,
            voiceLeadingValidation: voiceLeading.toolResult,
          },
        };
      },
      temperature: 0.2,
      maxIterations: MAX_TOOL_LOOP_ITERATIONS,
      maxValidationAttempts: MAX_VALIDATION_REPAIR_ATTEMPTS,
      onDiagnostic,
    });
    const result = rawResult as RawConsolidatedChordIngestionResult;

    return [
      makeRun({
        stepId: "chord-tone-mapping",
        requestPrompt,
        userNote: input.userNote,
        options: normalizeOptions(result.chordToneMapping, input.sourceAbc),
        rawResult: result.chordToneMapping,
        diagnostics,
      }),
      makeRun({
        stepId: "chord-progression",
        requestPrompt,
        userNote: input.userNote,
        options: normalizeOptions(result.chordProgression, input.sourceAbc),
        rawResult: result.chordProgression,
        diagnostics,
      }),
      makeRun({
        stepId: "voice-leading-validation",
        requestPrompt,
        userNote: input.userNote,
        options: normalizeOptions(result.voiceLeadingValidation, input.sourceAbc),
        rawResult: result.voiceLeadingValidation,
        diagnostics,
      }),
    ];
  } catch (error) {
    console.error("Error during consolidated chord ingestion workflow generation:", error);
    throw new Error(error instanceof Error ? error.message : "An unknown error occurred during consolidated chord ingestion workflow generation.");
  }
}
