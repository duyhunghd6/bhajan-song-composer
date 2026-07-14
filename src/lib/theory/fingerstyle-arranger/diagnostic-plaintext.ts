import type { FingerstyleDiagnosticEvent } from "./dp-diagnostics";
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

const WIDTH = 104;

function rule(char = "="): string {
  return char.repeat(WIDTH);
}

function cell(value: unknown, width: number): string {
  const text = String(value ?? "-");
  return text.length > width
    ? `${text.slice(0, Math.max(0, width - 1))}…`
    : text.padEnd(width);
}

function formatCost(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "INF";
}

function issueCounts(event: Extract<FingerstyleDiagnosticEvent, { type: "candidate-generation" }>): string {
  const entries = Object.entries(event.rejectionCounts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);
  return entries.length === 0
    ? "none"
    : entries.map(([reason, count]) => `${reason}=${count}`).join(", ");
}

function statusMark(status: FingerstyleGenerationDiagnosticEvent["status"]): string {
  switch (status) {
    case "success": return "[OK]";
    case "warning": return "[!!]";
    case "failed": return "[XX]";
    case "started": return "[>>]";
    default: return "[--]";
  }
}

function renderLlmTimeline(events: FingerstyleGenerationDiagnosticEvent[]): string[] {
  const llmEvents = events.filter(event => event.source === "llm");
  const lines = ["LLM TOOL-LOOP TIMELINE", rule("-")];
  if (llmEvents.length === 0) return [...lines, "(no LLM events recorded)"];
  for (const event of llmEvents) {
    const iteration = typeof event.iteration === "number" ? ` i${event.iteration + 1}` : "";
    lines.push(`${statusMark(event.status)}${iteration} ${event.kind}: ${event.message}`);
  }
  return lines;
}

function renderWorkflowTimeline(events: FingerstyleGenerationDiagnosticEvent[]): string[] {
  const workflowEvents = events.filter(event => event.source === "workflow");
  const lines = ["FOUNDATION + FILL WORKFLOW TIMELINE", rule("-")];
  if (workflowEvents.length === 0) return [...lines, "(no staged workflow events recorded)"];
  for (const event of workflowEvents) {
    lines.push(`${statusMark(event.status)} ${event.phase}/${event.kind}: ${event.message}`);
  }
  return lines;
}

function renderConfiguration(dpEvents: FingerstyleDiagnosticEvent[]): string[] {
  const config = dpEvents.find((event): event is Extract<FingerstyleDiagnosticEvent, { type: "configuration" }> => (
    event.type === "configuration"
  ));
  const lines = ["DP INPUTS AND EFFECTIVE CONDITIONS", rule("-")];
  if (!config) return [...lines, "(configuration event missing)"];
  const keys = [
    "bpm",
    "skillLevel",
    "capo",
    "autoCapo",
    "maxCapo",
    "candidateCap",
    "recurringShapeMismatchCost",
  ];
  for (const key of keys) {
    const source = config.provenance[key] ?? "unknown";
    lines.push(`${cell(key, 30)} = ${JSON.stringify(config.values[key])}  <${source}>`);
  }
  lines.push(`skillConstraints               = ${JSON.stringify(config.values.skillConstraints)}`);
  lines.push(`tuningMidi                     = ${JSON.stringify(config.values.tuningMidi)}`);
  lines.push(`costConstants                  = ${JSON.stringify(config.values.costConstants)}`);
  return lines;
}

