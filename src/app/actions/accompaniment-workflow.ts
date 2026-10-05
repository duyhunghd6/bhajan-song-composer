"use server";

import { generateHarmonyWorkflowStep, isAlgorithmicHarmonyStep } from "@/lib/theory/harmony/workflow";
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
  buildBreakMeasuresLineToolSchema,
  buildQueryGuitarVoicingsToolSchema,
  convertGuitarClassicEventsToAbc,
  GUITAR_CLASSIC_COMPING_PROFILES,
  isGuitarClassicCompingProfileId,
  realizeGuitarClassicAccompaniment,
  getAbcMeasureLinePattern,
  getAccompanimentWorkflowLlmToolNames,
  isGuitarTabValidationWorkflowStep,
  normalizeAccompanimentWorkflowSetup,
  normalizeGuitarTabEvents,
  normalizeWorkflowOptionDataLineBreaks,
  orderedAccompanimentInstruments,
  validateGuitarVoiceChordTones,
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
import { query_guitar_voicings } from "@/lib/theory/guitar-voicings";
import { validateHarmonyTimelineAbc } from "@/lib/theory/accompaniment-workflow/harmony-validation";
import {
  assignActiveChordsToMelodyNotes,
} from "@/lib/theory/fingerstyle-arranger/melody-chord-timeline";
import {
  buildValidGuitarTabToolSchema,
  validateGuitarTab,
  type GuitarTabEvent,
  type GuitarTabValidationOptions,
  type GuitarTabValidationResult,
} from "@/lib/theory/guitar-tab-validation";

interface RawWorkflowStepResult {
  options?: Array<Partial<AccompanimentWorkflowOption>>;
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
      return `LLM call started with ${event.messageCount} message${event.messageCount === 1 ? "" : "s"} and ${event.toolNames.length} exposed tool${event.toolNames.length === 1 ? "" : "s"}. Timeout: ${((event.requestTimeoutMs ?? 180000) / 1000).toFixed(0)}s, max attempts: ${event.maxRequestAttempts ?? 2}.`;
    case "chat-response":
      return event.toolCallNames.length > 0
        ? `LLM call succeeded in ${event.elapsedMs !== undefined ? `${(event.elapsedMs / 1000).toFixed(1)}s` : "?"}${event.requestAttempts !== undefined && event.requestAttempts > 1 ? ` (${event.requestAttempts} attempts)` : ""} and requested ${event.toolCallNames.join(", ")}.`
        : `LLM call succeeded in ${event.elapsedMs !== undefined ? `${(event.elapsedMs / 1000).toFixed(1)}s` : "?"} but returned no tool calls.`;
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
    case "context-budget-exceeded":
      return `LLM context budget exceeded: ${event.message}`;
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
    elapsedMs: "elapsedMs" in event ? event.elapsedMs : undefined,
    requestAttempts: "requestAttempts" in event ? event.requestAttempts : undefined,
  };
}

function logDiagnosticToConsole(entry: AccompanimentWorkflowLlmLogEntry): void {
  const elapsed = entry.elapsedMs !== undefined ? ` (${(entry.elapsedMs / 1000).toFixed(1)}s)` : "";
  const attempts = entry.requestAttempts !== undefined && entry.requestAttempts > 1 ? ` [${entry.requestAttempts} attempts]` : "";
  const prefix = `[Accompaniment LLM][${entry.stepId}][${entry.status}]`;
  if (entry.status === "failed") {
    console.warn(prefix, entry.message + elapsed + attempts);
    return;
  }
  if (entry.status === "warning") {
    console.warn(prefix, entry.message + elapsed + attempts);
    return;
  }
  console.info(prefix, entry.message + elapsed + attempts);
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
  return Array.isArray(events) ? normalizeGuitarTabEvents(events) as unknown as GuitarTabEvent[] : null;
}

