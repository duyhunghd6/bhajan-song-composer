import { requestOpenAiCompatibleToolLoop, type ToolDiagnosticEvent } from "../ai-config";
import {
  INSPECT_FILL_RESERVATION_SLOTS_TOOL_DEFINITION,
  SELECT_FILL_RESERVATIONS_TOOL_DEFINITION,
  INSPECT_BASS_POSITIONS_TOOL_DEFINITION,
  SELECT_BASS_POSITIONS_TOOL_DEFINITION,
  INSPECT_BASS_PITCH_CANDIDATES_TOOL_DEFINITION,
  SELECT_BASS_PITCHES_TOOL_DEFINITION,
  INSPECT_FILL_OPPORTUNITIES_TOOL_DEFINITION,
  SELECT_FILL_WINDOWS_TOOL_DEFINITION,
  SUBMIT_ARRANGED_LINE_TOOL_DEFINITION,
  VALIDATE_COMPOSED_FILLS_TOOL_DEFINITION,
} from "../fingerstyle-tool-contract";
import {
  persistFingerstyleDiagnosticRecords,
  type FingerstyleStoredDiagnosticRecord,
} from "../fingerstyle-diagnostics";
import { placeFingerstyleFoundationOnTimeGrid } from "@/lib/theory/fingerstyle-arranger/heuristic-time-slice";
import {
  analyzeFillOpportunities,
  mergeAcceptedFills,
  normalizeFillPolicy,
  paginateFillOpportunities,
  parseFillCompositionToon,
  parseFillSelectionToon,
  validateFillComposition,
  validateFillSelection,
  type FillComposition,
  type FillOpportunityAnalysis,
  type FillSelection,
} from "@/lib/theory/fingerstyle-arranger/fill-opportunities";
import {
  FINGERSTYLE_GENERATION_DIAGNOSTIC_VERSION,
  type FingerstyleGenerationDiagnosticEvent,
  type FingerstyleGenerationDiagnosticRun,
  type FingerstyleGenerationDiagnosticSummary,
  type FingerstyleWorkflowDiagnosticEvent,
} from "@/lib/theory/fingerstyle-arranger/generation-diagnostics";
import { renderFingerstyleDiagnosticPlaintext } from "@/lib/theory/fingerstyle-arranger/diagnostic-plaintext";
import {
  analyzeFillReservationSlots,
  formatFillReservationSlots,
  parseFillReservationSelection,
  validateFillReservationSelection,
  type FillReservationAnalysis,
  type FillReservationSelection,
} from "@/lib/theory/fingerstyle-arranger/fill-reservations";
import {
  analyzeBassPositions,
  analyzeBassPitchCandidates,
  formatBassPitchCandidates,
  formatBassPositions,
  materializeBassFoundation,
  parseBassPitchSelection,
  parseBassPositionSelection,
  validateBassPitchSelection,
  validateBassPositionSelection,
  type BassPitchAnalysis,
  type BassPositionAnalysis,
} from "@/lib/theory/fingerstyle-arranger/bass-planning";
import { validateFingerstylePhysics } from "@/lib/theory/fingerstyle-arranger/physics-validation";
import { analyzeAuthoritativeMelodyPlayability } from "@/lib/theory/fingerstyle-arranger/source-playability";
import { renderAsciiGuitarTab } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import {
  validateGuitarAbcAgainstAsciiGuitarTab,
  formatAbcAsciiGuitarTabValidation,
} from "@/lib/theory/fingerstyle-arranger/abc-ascii-guitartab-validation";
import { buildAbcDurationContext } from "@/lib/theory/abc-duration";
import { getKeyAccidentalsFromAbc } from "@/lib/theory/abc-key-signature";
import { buildGeneratedGuitarAbc } from "@/lib/theory/fingerstyle-arranger/guitar-abc-output";
import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";

import {
  boundedToolDiagnostic,
  compactDiagnosticPayload,
  makeLlmDiagnosticEvent,
} from "./diagnostics";
import { buildLineSystemPrompt, buildLineUserPrompt } from "./prompts";
import type {
  FingerstyleFillGenerationSummary,
  FingerstyleGenerationNotice,
  GenerateFingerstyleLineInput,
  GenerateFingerstyleLineOutput,
} from "./types";

function parseAbcTempo(abc: string, fallback = 120): number {
  const match = abc.match(/^\s*Q:\s*(?:\d+\/\d+=)?(\d+)/m);
  const bpm = match ? Number.parseInt(match[1], 10) : fallback;
  return Number.isFinite(bpm) && bpm > 0 && bpm <= 600 ? bpm : fallback;
}

type MelodySourceSnapshot = {
  measure: number;
  step: number;
  pitch: string | null;
  state: TimeSliceMeasure["grid"][number]["melody"]["state"];
};

function snapshotMelodySource(measures: readonly TimeSliceMeasure[]): MelodySourceSnapshot[] {
  return measures.flatMap(measure => measure.grid.map(step => ({
    measure: measure.measure,
    step: step.step,
    pitch: step.melody.pitch,
    state: step.melody.state,
  })));
}

function sourceMelodyDrift(
  source: readonly MelodySourceSnapshot[],
  measures: readonly TimeSliceMeasure[],
): string[] {
  const actual = snapshotMelodySource(measures);
  if (actual.length !== source.length) return ["source melody grid length changed."];
  return source.flatMap((expected, index) => {
    const observed = actual[index];
    if (
      expected.measure === observed.measure
      && expected.step === observed.step
      && expected.pitch === observed.pitch
      && expected.state === observed.state
    ) return [];
    return [`M${expected.measure}/s${expected.step} source melody changed.`];
  });
}

