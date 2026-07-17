import { buildGeneratedGuitarAbc } from "@/lib/theory/fingerstyle-arranger/guitar-abc-output";
import {
  validateFingerstylePhysicsDetailed,
  type FingerstylePhysicsOptions,
} from "@/lib/theory/fingerstyle-arranger/physics-validation";
import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";
import { validateGuitarMeasureContinuity } from "@/lib/theory/fingerstyle-arranger/timegrid-document-codec-v3";

export { buildGeneratedGuitarAbc };

const FINGERSTYLE_MEASURES_VERSION = 1;

interface PersistedFingerstyleMeasures {
  version: typeof FINGERSTYLE_MEASURES_VERSION;
  sourceFingerprint: string;
  measures: TimeSliceMeasure[];
}

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
    ? parsed as Partial<PersistedFingerstyleMeasures>
    : null;
  const persisted = isLegacy ? parsed as TimeSliceMeasure[] : envelope?.measures;

  if (!Array.isArray(persisted)) return fresh;
  if (!isLegacy && (
    envelope?.version !== FINGERSTYLE_MEASURES_VERSION
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

export function serializeFingerstyleMeasures(
  measures: TimeSliceMeasure[],
  sourceFingerprint: string,
): string {
  const payload: PersistedFingerstyleMeasures = {
    version: FINGERSTYLE_MEASURES_VERSION,
    sourceFingerprint,
    measures,
  };
  return JSON.stringify(payload);
}
