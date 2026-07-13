import type { DPNoteEvent, DPResult, SkillLevel } from "./dp-types";
import { DPDiagnosticLogger } from "./dp-types";
import { optimizeFingerstylePath } from "./dp-optimizer";

/**
 * Default maximum capo position to sweep through.
 */
const DEFAULT_MAX_CAPO = 7;

/**
 * Transpose a MIDI pitch down by `capo` semitones.
 * Returns null if the input is null.
 */
function transposeMidi(midi: number | null, capo: number): number | null {
  if (midi === null) return null;
  return midi - capo;
}

/**
 * Create a transposed copy of events for a given capo position.
 * The capo effectively raises all open strings by `capo` semitones,
 * which is equivalent to lowering all target pitches by `capo` semitones
 * relative to the open strings.
 */
function transposeEvents(events: DPNoteEvent[], capo: number): DPNoteEvent[] {
  if (capo === 0) return events;
  return events.map(event => ({
    ...event,
    melodyMidi: transposeMidi(event.melodyMidi, capo),
    bassMidi: transposeMidi(event.bassMidi, capo),
  }));
}

/**
 * Sweep through capo positions 0..maxCapo and find the one that
 * produces the minimum total cost for the fingerstyle DP optimization.
 *
 * For each capo position, all MIDI pitches are transposed down by
 * the capo offset and the Viterbi optimizer is run. The capo position
 * with the lowest total cost is selected.
 */
export function optimizeWithCapo(
  events: DPNoteEvent[],
  skillLevel: SkillLevel,
  maxCapo: number = DEFAULT_MAX_CAPO,
  logger?: DPDiagnosticLogger
): DPResult {
  const log = logger ?? new DPDiagnosticLogger();
  let bestResult: DPResult | null = null;

  log.section("CAPO SWEEP");
  log.entry("Sweep range", `capo 0 → ${maxCapo}`);
  log.entry("Events", events.length);

  const capoResults: { capo: number; cost: number }[] = [];

  for (let capo = 0; capo <= maxCapo; capo++) {
    const transposed = transposeEvents(events, capo);
    // Use a sub-logger for each capo run to avoid flooding the main log
    const subLogger = new DPDiagnosticLogger();
    const result = optimizeFingerstylePath(transposed, skillLevel, capo, subLogger);

    capoResults.push({ capo, cost: result.totalCost });

    if (bestResult === null || result.totalCost < bestResult.totalCost) {
      bestResult = result;
    }
  }

  // Log the capo comparison table
  log.section("CAPO COMPARISON");
  for (const { capo, cost } of capoResults) {
    const marker = bestResult && capo === bestResult.capo ? " ◀ BEST" : "";
    log.item(capo, `capo ${capo} → totalCost=${cost.toFixed(2)}${marker}`);
  }

  if (bestResult) {
    log.entry("Selected capo", bestResult.capo);
    log.entry("Selected cost", bestResult.totalCost.toFixed(2));

    // Re-run the best capo with the main logger to get full logs
    const transposed = transposeEvents(events, bestResult.capo);
    const finalResult = optimizeFingerstylePath(transposed, skillLevel, bestResult.capo, log);

    return {
      ...finalResult,
      logs: log.getLines(),
    };
  }

  return { path: [], totalCost: Infinity, capo: 0, skillLevel, logs: log.getLines() };
}
