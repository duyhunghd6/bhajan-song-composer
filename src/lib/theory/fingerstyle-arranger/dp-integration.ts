import { midiForStringFret } from "../guitar-playability";
import type {
  FingerstyleCanonicalEvent,
  FingerstyleCanonicalMeasure,
  FingerstyleEventMatrix,
} from "./event-matrix";
import type { DPNoteEvent, DPOptions, DPResult } from "./dp-types";
import { DPDiagnosticLogger, SKILL_LEVEL_CONSTRAINTS, STANDARD_TUNING_MIDI, stringToIndex, midiToNoteName } from "./dp-types";
import { optimizeFingerstylePath, RECURRING_SHAPE_MISMATCH_COST } from "./dp-optimizer";
import { optimizeWithCapo } from "./dp-capo";
import { DP_CANDIDATE_LIMIT } from "./dp-candidates";
import { DP_COST_CONSTANTS } from "./dp-cost";
import type { FingerstyleDiagnosticRun } from "./dp-diagnostics";

// ---------------------------------------------------------------------------
// Extract DPNoteEvents from the Event Matrix
// ---------------------------------------------------------------------------

/**
 * Convert the event matrix's canonical events into a flat sequence of
 * DPNoteEvents suitable for the Viterbi optimizer.
 *
 * Groups simultaneous events (same measure + onset) into single DPNoteEvents
 * with melody and bass MIDI values.
 */
