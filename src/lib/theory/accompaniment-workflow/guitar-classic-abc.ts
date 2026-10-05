import { buildAbcDurationContext } from "../abc-duration";
import { getKeyAccidentalsFromAbc } from "../abc-key-signature";
import {
  convertAbcToTimeSliceGrid,
  groupMeasuresByLine,
  joinMeasureAbcWithBarlines,
  type TimeSliceGridStep,
  type TimeSliceMeasure,
} from "../fingerstyle-arranger/time-slice";
import { renderTimeSliceMeasuresToAbc } from "../fingerstyle-arranger/time-slice-abc-renderer";
import { validateGuitarTab, type GuitarTabEvent } from "../guitar-tab-validation";

const GRID_ROLE_BY_EVENT_ROLE: Record<string, NonNullable<TimeSliceGridStep["tablature"]>[number]["role"]> = {
  bass: "bass",
  melody: "melody",
  fill: "fill",
  harmony: "harmony",
  root: "root",
  fifth: "fifth",
};

export interface GuitarClassicAbcConversionResult {
  abc: string | null;
  errors: string[];
  renderedEventCount: number;
  measureCount: number;
  migrationError?: boolean;
}

function gridRole(role: string): NonNullable<TimeSliceGridStep["tablature"]>[number]["role"] {
  const normalized = role.toLowerCase();
  if (normalized.includes("bass") || normalized.includes("thumb")) return "bass";
  if (normalized.includes("root")) return "root";
  if (normalized.includes("fifth")) return "fifth";
  if (normalized.includes("melody")) return "melody";
  return GRID_ROLE_BY_EVENT_ROLE[normalized] ?? "harmony";
}

function activeStepCount(measure: TimeSliceMeasure, stepDurationUnits: number): number {
  if (!measure.pickupDurationUnits || measure.pickupDurationUnits <= 0) return measure.grid.length;
  return Math.max(0, Math.min(measure.grid.length, Math.ceil(measure.pickupDurationUnits / stepDurationUnits)));
}

function emptyGuitarGrid(source: TimeSliceMeasure[]): TimeSliceMeasure[] {
  return source.map((measure) => ({
    ...measure,
    grid: measure.grid.map((step) => ({ ...step, tablature: undefined })),
    guitarTiesToNext: undefined,
    guitarSlurs: undefined,
    guitarSlursToNext: undefined,
  }));
}

