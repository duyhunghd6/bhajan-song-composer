import { buildGeneratedGuitarAbc } from "@/lib/theory/fingerstyle-arranger/guitar-abc-output";
import type { TimeSliceMeasure } from "@/lib/theory/fingerstyle-arranger/time-slice";

export { buildGeneratedGuitarAbc };

const FINGERSTYLE_MEASURES_VERSION = 1;

interface PersistedFingerstyleMeasures {
  version: typeof FINGERSTYLE_MEASURES_VERSION;
  sourceFingerprint: string;
  measures: TimeSliceMeasure[];
}

function isValidTablature(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((event) => {
    if (!event || typeof event !== "object") return false;
    const tab = event as Record<string, unknown>;
    return Number.isInteger(tab.string)
      && Number(tab.string) >= 1
      && Number(tab.string) <= 6
      && Number.isInteger(tab.fret)
      && Number(tab.fret) >= 0
      && Number(tab.fret) <= 24;
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
): TimeSliceMeasure[] {
  if (!saved) return fresh;

  const parsed: unknown = JSON.parse(saved);
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

  return fresh.map((measure, measureIndex) => ({
    ...measure,
    visualTablature: persisted[measureIndex]?.visualTablature,
    grid: measure.grid.map((step, stepIndex) => ({
      ...step,
      tablature: persisted[measureIndex]?.grid[stepIndex]?.tablature,
    })),
  }));
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