export function extractDPEvents(
  matrix: FingerstyleEventMatrix,
  bpm: number = 120,
  logger?: DPDiagnosticLogger
): DPNoteEvent[] {
  const log = logger;
  const events: DPNoteEvent[] = [];
  let eventIndex = 0;
  let previousAbsoluteOnsetStep: number | null = null;

  log?.section("EXTRACT DP EVENTS FROM MATRIX");
  log?.entry("Total measures", matrix.measures.length);
  log?.entry("BPM", bpm);
  log?.entry("Meter", `${matrix.durationContext.meter.numerator}/${matrix.durationContext.meter.denominator}`);

  for (const measure of matrix.measures) {
    // Group events by onset time
    const byOnset = new Map<number, FingerstyleCanonicalEvent[]>();
    for (const event of measure.events) {
      const key = event.onsetUnits;
      if (!byOnset.has(key)) byOnset.set(key, []);
      byOnset.get(key)!.push(event);
    }

    // Sort onsets
    const sortedOnsets = [...byOnset.keys()].sort((a, b) => a - b);

    log?.log(`  M${measure.measureIndex + 1} (${measure.chord}): ${sortedOnsets.length} onset groups, ${measure.events.length} events`);

    for (let i = 0; i < sortedOnsets.length; i++) {
      const onset = sortedOnsets[i];
      const group = byOnset.get(onset)!;

      // Find melody and bass from the group
      const melodyEvent = group.find(e => e.role === "melody");
      const bassEvent = group.find(e => e.role === "bass" || e.role === "root" || e.role === "fifth");

      // Duration in steps: distance to next onset, or remaining measure
      const nextOnset = i + 1 < sortedOnsets.length
        ? sortedOnsets[i + 1]
        : matrix.durationContext.fullMeasureUnits;
      const durationUnits = nextOnset - onset;
      const stepsPerBeat = 4;
      const durationSteps = Math.max(1, Math.round(
        (durationUnits / matrix.durationContext.unitsPerBeat) * stepsPerBeat
      ));
      const stepsPerMeasure = matrix.durationContext.meter.numerator * stepsPerBeat;
      const onsetSteps = Math.round(
        (onset / matrix.durationContext.unitsPerBeat) * stepsPerBeat
      );
      const absoluteOnsetStep = measure.measureIndex * stepsPerMeasure + onsetSteps;
      const movementSteps = Math.max(
        1,
        previousAbsoluteOnsetStep === null
          ? absoluteOnsetStep
          : absoluteOnsetStep - previousAbsoluteOnsetStep
      );

      const melodyMidi = melodyEvent
        ? midiForStringFret(melodyEvent.string as 1 | 2 | 3 | 4 | 5 | 6, melodyEvent.fret)
        : null;
      const bassMidi = bassEvent
        ? midiForStringFret(bassEvent.string as 1 | 2 | 3 | 4 | 5 | 6, bassEvent.fret)
        : null;

      const currentEventIndex = eventIndex++;
      events.push({
        index: currentEventIndex,
        absoluteOnsetStep,
        movementSteps,
        melodyMidi,
        bassMidi,
        chord: measure.chord,
        durationSteps,
        bpm,
        isRest: !melodyEvent && !bassEvent,
      });
      log?.event({
        type: "input-binding",
        phase: "extraction",
        eventIndex: currentEventIndex,
        measureIndex: measure.measureIndex,
        stepIndex: onset,
        absoluteOnsetStep,
        durationSteps,
        movementSteps,
        movementSeconds: movementSteps * (60 / bpm / 4),
        chord: measure.chord,
        normalizedChord: measure.chord.trim().replace(/\s+/g, "").toLowerCase(),
        melodyTabIndex: null,
        bassTabIndex: null,
        authoritativeMelodyMidi: melodyMidi,
        submittedMelodyMidi: melodyMidi,
        effectiveMelodyMidi: melodyMidi,
        bassMidi,
        bassPitchSource: bassMidi === null ? "none" : "submitted-tab",
        fixedFrets: [null, null, null, null, null, null],
      });
      previousAbsoluteOnsetStep = absoluteOnsetStep;
    }

    // If measure has only rests (no events), emit a single rest event
    if (measure.events.length === 0) {
      const stepsPerBeat = 4;
      const stepsPerMeasure = matrix.durationContext.meter.numerator * stepsPerBeat;
      const absoluteOnsetStep = measure.measureIndex * stepsPerMeasure;
      const movementSteps = Math.max(
        1,
        previousAbsoluteOnsetStep === null
          ? absoluteOnsetStep
          : absoluteOnsetStep - previousAbsoluteOnsetStep
      );
      const currentEventIndex = eventIndex++;
      events.push({
        index: currentEventIndex,
        absoluteOnsetStep,
        movementSteps,
        melodyMidi: null,
        bassMidi: null,
        chord: measure.chord,
        durationSteps: stepsPerMeasure,
        bpm,
        isRest: true,
      });
      log?.event({
        type: "input-binding",
        phase: "extraction",
        eventIndex: currentEventIndex,
        measureIndex: measure.measureIndex,
        stepIndex: 0,
        absoluteOnsetStep,
        durationSteps: stepsPerMeasure,
        movementSteps,
        movementSeconds: movementSteps * (60 / bpm / 4),
        chord: measure.chord,
        normalizedChord: measure.chord.trim().replace(/\s+/g, "").toLowerCase(),
        melodyTabIndex: null,
        bassTabIndex: null,
        authoritativeMelodyMidi: null,
        submittedMelodyMidi: null,
        effectiveMelodyMidi: null,
        bassMidi: null,
        bassPitchSource: "none",
        fixedFrets: [null, null, null, null, null, null],
      });
      previousAbsoluteOnsetStep = absoluteOnsetStep;
      log?.log(`  M${measure.measureIndex + 1}: REST measure`);
    }
  }

  log?.entry("Total DP events extracted", events.length);
  log?.event({
    type: "input-extraction",
    phase: "extraction",
    source: "event-matrix",
    measureCount: matrix.measures.length,
    inputEventCount: matrix.measures.reduce((sum, measure) => sum + measure.events.length, 0),
    extractedEventCount: events.length,
  });

  // Log the extracted event sequence
  log?.section("EVENT SEQUENCE");
  for (const ev of events) {
    log?.item(ev.index, [
      `chord=${ev.chord}`,
      `mel=${midiToNoteName(ev.melodyMidi)}`,
      `bass=${midiToNoteName(ev.bassMidi)}`,
      `dur=${ev.durationSteps}`,
      ev.isRest ? "REST" : "",
    ].filter(Boolean).join(" | "));
  }

  return events;
}

// ---------------------------------------------------------------------------
// Apply DP Result back onto the Event Matrix
// ---------------------------------------------------------------------------

/**
 * Apply the DP-optimized string/fret assignments back onto the event matrix,
 * updating each canonical event's string, fret, note, and technique fields.
 */
