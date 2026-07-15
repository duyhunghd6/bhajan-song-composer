import { requestOpenAiCompatibleToolLoop, type ToolDiagnosticEvent } from "../ai-config";
import {
  buildFingerstyleTablatureToolDefinition,
  executeGuitarVoicingQuery,
  GUITAR_VOICING_TOOL_DEFINITION,
  INSPECT_FILL_OPPORTUNITIES_TOOL_DEFINITION,
  SELECT_FILL_WINDOWS_TOOL_DEFINITION,
  SUBMIT_ARRANGED_LINE_TOOL_DEFINITION,
  VALIDATE_COMPOSED_FILLS_TOOL_DEFINITION,
} from "../fingerstyle-tool-contract";
import {
  persistFingerstyleDiagnosticRecords,
  type FingerstyleStoredDiagnosticRecord,
} from "../fingerstyle-diagnostics";
import { applyDPToTimeSliceMeasures } from "@/lib/theory/fingerstyle-arranger/dp-integration";
import { applyHeuristicToTimeSliceMeasures } from "@/lib/theory/fingerstyle-arranger/heuristic-time-slice";
import { createFingerstyleDiagnosticRunId } from "@/lib/theory/fingerstyle-arranger/dp-diagnostics";
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
  projectDpDiagnosticEvents,
  summaryFromDpRun,
  type FingerstyleGenerationDiagnosticEvent,
  type FingerstyleGenerationDiagnosticRun,
  type FingerstyleGenerationDiagnosticSummary,
  type FingerstyleWorkflowDiagnosticEvent,
} from "@/lib/theory/fingerstyle-arranger/generation-diagnostics";
import { renderFingerstyleDiagnosticPlaintext } from "@/lib/theory/fingerstyle-arranger/diagnostic-plaintext";
import { applyFingerstyleTablatureToon } from "@/lib/theory/fingerstyle-arranger/llm-codec";
import { midiForStringFret, parseScientificPitch } from "@/lib/theory/guitar-playability";
import { validateFingerstylePhysics } from "@/lib/theory/fingerstyle-arranger/physics-validation";
import { analyzeAuthoritativeMelodyPlayability } from "@/lib/theory/fingerstyle-arranger/source-playability";
import { renderAsciiGuitarTab } from "@/lib/theory/fingerstyle-arranger/toon-utils";
import {
  validateGuitarAbcAgainstAsciiGuitarTab,
  formatAbcAsciiGuitarTabValidation,
} from "@/lib/theory/fingerstyle-arranger/abc-ascii-guitartab-validation";
import { buildAbcDurationContext } from "@/lib/theory/abc-duration";
import { getKeyAccidentalsFromAbc } from "@/lib/theory/abc-key-signature";
import {
  convertTimeSliceMeasureToAbc,
  joinMeasureAbcWithBarlines,
  type TimeSliceMeasure,
} from "@/lib/theory/fingerstyle-arranger/time-slice";

import {
  boundedToolDiagnostic,
  compactDiagnosticPayload,
  makeLlmDiagnosticEvent,
} from "./diagnostics";
import { buildLineSystemPrompt, buildLineUserPrompt } from "./prompts";
import type {
  FingerstyleFillGenerationSummary,
  GenerateFingerstyleLineInput,
  GenerateFingerstyleLineOutput,
} from "./types";

function parseAbcTempo(abc: string, fallback = 120): number {
  const match = abc.match(/^\s*Q:\s*(?:\d+\/\d+=)?(\d+)/m);
  const bpm = match ? Number.parseInt(match[1], 10) : fallback;
  return Number.isFinite(bpm) && bpm > 0 && bpm <= 600 ? bpm : fallback;
}

