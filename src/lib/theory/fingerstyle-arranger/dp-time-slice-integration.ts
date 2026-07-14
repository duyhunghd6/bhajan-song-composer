import { midiForStringFret } from "../guitar-playability";
import { optimizeWithCapo } from "./dp-capo";
import type { DPCandidateOrigin, FingerstyleDiagnosticRun } from "./dp-diagnostics";
import { optimizeFingerstylePath } from "./dp-optimizer";
import {
  validateFingerstylePhysicsDetailed,
  type FingerstylePhysicsIssue,
} from "./physics-validation";
import {
  emitDPConfiguration,
  extractTimeSliceEvents,
  type TimeSliceDPBinding,
  type TimeSliceTab,
} from "./dp-time-slice-extraction";
import type { TimeSliceMeasure } from "./time-slice";
import type { DPOptions, DPResult } from "./dp-types";
import { DPDiagnosticLogger } from "./dp-types";

export interface ApplyDPToTimeSliceMeasuresResult {
  measures: TimeSliceMeasure[];
  logs: string[];
  diagnostics: FingerstyleDiagnosticRun;
}

function sameTab(left: TimeSliceTab, right: TimeSliceTab): boolean {
  return left.string === right.string
    && left.fret === right.fret
    && left.finger === right.finger
    && left.role === right.role;
}

function uniqueIssueCodes(issues: readonly FingerstylePhysicsIssue[]): string[] {
  return [...new Set(issues.map(issue => issue.code))];
}

function difference(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return left.filter(value => !rightSet.has(value));
}

function emitWriteback(
  log: DPDiagnosticLogger,
  input: {
    eventIndex: number;
    binding: TimeSliceDPBinding;
    role: "melody" | "bass";
    tabIndex: number;
    tab: TimeSliceTab;
    selectedString: number | null;
    selectedFret: number;
    selectedMidi: number | null;
    origin: DPCandidateOrigin;
    requestedMidi: number | null;
    result: "changed" | "unchanged" | "unresolved" | "rejected";
  }
): void {
  log.event({
    type: "writeback",
    phase: "writeback",
    severity: input.result === "unresolved" || input.result === "rejected" ? "warning" : "info",
    eventIndex: input.eventIndex,
    measureIndex: input.binding.measureIndex,
    stepIndex: input.binding.stepIndex,
    role: input.role,
    tabIndex: input.tabIndex,
    submitted: {
      string: input.tab.string,
      fret: input.tab.fret,
      midi: midiForStringFret(input.tab.string, input.tab.fret),
    },
    selected: {
      string: input.selectedString,
      fret: input.selectedFret,
      midi: input.selectedMidi,
      origin: input.origin,
    },
    requestedMidi: input.requestedMidi,
    pitchInvariant: input.selectedMidi === input.requestedMidi,
    result: input.result,
  });
}

