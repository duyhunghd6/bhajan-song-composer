import { buildGeneratedGuitarAbc } from "@/lib/theory/fingerstyle-arranger/guitar-abc-output";
import {
  validateFingerstylePhysicsDetailed,
  type FingerstylePhysicsOptions,
} from "@/lib/theory/fingerstyle-arranger/physics-validation";
import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import type { FingerstyleLineGenerationRun } from "@/app/actions/fingerstyle-line-arranger";
import { validateGuitarMeasureContinuity } from "@/lib/theory/fingerstyle-arranger/timegrid-document-codec-v3";
import type { FillOpportunityAnalysis } from "@/lib/theory/fingerstyle-arranger/fill-opportunities";

export { buildGeneratedGuitarAbc };

const FINGERSTYLE_MEASURES_VERSION = 2;

type PersistedFingerstyleMeasures = {
  version: typeof FINGERSTYLE_MEASURES_VERSION;
  sourceFingerprint: string;
  measures: TimeSliceMeasure[];
  lineGenerationRunsByLine?: Record<string, FingerstyleLineGenerationRun>;
};

type LegacyPersistedFingerstyleMeasures = {
  version: 1;
  sourceFingerprint: string;
  measures: TimeSliceMeasure[];
};

const FINGERS = new Set(["p", "i", "m", "a", null]);
const ROLES = new Set(["bass", "melody", "fill", "harmony", "root", "fifth", "imported"]);

function isValidTablature(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;

  const strings = new Set<number>();
  return value.every((event) => {
    if (!event || typeof event !== "object") return false;
    const tab = event as Record<string, unknown>;
    const isFill = tab.role === "fill";
    const hasCompleteFillProvenance = typeof tab.fillWindowId === "string"
      && tab.fillWindowId.length > 0
      && typeof tab.fillCandidateId === "string"
      && tab.fillCandidateId.length > 0;
    const hasNoFillProvenance = tab.fillWindowId === undefined && tab.fillCandidateId === undefined;
    const valid = Number.isInteger(tab.string)
      && Number(tab.string) >= 1
      && Number(tab.string) <= 6
      && Number.isInteger(tab.fret)
      && Number(tab.fret) >= 0
      && Number(tab.fret) <= 24
      && FINGERS.has(tab.finger as string | null)
      && ROLES.has(tab.role as string)
      && (tab.durationSteps === undefined || (Number.isInteger(tab.durationSteps) && Number(tab.durationSteps) > 0))
      && (isFill ? hasCompleteFillProvenance || hasNoFillProvenance : hasNoFillProvenance);
    if (!valid || strings.has(tab.string as number)) return false;
    strings.add(tab.string as number);
    return true;
  });
}

function arePersistedMeasuresCompatible(
  persisted: TimeSliceMeasure[],
  fresh: TimeSliceMeasure[],
  requireMatchingSource: boolean,
): boolean {
  return persisted.length === fresh.length && persisted.every((measure, index) => {
    const current = fresh[index];
    if (!current || measure.measure !== current.measure || !Array.isArray(measure.grid)) return false;
    if (measure.grid.length !== current.grid.length) return false;
    if (requireMatchingSource) {
      if (!measure.source_abc || !current.source_abc) return false;
      if (JSON.stringify(measure.source_abc) !== JSON.stringify(current.source_abc)) return false;
    }
    return measure.grid.every((step, stepIndex) => (
      step.step === current.grid[stepIndex]?.step && isValidTablature(step.tablature)
    ));
  });
}

