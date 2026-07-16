export const FINGERSTYLE_GENERATION_DIAGNOSTIC_VERSION = 2 as const;

export type FingerstyleGenerationDiagnosticStatus = "started" | "info" | "success" | "warning" | "failed";
export type FingerstylePlacementOutcome = "accepted" | "accepted-with-unresolved-events" | "no-effective-change" | "failed" | "llm-failed";

export interface FingerstyleDiagnosticScope {
  songSlug?: string;
  lineIndex?: number;
  measureIndexes?: number[];
  sourceFingerprint?: string;
}

interface EventBase {
  id: string;
  runId: string;
  sequence: number;
  createdAt: string;
  phase: string;
  status: FingerstyleGenerationDiagnosticStatus;
  message: string;
  payloadPreview?: unknown;
}

export interface FingerstyleLlmDiagnosticEvent extends EventBase {
  source: "llm";
  kind: "chat-request" | "chat-response" | "chat-error" | "tool-call" | "tool-result" | "final-validation" | "loop-exhausted" | "context-budget-exceeded";
  iteration?: number;
  toolName?: string;
  toolCallNames?: string[];
  validationMessage?: string;
}

export interface FingerstyleWorkflowDiagnosticEvent extends EventBase {
  source: "workflow" | "placement";
  kind:
    | "foundation-validated" | "foundation-rejected" | "foundation-placed"
    | "fill-reservations-analyzed" | "fill-reservations-accepted" | "fill-reservations-rejected" | "fill-reservations-reconciled"
    | "bass-positions-analyzed" | "bass-positions-accepted" | "bass-positions-rejected" | "bass-source-abc-annotated"
    | "bass-pitches-analyzed" | "bass-pitches-accepted" | "bass-pitches-rejected" | "timegrid-materialized"
    | "opportunities-analyzed" | "opportunity-page-inspected" | "fill-stages-skipped"
    | "selection-accepted" | "selection-rejected"
    | "composition-accepted" | "composition-rejected"
    | "final-merge-validated" | "final-merge-rejected"
    | "abc-ascii-guitartab-validated" | "abc-ascii-guitartab-rejected";
}

export type FingerstyleGenerationDiagnosticEvent = FingerstyleLlmDiagnosticEvent | FingerstyleWorkflowDiagnosticEvent;

export interface FingerstyleGenerationDiagnosticSummary {
  outcome: FingerstylePlacementOutcome;
  inputEventCount: number;
  resolvedEventCount: number;
  unresolvedEventCount: number;
  changedEventCount: number;
  unchangedEventCount: number;
  totalCost: null;
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
  plaintext: string;
  persistence: FingerstyleDiagnosticPersistence;
}