function applyDPResultToMatrix(
  matrix: FingerstyleEventMatrix,
  result: DPResult,
  logger?: DPDiagnosticLogger
): FingerstyleEventMatrix {
  if (result.path.length === 0) return matrix;

  const log = logger;
  log?.section("APPLY DP RESULT TO MATRIX");

  let dpIndex = 0;
  let changedCount = 0;
  const updatedMeasures = matrix.measures.map(measure => {
    const byOnset = new Map<number, FingerstyleCanonicalEvent[]>();
    for (const event of measure.events) {
      const key = event.onsetUnits;
      if (!byOnset.has(key)) byOnset.set(key, []);
      byOnset.get(key)!.push(event);
    }
    const sortedOnsets = [...byOnset.keys()].sort((a, b) => a - b);

    const updatedEvents: FingerstyleCanonicalEvent[] = [];

    for (const onset of sortedOnsets) {
      const group = byOnset.get(onset)!;
      const eventIndex = dpIndex;
      const dpCandidate = dpIndex < result.path.length ? result.path[dpIndex] : null;
      dpIndex++;

      for (const event of group) {
        if (!dpCandidate) {
          updatedEvents.push(event);
          continue;
        }

        if (event.role === "melody" && dpCandidate.melodyString !== null) {
          const newString = dpCandidate.melodyString;
          const newFret = dpCandidate.melodyFret;
          const newMidi = STANDARD_TUNING_MIDI[stringToIndex(newString)] + newFret;
          const pitchNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
          const octave = Math.floor(newMidi / 12) - 1;
          const note = `${pitchNames[newMidi % 12]}${octave}`;

          const wasChanged = event.string !== newString || event.fret !== newFret;
          if (wasChanged) {
            changedCount++;
            log?.log(`  M${measure.measureIndex + 1} melody: s${event.string}/f${event.fret} → s${newString}/f${newFret} (${event.note} → ${note}) tech=${dpCandidate.melodyTechnique}`);
          }
          const requestedMidi = midiForStringFret(event.string, event.fret);
          log?.event({
            type: "writeback",
            phase: "writeback",
            eventIndex,
            measureIndex: measure.measureIndex,
            stepIndex: sortedOnsets.indexOf(onset),
            role: "melody",
            tabIndex: group.indexOf(event),
            submitted: { string: event.string, fret: event.fret, midi: requestedMidi },
            selected: {
              string: newString,
              fret: newFret,
              midi: newMidi,
              origin: dpCandidate.origin ?? "generated",
            },
            requestedMidi,
            pitchInvariant: newMidi === requestedMidi,
            result: wasChanged ? "changed" : "unchanged",
          });

          updatedEvents.push({
            ...event,
            string: newString,
            fret: newFret,
            note,
            technique: dpCandidate.melodyTechnique,
          });
        } else if (
          (event.role === "bass" || event.role === "root" || event.role === "fifth") &&
          dpCandidate.bassString !== null
        ) {
          const newString = dpCandidate.bassString;
          const newFret = dpCandidate.bassFret;
          const newMidi = STANDARD_TUNING_MIDI[stringToIndex(newString)] + newFret;
          const pitchNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
          const octave = Math.floor(newMidi / 12) - 1;
          const note = `${pitchNames[newMidi % 12]}${octave}`;

          const wasChanged = event.string !== newString || event.fret !== newFret;
          if (wasChanged) {
            changedCount++;
            log?.log(`  M${measure.measureIndex + 1} ${event.role}: s${event.string}/f${event.fret} → s${newString}/f${newFret} (${event.note} → ${note})`);
          }
          const requestedMidi = midiForStringFret(event.string, event.fret);
          log?.event({
            type: "writeback",
            phase: "writeback",
            eventIndex,
            measureIndex: measure.measureIndex,
            stepIndex: sortedOnsets.indexOf(onset),
            role: "bass",
            tabIndex: group.indexOf(event),
            submitted: { string: event.string, fret: event.fret, midi: requestedMidi },
            selected: {
              string: newString,
              fret: newFret,
              midi: newMidi,
              origin: dpCandidate.origin ?? "generated",
            },
            requestedMidi,
            pitchInvariant: newMidi === requestedMidi,
            result: wasChanged ? "changed" : "unchanged",
          });

          updatedEvents.push({
            ...event,
            string: newString,
            fret: newFret,
            note,
          });
        } else {
          if (
            dpCandidate.origin === "fallback-noop"
            && (event.role === "melody" || event.role === "bass" || event.role === "root" || event.role === "fifth")
          ) {
            const requestedMidi = midiForStringFret(event.string, event.fret);
            log?.event({
              type: "writeback",
              phase: "writeback",
              severity: "warning",
              eventIndex,
              measureIndex: measure.measureIndex,
              stepIndex: sortedOnsets.indexOf(onset),
              role: event.role === "melody" ? "melody" : "bass",
              tabIndex: group.indexOf(event),
              submitted: { string: event.string, fret: event.fret, midi: requestedMidi },
              selected: {
                string: null,
                fret: 0,
                midi: null,
                origin: "fallback-noop",
              },
              requestedMidi,
              pitchInvariant: false,
              result: "unresolved",
            });
          }
          updatedEvents.push(event);
        }
      }
    }

    return {
      ...measure,
      events: updatedEvents.sort((a, b) => a.onsetUnits - b.onsetUnits || a.string - b.string),
    } as FingerstyleCanonicalMeasure;
  });

  log?.entry("Events updated", changedCount);
  log?.entry("Events unchanged", result.path.length > 0 ? dpIndex - changedCount : 0);

  return {
    ...matrix,
    measures: updatedMeasures,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply DP optimization to an existing event matrix.
 * This is the main integration point — called optionally from
 * `buildFingerstyleEventMatrix()` as a post-processing step.
 *
 * When `options.autoCapo` is true, the optimizer sweeps capo positions
 * and picks the one with minimum total hand-movement cost.
 *
 * Returns the updated matrix, the DP result, and the diagnostic logs.
 */
export function applyDPOptimization(
  matrix: FingerstyleEventMatrix,
  options: DPOptions = {}
): { matrix: FingerstyleEventMatrix; result: DPResult; logs: string[]; diagnostics: FingerstyleDiagnosticRun } {
  const startedAt = Date.now();
  const log = new DPDiagnosticLogger();
  const skillLevel = options.skillLevel ?? "intermediate";
  const bpm = options.bpm ?? 120;

  log.section("DP FINGERSTYLE OPTIMIZATION START");
  log.entry("Skill level", skillLevel);
  log.entry("BPM", bpm);
  log.entry("Auto capo", options.autoCapo ?? false);
  log.entry("Fixed capo", options.capo ?? 0);
  log.entry("Measures in matrix", matrix.measures.length);
  log.entry("Total events in matrix", matrix.measures.reduce((sum, m) => sum + m.events.length, 0));
  log.event({
    type: "configuration",
    phase: "configuration",
    values: {
      bpm,
      skillLevel,
      capo: options.capo ?? 0,
      autoCapo: options.autoCapo ?? false,
      maxCapo: options.maxCapo ?? 7,
      candidateCap: DP_CANDIDATE_LIMIT,
      tuningMidi: [...STANDARD_TUNING_MIDI],
      skillConstraints: { ...SKILL_LEVEL_CONSTRAINTS[skillLevel] },
      recurringShapeMismatchCost: RECURRING_SHAPE_MISMATCH_COST,
      costConstants: { ...DP_COST_CONSTANTS },
    },
    provenance: {
      bpm: options.bpm === undefined ? "defaulted" : "supplied",
      skillLevel: options.skillLevel === undefined ? "defaulted" : "supplied",
      capo: options.capo === undefined ? "defaulted" : "supplied",
      autoCapo: options.autoCapo === undefined ? "defaulted" : "supplied",
      maxCapo: options.maxCapo === undefined ? "defaulted" : "supplied",
      candidateCap: "constant",
      tuningMidi: "constant",
      skillConstraints: "derived",
      recurringShapeMismatchCost: "constant",
      costConstants: "constant",
    },
  });

  const dpEvents = extractDPEvents(matrix, bpm, log);

  let result: DPResult;

  if (options.autoCapo) {
    result = optimizeWithCapo(dpEvents, skillLevel, options.maxCapo, log);
  } else {
    result = optimizeFingerstylePath(dpEvents, skillLevel, options.capo ?? 0, log);
  }

  const updatedMatrix = applyDPResultToMatrix(matrix, result, log);

  log.section("DP FINGERSTYLE OPTIMIZATION COMPLETE");
  log.entry("Final total cost", result.totalCost.toFixed(2));
  log.entry("Selected capo", result.capo);
  log.entry("Path events", result.path.length);

  const changedEventCount = updatedMatrix.measures.reduce((count, measure, measureIndex) =>
    count + measure.events.filter((event, eventIndex) => {
      const original = matrix.measures[measureIndex]?.events[eventIndex];
      return original && (original.string !== event.string || original.fret !== event.fret);
    }).length, 0);
  const unresolvedEventCount = result.path.filter(candidate => candidate.origin === "fallback-noop").length;
  const outcome = !Number.isFinite(result.totalCost)
    ? "failed"
    : unresolvedEventCount > 0
      ? "accepted-with-unresolved-events"
      : changedEventCount === 0
        ? "no-effective-dp-change"
        : "accepted";
  log.event({
    type: "run-summary",
    phase: "summary",
    outcome,
    inputEventCount: dpEvents.length,
    resolvedEventCount: dpEvents.length - unresolvedEventCount,
    unresolvedEventCount,
    changedEventCount,
    unchangedEventCount: Math.max(0, dpEvents.length - unresolvedEventCount - changedEventCount),
    totalCost: result.totalCost,
    elapsedMs: Date.now() - startedAt,
  });
  log.collector.complete(outcome);

  const allLogs = log.getLines();
  const diagnostics = log.getDiagnostics();
  return {
    matrix: updatedMatrix,
    result: { ...result, logs: allLogs, diagnostics },
    logs: allLogs,
    diagnostics,
  };
}

export { applyDPToTimeSliceMeasures } from "./dp-time-slice-integration";
export type { ApplyDPToTimeSliceMeasuresResult } from "./dp-time-slice-integration";