function validateFoundation(
  measures: TimeSliceMeasure[],
  skillLevel: GenerateFingerstyleLineInput["skillLevel"],
  maxMelodyFret: number,
): string[] {
  const errors: string[] = [];
  for (const measure of measures) {
    for (const step of measure.grid) {
      const events = step.tablature ?? [];
      if (events.some(event => event.role === "fill")) {
        errors.push(`Measure ${measure.measure} step ${step.step}: foundation must not contain role=fill.`);
      }
      const melodyEvents = events.filter(event => event.role === "melody");
      if (step.melody.state !== "attack" && step.weight === null && events.length > 0) {
        errors.push(`Measure ${measure.measure} step ${step.step}: unweighted rest/sustain attacks are reserved for the scored fill stage.`);
      }
      if (step.melody.state === "attack" && melodyEvents.length !== 1) {
        errors.push(`Measure ${measure.measure} step ${step.step}: melody attack requires exactly one role=melody event.`);
      }
      if (step.melody.state !== "attack" && melodyEvents.length > 0) {
        errors.push(`Measure ${measure.measure} step ${step.step}: role=melody may appear only on melody attacks.`);
      }
    }
    const physics = validateFingerstylePhysics(measure.grid, {
      fillDensity: "none",
      skillLevel: skillLevel ?? "beginner",
      maxMelodyFret,
    });
    if (!physics.valid) errors.push(`Measure ${measure.measure}: ${physics.message}`);
  }
  return errors;
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

function countMelodyPositionRepairs(
  sourceMeasures: readonly TimeSliceMeasure[],
  submittedMeasures: readonly TimeSliceMeasure[],
): number {
  let repairs = 0;
  for (let measureIndex = 0; measureIndex < sourceMeasures.length; measureIndex++) {
    const sourceMeasure = sourceMeasures[measureIndex];
    const submittedMeasure = submittedMeasures[measureIndex];
    if (!submittedMeasure) continue;
    for (let stepIndex = 0; stepIndex < sourceMeasure.grid.length; stepIndex++) {
      const sourceStep = sourceMeasure.grid[stepIndex];
      const submittedStep = submittedMeasure.grid[stepIndex];
      const melody = submittedStep?.tablature?.find(event => event.role === "melody");
      const authoritativeMidi = sourceStep.melody.pitch
        ? parseScientificPitch(sourceStep.melody.pitch)?.midi ?? null
        : null;
      if (melody && authoritativeMidi !== null && midiForStringFret(melody.string, melody.fret) !== authoritativeMidi) {
        repairs++;
      }
    }
  }
  return repairs;
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

function toolPayloadString(args: unknown, key: string): string | null {
  const value = (args as Record<string, unknown> | null)?.[key];
  return typeof value === "string" ? value.trim() : null;
}

export async function runFingerstyleLineWorkflow(
  input: GenerateFingerstyleLineInput,
): Promise<GenerateFingerstyleLineOutput> {
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const runId = createFingerstyleDiagnosticRunId();
  const lineIndex = input.lineMeasures[0]?.lineIndex ?? input.previousLines.length;
  const measureNumbers = input.lineMeasures.map(measure => measure.measure);
  const sourceMelody = snapshotMelodySource(input.lineMeasures);
  const policy = normalizeFillPolicy(input);
  const arrangementOptimization = input.arrangementOptimization ?? "heuristic";
  const melodyPlayability = analyzeAuthoritativeMelodyPlayability(input.lineMeasures, policy.skillLevel);
  const bpm = parseAbcTempo(input.activeAbc);
  const dpOptions = {
    skillLevel: policy.skillLevel,
    maxMelodyFret: melodyPlayability.melodyMaxFret,
    autoCapo: false,
    capo: 0,
  } as const;
  const systemPrompt = buildLineSystemPrompt();
  const userPrompt = buildLineUserPrompt(input, melodyPlayability);
  const tools = [
    GUITAR_VOICING_TOOL_DEFINITION,
    buildFingerstyleTablatureToolDefinition(
      "submit_fingerstyle_foundation",
      "Validate, DP-position, and freeze the complete non-fill foundation before fill analysis.",
    ),
    INSPECT_FILL_OPPORTUNITIES_TOOL_DEFINITION,
    SELECT_FILL_WINDOWS_TOOL_DEFINITION,
    VALIDATE_COMPOSED_FILLS_TOOL_DEFINITION,
    SUBMIT_ARRANGED_LINE_TOOL_DEFINITION,
  ];

  let frozenFoundation: TimeSliceMeasure[] | null = null;
  let opportunityAnalysis: FillOpportunityAnalysis | null = null;
  let nextInspectionCursor: number | null = 0;
  let acceptedSelection: FillSelection | null = null;
  let acceptedComposition: FillComposition | null = null;
  let acceptedCompositionToon: string | null = null;
  let acceptedFinalMeasures: TimeSliceMeasure[] | null = null;
  let finalOutput: GenerateFingerstyleLineOutput | null = null;
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
        lineMeasures: input.lineMeasures,
        previousLines: input.previousLines,
        nextLineMeasures: input.nextLineMeasures,
        activeAbc: input.activeAbc,
        systemPrompt,
        userPrompt,
        tools,
      },
      conditioning: {
        policy,
        bpm,
        melodyPlayability,
        finalToolName: "submit_arranged_line",
        temperature: 0.25,
        maxIterations: 24,
        maxValidationAttempts: 3,
        requestTimeoutMs: 60_000,
        maxRequestAttempts: 2,
        maxDurationMs: 5 * 60_000,
        dpOptions,
        arrangementOptimization,
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
      finalToolName: "submit_arranged_line",
      onDiagnostic: recordLlmDiagnostic,
      localTools: [
        { name: "query_guitar_voicings", execute: executeGuitarVoicingQuery },
        {
          name: "submit_fingerstyle_foundation",
          execute: args => {
            frozenFoundation = null;
            opportunityAnalysis = null;
            nextInspectionCursor = 0;
            acceptedSelection = null;
            acceptedComposition = null;
            acceptedCompositionToon = null;
            acceptedFinalMeasures = null;
            const decoded = applyFingerstyleTablatureToon(toolPayloadString(args, "tablature_toon"), input.lineMeasures);
            if (!decoded.ok) {
              recordWorkflowEvent("foundation-rejected", "foundation", "warning", decoded.error.message, decoded.error);
              return { valid: false, code: decoded.error.code, message: decoded.error.message };
            }
            const decodedSourceDrift = sourceMelodyDrift(sourceMelody, decoded.measures);
            if (decodedSourceDrift.length > 0) {
              const message = `Source-pinned melody changed before optimization: ${decodedSourceDrift.join(" ")}`;
              recordWorkflowEvent("foundation-rejected", "foundation", "warning", message, { errors: decodedSourceDrift });
              return { valid: false, message };
            }
            const submittedMelodyRepairs = countMelodyPositionRepairs(input.lineMeasures, decoded.measures);
            const errors = validateFoundation(decoded.measures, policy.skillLevel, melodyPlayability.melodyMaxFret);
            if (errors.length > 0) {
              const message = errors.join(" ");
              recordWorkflowEvent("foundation-rejected", "foundation", "warning", message, { errors });
              return { valid: false, message, repair: "Resubmit a complete tablature:v1 foundation with no fill rows." };
            }
            try {
              const optimizationResult = arrangementOptimization === "dynamic-programming"
                ? applyDPToTimeSliceMeasures(decoded.measures, bpm, dpOptions)
                : applyHeuristicToTimeSliceMeasures(decoded.measures, {
                  bpm,
                  skillLevel: policy.skillLevel,
                  maxMelodyFret: melodyPlayability.melodyMaxFret,
                });
              logs.push(...optimizationResult.logs);
              diagnosticEvents.push(...projectDpDiagnosticEvents(runId, optimizationResult.diagnostics, diagnosticEvents.length));
              for (const event of optimizationResult.diagnostics.events) {
                storedRecords.push({ type: "dp-event", timestamp: event.timestamp, runId, payload: event });
              }
              diagnosticSummary = summaryFromDpRun(optimizationResult.diagnostics, Date.now() - startedAtMs);
              if (diagnosticSummary.outcome === "rolled-back" || diagnosticSummary.unresolvedEventCount > 0) {
                const message = `Foundation ${arrangementOptimization} did not resolve every required event (${diagnosticSummary.outcome}, unresolved=${diagnosticSummary.unresolvedEventCount}).`;
                recordWorkflowEvent("foundation-rejected", "foundation", "warning", message, diagnosticSummary);
                return { valid: false, message };
              }
              const optimizedSourceDrift = sourceMelodyDrift(sourceMelody, optimizationResult.measures);
              if (optimizedSourceDrift.length > 0) {
                const message = `Source-pinned melody changed during ${arrangementOptimization}: ${optimizedSourceDrift.join(" ")}`;
                recordWorkflowEvent("foundation-rejected", "foundation", "failed", message, { errors: optimizedSourceDrift });
                return { valid: false, message };
              }
              frozenFoundation = freezeFoundationDurations(optimizationResult.measures);
              recordWorkflowEvent("foundation-validated", "foundation", "success", `Foundation frozen after ${arrangementOptimization} at ${bpm} BPM using ${policy.skillLevel} accompaniment constraints.`, {
                measureCount: frozenFoundation.length,
                arrangementOptimization,
                dpOutcome: diagnosticSummary.outcome,
                maxMelodyFret: melodyPlayability.melodyMaxFret,
                melodySource: "authoritative-source-grid",
                submittedMelodyRepairs,
              });
              return { valid: true, message: "Foundation accepted and frozen. Inspect fill opportunities next.", bpm, policy, arrangementOptimization, dpOutcome: diagnosticSummary.outcome };
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              recordWorkflowEvent("foundation-rejected", "foundation", "failed", `DP failed: ${message}`);
              return { valid: false, message: `Foundation DP failed: ${message}` };
            }
          },
          maxInvalidResults: 3,
        },
        {
          name: "inspect_fill_opportunities",
          execute: args => {
            if (!frozenFoundation) return { valid: false, message: "Submit and freeze the foundation first." };
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
            return page.toon;
          },
          maxInvalidResults: 3,
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
              return { valid: false, message };
            }
            const validated = validateFillSelection(opportunityAnalysis, parsed.value);
            if (!validated.valid) {
              const message = validated.errors.join(" ");
              recordWorkflowEvent("selection-rejected", "fill-selection", "warning", message, { errors: validated.errors });
              return { valid: false, message };
            }
            acceptedSelection = parsed.value;
            acceptedComposition = null;
            acceptedCompositionToon = null;
            acceptedFinalMeasures = null;
            recordWorkflowEvent("selection-accepted", "fill-selection", "success", `Accepted ${validated.selectedWindowIds.length} selected fill window(s).`, {
              selectedWindowIds: validated.selectedWindowIds,
              targetWindows: opportunityAnalysis.budget.targetWindows,
              maxWindows: opportunityAnalysis.budget.maxWindows,
            });
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
              return { valid: false, message };
            }
            const validated = validateFillComposition(opportunityAnalysis, acceptedSelection, parsed.value);
            if (!validated.valid) {
              recordWorkflowEvent("composition-rejected", "fill-composition", "warning", validated.message, { issues: validated.issues });
              return { valid: false, message: validated.message };
            }
            const merged = mergeAcceptedFills(frozenFoundation, opportunityAnalysis, validated);
            const physicalErrors = physicalValidationErrors(merged, policy, melodyPlayability.melodyMaxFret);
            if (physicalErrors.length > 0) {
              const message = physicalErrors.join(" ");
              recordWorkflowEvent("composition-rejected", "fill-composition", "warning", message, { physicalErrors });
              return { valid: false, message };
            }
            acceptedComposition = parsed.value;
            acceptedCompositionToon = fillsToon;
            acceptedFinalMeasures = merged;
            recordWorkflowEvent("composition-accepted", "fill-composition", "success", `Accepted ${parsed.value.entries.length} composed fill note(s).`, {
              entries: parsed.value.entries,
            });
            return { valid: true, message: "Composed fills accepted. Submit the exact same fills_toon payload." };
          },
          maxInvalidResults: 3,
        },
      ],
      validateFinalResult: args => {
        const fillsToon = toolPayloadString(args, "fills_toon");
        if (!acceptedCompositionToon || !acceptedFinalMeasures || !acceptedComposition) {
          const message = "Validate composed fills before final submission.";
          recordWorkflowEvent("final-merge-rejected", "final-validation", "warning", message);
          return { valid: false, message, toolResult: { valid: false, message } };
        }
        if (fillsToon !== acceptedCompositionToon) {
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
        const guitarAbc = joinMeasureAbcWithBarlines(
          acceptedFinalMeasures.map(measure => convertTimeSliceMeasureToAbc(
            measure,
            durationContext,
            keyAccidentals,
            true,
          )),
          acceptedFinalMeasures,
        );
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
        finalOutput = { success: true, measures: acceptedFinalMeasures, logs, fillSummary: completedFillSummary };
        return { valid: true };
      },
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
