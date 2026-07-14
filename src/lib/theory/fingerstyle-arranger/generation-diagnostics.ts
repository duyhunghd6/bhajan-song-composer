import type {
  FingerstyleDiagnosticEvent,
  FingerstyleDiagnosticOutcome,
  FingerstyleDiagnosticRun,
  FingerstyleDiagnosticScope,
} from "./dp-diagnostics";

export const FINGERSTYLE_GENERATION_DIAGNOSTIC_VERSION = 1 as const;

export type FingerstyleGenerationDiagnosticStatus =
  | "started"
  | "info"
  | "success"
  | "warning"
  | "failed";

interface FingerstyleGenerationDiagnosticEventBase {
  id: string;
  runId: string;
  sequence: number;
  createdAt: string;
  phase: string;
  status: FingerstyleGenerationDiagnosticStatus;
  message: string;
}

export interface FingerstyleLlmDiagnosticEvent
  extends FingerstyleGenerationDiagnosticEventBase {
  source: "llm";
  kind:
    | "chat-request"
    | "chat-response"
    | "chat-error"
    | "tool-call"
    | "tool-result"
    | "final-validation"
    | "loop-exhausted";
  iteration?: number;
  toolName?: string;
  toolCallNames?: string[];
  validationMessage?: string;
  payloadPreview?: unknown;
}

export interface FingerstyleWorkflowDiagnosticEvent
  extends FingerstyleGenerationDiagnosticEventBase {
  source: "workflow";
  kind:
    | "foundation-validated"
    | "foundation-rejected"
    | "opportunities-analyzed"
    | "opportunity-page-inspected"
    | "selection-accepted"
    | "selection-rejected"
    | "composition-accepted"
    | "composition-rejected"
    | "final-merge-validated"
    | "final-merge-rejected";
  payloadPreview?: unknown;
}

export interface FingerstyleDpDiagnosticEvent
  extends FingerstyleGenerationDiagnosticEventBase {
  source: "dp";
  kind: FingerstyleDiagnosticEvent["type"];
  dpEvent: FingerstyleDiagnosticEvent;
}

export type FingerstyleGenerationDiagnosticEvent =
  | FingerstyleLlmDiagnosticEvent
  | FingerstyleWorkflowDiagnosticEvent
  | FingerstyleDpDiagnosticEvent;

export interface FingerstyleGenerationDiagnosticSummary {
  outcome: FingerstyleDiagnosticOutcome | "llm-failed";
  inputEventCount: number;
  resolvedEventCount: number;
  unresolvedEventCount: number;
  changedEventCount: number;
  unchangedEventCount: number;
  totalCost: number | null;
  elapsedMs: number;
}

export interface FingerstyleDiagnosticPersistence {
  persisted: boolean;
  logPath?: string;
  error?: string;
}

export interface FingerstyleGenerationDiagnosticRun {
  version: typeof FINGERSTYLE_GENERATION_DIAGNOSTIC_VERSION;
  runId: string;
  startedAt: string;
  completedAt: string;
  scope: FingerstyleDiagnosticScope;
  events: FingerstyleGenerationDiagnosticEvent[];
  summary: FingerstyleGenerationDiagnosticSummary;
  /** Plaintext visualization intended for both human and LLM inspection. */
  plaintext: string;
  persistence: FingerstyleDiagnosticPersistence;
}

const CLIENT_DP_EVENT_TYPES = new Set<FingerstyleDiagnosticEvent["type"]>([
  "configuration",
  "input-extraction",
  "input-binding",
  "input-anomaly",
  "candidate-generation",
  "trellis-column",
  "recurring-shape",
  "fallback-noop",
  "backtrack-step",
  "pass-summary",
  "capo-tested",
  "capo-selected",
  "writeback",
  "fixed-entry-check",
  "validation",
  "rollback",
  "phase-timing",
  "run-summary",
  "truncation",
]);

function statusForDpEvent(
  event: FingerstyleDiagnosticEvent,
): FingerstyleGenerationDiagnosticStatus {
  if (event.severity === "error" || event.type === "rollback") return "failed";
  if (
    event.severity === "warning"
    || event.type === "fallback-noop"
    || event.type === "input-anomaly"
    || event.type === "truncation"
  ) return "warning";
  if (event.type === "run-summary") {
    return event.outcome === "accepted" || event.outcome === "no-effective-dp-change"
      ? "success"
      : event.outcome === "rolled-back" || event.outcome === "failed"
        ? "failed"
        : "warning";
  }
  return "info";
}