function renderPhaseTimeline(events: FingerstyleGenerationDiagnosticEvent[]): string[] {
  const phases = new Map<string, { count: number; warnings: number; failures: number; elapsedMs: number }>();
  for (const event of events) {
    const state = phases.get(event.phase) ?? { count: 0, warnings: 0, failures: 0, elapsedMs: 0 };
    state.count += 1;
    if (event.status === "warning") state.warnings += 1;
    if (event.status === "failed") state.failures += 1;
    if (event.source === "dp" && event.dpEvent.type === "phase-timing") {
      state.elapsedMs += event.dpEvent.elapsedMs;
    }
    phases.set(event.phase, state);
  }
  const preferredOrder = [
    "llm-tool-loop",
    "configuration",
    "extraction",
    "candidate-generation",
    "establish-grips",
    "grip-memory",
    "apply-grip-preferences",
    "backtrack",
    "writeback",
    "validation",
    "rollback",
    "summary",
  ];
  const ordered = [...phases.entries()].sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left[0]);
    const rightIndex = preferredOrder.indexOf(right[0]);
    return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex);
  });
  const lines = ["PROCESSING PHASES", rule("-")];
  for (const [phase, state] of ordered) {
    const mark = state.failures > 0 ? "[XX]" : state.warnings > 0 ? "[!!]" : "[OK]";
    const duration = state.elapsedMs > 0 ? ` ${state.elapsedMs}ms` : "";
    lines.push(`${mark} ${cell(phase, 28)} events=${String(state.count).padStart(4)} warnings=${String(state.warnings).padStart(3)} failures=${String(state.failures).padStart(3)}${duration}`);
  }
  return lines;
}

function renderEventInputs(dpEvents: FingerstyleDiagnosticEvent[]): string[] {
  const bindings = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "input-binding" }> => (
    event.type === "input-binding"
  ));
  const lines = [
    "DP DECISION INPUTS",
    rule("-"),
    `${cell("Ev", 4)} ${cell("M/S", 9)} ${cell("Chord", 10)} ${cell("Mel MIDI", 10)} ${cell("Bass MIDI", 10)} ${cell("Onset", 7)} ${cell("Move", 7)} ${cell("Dur", 6)} Fixed frets (6→1)`,
  ];
  for (const event of bindings) {
    lines.push(
      `${cell(event.eventIndex + 1, 4)} ${cell(`${event.measureIndex + 1}/${event.stepIndex + 1}`, 9)} ${cell(event.chord, 10)} ${cell(event.effectiveMelodyMidi, 10)} ${cell(event.bassMidi, 10)} ${cell(event.absoluteOnsetStep, 7)} ${cell(event.movementSteps, 7)} ${cell(event.durationSteps, 6)} ${event.fixedFrets.map(fret => fret ?? "x").join(":")}`,
    );
    lines.push(`     pitch-source: authoritative=${event.authoritativeMelodyMidi ?? "-"}, submitted=${event.submittedMelodyMidi ?? "-"}, movement=${event.movementSeconds.toFixed(3)}s`);
  }
  return bindings.length === 0 ? [...lines, "(no input bindings recorded)"] : lines;
}

function renderCandidateFunnels(dpEvents: FingerstyleDiagnosticEvent[]): string[] {
  const generations = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "candidate-generation" }> => (
    event.type === "candidate-generation"
  ));
  const lines = ["CANDIDATE FUNNELS", rule("-")];
  for (const pass of ["establish-grips", "apply-grip-preferences"] as const) {
    lines.push(`PASS: ${pass}`);
    const passEvents = generations.filter(event => event.pass === pass);
    for (const event of passEvents) {
      lines.push(
        `  E${String(event.eventIndex + 1).padStart(2, "0")} positions(m/b)=${event.melodyPositionsAccepted}/${event.bassPositionsAccepted} combinations=${event.cartesianCombinationCount} feasible=${event.acceptedBeforeCap} retained=${event.retainedCount} pruned=${event.prunedByCapCount}`,
      );
      lines.push(`      rejected: ${issueCounts(event)}`);
      lines.push(`      retained: ${event.retainedCandidates.map((candidate, index) => (
        `C${index + 1}[m:s${candidate.melodyString ?? "-"}/f${candidate.melodyFret},b:s${candidate.bassString ?? "-"}/f${candidate.bassFret},pos:${candidate.handPosition},shape:${candidate.shapeFrets.map(fret => fret ?? "x").join(":")}]`
      )).join(" ") || "none"}`);
    }
  }
  return lines;
}