function freezeFoundationDurations(measures: TimeSliceMeasure[]): TimeSliceMeasure[] {
  return measures.map(measure => ({
    ...measure,
    grid: measure.grid.map(step => ({
      ...step,
      melody: { ...step.melody },
      tablature: step.tablature?.map(tab => tab.role === "melody"
        ? { ...tab }
        : { ...tab, durationSteps: tab.durationSteps ?? 1 }),
    })),
  }));
}

function physicalValidationErrors(
  measures: TimeSliceMeasure[],
  policy: ReturnType<typeof normalizeFillPolicy>,
  maxMelodyFret: number,
): string[] {
  const errors: string[] = [];
  for (const measure of measures) {
    const physics = validateFingerstylePhysics(measure.grid, {
      fillDensity: policy.resolvedDensity === "off" ? "none" : policy.resolvedDensity,
      skillLevel: policy.skillLevel,
      maxMelodyFret,
    });
    if (!physics.valid) errors.push(`Measure ${measure.measure}: ${physics.message}`);
  }
  return errors;
}

function formatBassSourceDiagnostic(measures: TimeSliceMeasure[], positionIds: string[]): string {
  const labels = new Map<number, string[]>();
  for (const id of positionIds) {
    const match = /^bp-m(\d+)-s(\d+)$/.exec(id);
    if (!match) continue;
    const measure = Number(match[1]);
    const step = Number(match[2]);
    labels.set(measure, [...(labels.get(measure) ?? []), `"_Bass M${measure}:S${step}"`]);
  }
  return [
    "% Bass positions in source ABC — diagnostic projection only; raw source remains unchanged.",
    "[V:Melody] " + measures.map(measure => (
      `${(labels.get(measure.measure) ?? []).join("")}${measure.source_abc?.melody ?? "z"}`
    )).join(" | ") + " |",
  ].join("\n");
}

function toolPayloadString(args: unknown, key: string): string | null {
  const value = (args as Record<string, unknown> | null)?.[key];
  return typeof value === "string" ? value.trim() : null;
}

