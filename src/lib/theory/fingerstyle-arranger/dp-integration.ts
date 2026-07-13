import type { GuitarStringNumber } from "../fingerstyle-compressor";
import { midiForStringFret } from "../guitar-playability";
import type {
  FingerstyleCanonicalEvent,
  FingerstyleCanonicalMeasure,
  FingerstyleEventMatrix,
} from "./event-matrix";
import type { DPNoteEvent, DPOptions, DPResult } from "./dp-types";
import { DPDiagnosticLogger, STANDARD_TUNING_MIDI, stringToIndex, midiToNoteName } from "./dp-types";
import { optimizeFingerstylePath } from "./dp-optimizer";
import { optimizeWithCapo } from "./dp-capo";
import type { TimeSliceMeasure, TimeSliceGridStep } from "./time-slice";

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

      const melodyMidi = melodyEvent
        ? midiForStringFret(melodyEvent.string as 1 | 2 | 3 | 4 | 5 | 6, melodyEvent.fret)
        : null;
      const bassMidi = bassEvent
        ? midiForStringFret(bassEvent.string as 1 | 2 | 3 | 4 | 5 | 6, bassEvent.fret)
        : null;

      events.push({
        index: eventIndex++,
        melodyMidi,
        bassMidi,
        chord: measure.chord,
        durationSteps,
        bpm,
        isRest: !melodyEvent && !bassEvent,
      });
    }

    // If measure has only rests (no events), emit a single rest event
    if (measure.events.length === 0) {
      const stepsPerBeat = 4;
      const stepsPerMeasure = matrix.durationContext.meter.numerator * stepsPerBeat;
      events.push({
        index: eventIndex++,
        melodyMidi: null,
        bassMidi: null,
        chord: measure.chord,
        durationSteps: stepsPerMeasure,
        bpm,
        isRest: true,
      });
      log?.log(`  M${measure.measureIndex + 1}: REST measure`);
    }
  }

  log?.entry("Total DP events extracted", events.length);

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

          updatedEvents.push({
            ...event,
            string: newString,
            fret: newFret,
            note,
          });
        } else {
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
): { matrix: FingerstyleEventMatrix; result: DPResult; logs: string[] } {
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

  const allLogs = log.getLines();
  return { matrix: updatedMatrix, result: { ...result, logs: allLogs }, logs: allLogs };
}

// ---------------------------------------------------------------------------
// Apply DP Result back onto TimeSliceMeasure array (LLM Integration)
// ---------------------------------------------------------------------------

/** Check whether a step has melody or bass tablature (not just fills). */
function hasMelodyOrBass(step: TimeSliceGridStep): boolean {
  if (!step.tablature || step.tablature.length === 0) return false;
  return step.tablature.some(
    t => t.role === "melody" || t.role === "bass" || t.role === "root" || t.role === "fifth"
  );
}

