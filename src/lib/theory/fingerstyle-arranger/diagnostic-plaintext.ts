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
  const workflowEvents = input.events.filter(event => event.source === "workflow" || event.source === "placement");
  const section = (title: string, kinds: string[]) => {
    const entries = workflowEvents.filter(event => kinds.includes(event.kind));
    if (entries.length === 0) return;
    lines.push("", title, ...entries.map(event => `- ${event.message}`));
  };
  section("NOTE FILLS POSITION", ["fill-reservations-accepted", "fill-reservations-reconciled"]);
  section("BASS POSITIONS IN SOURCE ABC", ["bass-positions-accepted", "bass-source-abc-annotated"]);
  section("CHORD-DERIVED BASS NOTES", ["bass-pitches-accepted"]);
  section("TIMEGRID / ASCII / GUITAR ABC", ["timegrid-materialized", "abc-ascii-guitartab-validated", "abc-ascii-guitartab-rejected", "final-merge-validated", "final-merge-rejected"]);
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
