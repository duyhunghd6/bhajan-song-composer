import type {
  FingerstyleGenerationDiagnosticEvent,
  FingerstyleGenerationDiagnosticRun,
  FingerstyleGenerationDiagnosticSummary,
} from "./generation-diagnostics";

interface PlaintextDiagnosticInput {
  runId: string;
  startedAt: string;
  completedAt: string;
  scope: FingerstyleGenerationDiagnosticRun["scope"];
  events: FingerstyleGenerationDiagnosticEvent[];
  summary: FingerstyleGenerationDiagnosticSummary;
}

function mark(status: FingerstyleGenerationDiagnosticEvent["status"]): string {
  return status === "success" ? "[OK]" : status === "warning" ? "[!!]" : status === "failed" ? "[XX]" : "[--]";
}

/** A bounded, copyable summary; detailed source/grid/prompt payloads never enter this view. */
export function renderFingerstyleDiagnosticPlaintext(input: PlaintextDiagnosticInput): string {
  const lines = [
    "FINGERSTYLE LLM + TIMEGRID WORKFLOW DIAGNOSTICS",
    `Run: ${input.runId}`,
    `Scope: ${input.scope.songSlug ?? "song"}, line ${input.scope.lineIndex ?? "-"}, measures ${(input.scope.measureIndexes ?? []).join(", ") || "-"}`,
    "",
    "TIMELINE",
  ];
  for (const event of input.events) {
    const iteration = "iteration" in event && typeof event.iteration === "number" ? ` i${event.iteration + 1}` : "";
    lines.push(`${mark(event.status)}${iteration} ${event.source}/${event.phase}/${event.kind}: ${event.message}`);
  }
  lines.push(
    "",
    "SUMMARY",
    `Outcome: ${input.summary.outcome}`,
    `Events: ${input.summary.resolvedEventCount} resolved, ${input.summary.unresolvedEventCount} unresolved, ${input.summary.changedEventCount} repositioned.`,
    `Elapsed: ${input.summary.elapsedMs}ms`,
    `Completed: ${input.completedAt}`,
  );
  return lines.join("\n");
}
