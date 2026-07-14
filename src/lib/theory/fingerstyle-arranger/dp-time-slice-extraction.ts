import { midiForStringFret, parseScientificPitch } from "../guitar-playability";
import { DP_CANDIDATE_LIMIT } from "./dp-candidates";
import { DP_COST_CONSTANTS, dpStepDurationSeconds } from "./dp-cost";
import { RECURRING_SHAPE_MISMATCH_COST } from "./dp-optimizer";
import type { TimeSliceGridStep, TimeSliceMeasure } from "./time-slice";
import type { DPNoteEvent, DPOptions, SkillLevel } from "./dp-types";
import {
  DPDiagnosticLogger,
  SKILL_LEVEL_CONSTRAINTS,
  STANDARD_TUNING_MIDI,
  midiToNoteName,
  stringToIndex,
} from "./dp-types";

export type TimeSliceTab = NonNullable<TimeSliceGridStep["tablature"]>[number];

export interface FixedEntrySnapshot {
  tabIndex: number;
  tab: TimeSliceTab;
}

export interface TimeSliceDPBinding {
  measureIndex: number;
  stepIndex: number;
  melodyTabIndex: number | null;
  bassTabIndex: number | null;
  absoluteOnsetStep: number;
  authoritativeMelodyMidi: number | null;
  submittedMelodyMidi: number | null;
  fixedEntries: FixedEntrySnapshot[];
}

function hasMelodyOrBass(step: TimeSliceGridStep): boolean {
  return step.tablature?.some(tab =>
    tab.role === "melody" || tab.role === "bass" || tab.role === "root" || tab.role === "fifth") ?? false;
}

function normalizeChord(chord: string): string {
  return chord.trim().replace(/\s+/g, "").toLowerCase();
}

function provenance(supplied: boolean): "supplied" | "defaulted" {
  return supplied ? "supplied" : "defaulted";
}

export function emitDPConfiguration(
  log: DPDiagnosticLogger,
  options: DPOptions,
  bpm: number,
  skillLevel: SkillLevel,
  bpmWasSupplied: boolean
): void {
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
      maxMelodyFret: options.maxMelodyFret ?? SKILL_LEVEL_CONSTRAINTS[skillLevel].maxFret,
      recurringShapeMismatchCost: RECURRING_SHAPE_MISMATCH_COST,
      costConstants: { ...DP_COST_CONSTANTS },
    },
    provenance: {
      bpm: provenance(bpmWasSupplied),
      skillLevel: provenance(options.skillLevel !== undefined),
      capo: provenance(options.capo !== undefined),
      autoCapo: provenance(options.autoCapo !== undefined),
      maxCapo: provenance(options.maxCapo !== undefined),
      candidateCap: "constant",
      tuningMidi: "constant",
      skillConstraints: "derived",
      maxMelodyFret: options.maxMelodyFret === undefined ? "derived" : "supplied",
      recurringShapeMismatchCost: "constant",
      costConstants: "constant",
    },
  });
}