export function applyDPToTimeSliceMeasures(
  measures: TimeSliceMeasure[],
  bpm: number = 120,
  options: DPOptions = {}
): { measures: TimeSliceMeasure[]; logs: string[] } {
  const log = new DPDiagnosticLogger();
  const skillLevel = options.skillLevel ?? "intermediate";

  log.section("DP FINGERSTYLE OPTIMIZATION (TIME-SLICE)");
  log.entry("Skill level", skillLevel);
  log.entry("BPM", bpm);
  log.entry("Auto capo", options.autoCapo ?? false);
  log.entry("Fixed capo", options.capo ?? 0);
  log.entry("Measures", measures.length);

  // ── Phase 1: Extract DP events ──────────────────────────────────────
  // Only steps with melody or bass tablature become DP events.
  // Fill-only steps are skipped to prevent duration corruption.

  const dpEvents: DPNoteEvent[] = [];
  let eventIndex = 0;

  log.section("EXTRACT DP EVENTS FROM TIME-SLICE");

  // Collect coordinates of steps that have melody/bass tablature
  const noteSteps: { measureIndex: number; stepIndex: number; chord: string }[] = [];

  for (let m = 0; m < measures.length; m++) {
    const measure = measures[m];
    for (let s = 0; s < measure.grid.length; s++) {
      const step = measure.grid[s];
      if (hasMelodyOrBass(step)) {
        noteSteps.push({ measureIndex: m, stepIndex: s, chord: step.chord });
      }
    }
  }

  log.entry("Steps with melody/bass", noteSteps.length);

  for (let i = 0; i < noteSteps.length; i++) {
    const { measureIndex, stepIndex, chord } = noteSteps[i];
    const step = measures[measureIndex].grid[stepIndex];

    // Duration: distance (in grid steps) to the NEXT melody/bass step
    let durationSteps: number;
    if (i + 1 < noteSteps.length) {
      const next = noteSteps[i + 1];
      if (next.measureIndex === measureIndex) {
        durationSteps = next.stepIndex - stepIndex;
      } else {
        // Sum remaining steps in current measure + steps before next event in subsequent measures
        let totalSteps = measures[measureIndex].grid.length - stepIndex;
        for (let mBetween = measureIndex + 1; mBetween < next.measureIndex; mBetween++) {
          totalSteps += measures[mBetween].grid.length;
        }
        totalSteps += next.stepIndex;
        durationSteps = totalSteps;
      }
    } else {
      // Last event: duration = remaining steps in the measure
      durationSteps = measures[measureIndex].grid.length - stepIndex;
    }
    durationSteps = Math.max(1, durationSteps);

    const melodyEvent = step.tablature?.find(t => t.role === "melody");
    const bassEvent = step.tablature?.find(t => t.role === "bass" || t.role === "root" || t.role === "fifth");

    const melodyMidi = melodyEvent ? midiForStringFret(melodyEvent.string as GuitarStringNumber, melodyEvent.fret) : null;
    const bassMidi = bassEvent ? midiForStringFret(bassEvent.string as GuitarStringNumber, bassEvent.fret) : null;

    dpEvents.push({
      index: eventIndex,
      melodyMidi,
      bassMidi,
      chord: chord || "N.C.",
      durationSteps,
      bpm,
      isRest: false, // We only extracted steps with melody/bass, so never rest
    });

    // Per-event diagnostic log
    log.item(eventIndex, [
      `M${measureIndex + 1}/s${stepIndex + 1}`,
      `chord=${chord}`,
      `mel=${midiToNoteName(melodyMidi)}${melodyEvent ? ` s${melodyEvent.string}/f${melodyEvent.fret}` : ""}`,
      `bass=${midiToNoteName(bassMidi)}${bassEvent ? ` s${bassEvent.string}/f${bassEvent.fret}` : ""}`,
      `dur=${durationSteps}steps`,
    ].join(" | "));

    eventIndex++;
  }

  log.entry("Total DP events extracted", dpEvents.length);

  // ── Phase 2: Run Viterbi optimizer ──────────────────────────────────

  let result: DPResult;
  if (options.autoCapo) {
    result = optimizeWithCapo(dpEvents, skillLevel, options.maxCapo, log);
  } else {
    result = optimizeFingerstylePath(dpEvents, skillLevel, options.capo ?? 0, log);
  }

  // ── Phase 3: Apply DP result back onto the grid ─────────────────────
  // Walk the same melody/bass steps in the same order to maintain alignment.

  log.section("APPLY DP RESULT TO TIME-SLICE");

  let dpIndex = 0;
  let changedCount = 0;

  const updatedMeasures: TimeSliceMeasure[] = JSON.parse(JSON.stringify(measures));

  for (let m = 0; m < updatedMeasures.length; m++) {
    const measure = updatedMeasures[m];
    for (let s = 0; s < measure.grid.length; s++) {
      const step = measure.grid[s];
      if (!hasMelodyOrBass(step)) continue;

      const dpCandidate = dpIndex < result.path.length ? result.path[dpIndex] : null;
      dpIndex++;

      if (dpCandidate && step.tablature) {
        for (const tab of step.tablature) {
          if (tab.role === "melody" && dpCandidate.melodyString !== null) {
            if (tab.string !== dpCandidate.melodyString || tab.fret !== dpCandidate.melodyFret) {
              log.log(`  M${m + 1}/s${s + 1} melody: s${tab.string}/f${tab.fret} → s${dpCandidate.melodyString}/f${dpCandidate.melodyFret} tech=${dpCandidate.melodyTechnique}`);
              changedCount++;
            }
            tab.string = dpCandidate.melodyString;
            tab.fret = dpCandidate.melodyFret;
          } else if ((tab.role === "bass" || tab.role === "root" || tab.role === "fifth") && dpCandidate.bassString !== null) {
            if (tab.string !== dpCandidate.bassString || tab.fret !== dpCandidate.bassFret) {
              log.log(`  M${m + 1}/s${s + 1} ${tab.role}: s${tab.string}/f${tab.fret} → s${dpCandidate.bassString}/f${dpCandidate.bassFret}`);
              changedCount++;
            }
            tab.string = dpCandidate.bassString;
            tab.fret = dpCandidate.bassFret;
          }
        }
      }
    }
  }

  log.entry("Events updated", changedCount);
  log.entry("Events unchanged", dpIndex - changedCount);
  log.section("DP FINGERSTYLE OPTIMIZATION COMPLETE");
  log.entry("Final total cost", result.totalCost.toFixed(2));
  log.entry("Selected capo", result.capo);

  const allLogs = log.getLines();
  return { measures: updatedMeasures, logs: allLogs };
}