function guitarClassicCompingProfileFromSelection(selection: AccompanimentWorkflowSelectedContext | undefined) {
  const data = selection?.data;
  const guitarTab = data?.guitarTab;
  const guitarTabData = guitarTab && typeof guitarTab === "object" && !Array.isArray(guitarTab)
    ? guitarTab as Record<string, unknown>
    : null;
  const profileId = guitarTabData?.compingProfileId ?? data?.compingProfileId;
  return isGuitarClassicCompingProfileId(profileId) ? profileId : null;
}

function buildGuitarClassicAbcNotationRun(
  input: GenerateAccompanimentWorkflowStepInput
): AccompanimentWorkflowRun {
  const voicingSelection = input.previousSelections.find((selection) => selection.stepId === "guitar-voicing-bass");
  const profileSelection = input.previousSelections.find((selection) => selection.stepId === "guitar-comping-profile");
  const anchorEvents = voicingSelection
    ? guitarTabEventsFromOption({ data: voicingSelection.data })
    : null;
  if (!anchorEvents?.length) {
    throw new Error("Select a Guitar Voicing option with concrete guitarTab.events before building Guitar ABCNotation.");
  }

  const compingProfileId = guitarClassicCompingProfileFromSelection(profileSelection)
    ?? guitarClassicCompingProfileFromSelection(voicingSelection);
  if (!compingProfileId) {
    throw new Error("Select a Guitar Profile with a supported arpeggio, pinch, or bhajan strum technique before building Guitar ABCNotation.");
  }

  const realization = realizeGuitarClassicAccompaniment({
    sourceAbc: input.sourceAbc,
    compingProfileId,
    anchorEvents,
  });
  if (realization.errors.length > 0) {
    throw new Error(realization.errors.join(" "));
  }

  const conversion = convertGuitarClassicEventsToAbc(input.sourceAbc, realization.events);
  if (!conversion.abc) {
    throw new Error(conversion.errors.join(" ") || "The realized Guitar accompaniment cannot be converted to ABCNotation.");
  }

  return makeRun({
    stepId: "guitar-classic-abc-notation",
    requestPrompt: "Deterministically realize the selected Guitar Profile and Guitar Voicing anchors as a measure-aligned standard-notation support voice.",
    userNote: input.userNote,
    options: [{
      id: "guitar-classic-support-abc",
      label: "Guitar Support Music Sheet",
      summary: `${GUITAR_CLASSIC_COMPING_PROFILES[compingProfileId].label} realized ${conversion.renderedEventCount} chord-support events from ${realization.sourceAnchorCount} selected anchors across ${conversion.measureCount} source measures.`,
      justification: "The selected Guitar Profile supplies the rhythmic technique while the selected Guitar Voicing anchors determine the fretboard context; Step 6 deterministically materializes the complete chord texture.",
      data: {
        guitarClassicAbc: conversion.abc,
        compingProfileId,
        sourceAnchorCount: realization.sourceAnchorCount,
        realizedAttackCount: realization.realizedAttackCount,
        renderedEventCount: conversion.renderedEventCount,
        measureCount: conversion.measureCount,
        sourceStepId: "guitar-voicing-bass",
      },
      warnings: [],
      validationNotes: ["Standard notation support voice created for the default acoustic steel-string Guitar; Guitar TAB remains exclusive to the dedicated Fingerstyle route."],
    }],
    rawResult: { deterministic: true, realization, conversion },
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isGuitarValidationProfileId(value: unknown): value is "guitar-classic" | "guitar-acoustic" | "standard-six-string" {
  return value === "guitar-classic" || value === "guitar-acoustic" || value === "standard-six-string";
}

function guitarTabObjectFromData(data: Record<string, unknown> | null): Record<string, unknown> | null {
  const guitarTab = data?.guitarTab;
  return guitarTab && typeof guitarTab === "object" && !Array.isArray(guitarTab)
    ? guitarTab as Record<string, unknown>
    : null;
}

function profileFromSetup(setupInput?: Partial<AccompanimentWorkflowSetup> | null): GuitarTabValidationOptions["guitarProfile"] {
  const setup = normalizeAccompanimentWorkflowSetup(setupInput);
  const guitar = orderedAccompanimentInstruments(setup).find((instrument) =>
    instrument.enabled && instrument.id === "guitar-classic"
  );
  return guitar ? "guitar-acoustic" : "standard-six-string";
}

function guitarTabValidationOptionsFromOption(
  option: Partial<AccompanimentWorkflowOption>,
  input: GenerateAccompanimentWorkflowStepInput
): GuitarTabValidationOptions {
  const data = optionData(option);
  const guitarTab = guitarTabObjectFromData(data);
  const previousGuitarProfile = input.previousSelections
    .map((selection) => guitarTabObjectFromData(selection.data)?.profileId ?? selection.data.profileId)
    .find(isGuitarValidationProfileId);
  const optionProfile = guitarTab?.profileId ?? data?.guitarProfileId ?? data?.profileId;
  const optionVoicing = guitarTab?.voicingProfileId ?? data?.voicingProfileId ?? data?.compingProfile ?? data?.pickingProfile ?? data?.profileId;

  return {
    guitarProfile: isGuitarValidationProfileId(optionProfile)
      ? optionProfile
      : previousGuitarProfile ?? profileFromSetup(input.setup),
    voicingProfile: stringValue(optionVoicing) ?? stringValue(input.previousSelections.find((selection) => selection.stepId === "guitar-comping-profile")?.data.voicingProfileId),
    requireScientificPitch: true,
    requireRenderableTiming: true,
  };
}

function guitarTabValidationOptionsFromToolArgs(args: unknown, input: GenerateAccompanimentWorkflowStepInput): GuitarTabValidationOptions {
  const record = args && typeof args === "object" && !Array.isArray(args) ? args as Record<string, unknown> : {};
  return {
    guitarProfile: isGuitarValidationProfileId(record.profileId) ? record.profileId : profileFromSetup(input.setup),
    voicingProfile: stringValue(record.voicingProfileId),
    requireScientificPitch: true,
    requireRenderableTiming: true,
  };
}

function validateGuitarWorkflowResult(
  raw: unknown,
  input: GenerateAccompanimentWorkflowStepInput,
  toolEvidence: { queriedVoicings: boolean; validatedTab: boolean },
): ToolLoopValidationResult {
  const result = raw as RawWorkflowStepResult;
  const options = Array.isArray(result.options) ? result.options.slice(0, 5) : [];
  const validations: Array<{ optionId: string; validation: GuitarTabValidationResult }> = [];
  const messages: string[] = [];
  if (!toolEvidence.queriedVoicings) messages.push("Call query_guitar_voicings before finalizing acoustic steel-string Guitar fretting.");
  if (!toolEvidence.validatedTab) messages.push("Call valid_guitar_tab on the proposed acoustic steel-string Guitar events before finalizing.");

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

    const generatedProfile = guitarTabObjectFromData(optionData(option))?.compingProfileId;
    if (!isGuitarClassicCompingProfileId(generatedProfile)) {
      messages.push(`${optionId} is missing a supported data.guitarTab.compingProfileId.`);
    }
    const selectedProfile = guitarClassicCompingProfileFromSelection(
      input.previousSelections.find((selection) => selection.stepId === "guitar-comping-profile")
    );
    if (input.stepId === "guitar-voicing-bass" && selectedProfile && generatedProfile !== selectedProfile) {
      messages.push(`${optionId} must retain the selected Guitar Profile ${selectedProfile}.`);
    }

    const validation = validateGuitarTab(events, {
      ...guitarTabValidationOptionsFromOption(option, input),
      requireSourceEventIds: false,
    });
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

const ABC_WORKFLOW_STEP_IDS = new Set<AccompanimentWorkflowStepId>(["chord-roles-progression", "voice-leading-validation"]);
const ABC_OPTION_DATA_KEYS = ["harmonizedAbc", "validatedAbc", "chordAnnotatedAbc", "abc"] as const;

function optionData(option: Partial<AccompanimentWorkflowOption>): Record<string, unknown> | null {
  const data = option.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function playableAbcFromData(data: Record<string, unknown>): string | null {
  for (const key of ABC_OPTION_DATA_KEYS) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function deriveNoteChordAssignments(data: Record<string, unknown>): Record<string, unknown> {
  const abc = playableAbcFromData(data);
  const normalized = { ...data };
  delete normalized.noteChordAssignments;

  return abc
    ? { ...normalized, noteChordAssignments: assignActiveChordsToMelodyNotes(abc) }
    : normalized;
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

function validateHarmonyTimeline(raw: unknown): ToolLoopValidationResult {
  const result = raw as RawWorkflowStepResult;
  const options = Array.isArray(result.options) ? result.options.slice(0, 5) : [];
  const messages: string[] = [];

  for (const [index, option] of options.entries()) {
    const optionId = normalizeId(option.id, `option-${index + 1}`);
    const data = optionData(option);
    if (!data) continue;

    for (const key of ABC_OPTION_DATA_KEYS) {
      const abc = data[key];
      if (typeof abc !== "string" || !abc.trim()) continue;

      messages.push(...validateHarmonyTimelineAbc(abc).map((message) => `${optionId}.${key} ${message}`));
    }
  }

  return {
    valid: messages.length === 0,
    message: messages.join("\n"),
    toolResult: { valid: messages.length === 0, issues: messages },
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

function normalizeGuitarTabOptionData(data: Record<string, unknown>): Record<string, unknown> {
  const guitarTab = data.guitarTab;
  if (!guitarTab || typeof guitarTab !== "object" || Array.isArray(guitarTab)) return data;
  const events = (guitarTab as Record<string, unknown>).events;
  if (!Array.isArray(events)) return data;
  return {
    ...data,
    guitarTab: {
      ...(guitarTab as Record<string, unknown>),
      events: normalizeGuitarTabEvents(events),
    },
  };
}

function normalizeOptions(raw: unknown, sourceAbc: string, stepId?: AccompanimentWorkflowStepId): AccompanimentWorkflowOption[] {
  const result = raw as RawWorkflowStepResult;
  const options = Array.isArray(result.options) ? result.options.slice(0, 2) : [];

  if (options.length === 0) {
    throw new Error("LLM returned no workflow options");
  }

  return options.map((option, index) => {
    const data = option.data && typeof option.data === "object" && !Array.isArray(option.data)
      ? normalizeWorkflowOptionDataLineBreaks(option.data, sourceAbc)
      : {};
    const normalizedData = stepId && ABC_WORKFLOW_STEP_IDS.has(stepId)
        ? deriveNoteChordAssignments(data)
        : stepId && isGuitarTabValidationWorkflowStep(stepId)
          ? normalizeGuitarTabOptionData(data)
          : data;

    const warnings = stringArray(option.warnings);

    // Warning-level chord-tone validation for Guitar voice ABC
    if (stepId && isGuitarTabValidationWorkflowStep(stepId)) {
      for (const key of ABC_OPTION_DATA_KEYS) {
        const abcValue = normalizedData[key];
        if (typeof abcValue === "string" && abcValue.includes("[V:Guitar]")) {
          try {
            const chordToneResult = validateGuitarVoiceChordTones(abcValue);
            if (!chordToneResult.valid) {
              warnings.push(...chordToneResult.issues.map(
                (issue) => `[chord-tone] ${issue}`
              ));
              console.warn(
                `[Accompaniment][chord-tone][${stepId}] Option ${index + 1} chord-tone issues:`,
                chordToneResult.issues
              );
            }
          } catch (e) {
            console.error("[Accompaniment][chord-tone] Validation error:", e);
          }
        }
      }
    }

    return {
      id: normalizeId(option.id, `option-${index + 1}`),
      label: typeof option.label === "string" && option.label.trim() ? option.label.trim() : `Option ${index + 1}`,
      summary: typeof option.summary === "string" ? option.summary : "",
      justification: typeof option.justification === "string" ? option.justification : "",
      data: normalizedData,
      warnings,
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
    if (isAlgorithmicHarmonyStep(input.stepId)) return generateHarmonyWorkflowStep(input);
    if (input.stepId === "guitar-classic-abc-notation") {
      return buildGuitarClassicAbcNotationRun(input);
    }

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

    if (isGuitarTabValidationWorkflowStep(input.stepId)) {
      let queriedVoicings = false;
      let validatedTab = false;
      rawResult = await requestOpenAiCompatibleToolLoop({
        systemPrompt: `${systemPrompt} For acoustic steel-string Guitar singer-support steps, call query_guitar_voicings before concrete fretting and valid_guitar_tab on the exact proposed events; both calls are required before final output. Use compact timed tab keys (m/t/d/b/n/s/f/r/sid) and include data.guitarTab.compingProfileId. Step 4 selects devotional-pima-arpeggio, devotional-pinch-arpeggio, or bhajan-strum with a representative sample. Step 5 retains that profile and plans bounded voicing/root-fifth/transition anchors, not a full texture. Step 6 deterministically makes the treble-led accompaniment: strings 4-6 are restrained structural bass, strings 1-3 carry most PIMA/pinch motion, walking bass is optional transition material, and pinches are bass-plus-treble on metric strong beats. Ensure unique string/source assignment and one-left-hand reach.`,
        userPrompt: requestPrompt,
        tools: [buildValidGuitarTabToolSchema(), buildQueryGuitarVoicingsToolSchema(), toolSchema],
        finalToolName: toolName,
        localTools: [
          {
            name: "valid_guitar_tab",
            execute: (args) => {
              validatedTab = true;
              const events = (args as { events?: unknown }).events;
              return validateGuitarTab(
                normalizeGuitarTabEvents(events) as unknown as GuitarTabEvent[],
                guitarTabValidationOptionsFromToolArgs(args, input)
              );
            },
          },
          {
            name: "query_guitar_voicings",
            execute: (args) => {
              queriedVoicings = true;
              const { chord, melody_pitch, target_position } = args as { chord: Parameters<typeof query_guitar_voicings>[0]; melody_pitch: Parameters<typeof query_guitar_voicings>[1]; target_position: Parameters<typeof query_guitar_voicings>[2] };
              return query_guitar_voicings(chord, melody_pitch, target_position);
            }
          }
        ],
        validateFinalResult: (args) => validateGuitarWorkflowResult(args, input, { queriedVoicings, validatedTab }),
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
        validateFinalResult: (args) => {
          const lineBreakValidation = validateWorkflowAbcLineBreaks({
            raw: args,
            sourceAbc: input.sourceAbc,
            requireBreakToolCall: true,
            breakToolCalled,
            requireAbcField: true,
          });
          const harmonyTimelineValidation = validateHarmonyTimeline(args);
          const issues = [lineBreakValidation.message, harmonyTimelineValidation.message].filter(Boolean);
          return {
            valid: lineBreakValidation.valid && harmonyTimelineValidation.valid,
            message: issues.join("\n"),
            toolResult: {
              lineBreakValidation: lineBreakValidation.toolResult,
              harmonyTimelineValidation: harmonyTimelineValidation.toolResult,
            },
          };
        },
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
  const chords = generateHarmonyWorkflowStep({ ...input, stepId: "chord-roles-progression" });
  // Selection is explicit: callers must select Step 2 before requesting validation.
  return [chords];
}
