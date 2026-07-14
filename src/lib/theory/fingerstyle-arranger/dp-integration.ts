import { midiForStringFret, parseScientificPitch } from "../guitar-playability";
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
import { validateFingerstylePhysics } from "./physics-validation";

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

      events.push({
        index: eventIndex++,
        absoluteOnsetStep,
        movementSteps,
        melodyMidi,
        bassMidi,
        chord: measure.chord,
        durationSteps,
        bpm,
        isRest: !melodyEvent && !bassEvent,
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
      events.push({
        index: eventIndex++,
        absoluteOnsetStep,
        movementSteps,
        melodyMidi: null,
        bassMidi: null,
        chord: measure.chord,
        durationSteps: stepsPerMeasure,
        bpm,
        isRest: true,
      });
      previousAbsoluteOnsetStep = absoluteOnsetStep;
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

  type Binding = {
    measureIndex: number;
    stepIndex: number;
    melodyTabIndex: number | null;
    bassTabIndex: number | null;
    absoluteOnsetStep: number;
  };

  const dpEvents: DPNoteEvent[] = [];
  const bindings: Binding[] = [];
  const measureOffsets: number[] = [];
  let totalGridSteps = 0;
  for (const measure of measures) {
    measureOffsets.push(totalGridSteps);
    totalGridSteps += measure.grid.length;
  }

  log.section("EXTRACT DP EVENTS FROM TIME-SLICE");

  for (let measureIndex = 0; measureIndex < measures.length; measureIndex++) {
    const measure = measures[measureIndex];
    for (let stepIndex = 0; stepIndex < measure.grid.length; stepIndex++) {
      const step = measure.grid[stepIndex];
      if (!hasMelodyOrBass(step)) continue;

      const tablature = step.tablature ?? [];
      const melodyTabIndex = tablature.findIndex(tab => tab.role === "melody");
      const bassTabIndex = tablature.findIndex(
        tab => tab.role === "bass" || tab.role === "root" || tab.role === "fifth"
      );
      const absoluteOnsetStep = measureOffsets[measureIndex] + stepIndex;

      const fixedFrets: (number | null)[] = [null, null, null, null, null, null];
      for (let tabIndex = 0; tabIndex < tablature.length; tabIndex++) {
        if (tabIndex === melodyTabIndex || tabIndex === bassTabIndex) continue;
        const tab = tablature[tabIndex];
        fixedFrets[stringToIndex(tab.string)] = tab.fret;
      }

      const melodyTab = melodyTabIndex >= 0 ? tablature[melodyTabIndex] : null;
      const bassTab = bassTabIndex >= 0 ? tablature[bassTabIndex] : null;
      const authoritativeMelody = step.melody.pitch
        ? parseScientificPitch(step.melody.pitch)?.midi ?? null
        : null;
      const melodyMidi = melodyTab
        ? authoritativeMelody ?? midiForStringFret(melodyTab.string, melodyTab.fret)
        : null;
      const bassMidi = bassTab
        ? midiForStringFret(bassTab.string, bassTab.fret)
        : null;

      bindings.push({
        measureIndex,
        stepIndex,
        melodyTabIndex: melodyTabIndex >= 0 ? melodyTabIndex : null,
        bassTabIndex: bassTabIndex >= 0 ? bassTabIndex : null,
        absoluteOnsetStep,
      });
      dpEvents.push({
        index: dpEvents.length,
        absoluteOnsetStep,
        fixedFrets,
        melodyMidi,
        bassMidi,
        chord: step.chord || "N.C.",
        durationSteps: 1,
        bpm,
        isRest: false,
      });
    }
  }

  for (let index = 0; index < dpEvents.length; index++) {
    const nextOnset = dpEvents[index + 1]?.absoluteOnsetStep ?? totalGridSteps;
    const onset = dpEvents[index].absoluteOnsetStep ?? 0;
    const previousOnset = dpEvents[index - 1]?.absoluteOnsetStep;
    dpEvents[index].durationSteps = Math.max(1, nextOnset - onset);
    dpEvents[index].movementSteps = Math.max(
      1,
      previousOnset === undefined ? onset : onset - previousOnset
    );
    const binding = bindings[index];
    log.item(index, [
      `M${binding.measureIndex + 1}/s${binding.stepIndex + 1}`,
      `chord=${dpEvents[index].chord}`,
      `mel=${midiToNoteName(dpEvents[index].melodyMidi)}`,
      `bass=${midiToNoteName(dpEvents[index].bassMidi)}`,
      `dur=${dpEvents[index].durationSteps}steps`,
    ].join(" | "));
  }

  log.entry("Total DP events extracted", dpEvents.length);

  let result: DPResult;
  if (options.autoCapo) {
    result = optimizeWithCapo(dpEvents, skillLevel, options.maxCapo, log);
  } else {
    result = optimizeFingerstylePath(dpEvents, skillLevel, options.capo ?? 0, log);
  }

  log.section("APPLY DP RESULT TO TIME-SLICE");
  let changedCount = 0;
  let writebackValid = result.path.length === bindings.length;
  const updatedMeasures: TimeSliceMeasure[] = JSON.parse(JSON.stringify(measures));

  for (let index = 0; index < bindings.length && index < result.path.length; index++) {
    const binding = bindings[index];
    const candidate = result.path[index];
    const event = dpEvents[index];
    const step = updatedMeasures[binding.measureIndex].grid[binding.stepIndex];
    const tablature = step.tablature ?? [];

    if (binding.melodyTabIndex !== null && candidate.melodyString !== null) {
      const actualMidi = midiForStringFret(candidate.melodyString, candidate.melodyFret);
      if (actualMidi !== event.melodyMidi) {
        writebackValid = false;
        log.log(`  ⚠ M${binding.measureIndex + 1}/s${binding.stepIndex + 1} melody pitch invariant failed`);
        break;
      }
      const tab = tablature[binding.melodyTabIndex];
      if (tab.string !== candidate.melodyString || tab.fret !== candidate.melodyFret) {
        changedCount++;
        log.log(`  M${binding.measureIndex + 1}/s${binding.stepIndex + 1} melody: s${tab.string}/f${tab.fret} → s${candidate.melodyString}/f${candidate.melodyFret}`);
      }
      tab.string = candidate.melodyString;
      tab.fret = candidate.melodyFret;
    }

    if (binding.bassTabIndex !== null && candidate.bassString !== null) {
      const actualMidi = midiForStringFret(candidate.bassString, candidate.bassFret);
      if (actualMidi !== event.bassMidi) {
        writebackValid = false;
        log.log(`  ⚠ M${binding.measureIndex + 1}/s${binding.stepIndex + 1} bass pitch invariant failed`);
        break;
      }
      const tab = tablature[binding.bassTabIndex];
      if (tab.string !== candidate.bassString || tab.fret !== candidate.bassFret) {
        changedCount++;
        log.log(`  M${binding.measureIndex + 1}/s${binding.stepIndex + 1} ${tab.role}: s${tab.string}/f${tab.fret} → s${candidate.bassString}/f${candidate.bassFret}`);
      }
      tab.string = candidate.bassString;
      tab.fret = candidate.bassFret;
    }
  }

  if (writebackValid) {
    for (let index = 0; index < updatedMeasures.length; index++) {
      const measure = updatedMeasures[index];
      const validationOptions = {
        fillDensity: measure.style_profile.fill_density,
      };
      const before = validateFingerstylePhysics(
        measures[index].grid,
        validationOptions
      );
      const after = validateFingerstylePhysics(measure.grid, validationOptions);
      if (!after.valid && before.valid) {
        writebackValid = false;
        log.log(`  ⚠ POST-DP PHYSICS VALIDATION M${measure.measure}: ${after.message}`);
        break;
      }
      if (!after.valid) {
        log.log(`  ⚠ M${measure.measure} retains pre-existing validation issues after pitch-safe DP writeback.`);
      }
    }
  }

  log.entry("Events updated", changedCount);
  log.section("DP FINGERSTYLE OPTIMIZATION COMPLETE");
  log.entry("Final total cost", result.totalCost.toFixed(2));
  log.entry("Selected capo", result.capo);
  log.entry("Writeback", writebackValid ? "accepted" : "rolled back");

  const allLogs = log.getLines();
  return {
    measures: writebackValid ? updatedMeasures : measures,
    logs: allLogs,
  };
}