export function applyDPToTimeSliceMeasures(
  measures: TimeSliceMeasure[],
  bpm?: number,
  options: DPOptions = {}
): ApplyDPToTimeSliceMeasuresResult {
  const bpmWasSupplied = bpm !== undefined;
  bpm ??= 120;
  const startedAt = Date.now();
  const log = new DPDiagnosticLogger();
  const skillLevel = options.skillLevel ?? "intermediate";
  log.section("DP FINGERSTYLE OPTIMIZATION (TIME-SLICE)");
  log.entry("Skill level", skillLevel);
  log.entry("BPM", bpm);
  log.entry("Auto capo", options.autoCapo ?? false);
  log.entry("Fixed capo", options.capo ?? 0);
  log.entry("Measures", measures.length);
  emitDPConfiguration(log, options, bpm, skillLevel, bpmWasSupplied);

  const extractionStartedAt = Date.now();
  const { events, bindings } = extractTimeSliceEvents(measures, bpm, log, options.maxMelodyFret);
  log.event({ type: "phase-timing", phase: "extraction", name: "extraction", elapsedMs: Date.now() - extractionStartedAt });
  const result: DPResult = options.autoCapo
    ? optimizeWithCapo(events, skillLevel, options.maxCapo, log)
    : optimizeFingerstylePath(events, skillLevel, options.capo ?? 0, log);

  log.section("APPLY DP RESULT TO TIME-SLICE");
  const writebackStartedAt = Date.now();
  let writebackValid = result.path.length === bindings.length;
  let rollbackReason: "path-binding-count-mismatch" | "pitch-invariant-failed" | "new-physics-issue" | null = null;
  const updatedMeasures: TimeSliceMeasure[] = JSON.parse(JSON.stringify(measures));
  const changedEventIndexes = new Set<number>();
  const unresolvedEventIndexes = new Set<number>();

  if (!writebackValid) {
    rollbackReason = "path-binding-count-mismatch";
    log.event({
      type: "rollback",
      phase: "rollback",
      severity: "error",
      reason: rollbackReason,
      details: { pathLength: result.path.length, bindingCount: bindings.length },
    });
  }

  for (let index = 0; writebackValid && index < bindings.length; index++) {
    const binding = bindings[index];
    const candidate = result.path[index];
    const event = events[index];
    const step = updatedMeasures[binding.measureIndex].grid[binding.stepIndex];
    const tablature = step.tablature ?? [];
    const origin = candidate.origin ?? "generated";

    if (origin === "fallback-noop") unresolvedEventIndexes.add(index);
    const assignments: { role: "melody" | "bass"; tabIndex: number; selectedString: number | null; selectedFret: number; requestedMidi: number | null }[] = [];
    if (binding.melodyTabIndex !== null) {
      assignments.push({
        role: "melody",
        tabIndex: binding.melodyTabIndex,
        selectedString: candidate.melodyString,
        selectedFret: candidate.melodyFret,
        requestedMidi: event.melodyMidi,
      });
    }
    if (binding.bassTabIndex !== null) {
      assignments.push({
        role: "bass",
        tabIndex: binding.bassTabIndex,
        selectedString: candidate.bassString,
        selectedFret: candidate.bassFret,
        requestedMidi: event.bassMidi,
      });
    }

    for (const assignment of assignments) {
      const tab = tablature[assignment.tabIndex];
      const selectedMidi = assignment.selectedString === null
        ? null
        : midiForStringFret(assignment.selectedString as 1 | 2 | 3 | 4 | 5 | 6, assignment.selectedFret);
      if (origin === "fallback-noop" || assignment.selectedString === null) {
        emitWriteback(log, {
          eventIndex: index,
          binding,
          ...assignment,
          tab,
          selectedMidi,
          origin,
          result: "unresolved",
        });
        continue;
      }
      if (selectedMidi !== assignment.requestedMidi) {
        writebackValid = false;
        rollbackReason = "pitch-invariant-failed";
        log.log(`  ⚠ M${binding.measureIndex + 1}/s${binding.stepIndex + 1} ${assignment.role} pitch invariant failed`);
        emitWriteback(log, {
          eventIndex: index,
          binding,
          ...assignment,
          tab,
          selectedMidi,
          origin,
          result: "rejected",
        });
        log.event({
          type: "rollback",
          phase: "rollback",
          severity: "error",
          reason: rollbackReason,
          measureIndex: binding.measureIndex,
          eventIndex: index,
          details: { role: assignment.role, requestedMidi: assignment.requestedMidi, selectedMidi },
        });
        break;
      }

      const changed = tab.string !== assignment.selectedString || tab.fret !== assignment.selectedFret;
      if (changed) {
        changedEventIndexes.add(index);
        log.log(`  M${binding.measureIndex + 1}/s${binding.stepIndex + 1} ${assignment.role}: s${tab.string}/f${tab.fret} → s${assignment.selectedString}/f${assignment.selectedFret}`);
      }
      emitWriteback(log, {
        eventIndex: index,
        binding,
        ...assignment,
        tab,
        selectedMidi,
        origin,
        result: changed ? "changed" : "unchanged",
      });
      tab.string = assignment.selectedString as 1 | 2 | 3 | 4 | 5 | 6;
      tab.fret = assignment.selectedFret;
    }

    for (const fixedEntry of binding.fixedEntries) {
      const current = tablature[fixedEntry.tabIndex];
      log.event({
        type: "fixed-entry-check",
        phase: "writeback",
        severity: current && sameTab(current, fixedEntry.tab) ? "info" : "error",
        measureIndex: binding.measureIndex,
        stepIndex: binding.stepIndex,
        tabIndex: fixedEntry.tabIndex,
        role: fixedEntry.tab.role,
        unchanged: current !== undefined && sameTab(current, fixedEntry.tab),
      });
    }
  }
  log.event({ type: "phase-timing", phase: "writeback", name: "writeback", elapsedMs: Date.now() - writebackStartedAt });

  const validationStartedAt = Date.now();
  if (writebackValid) {
    for (let measureIndex = 0; measureIndex < updatedMeasures.length; measureIndex++) {
      const validationOptions = {
        fillDensity: updatedMeasures[measureIndex].style_profile.fill_density,
        skillLevel,
        maxMelodyFret: options.maxMelodyFret,
      };
      const before = validateFingerstylePhysicsDetailed(measures[measureIndex].grid, validationOptions);
      const after = validateFingerstylePhysicsDetailed(updatedMeasures[measureIndex].grid, validationOptions);
      const beforeCodes = uniqueIssueCodes(before.issues);
      const afterCodes = uniqueIssueCodes(after.issues);
      const introducedIssueCodes = difference(afterCodes, beforeCodes);
      const rollbackTriggered = !after.valid && before.valid;
      log.event({
        type: "validation",
        phase: "validation",
        severity: after.valid ? "info" : "warning",
        measureIndex,
        beforeIssueCodes: beforeCodes,
        afterIssueCodes: afterCodes,
        resolvedIssueCodes: difference(beforeCodes, afterCodes),
        retainedIssueCodes: afterCodes.filter(code => beforeCodes.includes(code)),
        introducedIssueCodes,
        rollbackTriggered,
      });
      if (rollbackTriggered) {
        writebackValid = false;
        rollbackReason = "new-physics-issue";
        log.log(`  ⚠ POST-DP PHYSICS VALIDATION M${updatedMeasures[measureIndex].measure}: ${after.message}`);
        log.event({
          type: "rollback",
          phase: "rollback",
          severity: "error",
          reason: rollbackReason,
          measureIndex,
          details: { beforeIssueCodes: beforeCodes, afterIssueCodes: afterCodes, message: after.message },
        });
        break;
      }
      if (!after.valid) {
        log.log(`  ⚠ M${updatedMeasures[measureIndex].measure} retains pre-existing validation issues after pitch-safe DP writeback.`);
      }
    }
  }
  log.event({ type: "phase-timing", phase: "validation", name: "validation", elapsedMs: Date.now() - validationStartedAt });

  const unresolvedEventCount = unresolvedEventIndexes.size;
  const changedEventCount = changedEventIndexes.size;
  const resolvedEventCount = Math.max(0, events.length - unresolvedEventCount);
  const unchangedEventCount = Math.max(0, resolvedEventCount - changedEventCount);
  const outcome = !writebackValid
    ? "rolled-back"
    : unresolvedEventCount > 0
      ? "accepted-with-unresolved-events"
      : changedEventCount === 0
        ? "no-effective-dp-change"
        : "accepted";
  log.entry("Events updated", changedEventCount);
  log.entry("Events unresolved", unresolvedEventCount);
  log.section("DP FINGERSTYLE OPTIMIZATION COMPLETE");
  log.entry("Final total cost", result.totalCost.toFixed(2));
  log.entry("Selected capo", result.capo);
  log.entry("Writeback", writebackValid ? "accepted" : "rolled back");
  if (rollbackReason) log.entry("Rollback reason", rollbackReason);
  log.event({
    type: "run-summary",
    phase: "summary",
    outcome,
    inputEventCount: events.length,
    resolvedEventCount,
    unresolvedEventCount,
    changedEventCount,
    unchangedEventCount,
    totalCost: result.totalCost,
    elapsedMs: Date.now() - startedAt,
  });
  log.collector.complete(outcome);

  return {
    measures: writebackValid ? updatedMeasures : measures,
    logs: log.getLines(),
    diagnostics: log.getDiagnostics(),
  };
}