export async function runFingerstyleLineWorkflow(
  input: GenerateFingerstyleLineInput,
): Promise<GenerateFingerstyleLineOutput> {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const runId = crypto.randomUUID();
  const lineIndex = input.lineMeasures[0]?.lineIndex ?? input.previousLines.length;
  const measureNumbers = input.lineMeasures.map(measure => measure.measure);
  const sourceMelody = snapshotMelodySource(input.lineMeasures);
  const policy = normalizeFillPolicy(input);
  const melodyPlayability = analyzeAuthoritativeMelodyPlayability(input.lineMeasures, policy.skillLevel);
  const bpm = parseAbcTempo(input.activeAbc);
  const systemPrompt = buildLineSystemPrompt({ fillDensityOff: policy.resolvedDensity === "off" });
  const userPrompt = buildLineUserPrompt(input, melodyPlayability);
  const tools = [
    INSPECT_FILL_RESERVATION_SLOTS_TOOL_DEFINITION,
    SELECT_FILL_RESERVATIONS_TOOL_DEFINITION,
    INSPECT_BASS_POSITIONS_TOOL_DEFINITION,
    SELECT_BASS_POSITIONS_TOOL_DEFINITION,
    INSPECT_BASS_PITCH_CANDIDATES_TOOL_DEFINITION,
    SELECT_BASS_PITCHES_TOOL_DEFINITION,
    INSPECT_FILL_OPPORTUNITIES_TOOL_DEFINITION,
    SELECT_FILL_WINDOWS_TOOL_DEFINITION,
    VALIDATE_COMPOSED_FILLS_TOOL_DEFINITION,
    SUBMIT_ARRANGED_LINE_TOOL_DEFINITION,
  ];

  let reservationAnalysis: FillReservationAnalysis | null = null;
  let acceptedReservations: FillReservationSelection | null = null;
  let bassPositionAnalysis: BassPositionAnalysis | null = null;
  let bassPositionsSelected = false;
  let acceptedBassPositions: string[] = [];
  let bassPitchAnalysis: BassPitchAnalysis | null = null;
  let frozenFoundation: TimeSliceMeasure[] | null = null;
  let opportunityAnalysis: FillOpportunityAnalysis | null = null;
  let nextInspectionCursor: number | null = 0;
  let acceptedSelection: FillSelection | null = null;
  let acceptedComposition: FillComposition | null = null;
  let acceptedCompositionToon: string | null = null;
  let acceptedFinalMeasures: TimeSliceMeasure[] | null = null;
  let finalOutput: GenerateFingerstyleLineOutput | null = null;
  let fillRepairStage: "bass" | "reservation" | null = null;
  let fillRepairAttempts = 0;
  let fillStageFailureAttempts = 0;
  let selectionRepairAttempts = 0;
  const notices: FingerstyleGenerationNotice[] = [];
  let selectionRepairWindowIds: string[] = [];
  const forceToolTurn = (tool: (typeof tools)[number]) => ({
    tools: [tool],
    toolChoice: { type: "function", function: { name: tool.function.name } },
    maxToolCallsPerTurn: 1,
  });
  const resolveFingerstyleToolTurn = () => {
    if (fillRepairStage === "reservation") return forceToolTurn(SELECT_FILL_RESERVATIONS_TOOL_DEFINITION);
    if (fillRepairStage === "bass") return forceToolTurn(SELECT_BASS_POSITIONS_TOOL_DEFINITION);
    if (!reservationAnalysis) return forceToolTurn(INSPECT_FILL_RESERVATION_SLOTS_TOOL_DEFINITION);
    if (!acceptedReservations) return forceToolTurn(SELECT_FILL_RESERVATIONS_TOOL_DEFINITION);
    if (!bassPositionAnalysis) return forceToolTurn(INSPECT_BASS_POSITIONS_TOOL_DEFINITION);
    if (!bassPositionsSelected) return forceToolTurn(SELECT_BASS_POSITIONS_TOOL_DEFINITION);
    if (!bassPitchAnalysis) return forceToolTurn(INSPECT_BASS_PITCH_CANDIDATES_TOOL_DEFINITION);
    if (!frozenFoundation) return forceToolTurn(SELECT_BASS_PITCHES_TOOL_DEFINITION);
    if (policy.resolvedDensity === "off") return forceToolTurn(SUBMIT_ARRANGED_LINE_TOOL_DEFINITION);
    if (!opportunityAnalysis || nextInspectionCursor !== null) return forceToolTurn(INSPECT_FILL_OPPORTUNITIES_TOOL_DEFINITION);
    if (!acceptedSelection || selectionRepairWindowIds.length > 0) return forceToolTurn(SELECT_FILL_WINDOWS_TOOL_DEFINITION);
    if (!acceptedComposition) return forceToolTurn(VALIDATE_COMPOSED_FILLS_TOOL_DEFINITION);
    return forceToolTurn(SUBMIT_ARRANGED_LINE_TOOL_DEFINITION);
  };
  let diagnosticSummary: FingerstyleGenerationDiagnosticSummary = {
    outcome: "failed",
    inputEventCount: 0,
    resolvedEventCount: 0,
    unresolvedEventCount: 0,
    changedEventCount: 0,
    unchangedEventCount: 0,
    totalCost: null,
    elapsedMs: 0,
  };
  const logs: string[] = [];
  const diagnosticEvents: FingerstyleGenerationDiagnosticEvent[] = [];
  const storedRecords: FingerstyleStoredDiagnosticRecord[] = [{
    type: "run-input",
    timestamp: startedAt,
    runId,
    payload: {
      scope: { songSlug: input.songSlug, lineIndex, measureNumbers, sourceFingerprint: input.sourceFingerprint },
      inputs: {
        lineMeasureCount: input.lineMeasures.length,
        previousLineCount: input.previousLines.length,
        nextLineMeasureCount: input.nextLineMeasures?.length ?? 0,
        sourceAbcLength: input.activeAbc.length,
        systemPromptLength: systemPrompt.length,
        userPromptLength: userPrompt.length,
        toolCount: tools.length,
      },
      conditioning: {
        policy,
        bpm,
        melodyMaxFret: melodyPlayability.melodyMaxFret,
        finalToolName: "submit_arranged_line",
        maxIterations: 24,
        maxValidationAttempts: 3,
        requestTimeoutMs: 60_000,
        maxRequestAttempts: 2,
        maxDurationMs: 5 * 60_000,
      },
    },
  }];

  const recordWorkflowEvent = (
    kind: FingerstyleWorkflowDiagnosticEvent["kind"],
    phase: string,
    status: FingerstyleWorkflowDiagnosticEvent["status"],
    message: string,
    payload?: unknown,
  ) => {
    const timestamp = new Date().toISOString();
    const event: FingerstyleWorkflowDiagnosticEvent = {
      id: `${runId}-workflow-${diagnosticEvents.length}`,
      runId,
      sequence: diagnosticEvents.length,
      createdAt: timestamp,
      source: "workflow",
      kind,
      phase,
      status,
      message,
      payloadPreview: compactDiagnosticPayload(payload),
    };
    diagnosticEvents.push(event);
    storedRecords.push({ type: "workflow-event", timestamp, runId, payload: { kind, phase, status, message, details: payload } });
    logs.push(`[${phase.toUpperCase()}] ${message}`);
  };

  const recordLlmDiagnostic = (event: ToolDiagnosticEvent) => {
    if (event.type === "tool-call") logs.push(`[TOOL IN] ${event.toolName}(${boundedToolDiagnostic(event.input)})`);
    else if (event.type === "tool-result") logs.push(`[TOOL OUT] ${event.toolName} => ${boundedToolDiagnostic(event.result)}`);
    else if (event.type === "final-validation") logs.push(`[VALIDATION] ${event.valid ? "PASSED" : "FAILED"}: ${event.message || ""}`);
    else if (event.type === "chat-request") logs.push(`[LLM QUERY] Sending ${event.messageCount} messages. Available tools: ${event.toolNames.join(", ")}`);
    else if (event.type === "chat-response") logs.push(`[LLM RESPONSE] Tools called: ${event.toolCallNames.join(", ")}`);
    else if (event.type === "chat-error" || event.type === "loop-exhausted") logs.push(`[ERROR] ${"message" in event ? event.message : event.lastValidationMessage}`);
    diagnosticEvents.push(makeLlmDiagnosticEvent(event, runId, diagnosticEvents.length));
    storedRecords.push({ type: "llm-event", timestamp: new Date().toISOString(), runId, payload: compactDiagnosticPayload(event) });
  };

  const finalizeDiagnostics = async (summary: FingerstyleGenerationDiagnosticSummary): Promise<FingerstyleGenerationDiagnosticRun> => {
    const completedAt = new Date().toISOString();
    const scope: FingerstyleGenerationDiagnosticRun["scope"] = {
      songSlug: input.songSlug,
      lineIndex,
      measureIndexes: measureNumbers,
      sourceFingerprint: input.sourceFingerprint,
    };
    const plaintext = renderFingerstyleDiagnosticPlaintext({ runId, startedAt, completedAt, scope, events: diagnosticEvents, summary });
    logs.push(plaintext);
    storedRecords.push({ type: "run-complete", timestamp: completedAt, runId, payload: { summary, plaintext, legacyLogLineCount: logs.length - 1 } });
    const persistence = await persistFingerstyleDiagnosticRecords({ songSlug: input.songSlug, lineIndex, runId, records: storedRecords });
    return { version: FINGERSTYLE_GENERATION_DIAGNOSTIC_VERSION, runId, startedAt, completedAt, scope, events: diagnosticEvents, summary, plaintext, persistence };
  };

  const fillSummary = (finalValidation: "passed" | "failed"): FingerstyleFillGenerationSummary => ({
    bpm,
    policy,
    evaluatedStepCount: opportunityAnalysis?.evaluatedStepCount ?? 0,
    evaluatedPlacementCount: opportunityAnalysis?.evaluatedPlacementCount ?? 0,
    eligibleWindowCount: opportunityAnalysis?.windows.length ?? 0,
    selectedWindowCount: acceptedSelection?.decisions.filter(decision => decision.decision === "use").length ?? 0,
    composedFillCount: acceptedComposition?.entries.length ?? 0,
    finalValidation,
  });

  logs.push(`=== SYSTEM PROMPT ===\n${systemPrompt}\n`);
  logs.push(`=== USER PROMPT ===\n${userPrompt}\n`);

  const completeFinalOutput = (fillsToon?: string | null) => {
    if (!acceptedFinalMeasures) {
      const message = "Materialize a validated foundation before final submission.";
      recordWorkflowEvent("final-merge-rejected", "final-validation", "warning", message);
      return { valid: false, message, toolResult: { valid: false, message } };
    }
    if (acceptedCompositionToon && fillsToon !== acceptedCompositionToon) {
      const message = "Final fills_toon must exactly match the payload accepted by validate_composed_fills.";
      recordWorkflowEvent("final-merge-rejected", "final-validation", "warning", message);
      return { valid: false, message, toolResult: { valid: false, message } };
    }
    const finalSourceDrift = sourceMelodyDrift(sourceMelody, acceptedFinalMeasures);
    if (finalSourceDrift.length > 0) {
      const message = `Final merge changed the source-pinned melody: ${finalSourceDrift.join(" ")}`;
      recordWorkflowEvent("final-merge-rejected", "final-validation", "failed", message, { errors: finalSourceDrift });
      return { valid: false, message, toolResult: { valid: false, message } };
    }
    const physicalErrors = physicalValidationErrors(acceptedFinalMeasures, policy, melodyPlayability.melodyMaxFret);
    if (physicalErrors.length > 0) {
      const message = physicalErrors.join(" ");
      recordWorkflowEvent("final-merge-rejected", "final-validation", "failed", message, { physicalErrors });
      return { valid: false, message, toolResult: { valid: false, message } };
    }

    const durationContext = buildAbcDurationContext(input.activeAbc);
    const keyAccidentals = getKeyAccidentalsFromAbc(input.activeAbc);
    // Keep server validation on the same canonical TimeGrid projection used by
    // the workspace and /test-timegrid-to-abcnotation.
    const guitarAbc = buildGeneratedGuitarAbc(acceptedFinalMeasures, input.activeAbc);
    const asciiGuitarTabValidation = validateGuitarAbcAgainstAsciiGuitarTab({
      abc: guitarAbc,
      measures: acceptedFinalMeasures,
      durationContext,
      keyAccidentals,
    });
    const asciiGuitarTabValidationMessage = formatAbcAsciiGuitarTabValidation(asciiGuitarTabValidation);
    recordWorkflowEvent(
      asciiGuitarTabValidation.valid ? "abc-ascii-guitartab-validated" : "abc-ascii-guitartab-rejected",
      "final-validation",
      asciiGuitarTabValidation.valid ? "success" : "failed",
      asciiGuitarTabValidation.valid
        ? `ABC ↔ ASCII-GuitarTab validation passed: ${asciiGuitarTabValidation.checkedMeasures} measure(s), ${asciiGuitarTabValidation.expectedEventCount} event(s), no mismatches.`
        : `ABC ↔ ASCII-GuitarTab validation failed: ${asciiGuitarTabValidation.mismatchCount} mismatch(es).`,
      asciiGuitarTabValidation,
    );
    if (!asciiGuitarTabValidation.valid) {
      return {
        valid: false,
        message: asciiGuitarTabValidationMessage,
        toolResult: { valid: false, message: asciiGuitarTabValidationMessage },
      };
    }

    for (const measure of acceptedFinalMeasures) {
      const asciiGuitarTab = renderAsciiGuitarTab(measure.grid, measure.pickupDurationUnits);
      if (asciiGuitarTab) logs.push(`\n## Measure ${measure.measure} — ASCII-GuitarTab\n\n${asciiGuitarTab}`);
    }
    logs.push(`\n## ABC ↔ ASCII-GuitarTab Validation\n\n${asciiGuitarTabValidationMessage}`);
    const completedFillSummary = fillSummary("passed");
    recordWorkflowEvent("final-merge-validated", "final-validation", "success", "Server reconstruction and whole-line validation passed.", completedFillSummary);
    finalOutput = { success: true, measures: acceptedFinalMeasures, logs, fillSummary: completedFillSummary, notices };
    return { valid: true };
  };

  const finalizeWithoutFills = (reason: FingerstyleGenerationNotice["reason"]) => {
    if (!frozenFoundation) return { valid: false, message: "Materialize a validated bass foundation before skipping fills." };
    acceptedSelection = null;
    acceptedComposition = null;
    acceptedCompositionToon = null;
    acceptedFinalMeasures = frozenFoundation;
    const message = reason === "no-legal-windows"
      ? "Bass foundation generated successfully. No playable discretionary fills were available for this line."
      : reason === "all-windows-skipped"
        ? "Bass foundation generated successfully. No discretionary fill was selected, so this line was returned without fills."
        : "Bass foundation generated successfully. Discretionary fills could not be validated after retries, so this line was returned without fills.";
    notices.push({ code: "fills-unavailable", severity: "warning", message, reason });
    recordWorkflowEvent("fill-stages-unavailable", "fill-fallback", "warning", message, {
      reason,
      eligibleWindowCount: opportunityAnalysis?.windows.length ?? 0,
      selectedWindowCount: 0,
      composedFillCount: 0,
    });
    const finalization = completeFinalOutput();
    return finalization.valid ? { valid: true, message } : finalization;
  };

  const retryFillStageOrFinalize = (message: string) => {
    fillStageFailureAttempts += 1;
    return fillStageFailureAttempts >= 3
      ? finalizeWithoutFills("retry-exhausted")
      : { valid: false, message };
  };

  try {
    if (!melodyPlayability.playable) {
      const message = melodyPlayability.issues.map(issue => issue.message).join(" ");
      recordWorkflowEvent("foundation-rejected", "source-playability", "failed", message, melodyPlayability);
      throw new Error(message);
    }
    recordWorkflowEvent(
      "foundation-validated",
      "source-playability",
      melodyPlayability.exceptions.length > 0 ? "info" : "success",
      melodyPlayability.exceptions.length > 0
        ? `${melodyPlayability.exceptions.length} authoritative melody attack(s) require a melody-only fret exception up to fret ${melodyPlayability.melodyMaxFret}; discretionary ${policy.skillLevel} notes remain capped at fret ${melodyPlayability.accompanimentMaxFret}.`
        : `All authoritative melody attacks fit the ${policy.skillLevel} fret limit.`,
      melodyPlayability,
    );
    await requestOpenAiCompatibleToolLoop({
      systemPrompt,
      userPrompt,
      tools,
      resolveToolTurn: resolveFingerstyleToolTurn,
      finalToolName: "submit_arranged_line",
      onDiagnostic: recordLlmDiagnostic,
      localTools: [
        {
          name: "inspect_fill_reservation_slots",
          execute: () => {
            reservationAnalysis ??= analyzeFillReservationSlots({
              measures: input.lineMeasures,
              sourceFingerprint: input.sourceFingerprint,
              skillLevel: policy.skillLevel,
              densityMode: policy.densityMode,
            });
            recordWorkflowEvent("fill-reservations-analyzed", "fill-reservations", "success", `Found ${reservationAnalysis.slots.length} source-only fill reservation slot(s).`, reservationAnalysis);
            return formatFillReservationSlots(reservationAnalysis);
          },
        },
        {
          name: "select_fill_reservations",
          execute: args => {
            if (!reservationAnalysis) return { valid: false, message: "Inspect fill reservation slots first." };
            const parsed = parseFillReservationSelection(toolPayloadString(args, "reservations_toon") ?? "");
            if (!parsed.valid || !parsed.value) return { valid: false, message: parsed.errors.join(" ") };
            const validated = validateFillReservationSelection(reservationAnalysis, parsed.value);
            if (!validated.valid) {
              recordWorkflowEvent("fill-reservations-rejected", "fill-reservations", "warning", validated.errors.join(" "), validated.errors);
              return { valid: false, message: validated.errors.join(" ") };
            }
            acceptedReservations = parsed.value;
            acceptedBassPositions = [];
            bassPositionsSelected = false;
            bassPositionAnalysis = null;
            bassPitchAnalysis = null;
            frozenFoundation = null;
            opportunityAnalysis = null;
            nextInspectionCursor = 0;
            acceptedSelection = null;
            acceptedComposition = null;
            acceptedCompositionToon = null;
            acceptedFinalMeasures = null;
            fillRepairStage = null;
            fillRepairAttempts = 0;
            recordWorkflowEvent("fill-reservations-accepted", "fill-reservations", "success", `Note Fills Position: ${validated.selectedSlotIds.map(id => id.replace("fr-", "")).join(", ") || "none"}.`, { selectedSlotIds: validated.selectedSlotIds });
            return { valid: true, selectedSlotIds: validated.selectedSlotIds };
          },
        },
        {
          name: "inspect_bass_positions",
          execute: () => {
            if (!reservationAnalysis || !acceptedReservations) return { valid: false, message: "Select fill reservations first." };
            const selectedSlotIds = acceptedReservations.decisions.filter(row => row.decision === "use").map(row => row.slotId);
            bassPositionAnalysis = analyzeBassPositions({ measures: input.lineMeasures, sourceFingerprint: input.sourceFingerprint, reservedFillSlotIds: selectedSlotIds });
            recordWorkflowEvent("bass-positions-analyzed", "bass-positions", "success", `Found ${bassPositionAnalysis.positions.length} legal bass position(s) after reserving fill locations.`, bassPositionAnalysis);
            return formatBassPositions(bassPositionAnalysis);
          },
        },
        {
          name: "select_bass_positions",
          execute: args => {
            if (!bassPositionAnalysis) return { valid: false, message: "Inspect bass positions first." };
            const parsed = parseBassPositionSelection(toolPayloadString(args, "bass_positions_toon") ?? "");
            if (!parsed.valid || !parsed.value) return { valid: false, message: parsed.errors.join(" ") };
            const validated = validateBassPositionSelection(bassPositionAnalysis, parsed.value);
            if (!validated.valid) {
              recordWorkflowEvent("bass-positions-rejected", "bass-positions", "warning", validated.errors.join(" "), validated.errors);
              return { valid: false, message: validated.errors.join(" ") };
            }
            acceptedBassPositions = validated.selectedPositionIds;
            bassPositionsSelected = true;
            bassPitchAnalysis = null;
            fillRepairStage = null;
            frozenFoundation = null;
            opportunityAnalysis = null;
            nextInspectionCursor = 0;
            acceptedSelection = null;
            acceptedComposition = null;
            acceptedCompositionToon = null;
            acceptedFinalMeasures = null;
            const annotation = formatBassSourceDiagnostic(input.lineMeasures, validated.selectedPositionIds);
            logs.push(`\n## Bass positions in source ABC\n\n\`\`\`abc\n${annotation}\n\`\`\``);
            recordWorkflowEvent("bass-source-abc-annotated", "bass-positions", "info", "Bass positions in source ABC (diagnostic-only below-note labels).", { annotation, selectedPositionIds: validated.selectedPositionIds });
            recordWorkflowEvent("bass-positions-accepted", "bass-positions", "success", `Accepted bass positions: ${validated.selectedPositionIds.join(", ") || "none"}.`, { selectedPositionIds: validated.selectedPositionIds });
            return { valid: true, selectedPositionIds: validated.selectedPositionIds, sourceAbcAnnotations: annotation };
          },
        },
        {
          name: "inspect_bass_pitch_candidates",
          execute: () => {
            if (!bassPositionAnalysis || !acceptedBassPositions) return { valid: false, message: "Select bass positions first." };
            const selected = bassPositionAnalysis.positions.filter(position => acceptedBassPositions.includes(position.id));
            bassPitchAnalysis = analyzeBassPitchCandidates({ positionSetId: bassPositionAnalysis.setId, positions: selected, sourceFingerprint: input.sourceFingerprint, skillLevel: policy.skillLevel });
            recordWorkflowEvent("bass-pitches-analyzed", "bass-pitches", "success", `Generated ${bassPitchAnalysis.candidates.length} heuristic chord-derived bass candidate(s).`, bassPitchAnalysis);
            return formatBassPitchCandidates(bassPitchAnalysis);
          },
        },
        {
          name: "select_bass_pitches",
          execute: args => {
            if (!bassPitchAnalysis) return { valid: false, message: "Inspect bass pitch candidates first." };
            const parsed = parseBassPitchSelection(toolPayloadString(args, "bass_pitches_toon") ?? "");
            if (!parsed.valid || !parsed.value) return { valid: false, message: parsed.errors.join(" ") };
            const validated = validateBassPitchSelection(bassPitchAnalysis, acceptedBassPositions, parsed.value);
            if (!validated.valid) {
              recordWorkflowEvent("bass-pitches-rejected", "bass-pitches", "warning", validated.errors.join(" "), validated.errors);
              return { valid: false, message: validated.errors.join(" ") };
            }
            const materialized = materializeBassFoundation(input.lineMeasures, validated.selected, policy.skillLevel, melodyPlayability.melodyMaxFret);
            const placement = placeFingerstyleFoundationOnTimeGrid(materialized, { bpm, skillLevel: policy.skillLevel, maxMelodyFret: melodyPlayability.melodyMaxFret });
            if (placement.unresolvedEventCount > 0) return { valid: false, message: "TimeGrid materialization could not place every melody or bass event." };
            const errors = physicalValidationErrors(placement.measures, { ...policy, resolvedDensity: "off" }, melodyPlayability.melodyMaxFret);
            if (errors.length > 0) return { valid: false, message: errors.join(" ") };
            frozenFoundation = freezeFoundationDurations(placement.measures);
            opportunityAnalysis = null;
            nextInspectionCursor = 0;
            acceptedSelection = null;
            acceptedComposition = null;
            acceptedCompositionToon = null;
            acceptedFinalMeasures = null;
            fillStageFailureAttempts = 0;
            recordWorkflowEvent("bass-pitches-accepted", "bass-pitches", "success", `Bass note choices: ${validated.selected.map(candidate => `${candidate.positionId}=${candidate.pitch} (${candidate.role})`).join(", ") || "none"}.`, { selected: validated.selected });
            recordWorkflowEvent("timegrid-materialized", "timegrid", "success", `Updated and froze canonical TimeGrid with ${validated.selected.length} bass note(s).`, placement.diagnostics);
            if (policy.resolvedDensity === "off") {
              acceptedFinalMeasures = frozenFoundation;
              recordWorkflowEvent("fill-stages-skipped", "fill-analysis", "info", "Fill density is none; skipped opportunity analysis, fill selection, composition, and final LLM submission.");
              const finalization = completeFinalOutput();
              if (!finalization.valid) return finalization;
              return { valid: true, selected: validated.selected, message: "TimeGrid updated and finalized without discretionary fills." };
            }
            return { valid: true, selected: validated.selected, message: "TimeGrid updated. Inspect post-bass fill opportunities next." };
          },
          maxInvalidResults: 3,
        },
        {
          name: "inspect_fill_opportunities",
          execute: args => {
            if (!frozenFoundation || !acceptedReservations) return { valid: false, message: "Select bass pitches and materialize the TimeGrid before inspecting physical fill candidates." };
            const cursor = (args as { cursor?: unknown }).cursor;
            if (!Number.isSafeInteger(cursor) || (cursor as number) < 0) return { valid: false, message: "cursor must be a non-negative integer." };
            if (nextInspectionCursor === null) return { valid: false, message: "All opportunity pages are already inspected; select windows next." };
            if (cursor !== nextInspectionCursor) return { valid: false, message: `Inspect cursor ${nextInspectionCursor} next; do not skip or repeat pages.` };
            opportunityAnalysis ??= analyzeFillOpportunities({
              measures: frozenFoundation,
              sourceFingerprint: input.sourceFingerprint,
              skillLevel: policy.skillLevel,
              densityMode: policy.densityMode,
              previousLineMeasures: input.previousLineMeasures,
              nextLineMeasures: input.nextLineMeasures,
            });
            if (cursor === 0) {
              recordWorkflowEvent("opportunities-analyzed", "fill-analysis", "success", `Evaluated ${opportunityAnalysis.evaluatedPlacementCount} placements and retained ${opportunityAnalysis.windows.length} windows with ${opportunityAnalysis.candidates.length} legal atomic candidates.`, {
                opportunitySetId: opportunityAnalysis.opportunitySetId,
                rejectionCounts: opportunityAnalysis.rejectionCounts,
                budget: opportunityAnalysis.budget,
              });
            }
            const page = paginateFillOpportunities(opportunityAnalysis, { cursor: cursor as number });
            nextInspectionCursor = page.nextCursor;
            recordWorkflowEvent("opportunity-page-inspected", "fill-analysis", "info", `Inspected opportunity cursor ${page.cursor}; next cursor is ${page.nextCursor ?? "end"}.`, {
              cursor: page.cursor,
              nextCursor: page.nextCursor,
              candidateCount: page.candidateCount,
            });
            if (page.nextCursor === null) {
              const reserved = acceptedReservations.decisions.filter(decision => decision.decision === "use").map(decision => decision.slotId);
              const selectedWindowIds = new Set(reserved.flatMap(slotId => {
                const match = /^fr-m(\d+)-s(\d+)$/.exec(slotId);
                if (!match) return [];
                const measure = Number(match[1]);
                const step = Number(match[2]);
                return opportunityAnalysis!.windows.filter(window => window.measure === measure && step >= window.startStep && step <= window.endStep).map(window => window.id);
              }));
              const unresolved = reserved.filter(slotId => ![...selectedWindowIds].some(windowId => {
                const window = opportunityAnalysis!.windows.find(candidate => candidate.id === windowId);
                const match = /^fr-m(\d+)-s(\d+)$/.exec(slotId);
                return window && match && window.measure === Number(match[1]) && Number(match[2]) >= window.startStep && Number(match[2]) <= window.endStep;
              }));
              if (unresolved.length > 0) {
                fillRepairAttempts += 1;
                if (fillRepairAttempts >= 3) return finalizeWithoutFills("retry-exhausted");
                fillRepairStage = fillRepairAttempts === 1 ? "bass" : "reservation";
                opportunityAnalysis = null;
                nextInspectionCursor = 0;
                acceptedSelection = null;
                acceptedComposition = null;
                acceptedCompositionToon = null;
                acceptedFinalMeasures = null;
                recordWorkflowEvent("fill-reservations-reconciled", "fill-reconciliation", "warning", `Repair required: selected fill reservation(s) have no legal post-bass candidate window: ${unresolved.join(", ")}.`, { unresolved, repair: fillRepairStage });
                return { valid: false, message: `Repair required: revise ${fillRepairStage === "bass" ? "bass positions" : "fill reservations"} for ${unresolved.join(", ")}.` };
              }
              recordWorkflowEvent("fill-reservations-reconciled", "fill-reconciliation", "success", `Reconciled ${reserved.length} fill reservation(s) against the frozen bass TimeGrid.`, { reserved, selectedWindowIds: [...selectedWindowIds] });
            }
            return page.toon;
          },
        },
        {
          name: "select_fill_windows",
          execute: args => {
            acceptedSelection = null;
            acceptedComposition = null;
            acceptedCompositionToon = null;
            acceptedFinalMeasures = null;
            if (!opportunityAnalysis || nextInspectionCursor !== null) return { valid: false, message: "Inspect every opportunity page before selecting windows." };
            const selectionToon = toolPayloadString(args, "selection_toon");
            const parsed = parseFillSelectionToon(selectionToon ?? "");
            if (!parsed.valid || !parsed.value) {
              const message = parsed.errors.join(" ");
              recordWorkflowEvent("selection-rejected", "fill-selection", "warning", message, { errors: parsed.errors });
              return retryFillStageOrFinalize(message);
            }
            const validated = validateFillSelection(opportunityAnalysis, parsed.value);
            if (!validated.valid) {
              const message = validated.errors.join(" ");
              recordWorkflowEvent("selection-rejected", "fill-selection", "warning", message, { errors: validated.errors });
              return retryFillStageOrFinalize(message);
            }
            acceptedSelection = parsed.value;
            selectionRepairWindowIds = [];
            acceptedComposition = null;
            acceptedCompositionToon = null;
            acceptedFinalMeasures = null;
            recordWorkflowEvent("selection-accepted", "fill-selection", "success", `Accepted ${validated.selectedWindowIds.length} selected fill window(s).`, {
              selectedWindowIds: validated.selectedWindowIds,
              targetWindows: opportunityAnalysis.budget.targetWindows,
              maxWindows: opportunityAnalysis.budget.maxWindows,
            });
            if (validated.selectedWindowIds.length === 0) {
              return finalizeWithoutFills(opportunityAnalysis.windows.length === 0 ? "no-legal-windows" : "all-windows-skipped");
            }
            fillStageFailureAttempts = 0;
            return { valid: true, selectedWindowIds: validated.selectedWindowIds, maxNotesPerWindow: opportunityAnalysis.budget.maxNotesPerWindow };
          },
          maxInvalidResults: 3,
        },
        {
          name: "validate_composed_fills",
          execute: args => {
            acceptedComposition = null;
            acceptedCompositionToon = null;
            acceptedFinalMeasures = null;
            if (!frozenFoundation || !opportunityAnalysis || !acceptedSelection) return { valid: false, message: "Select fill windows before composing fills." };
            const fillsToon = toolPayloadString(args, "fills_toon");
            const parsed = parseFillCompositionToon(fillsToon ?? "");
            if (!parsed.valid || !parsed.value) {
              const message = parsed.errors.join(" ");
              recordWorkflowEvent("composition-rejected", "fill-composition", "warning", message, { errors: parsed.errors });
              return retryFillStageOrFinalize(message);
            }
            const validated = validateFillComposition(opportunityAnalysis, acceptedSelection, parsed.value);
            if (!validated.valid) {
              const uncoveredWindowIds = validated.issues
                .filter(issue => issue.code === "selected-window-uncovered")
                .flatMap(issue => /^Selected window (.+) needs at least one composed note\.$/.exec(issue.message)?.[1] ?? []);
              if (uncoveredWindowIds.length > 0 && selectionRepairAttempts < 2) {
                selectionRepairAttempts += 1;
                selectionRepairWindowIds = uncoveredWindowIds;
                acceptedSelection = null;
                recordWorkflowEvent("composition-rejected", "fill-selection-repair", "warning", `Selected windows need a note or skip decision: ${uncoveredWindowIds.join(", ")}.`, { uncoveredWindowIds, selectionRepairAttempts });
                return { valid: false, message: `Revise fill-window decisions: add a note for or skip ${uncoveredWindowIds.join(", ")}.` };
              }
              recordWorkflowEvent("composition-rejected", "fill-composition", "warning", validated.message, { issues: validated.issues });
              return retryFillStageOrFinalize(validated.message);
            }
            const merged = mergeAcceptedFills(frozenFoundation, opportunityAnalysis, validated);
            const physicalErrors = physicalValidationErrors(merged, policy, melodyPlayability.melodyMaxFret);
            if (physicalErrors.length > 0) {
              const message = physicalErrors.join(" ");
              recordWorkflowEvent("composition-rejected", "fill-composition", "warning", message, { physicalErrors });
              return retryFillStageOrFinalize(message);
            }
            acceptedComposition = parsed.value;
            acceptedCompositionToon = fillsToon;
            acceptedFinalMeasures = merged;
            recordWorkflowEvent("composition-accepted", "fill-composition", "success", `Accepted ${parsed.value.entries.length} composed fill note(s).`, {
              entries: parsed.value.entries,
            });
            return { valid: true, message: "Composed fills accepted. Submit the exact same fills_toon payload." };
          },
        },
      ],
      validateFinalResult: args => {
        if (!acceptedCompositionToon || !acceptedComposition) {
          const message = "Validate composed fills before final submission.";
          recordWorkflowEvent("final-merge-rejected", "final-validation", "warning", message);
          return { valid: false, message, toolResult: { valid: false, message } };
        }
        return completeFinalOutput(toolPayloadString(args, "fills_toon"));
      },
      shouldComplete: () => Boolean(finalOutput),
      temperature: 0.25,
      maxIterations: 24,
      maxValidationAttempts: 3,
      requestTimeoutMs: 60_000,
      maxRequestAttempts: 2,
      maxDurationMs: 5 * 60_000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error during AI generation.";
    diagnosticSummary = { ...diagnosticSummary, outcome: "llm-failed", elapsedMs: Date.now() - startedAtMs };
    const diagnostics = await finalizeDiagnostics(diagnosticSummary);
    return { success: false, logs, diagnostics, fillSummary: fillSummary("failed"), error: message };
  }

  if (!finalOutput) {
    diagnosticSummary = { ...diagnosticSummary, outcome: "llm-failed", elapsedMs: Date.now() - startedAtMs };
    const diagnostics = await finalizeDiagnostics(diagnosticSummary);
    return { success: false, logs, diagnostics, fillSummary: fillSummary("failed"), error: "LLM failed to complete the staged fingerstyle workflow." };
  }

  diagnosticSummary = { ...diagnosticSummary, elapsedMs: Math.max(diagnosticSummary.elapsedMs, Date.now() - startedAtMs) };
  const diagnostics = await finalizeDiagnostics(diagnosticSummary);
  const completedOutput = finalOutput as GenerateFingerstyleLineOutput;
  return { ...completedOutput, diagnostics };
}
