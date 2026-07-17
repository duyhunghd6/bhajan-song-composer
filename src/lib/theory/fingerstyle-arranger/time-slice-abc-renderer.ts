import { formatAbcDuration, type AbcDurationContext } from "../abc-duration";
import { abcNoteToMidiWithKey, type AbcKeyAccidentalMap } from "../abc-key-signature";
import type { GuitarStringNumber } from "../fingerstyle-compressor";
import { scientificPitchForStringFret } from "../guitar-playability";
import { extractDurationTokensWithTies, type TimeSliceGridStep, type TimeSliceMeasure } from "./time-slice";

interface SoundingEvent {
  id: string;
  start: number;
  end: number;
  tab: NonNullable<TimeSliceGridStep["tablature"]>[number];
}

export function scientificPitchToAbc(
  scientificPitch: string,
  keyAccidentals?: AbcKeyAccidentalMap,
): string {
  const match = scientificPitch.match(/^([A-G])([#b]?)(-?\d+)$/);
  if (!match) return scientificPitch;
  const [, letter, accidental, octaveText] = match;
  const octave = Number.parseInt(octaveText, 10);
  const keyAccidental = keyAccidentals?.get(letter);
  const abcAccidental = accidental === "#"
    ? keyAccidental === "^" ? "" : "^"
    : accidental === "b"
      ? keyAccidental === "_" ? "" : "_"
      : keyAccidental ? "=" : "";

  let abcLetter = letter;
  if (octave >= 4) abcLetter = `${letter.toLowerCase()}${"'".repeat(octave - 4)}`;
  else if (octave < 3) abcLetter = `${letter}${",".repeat(3 - octave)}`;
  return abcAccidental + abcLetter;
}

export function melodyDurationSteps(measure: TimeSliceMeasure, startIndex: number): number {
  const sourcePitch = measure.grid[startIndex].melody.pitch;
  let duration = 1;
  for (let index = startIndex + 1; index < measure.grid.length; index++) {
    const melody = measure.grid[index].melody;
    if (melody.state !== "sustain" || melody.pitch !== sourcePitch) break;
    duration++;
  }
  return duration;
}

function activeStepCount(measure: TimeSliceMeasure, stepDurationUnits: number): number {
  if (!measure.pickupDurationUnits || measure.pickupDurationUnits <= 0) return measure.grid.length;
  return Math.max(0, Math.min(
    measure.grid.length,
    Math.ceil(measure.pickupDurationUnits / stepDurationUnits),
  ));
}

export function resolveTabDurationSteps(
  measure: TimeSliceMeasure,
  startIndex: number,
  tab: NonNullable<TimeSliceGridStep["tablature"]>[number],
  maxSteps: number,
): number {
  const requestedDuration = tab.durationSteps
    ?? (tab.role === "melody" && measure.grid[startIndex].melody.state === "attack"
      ? melodyDurationSteps(measure, startIndex)
      : 1);
  return Math.max(1, Math.min(requestedDuration, maxSteps - startIndex));
}

function collectSoundingEvents(measure: TimeSliceMeasure, maxSteps: number): SoundingEvent[] {
  const events: SoundingEvent[] = [];
  for (let start = 0; start < maxSteps; start++) {
    for (const tab of measure.grid[start].tablature ?? []) {
      const duration = resolveTabDurationSteps(measure, start, tab, maxSteps);
      events.push({
        id: `${start}:${tab.string}:${tab.fret}:${tab.role}`,
        start,
        end: start + duration,
        tab,
      });
    }
  }
  return events;
}

function sourceMelodyTieBoundaries(
  measure: TimeSliceMeasure,
  durationContext: AbcDurationContext,
  maxSteps: number,
  events: SoundingEvent[],
  keyAccidentals: AbcKeyAccidentalMap | undefined,
): number[] {
  if (!measure.source_abc?.melody) return [];

  const stepDurationUnits = durationContext.unitsPerBeat / 4;
  const tokens = extractDurationTokensWithTies(measure.source_abc.melody);
  const boundaries = new Set<number>();
  let onset = 0;

  for (let index = 0; index < tokens.length - 1; index++) {
    const token = tokens[index];
    const next = tokens[index + 1];
    onset += token.durationUnits;
    const note = token.token.match(/^[_^=]?[A-Ga-g][,']*/)?.[0];
    const nextNote = next.token.match(/^[_^=]?[A-Ga-g][,']*/)?.[0];
    const pitch = note ? abcNoteToMidiWithKey(note, keyAccidentals) : null;
    const nextPitch = nextNote ? abcNoteToMidiWithKey(nextNote, keyAccidentals) : null;
    const rawStep = onset / stepDurationUnits;
    const boundary = Math.round(rawStep);

    if (!token.hasTie || pitch === null || pitch !== nextPitch || Math.abs(rawStep - boundary) > 1e-6) continue;
    if (boundary <= 0 || boundary >= maxSteps) continue;
    if (events.some(event => event.tab.role === "melody" && event.start < boundary && event.end > boundary)) {
      boundaries.add(boundary);
    }
  }

  return [...boundaries];
}

function soundingByString(events: SoundingEvent[], step: number): SoundingEvent[] {
  const byString = new Map<GuitarStringNumber, SoundingEvent>();
  for (const event of events) {
    if (event.start > step || event.end <= step) continue;
    const existing = byString.get(event.tab.string);
    if (!existing || event.start >= existing.start) byString.set(event.tab.string, event);
  }
  return [...byString.values()].sort((left, right) => left.tab.string - right.tab.string);
}

interface MeasureRenderContinuity {
  tieStringsAtEnd?: ReadonlySet<GuitarStringNumber>;
  slurStartSteps?: readonly number[];
  slurEndSteps?: readonly number[];
}

function renderSoundingToken(
  event: SoundingEvent,
  segmentEnd: number,
  keyAccidentals: AbcKeyAccidentalMap | undefined,
  includeTabStringForcing: boolean,
  continuity?: MeasureRenderContinuity,
): { token: string; continues: boolean } {
  const pitch = scientificPitchForStringFret(event.tab.string, event.tab.fret);
  const abcPitch = scientificPitchToAbc(pitch, keyAccidentals);
  return {
    token: includeTabStringForcing ? `!${event.tab.string}!${abcPitch}` : abcPitch,
    continues: event.end > segmentEnd || (
      event.end === segmentEnd
      && continuity?.tieStringsAtEnd?.has(event.tab.string) === true
    ),
  };
}

export function renderTimeSliceMeasureToAbc(
  measure: TimeSliceMeasure,
  durationContext: AbcDurationContext,
  keyAccidentals?: AbcKeyAccidentalMap,
  includeTabStringForcing = false,
  continuity?: MeasureRenderContinuity,
): string {
  const stepDurationUnits = durationContext.unitsPerBeat / 4;
  const maxSteps = activeStepCount(measure, stepDurationUnits);
  const events = collectSoundingEvents(measure, maxSteps);
  const boundaries = new Set<number>([0, maxSteps]);
  for (const event of events) {
    boundaries.add(event.start);
    boundaries.add(event.end);
  }
  for (const boundary of sourceMelodyTieBoundaries(
    measure,
    durationContext,
    maxSteps,
    events,
    keyAccidentals,
  )) boundaries.add(boundary);
  const orderedBoundaries = [...boundaries].sort((left, right) => left - right);
  const rendered: string[] = [];

  for (let index = 0; index < orderedBoundaries.length - 1; index++) {
    const start = orderedBoundaries[index];
    const end = orderedBoundaries[index + 1];
    if (end <= start) continue;
    const durationSuffix = formatAbcDuration((end - start) * stepDurationUnits);
    const sounding = soundingByString(events, start);
    if (sounding.length === 0) {
      rendered.push(`z${durationSuffix}`);
      continue;
    }
    const tokens = sounding.map(event => renderSoundingToken(
      event,
      end,
      keyAccidentals,
      includeTabStringForcing,
      continuity,
    ));
    const token = tokens.length === 1
      ? `${tokens[0].token}${durationSuffix}${tokens[0].continues ? "-" : ""}`
      : `[${tokens.map(value => `${value.token}${value.continues ? "-" : ""}`).join("")}]${durationSuffix}`;
    const opens = (measure.guitarSlurs?.filter(slur => slur.startStep - 1 === start).length ?? 0)
      + (continuity?.slurStartSteps?.filter(step => step - 1 === start).length ?? 0);
    const closes = (measure.guitarSlurs?.filter(slur => slur.endStep === end).length ?? 0)
      + (continuity?.slurEndSteps?.filter(step => step === end).length ?? 0);
    rendered.push(`${"(".repeat(opens)}${token}${")".repeat(closes)}`);
  }

  return rendered.join(" ");
}

/**
 * Render ordered measures while preserving only explicit, imported cross-bar
 * continuities. Equal pitches alone never create a tie or slur.
 */
function sourceMelodyTieStringsToNext(
  measure: TimeSliceMeasure,
  next: TimeSliceMeasure | undefined,
  durationContext: AbcDurationContext,
  keyAccidentals: AbcKeyAccidentalMap | undefined,
): Set<GuitarStringNumber> {
  if (!next || !measure.source_abc?.melody || !next.source_abc?.melody) return new Set();
  const sourceTokens = extractDurationTokensWithTies(measure.source_abc.melody);
  const targetTokens = extractDurationTokensWithTies(next.source_abc.melody);
  const source = sourceTokens.at(-1);
  const target = targetTokens[0];
  const sourceNote = source?.token.match(/^[_^=]?[A-Ga-g][,']*/)?.[0];
  const targetNote = target?.token.match(/^[_^=]?[A-Ga-g][,']*/)?.[0];
  if (!source?.hasTie || !sourceNote || !targetNote) return new Set();
  if (abcNoteToMidiWithKey(sourceNote, keyAccidentals) !== abcNoteToMidiWithKey(targetNote, keyAccidentals)) {
    return new Set();
  }

  const sourceMaxSteps = activeStepCount(measure, durationContext.unitsPerBeat / 4);
  const sourceEvents = collectSoundingEvents(measure, sourceMaxSteps).filter(event => (
    event.tab.role === "melody" && event.end === sourceMaxSteps
  ));
  const targetEvents = next.grid[0]?.tablature?.filter(tab => tab.role === "melody") ?? [];
  return new Set(sourceEvents.flatMap(sourceEvent => targetEvents
    .filter(targetEvent => (
      targetEvent.string === sourceEvent.tab.string && targetEvent.fret === sourceEvent.tab.fret
    ))
    .map(targetEvent => targetEvent.string)));
}

export function renderTimeSliceMeasuresToAbc(
  measures: TimeSliceMeasure[],
  durationContext: AbcDurationContext,
  keyAccidentals?: AbcKeyAccidentalMap,
  includeTabStringForcing = false,
): string[] {
  return measures.map((measure, index) => {
    const previous = measures[index - 1];
    return renderTimeSliceMeasureToAbc(
      measure,
      durationContext,
      keyAccidentals,
      includeTabStringForcing,
      {
        tieStringsAtEnd: new Set([
          ...(measure.guitarTiesToNext ?? []),
          ...sourceMelodyTieStringsToNext(measure, measures[index + 1], durationContext, keyAccidentals),
        ]),
        slurStartSteps: measure.guitarSlursToNext?.map(slur => slur.startStep),
        slurEndSteps: previous?.guitarSlursToNext?.map(slur => slur.endStep),
      },
    );
  });
}