function renderTrellis(dpEvents: FingerstyleDiagnosticEvent[]): string[] {
  const generations = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "candidate-generation" }> => (
    event.type === "candidate-generation"
  ));
  const transitions = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "transition-evaluated" }> => (
    event.type === "transition-evaluated" && event.selectedForCandidate
  ));
  const backtracks = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "backtrack-step" }> => (
    event.type === "backtrack-step"
  ));
  const fallbacks = new Set(dpEvents
    .filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "fallback-noop" }> => event.type === "fallback-noop")
    .map(event => `${event.pass}:${event.eventIndex}`));
  const lines = [
    "VITERBI TRELLIS (cumulative cost; * = selected final path; ! = unresolved fallback)",
    rule("-"),
  ];

  for (const pass of ["establish-grips", "apply-grip-preferences"] as const) {
    lines.push(`PASS: ${pass}`);
    const passGenerations = generations.filter(event => event.pass === pass);
    const maxCandidates = Math.max(1, ...passGenerations.map(event => event.retainedCount));
    const visibleCandidates = Math.min(maxCandidates, 20);
    lines.push(`      ${Array.from({ length: visibleCandidates }, (_, index) => cell(`C${index + 1}`, 9)).join(" ")}`);
    for (const generation of passGenerations) {
      const selectedIndex = backtracks.find(event => (
        event.pass === pass && event.eventIndex === generation.eventIndex
      ))?.candidateIndex;
      const values = Array.from({ length: visibleCandidates }, (_, candidateIndex) => {
        const transition = transitions.find(event => (
          event.pass === pass
          && event.eventIndex === generation.eventIndex
          && event.candidateIndex === candidateIndex
        ));
        if (!transition) return cell(".", 9);
        const selected = candidateIndex === selectedIndex ? "*" : " ";
        return cell(`${formatCost(transition.cumulativeCost)}${selected}`, 9);
      });
      const unresolved = fallbacks.has(`${pass}:${generation.eventIndex}`) ? " !" : "";
      lines.push(`E${String(generation.eventIndex + 1).padStart(3, "0")}${unresolved.padEnd(2)} ${values.join(" ")}`);
    }
  }
  return lines;
}

function renderSelectedPathAndCosts(dpEvents: FingerstyleDiagnosticEvent[]): string[] {
  const backtracks = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "backtrack-step" }> => (
    event.type === "backtrack-step" && event.pass === "apply-grip-preferences"
  )).sort((left, right) => left.eventIndex - right.eventIndex);
  const transitions = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "transition-evaluated" }> => (
    event.type === "transition-evaluated" && event.pass === "apply-grip-preferences" && event.selectedForCandidate
  ));
  const lines = ["SELECTED PATH AND COST BREAKDOWN", rule("-")];
  for (const step of backtracks) {
    const transition = transitions.find(event => (
      event.eventIndex === step.eventIndex && event.candidateIndex === step.candidateIndex
    ));
    const candidate = step.candidate;
    lines.push(
      `E${String(step.eventIndex + 1).padStart(2, "0")} C${String(step.candidateIndex + 1).padStart(2, "0")} origin=${candidate.origin} melody=s${candidate.melodyString ?? "-"}/f${candidate.melodyFret} bass=s${candidate.bassString ?? "-"}/f${candidate.bassFret} pos=${candidate.handPosition} tech=${candidate.technique}`,
    );
    if (transition) {
      const cost = transition.transition;
      lines.push(
        `     cost: movement=${formatCost(cost.movement.cost)} shape=${formatCost(cost.shape.cost)} sustain=${formatCost(cost.sustain.cost)} technique=${formatCost(cost.techniqueCost)} barre=${formatCost(cost.barre.cost)} placement=${formatCost(cost.placement.cost)} skill×${formatCost(cost.skill.multiplier)} recurring=${formatCost(cost.recurringShape.penalty)} total=${formatCost(cost.totalCost)} cumulative=${formatCost(transition.cumulativeCost)}`,
      );
      lines.push(
        `     movement: ${cost.movement.classification}, ${cost.movement.distance} fret(s), available=${cost.movement.availableSeconds.toFixed(3)}s, estimated=${cost.movement.estimatedJumpSeconds.toFixed(3)}s; shape=${cost.shape.classification}; interrupted-strings=${cost.sustain.interruptedStringIndexes.join(",") || "none"}`,
      );
    }
  }
  return backtracks.length === 0 ? [...lines, "(no selected path recorded)"] : lines;
}