function messageForDpEvent(event: FingerstyleDiagnosticEvent): string {
  switch (event.type) {
    case "configuration":
      return `DP configuration: ${String(event.values.skillLevel)} skill, ${String(event.values.bpm)} BPM, capo ${String(event.values.capo)}.`;
    case "input-extraction":
      return `Extracted ${event.extractedEventCount} DP decision events from ${event.measureCount} measure(s).`;
    case "input-binding":
      return `Event ${event.eventIndex + 1}: measure ${event.measureIndex + 1}, step ${event.stepIndex + 1}, chord ${event.chord}.`;
    case "input-anomaly":
      return `Input anomaly: ${event.code}.`;
    case "candidate-generation":
      return `Event ${event.eventIndex + 1}: retained ${event.retainedCount}/${event.acceptedBeforeCap} feasible candidates after ${event.cartesianCombinationCount} combinations.`;
    case "viterbi-pass-started":
      return `${event.pass} started for ${event.eventCount} event(s) at capo ${event.capo}.`;
    case "transition-evaluated":
      return `Event ${event.eventIndex + 1}, candidate ${event.candidateIndex + 1}: cumulative cost ${event.cumulativeCost.toFixed(2)}.`;
    case "trellis-column":
      return `Event ${event.eventIndex + 1}: evaluated ${event.transitionCount} transition(s) across ${event.candidateCount} candidate(s).`;
    case "recurring-shape":
      return event.action === "established"
        ? `Established recurring ${event.chord} grip ${event.preferredShape}.`
        : `Evaluated recurring ${event.chord} grip preference${event.penalty ? ` (+${event.penalty})` : ""}.`;
    case "fallback-noop":
      return `Event ${event.eventIndex + 1}: no feasible candidate; original tablature will remain unresolved.`;
    case "backtrack-step":
      return `Selected event ${event.eventIndex + 1}, candidate ${event.candidateIndex + 1} at cumulative cost ${event.cumulativeCost.toFixed(2)}.`;
    case "pass-summary":
      return `${event.pass} completed at cost ${event.totalCost.toFixed(2)} with ${event.unresolvedEventCount} unresolved event(s).`;
    case "capo-tested":
      return `Capo ${event.capo}: cost ${event.totalCost.toFixed(2)}, ${event.unresolvedEventCount} unresolved event(s).`;
    case "capo-selected":
      return `Selected capo ${event.capo} after testing ${event.testedCount} position(s).`;
    case "writeback":
      return `Event ${event.eventIndex + 1} ${event.role} writeback: ${event.result}.`;
    case "fixed-entry-check":
      return `Fixed ${event.role} entry at measure ${event.measureIndex + 1}, step ${event.stepIndex + 1} ${event.unchanged ? "remained unchanged" : "changed unexpectedly"}.`;
    case "validation":
      return `Measure ${event.measureIndex + 1} validation: ${event.afterIssueCodes.length} issue type(s) after DP.`;
    case "rollback":
      return `DP writeback rolled back: ${event.reason}.`;
    case "phase-timing":
      return `${event.name} completed in ${event.elapsedMs} ms.`;
    case "run-summary":
      return `DP outcome ${event.outcome}: ${event.resolvedEventCount} resolved, ${event.unresolvedEventCount} unresolved, ${event.changedEventCount} changed.`;
    case "truncation":
      return `${event.omittedEventCount} diagnostic event(s) omitted by the ${event.reason}.`;
  }
}

export function projectDpDiagnosticEvents(
  runId: string,
  diagnostics: FingerstyleDiagnosticRun,
  startSequence: number,
  maxEvents = 700,
): FingerstyleDpDiagnosticEvent[] {
  const selected = diagnostics.events.filter((event) => (
    CLIENT_DP_EVENT_TYPES.has(event.type)
    || (event.type === "transition-evaluated" && event.selectedForCandidate)
  ));
  const bounded = selected.length > maxEvents
    ? [
        ...selected.filter((event) => (
          event.type === "configuration"
          || event.type === "input-anomaly"
          || event.type === "fallback-noop"
          || event.type === "backtrack-step"
          || event.type === "validation"
          || event.type === "rollback"
          || event.type === "run-summary"
        )),
        ...selected.slice(-Math.floor(maxEvents / 2)),
      ]
    : selected;
  const unique = [...new Map(bounded.map((event) => [event.sequence, event])).values()]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-maxEvents);

  return unique.map((event, index) => ({
    id: `${runId}-dp-${event.sequence}`,
    runId,
    sequence: startSequence + index,
    createdAt: event.timestamp,
    source: "dp",
    kind: event.type,
    phase: event.phase,
    status: statusForDpEvent(event),
    message: messageForDpEvent(event),
    dpEvent: event,
  }));
}

export function summaryFromDpRun(
  diagnostics: FingerstyleDiagnosticRun,
  fallbackElapsedMs: number,
): FingerstyleGenerationDiagnosticSummary {
  const summary = [...diagnostics.events]
    .reverse()
    .find((event): event is Extract<FingerstyleDiagnosticEvent, { type: "run-summary" }> => (
      event.type === "run-summary"
    ));

  return summary
    ? {
        outcome: summary.outcome,
        inputEventCount: summary.inputEventCount,
        resolvedEventCount: summary.resolvedEventCount,
        unresolvedEventCount: summary.unresolvedEventCount,
        changedEventCount: summary.changedEventCount,
        unchangedEventCount: summary.unchangedEventCount,
        totalCost: summary.totalCost,
        elapsedMs: summary.elapsedMs,
      }
    : {
        outcome: diagnostics.outcome ?? "failed",
        inputEventCount: 0,
        resolvedEventCount: 0,
        unresolvedEventCount: 0,
        changedEventCount: 0,
        unchangedEventCount: 0,
        totalCost: null,
        elapsedMs: fallbackElapsedMs,
      };
}
