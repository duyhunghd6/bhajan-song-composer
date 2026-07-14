import type { DPNoteEvent, DPResult, SkillLevel } from "./dp-types";
import { DPDiagnosticLogger } from "./dp-types";
import { optimizeFingerstylePath } from "./dp-optimizer";

const DEFAULT_MAX_CAPO = 7;

function transposeMidi(midi: number | null, capo: number): number | null {
  return midi === null ? null : midi - capo;
}

function transposeEvents(events: DPNoteEvent[], capo: number): DPNoteEvent[] {
  if (capo === 0) return events;
  return events.map(event => ({
    ...event,
    melodyMidi: transposeMidi(event.melodyMidi, capo),
    bassMidi: transposeMidi(event.bassMidi, capo),
  }));
}

export function optimizeWithCapo(
  events: DPNoteEvent[],
  skillLevel: SkillLevel,
  maxCapo: number = DEFAULT_MAX_CAPO,
  logger?: DPDiagnosticLogger
): DPResult {
  const ownsLogger = logger === undefined;
  const log = logger ?? new DPDiagnosticLogger();
  const startedAt = Date.now();
  log.section("CAPO SWEEP");
  log.entry("Sweep range", `capo 0 → ${maxCapo}`);
  log.entry("Events", events.length);

  const tested: { capo: number; result: DPResult; transposed: DPNoteEvent[] }[] = [];
  let best: (typeof tested)[number] | null = null;
  for (let capo = 0; capo <= maxCapo; capo++) {
    const transposed = transposeEvents(events, capo);
    const result = optimizeFingerstylePath(transposed, skillLevel, capo, new DPDiagnosticLogger());
    const test = { capo, result, transposed };
    tested.push(test);
    if (best === null || result.totalCost < best.result.totalCost) best = test;
  }

  log.section("CAPO COMPARISON");
  for (const test of tested) {
    const selected = best?.capo === test.capo;
    const unresolvedEventCount = test.result.path.filter(candidate => candidate.origin === "fallback-noop").length;
    log.item(test.capo, `capo ${test.capo} → totalCost=${test.result.totalCost.toFixed(2)}${selected ? " ◀ BEST" : ""}`);
    log.event({
      type: "capo-tested",
      phase: "capo-sweep",
      capo: test.capo,
      transpositions: events.map((event, eventIndex) => ({
        eventIndex,
        melodyFrom: event.melodyMidi,
        melodyTo: test.transposed[eventIndex].melodyMidi,
        bassFrom: event.bassMidi,
        bassTo: test.transposed[eventIndex].bassMidi,
      })),
      totalCost: test.result.totalCost,
      pathLength: test.result.path.length,
      unresolvedEventCount,
      selected,
    });
  }

  if (best) {
    log.entry("Selected capo", best.capo);
    log.entry("Selected cost", best.result.totalCost.toFixed(2));
    log.event({
      type: "capo-selected",
      phase: "capo-sweep",
      capo: best.capo,
      totalCost: best.result.totalCost,
      testedCount: tested.length,
    });
    const finalResult = optimizeFingerstylePath(best.transposed, skillLevel, best.capo, log);
    if (ownsLogger) {
      const unresolvedEventCount = finalResult.path.filter(candidate => candidate.origin === "fallback-noop").length;
      const outcome = !Number.isFinite(finalResult.totalCost)
        ? "failed"
        : unresolvedEventCount > 0
          ? "accepted-with-unresolved-events"
          : finalResult.path.length === 0
            ? "no-effective-dp-change"
            : "accepted";
      log.event({
        type: "run-summary",
        phase: "summary",
        outcome,
        inputEventCount: events.length,
        resolvedEventCount: events.length - unresolvedEventCount,
        unresolvedEventCount,
        changedEventCount: 0,
        unchangedEventCount: events.length,
        totalCost: finalResult.totalCost,
        elapsedMs: Date.now() - startedAt,
      });
      log.collector.complete(outcome);
    }
    return { ...finalResult, logs: log.getLines(), diagnostics: log.getDiagnostics() };
  }

  const result: DPResult = {
    path: [],
    totalCost: Infinity,
    capo: 0,
    skillLevel,
    logs: log.getLines(),
    diagnostics: log.getDiagnostics(),
  };
  if (ownsLogger) log.collector.complete("failed");
  return { ...result, logs: log.getLines(), diagnostics: log.getDiagnostics() };
}