function renderWritebackAndValidation(dpEvents: FingerstyleDiagnosticEvent[]): string[] {
  const writes = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "writeback" }> => (
    event.type === "writeback"
  ));
  const validations = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "validation" }> => (
    event.type === "validation"
  ));
  const rollbacks = dpEvents.filter((event): event is Extract<FingerstyleDiagnosticEvent, { type: "rollback" }> => (
    event.type === "rollback"
  ));
  const lines = ["WRITEBACK AND VALIDATION", rule("-")];
  for (const event of writes) {
    lines.push(
      `${event.result === "rejected" ? "[XX]" : event.result === "unresolved" ? "[!!]" : "[OK]"} E${event.eventIndex + 1} M${event.measureIndex + 1}/S${event.stepIndex + 1} ${event.role}: s${event.submitted.string}/f${event.submitted.fret} -> s${event.selected.string ?? "-"}/f${event.selected.fret}; requested=${event.requestedMidi ?? "-"} selected=${event.selected.midi ?? "-"} invariant=${event.pitchInvariant}`,
    );
  }
  for (const event of validations) {
    lines.push(
      `${event.rollbackTriggered ? "[XX]" : event.afterIssueCodes.length > 0 ? "[!!]" : "[OK]"} M${event.measureIndex + 1}: before=[${event.beforeIssueCodes.join(", ")}] after=[${event.afterIssueCodes.join(", ")}] resolved=[${event.resolvedIssueCodes.join(", ")}] introduced=[${event.introducedIssueCodes.join(", ")}]`,
    );
  }
  for (const event of rollbacks) {
    lines.push(`[XX] rollback=${event.reason} details=${JSON.stringify(event.details)}`);
  }
  return writes.length + validations.length + rollbacks.length === 0
    ? [...lines, "(no writeback or validation records)"]
    : lines;
}

export function renderFingerstyleDiagnosticPlaintext(input: PlaintextDiagnosticInput): string {
  const dpEvents = input.events
    .filter(event => event.source === "dp")
    .map(event => event.dpEvent);
  const summary = input.summary;
  const header = [
    rule(),
    "FINGERSTYLE LLM + DP DIAGNOSTIC VISUALIZATION (PLAINTEXT)",
    rule(),
    `runId: ${input.runId}`,
    `time: ${input.startedAt} -> ${input.completedAt}`,
    `scope: song=${input.scope.songSlug ?? "-"} line=${(input.scope.lineIndex ?? 0) + 1} measures=${input.scope.measureIndexes?.join(",") ?? "-"}`,
    `sourceFingerprint: ${input.scope.sourceFingerprint ?? "-"}`,
    `outcome: ${summary.outcome}`,
    `summary: inputs=${summary.inputEventCount} resolved=${summary.resolvedEventCount} unresolved=${summary.unresolvedEventCount} changed=${summary.changedEventCount} unchanged=${summary.unchangedEventCount} totalCost=${summary.totalCost === null ? "-" : formatCost(summary.totalCost)} elapsed=${summary.elapsedMs}ms`,
    "Legend: [OK]=accepted  [!!]=warning/degraded  [XX]=failed/rollback  [>>]=started  [--]=information",
  ];

  return [
    ...header,
    "",
    ...renderLlmTimeline(input.events),
    "",
    ...renderWorkflowTimeline(input.events),
    "",
    ...renderConfiguration(dpEvents),
    "",
    ...renderPhaseTimeline(input.events),
    "",
    ...renderEventInputs(dpEvents),
    "",
    ...renderCandidateFunnels(dpEvents),
    "",
    ...renderTrellis(dpEvents),
    "",
    ...renderSelectedPathAndCosts(dpEvents),
    "",
    ...renderWritebackAndValidation(dpEvents),
    "",
    rule(),
    "END FINGERSTYLE DIAGNOSTICS",
    rule(),
  ].join("\n");
}