export function restorePersistedTablature(
  saved: string | null,
  fresh: TimeSliceMeasure[],
  sourceFingerprint: string,
  validationOptions?: FingerstylePhysicsOptions,
): TimeSliceMeasure[] {
  if (!saved) return fresh;

  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return fresh;
  }
  const isLegacy = Array.isArray(parsed);
  const envelope = !isLegacy && parsed && typeof parsed === "object"
    ? parsed as Partial<PersistedFingerstyleMeasures | LegacyPersistedFingerstyleMeasures>
    : null;
  const persisted = isLegacy ? parsed as TimeSliceMeasure[] : envelope?.measures;

  if (!Array.isArray(persisted)) return fresh;
  if (!isLegacy && (
    (envelope?.version !== 1 && envelope?.version !== FINGERSTYLE_MEASURES_VERSION)
    || envelope.sourceFingerprint !== sourceFingerprint
  )) return fresh;
  if (!arePersistedMeasuresCompatible(persisted, fresh, isLegacy)) return fresh;
  try {
    validateGuitarMeasureContinuity(persisted);
  } catch {
    return fresh;
  }

  const restored = fresh.map((measure, measureIndex) => {
    const persistedMeasure = persisted[measureIndex];
    return {
      ...measure,
      visualTablature: persistedMeasure?.visualTablature,
      guitarSlurs: persistedMeasure?.guitarSlurs?.map(slur => ({ ...slur })),
      guitarTiesToNext: persistedMeasure?.guitarTiesToNext
        ? [...persistedMeasure.guitarTiesToNext]
        : undefined,
      guitarSlursToNext: persistedMeasure?.guitarSlursToNext?.map(slur => ({ ...slur })),
      grid: measure.grid.map((step, stepIndex) => ({
        ...step,
        tablature: persistedMeasure?.grid[stepIndex]?.tablature,
      })),
    };
  });

  return restored.every(measure => (
    validateFingerstylePhysicsDetailed(measure.grid, validationOptions).valid
  )) ? restored : fresh;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRestorableGenerationRun(value: unknown, sourceFingerprint: string, fresh: TimeSliceMeasure[]): value is FingerstyleLineGenerationRun {
  if (!isRecord(value)) return false;
  const run = value as Partial<FingerstyleLineGenerationRun>;
  if (
    run.version !== 1
    || typeof run.id !== "string" || !run.id
    || run.sourceFingerprint !== sourceFingerprint
    || !Number.isSafeInteger(run.lineIndex)
    || !Array.isArray(run.measureNumbers) || !run.measureNumbers.every(Number.isSafeInteger)
    || !Array.isArray(run.foundation)
    || !isRecord(run.opportunityAnalysis)
    || typeof run.opportunityAnalysis.opportunitySetId !== "string" || !run.opportunityAnalysis.opportunitySetId
    || !Array.isArray(run.opportunityAnalysis.windows)
    || !Array.isArray(run.opportunityAnalysis.candidates)
    || !Array.isArray(run.options) || run.options.length === 0
    || typeof run.selectedOptionId !== "string" || !run.selectedOptionId
  ) return false;
  const line = fresh.filter(measure => measure.lineIndex === run.lineIndex);
  if (line.length === 0 || JSON.stringify(line.map(measure => measure.measure)) !== JSON.stringify(run.measureNumbers)) return false;

  const optionIds = new Set<string>();
  let selectedCount = 0;
  for (const option of run.options) {
    if (!isRecord(option) || typeof option.id !== "string" || !option.id || !Number.isSafeInteger(option.ordinal) || option.ordinal < 1) return false;
    if (optionIds.has(option.id)) return false;
    optionIds.add(option.id);
    if (option.id === run.selectedOptionId) selectedCount += 1;
    if (!isRecord(option.selection) || !isRecord(option.composition)) return false;
    if (
      option.selection.sourceFingerprint !== sourceFingerprint
      || option.composition.sourceFingerprint !== sourceFingerprint
      || option.selection.opportunitySetId !== run.opportunityAnalysis.opportunitySetId
      || option.composition.opportunitySetId !== run.opportunityAnalysis.opportunitySetId
      || !Array.isArray(option.selection.decisions)
      || !Array.isArray(option.composition.entries)
    ) return false;
  }
  return selectedCount === 1;
}

export function restoreFingerstyleGenerationRuns(
  saved: string | null,
  fresh: TimeSliceMeasure[],
  sourceFingerprint: string,
): Record<number, FingerstyleLineGenerationRun> {
  if (!saved) return {};
  try {
    const parsed = JSON.parse(saved) as Partial<PersistedFingerstyleMeasures>;
    if (parsed.version !== FINGERSTYLE_MEASURES_VERSION || parsed.sourceFingerprint !== sourceFingerprint) return {};
    const records = parsed.lineGenerationRunsByLine;
    if (!records || typeof records !== "object") return {};
    return Object.fromEntries(
      Object.entries(records)
        .filter(([lineIndex, run]) => (
          Number.isSafeInteger(Number(lineIndex))
          && String(Number(lineIndex)) === lineIndex
          && isRestorableGenerationRun(run, sourceFingerprint, fresh)
          && run.lineIndex === Number(lineIndex)
        ))
        .map(([lineIndex, run]) => [Number(lineIndex), run]),
    );
  } catch {
    return {};
  }
}