function migrationFailure(message: string): Pick<GuitarClassicAbcConversionResult, "abc" | "errors" | "renderedEventCount" | "measureCount" | "migrationError"> {
  return { abc: null, errors: [message], renderedEventCount: 0, measureCount: 0, migrationError: true };
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

/**
 * Legacy Step 5 events supplied only measure + beat. Derive timing transiently
 * from the exact selected Harmony Step 3 grid; never mutate persisted data.
 */
function prepareEventsForSource(
  events: GuitarTabEvent[],
  measures: TimeSliceMeasure[],
  stepDurationUnits: number,
): { events: GuitarTabEvent[] } | { error: string } {
  const hasTimed = events.map((event) => event.step !== undefined || event.durationSteps !== undefined);
  if (hasTimed.some(Boolean) && hasTimed.some((value) => !value)) {
    return { error: "This saved Guitar Voicing mixes old and partial timing data. Regenerate Step 5, then build Guitar ABC again." };
  }

  if (hasTimed.every(Boolean)) {
    if (events.some((event) => !isPositiveInteger(event.step) || !isPositiveInteger(event.durationSteps))) {
      return { error: "This saved Guitar Voicing has incomplete timing data. Regenerate Step 5, then build Guitar ABC again." };
    }
    return { events };
  }

  const sourceMeasureCount = measures.length;
  const indices = events.map((event) => event.measureIndex);
  const zeroBased = indices.every((index) => Number.isInteger(index) && index >= 0 && index < sourceMeasureCount);
  const oneBased = indices.every((index) => Number.isInteger(index) && index >= 1 && index <= sourceMeasureCount);
  if (!zeroBased && !oneBased) {
    return { error: "This saved Guitar Voicing references measures outside this score. Regenerate Step 5, then build Guitar ABC again." };
  }

  // Persisted workflow data shown to people has historically used one-based
  // measure labels. When an old selection has no measure 0/N sentinel, keep
  // those visible labels stable rather than rejecting the whole arrangement.
  const useZeroBasedMeasures = zeroBased && !oneBased;
  const migrated = events.map((event) => {
    const measureIndex = useZeroBasedMeasures ? event.measureIndex + 1 : event.measureIndex;
    const measure = measures.find((candidate) => candidate.measure === measureIndex);
    const rawStepOffset = (event.beat - 1) * 4;
    const activeSteps = measure ? activeStepCount(measure, stepDurationUnits) : 0;
    if (!measure || !Number.isFinite(event.beat) || !Number.isInteger(rawStepOffset) || rawStepOffset < 0 || rawStepOffset >= activeSteps) {
      return null;
    }
    return { ...event, measureIndex, step: rawStepOffset + 1 };
  });
  if (migrated.some((event) => event === null)) {
    return { error: "This saved Guitar Voicing uses timing that cannot be mapped safely to this score. Regenerate Step 5, then build Guitar ABC again." };
  }

  const groups = new Map<string, GuitarTabEvent[]>();
  for (const event of migrated as GuitarTabEvent[]) {
    const key = `${event.measureIndex}:${event.step}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const prepared: GuitarTabEvent[] = [];
  for (const measure of measures) {
    const activeSteps = activeStepCount(measure, stepDurationUnits);
    const steps = [...groups.values()]
      .filter((group) => group[0]?.measureIndex === measure.measure)
      .map((group) => group[0]?.step ?? 0)
      .sort((left, right) => left - right);
    for (const [index, step] of steps.entries()) {
      const durationSteps = (steps[index + 1] ?? activeSteps + 1) - step;
      for (const event of groups.get(`${measure.measure}:${step}`) ?? []) {
        prepared.push({ ...event, durationSteps });
      }
    }
  }
  return { events: prepared };
}

/** Build the non-solo acoustic steel-string Guitar support voice from selected physical events. */
export function convertGuitarClassicEventsToAbc(
  sourceAbc: string,
  events: GuitarTabEvent[],
): GuitarClassicAbcConversionResult {
  const sourceMeasures = convertAbcToTimeSliceGrid(sourceAbc, []);
  const durationContext = buildAbcDurationContext(sourceAbc);
  const prepared = prepareEventsForSource(events, sourceMeasures, durationContext.unitsPerBeat / 4);
  if ("error" in prepared) return migrationFailure(prepared.error);

  const validation = validateGuitarTab(prepared.events, {
    guitarProfile: "guitar-acoustic",
    requireScientificPitch: true,
    requireRenderableTiming: true,
  });
  if (!validation.valid) {
    return { abc: null, errors: validation.issues.map((issue) => issue.message), renderedEventCount: 0, measureCount: 0 };
  }

  const measures = emptyGuitarGrid(sourceMeasures);
  const stepDurationUnits = durationContext.unitsPerBeat / 4;
  const errors: string[] = [];
  for (const event of prepared.events) {
    const measure = measures.find((candidate) => candidate.measure === event.measureIndex);
    const start = (event.step ?? 0) - 1;
    const duration = event.durationSteps ?? 0;
    const activeSteps = measure ? activeStepCount(measure, stepDurationUnits) : 0;
    if (!measure || start < 0 || start >= activeSteps || start + duration > activeSteps) {
      errors.push(`${event.note} exceeds the source measure's playable grid.`);
      continue;
    }
    for (let index = start; index < start + duration; index += 1) {
      if (measure.grid[index]?.tablature?.some((tab) => tab.string === event.string)) {
        errors.push(`${event.note} overlaps another Guitar event on string ${event.string}.`);
        break;
      }
    }
    if (errors.length > 0) continue;
    const step = measure.grid[start];
    step.tablature = [...(step.tablature ?? []), {
      string: event.string,
      fret: event.fret,
      finger: null,
      role: gridRole(event.role),
      durationSteps: duration,
    }];
  }
  if (errors.length > 0) return { abc: null, errors, renderedEventCount: 0, measureCount: measures.length };

  const renderedMeasures = renderTimeSliceMeasuresToAbc(measures, durationContext, getKeyAccidentalsFromAbc(sourceAbc), true);
  const renderedByMeasure = new Map(measures.map((measure, index) => [measure, renderedMeasures[index] ?? ""]));
  const lines = groupMeasuresByLine(measures).map((lineMeasures) => joinMeasureAbcWithBarlines(
    lineMeasures.map((measure) => renderedByMeasure.get(measure) ?? ""), lineMeasures,
  ));
  return {
    abc: ['V:GuitarSupport clef=treble-8 name="Guitar Support" stem=down', "%%MIDI program 25", ...lines].join("\n"),
    errors: [],
    renderedEventCount: prepared.events.length,
    measureCount: measures.length,
  };
}