export function extractTimeSliceEvents(
  measures: TimeSliceMeasure[],
  bpm: number,
  log: DPDiagnosticLogger,
  maxMelodyFret?: number,
): { events: DPNoteEvent[]; bindings: TimeSliceDPBinding[]; totalGridSteps: number } {
  const events: DPNoteEvent[] = [];
  const bindings: TimeSliceDPBinding[] = [];
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
      const bassTabIndex = tablature.findIndex(tab =>
        tab.role === "bass" || tab.role === "root" || tab.role === "fifth");
      const absoluteOnsetStep = measureOffsets[measureIndex] + stepIndex;
      const fixedFrets: (number | null)[] = [null, null, null, null, null, null];
      const fixedEntries: FixedEntrySnapshot[] = [];

      for (let tabIndex = 0; tabIndex < tablature.length; tabIndex++) {
        const tab = tablature[tabIndex];
        if (tab.string < 1 || tab.string > 6 || !Number.isInteger(tab.fret) || tab.fret < 0) {
          log.event({
            type: "input-anomaly",
            phase: "extraction",
            severity: "warning",
            code: "invalid-physical-position",
            eventIndex: events.length,
            measureIndex,
            stepIndex,
            details: { tabIndex, string: tab.string, fret: tab.fret },
          });
        }
        if (tabIndex === melodyTabIndex || tabIndex === bassTabIndex) continue;
        fixedEntries.push({ tabIndex, tab: { ...tab } });
        const stringIndex = stringToIndex(tab.string);
        if (fixedFrets[stringIndex] !== null) {
          log.event({
            type: "input-anomaly",
            phase: "extraction",
            severity: "warning",
            code: "duplicate-fixed-string-occupancy",
            eventIndex: events.length,
            measureIndex,
            stepIndex,
            details: { tabIndex, string: tab.string, previousFret: fixedFrets[stringIndex], fret: tab.fret },
          });
        }
        fixedFrets[stringIndex] = tab.fret;
      }

      const melodyTab = melodyTabIndex >= 0 ? tablature[melodyTabIndex] : null;
      const bassTab = bassTabIndex >= 0 ? tablature[bassTabIndex] : null;
      const parsedMelody = step.melody.pitch ? parseScientificPitch(step.melody.pitch) : null;
      if (step.melody.pitch && !parsedMelody) {
        log.event({
          type: "input-anomaly",
          phase: "extraction",
          severity: "warning",
          code: "unparseable-melody-pitch",
          eventIndex: events.length,
          measureIndex,
          stepIndex,
          details: { pitch: step.melody.pitch },
        });
      }
      if (step.melody.state === "attack" && melodyTabIndex < 0) {
        log.event({
          type: "input-anomaly",
          phase: "extraction",
          severity: "warning",
          code: "missing-movable-tab",
          eventIndex: events.length,
          measureIndex,
          stepIndex,
          details: { role: "melody" },
        });
      }

      const authoritativeMelodyMidi = parsedMelody?.midi ?? null;
      const submittedMelodyMidi = melodyTab
        ? midiForStringFret(melodyTab.string, melodyTab.fret)
        : null;
      const melodyMidi = melodyTab ? authoritativeMelodyMidi ?? submittedMelodyMidi : null;
      const bassMidi = bassTab ? midiForStringFret(bassTab.string, bassTab.fret) : null;
      bindings.push({
        measureIndex,
        stepIndex,
        melodyTabIndex: melodyTabIndex >= 0 ? melodyTabIndex : null,
        bassTabIndex: bassTabIndex >= 0 ? bassTabIndex : null,
        absoluteOnsetStep,
        authoritativeMelodyMidi,
        submittedMelodyMidi,
        fixedEntries,
      });
      events.push({
        index: events.length,
        absoluteOnsetStep,
        fixedFrets,
        melodyMidi,
        maxMelodyFret,
        bassMidi,
        chord: step.chord || "N.C.",
        durationSteps: 1,
        bpm,
        isRest: false,
      });
    }
  }

  for (let index = 0; index < events.length; index++) {
    const nextOnset = events[index + 1]?.absoluteOnsetStep ?? totalGridSteps;
    const onset = events[index].absoluteOnsetStep ?? 0;
    const previousOnset = events[index - 1]?.absoluteOnsetStep;
    events[index].durationSteps = Math.max(1, nextOnset - onset);
    events[index].movementSteps = Math.max(1, previousOnset === undefined ? onset : onset - previousOnset);
    const binding = bindings[index];
    log.item(index, [
      `M${binding.measureIndex + 1}/s${binding.stepIndex + 1}`,
      `chord=${events[index].chord}`,
      `mel=${midiToNoteName(events[index].melodyMidi)}`,
      `bass=${midiToNoteName(events[index].bassMidi)}`,
      `dur=${events[index].durationSteps}steps`,
    ].join(" | "));
    log.event({
      type: "input-binding",
      phase: "extraction",
      eventIndex: index,
      measureIndex: binding.measureIndex,
      stepIndex: binding.stepIndex,
      absoluteOnsetStep: binding.absoluteOnsetStep,
      durationSteps: events[index].durationSteps,
      movementSteps: events[index].movementSteps ?? events[index].durationSteps,
      movementSeconds: (events[index].movementSteps ?? events[index].durationSteps) * dpStepDurationSeconds(bpm),
      chord: events[index].chord,
      normalizedChord: normalizeChord(events[index].chord),
      melodyTabIndex: binding.melodyTabIndex,
      bassTabIndex: binding.bassTabIndex,
      authoritativeMelodyMidi: binding.authoritativeMelodyMidi,
      submittedMelodyMidi: binding.submittedMelodyMidi,
      effectiveMelodyMidi: events[index].melodyMidi,
      bassMidi: events[index].bassMidi,
      bassPitchSource: binding.bassTabIndex === null ? "none" : "submitted-tab",
      fixedFrets: [...(events[index].fixedFrets ?? [])],
    });
  }

  log.entry("Total DP events extracted", events.length);
  log.event({
    type: "input-extraction",
    phase: "extraction",
    source: "time-slice",
    measureCount: measures.length,
    inputEventCount: measures.reduce((sum, measure) =>
      sum + measure.grid.reduce((stepSum, step) => stepSum + (step.tablature?.length ?? 0), 0), 0),
    extractedEventCount: events.length,
  });
  return { events, bindings, totalGridSteps };
}