function pruneFingerstyleLineGenerationRun(
  run: FingerstyleLineGenerationRun,
): FingerstyleLineGenerationRun {
  return {
    version: run.version,
    id: run.id,
    sourceFingerprint: run.sourceFingerprint,
    lineIndex: run.lineIndex,
    measureNumbers: run.measureNumbers,
    policy: run.policy,
    foundation: run.foundation.map((measure) => ({
      measure: measure.measure,
      lineIndex: measure.lineIndex,
      style_profile: measure.style_profile,
      pickupDurationUnits: measure.pickupDurationUnits,
      sourceDurationUnits: measure.sourceDurationUnits,
      barline: measure.barline,
      guitarSlurs: measure.guitarSlurs,
      guitarTiesToNext: measure.guitarTiesToNext,
      guitarSlursToNext: measure.guitarSlursToNext,
      source_abc: measure.source_abc,
      grid: measure.grid.map((step) => ({
        step: step.step,
        chord: step.chord,
        weight: step.weight,
        melody: step.melody,
        lyric: step.lyric,
        tablature: step.tablature,
      })),
    })),
    opportunityAnalysis: {
      version: run.opportunityAnalysis.version,
      opportunitySetId: run.opportunityAnalysis.opportunitySetId,
      sourceFingerprint: run.opportunityAnalysis.sourceFingerprint,
      policy: run.opportunityAnalysis.policy,
      budget: run.opportunityAnalysis.budget,
      evaluatedStepCount: run.opportunityAnalysis.evaluatedStepCount,
      evaluatedPlacementCount: run.opportunityAnalysis.evaluatedPlacementCount,
      rejectionCounts: run.opportunityAnalysis.rejectionCounts,
      windows: run.opportunityAnalysis.windows.map((w) => ({
        id: w.id,
        measure: w.measure,
        startStep: w.startStep,
        endStep: w.endStep,
      })),
      candidates: run.opportunityAnalysis.candidates.map((c) => ({
        id: c.id,
        windowId: c.windowId,
        measure: c.measure,
        step: c.step,
        string: c.string,
        fret: c.fret,
        maxDurationSteps: c.maxDurationSteps,
        harmonicRole: c.harmonicRole,
        midi: c.midi,
      })),
    } as unknown as FillOpportunityAnalysis,
    options: run.options.map((option) => ({
      id: option.id,
      ordinal: option.ordinal,
      selection: {
        version: option.selection.version,
        opportunitySetId: option.selection.opportunitySetId,
        sourceFingerprint: option.selection.sourceFingerprint,
        decisions: option.selection.decisions.map((d) => ({
          windowId: d.windowId,
          decision: d.decision,
          reason: d.reason,
        })),
      },
      composition: {
        version: option.composition.version,
        opportunitySetId: option.composition.opportunitySetId,
        sourceFingerprint: option.composition.sourceFingerprint,
        entries: option.composition.entries,
      },
      fillSummary: option.fillSummary,
    })),
    selectedOptionId: run.selectedOptionId,
  };
}


export function serializeFingerstyleMeasures(
  measures: TimeSliceMeasure[],
  sourceFingerprint: string,
  lineGenerationRunsByLine: Record<number, FingerstyleLineGenerationRun> = {},
): string {
  const payload: PersistedFingerstyleMeasures = {
    version: FINGERSTYLE_MEASURES_VERSION,
    sourceFingerprint,
    measures,
    lineGenerationRunsByLine: Object.fromEntries(
      Object.entries(lineGenerationRunsByLine)
        .filter(([, run]) => isRestorableGenerationRun(run, sourceFingerprint, measures))
        .map(([lineIndex, run]) => [lineIndex, pruneFingerstyleLineGenerationRun(run)]),
    ),
  };
  return JSON.stringify(payload);
}
