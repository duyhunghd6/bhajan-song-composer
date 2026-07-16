import {
  type AbcDurationContext,
  extractMusicBodyLines,
  splitAbcMeasureSegments,
} from "../abc-duration";
import { parseNoteDuration } from "../melody-analyzer";
import { abcNoteToMidiWithKey, type AbcKeyAccidentalMap } from "../abc-key-signature";
import { parseScientificPitch, scientificPitchForStringFret } from "../guitar-playability";
import type { GuitarStringNumber } from "../fingerstyle-compressor";
import type { TimeSliceMeasure } from "./time-slice";
import { inferLegacyTabDurationSteps } from "./time-slice-abc-renderer";

const MAX_MISMATCHES = 32;
const EPSILON = 1e-6;

type TabEvent = {
  measure: number;
  startUnits: number;
  endUnits: number;
  string: GuitarStringNumber;
  fret: number;
  midi: number;
  attack: boolean;
};

/** An independently authored physical attack/duration contract for forced TAB ABC. */
export interface ExpectedAsciiGuitarTabEvent {
  measure: number;
  stepIndex: number;
  durationSteps: number;
  string: GuitarStringNumber;
  fret: number;
}

export interface AbcAsciiGuitarTabMismatch {
  measure?: number;
  step?: number;
  string?: GuitarStringNumber;
  kind:
    | "parse-error"
    | "missing-event"
    | "unexpected-event"
    | "fret-mismatch"
    | "string-mismatch"
    | "duration-mismatch"
    | "measure-duration-mismatch"
    | "unsupported-notation";
  expected?: string;
  actual?: string;
  message: string;
}

export interface AbcAsciiGuitarTabValidationResult {
  valid: boolean;
  checkedMeasures: number;
  expectedEventCount: number;
  actualEventCount: number;
  mismatchCount: number;
  mismatches: AbcAsciiGuitarTabMismatch[];
  warnings: string[];
}

interface ParsedNote {
  string: GuitarStringNumber | null;
  midi: number | null;
  fret: number | null;
  tied: boolean;
}

function pushMismatch(
  result: AbcAsciiGuitarTabValidationResult,
  mismatch: AbcAsciiGuitarTabMismatch,
): void {
  result.mismatchCount += 1;
  if (result.mismatches.length < MAX_MISMATCHES) result.mismatches.push(mismatch);
}

function parseDuration(suffix: string): number {
  // ABC duration units are already normalized to the L: default note length.
  return parseNoteDuration(suffix);
}

function stripDecoration(text: string, cursor: { index: number }): number | null {
  const end = text.indexOf("!", cursor.index + 1);
  if (end < 0) {
    cursor.index = text.length;
    return null;
  }
  const value = text.slice(cursor.index + 1, end);
  cursor.index = end + 1;
  if (/^[1-6]$/.test(value)) return Number(value);
  return null;
}

function parseNote(text: string, cursor: { index: number }, keyAccidentals?: AbcKeyAccidentalMap): ParsedNote | null {
  let string: GuitarStringNumber | null = null;
  while (text[cursor.index] === "!") {
    const forced = stripDecoration(text, cursor);
    if (forced !== null) string = forced as GuitarStringNumber;
  }
  const noteStart = cursor.index;
  let accidental = "";
  while (text[cursor.index] === "_" || text[cursor.index] === "^" || text[cursor.index] === "=") {
    accidental += text[cursor.index++];
  }
  const letter = text[cursor.index];
  if (!letter || !/[A-Ga-g]/.test(letter)) {
    cursor.index = noteStart;
    return null;
  }
  cursor.index += 1;
  while (text[cursor.index] === "," || text[cursor.index] === "'") cursor.index += 1;
  const token = `${accidental}${text.slice(noteStart + accidental.length, cursor.index)}`;
  // Guitar voices use treble-8: ABC's written pitch is one octave above
  // the sounding pitch used for standard-tuning fret calculation.
  const writtenMidi = abcNoteToMidiWithKey(token, keyAccidentals);
  const midi = writtenMidi === null ? null : writtenMidi - 12;
  return { string, midi, fret: null, tied: false };
}

function parseChord(text: string, cursor: { index: number }, keyAccidentals?: AbcKeyAccidentalMap): ParsedNote[] {
  cursor.index += 1;
  const notes: ParsedNote[] = [];
  while (cursor.index < text.length && text[cursor.index] !== "]") {
    if (text[cursor.index] === "!") {
      // Decorations are consumed by parseNote, including string forcing.
    }
    const note = parseNote(text, cursor, keyAccidentals);
    if (note) {
      notes.push(note);
      continue;
    }
    if (text[cursor.index] === "-") {
      const previous = notes.at(-1);
      if (previous) previous.tied = true;
    }
    cursor.index += 1;
  }
  if (text[cursor.index] === "]") cursor.index += 1;
  return notes;
}

function parseMeasure(
  text: string,
  measure: number,
  keyAccidentals: AbcKeyAccidentalMap | undefined,
  result: AbcAsciiGuitarTabValidationResult,
  tieState: Map<GuitarStringNumber, { midi: number; fret: number }>,
): TabEvent[] {
  const events: TabEvent[] = [];
  const cursor = { index: 0 };
  let onset = 0;

  while (cursor.index < text.length) {
    const char = text[cursor.index];
    if (/\s/.test(char)) {
      cursor.index += 1;
      continue;
    }
    if (char === "%") break;
    if (char === ":" || char === "(" || char === ")" || char === "\\") {
      cursor.index += 1;
      continue;
    }
    if (char === '"') {
      const end = text.indexOf('"', cursor.index + 1);
      cursor.index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (char === "{") {
      const end = text.indexOf("}", cursor.index + 1);
      pushMismatch(result, { measure, kind: "unsupported-notation", message: `Grace notes are not part of canonical guitar TAB ABC at measure ${measure}.` });
      cursor.index = end < 0 ? text.length : end + 1;
      continue;
    }

    // A volta marker (`[1`, `[2`, `[1,3`) appears before a measure's music;
    // it is structure, not an ABC chord event.
    const volta = text.slice(cursor.index).match(/^\[[0-9,\-]+/);
    if (volta) {
      cursor.index += volta[0].length;
      continue;
    }

    let notes: ParsedNote[] = [];
    if (char === "[") notes = parseChord(text, cursor, keyAccidentals);
    else if (char === "z" || char === "x") cursor.index += 1;
    else {
      const note = parseNote(text, cursor, keyAccidentals);
      if (note) notes = [note];
      else {
        pushMismatch(result, { measure, kind: "parse-error", message: `Could not parse ABC near '${text.slice(cursor.index, cursor.index + 12)}' at measure ${measure}.` });
        cursor.index += 1;
        continue;
      }
    }

    const suffixStart = cursor.index;
    while (/[0-9/]/.test(text[cursor.index] ?? "")) cursor.index += 1;
    const durationUnits = parseDuration(text.slice(suffixStart, cursor.index));
    const hasTrailingTie = text[cursor.index] === "-";
    if (hasTrailingTie) cursor.index += 1;
    const end = onset + durationUnits;

    for (const note of notes) {
      const hasTie = note.tied || hasTrailingTie;
      if (note.string === null) {
        pushMismatch(result, {
          measure,
          kind: "parse-error",
          message: `Guitar note at measure ${measure}, onset ${onset} is missing a !N! string forcing decoration.`,
        });
        continue;
      }
      if (note.midi === null) {
        pushMismatch(result, { measure, string: note.string, kind: "parse-error", message: `Invalid ABC pitch at measure ${measure}, string ${note.string}.` });
        continue;
      }
      const previous = tieState.get(note.string);
      const attack = !(previous && previous.midi === note.midi);
      const openMidi = note.string === 1
        ? 64
        : note.string === 2
          ? 59
          : note.string === 3
            ? 55
            : note.string === 4
              ? 50
              : note.string === 5
                ? 45
                : 40;
      const fret = note.midi - openMidi;
      if (fret < 0 || fret > 30) {
        pushMismatch(result, { measure, string: note.string, kind: "parse-error", message: `ABC note ${note.midi} is not a supported standard-tuning fret on string ${note.string}.` });
        continue;
      }
      events.push({ measure, startUnits: onset, endUnits: end, string: note.string, fret, midi: note.midi, attack });
      if (hasTie) tieState.set(note.string, { midi: note.midi, fret });
      else tieState.delete(note.string);
    }
    onset = end;
  }

  return events;
}

function expectedEvents(measures: readonly TimeSliceMeasure[], stepDurationUnits: number): TabEvent[] {
  const output: TabEvent[] = [];
  measures.forEach((measure) => {
    measure.grid.forEach((step, index) => {
      for (const tab of step.tablature ?? []) {
        let durationSteps = tab.durationSteps;
        if (tab.role === "melody" && step.melody.state === "attack") {
          durationSteps = 1;
          for (let next = index + 1; next < measure.grid.length; next += 1) {
            const melody = measure.grid[next].melody;
            if (melody.state !== "sustain" || melody.pitch !== step.melody.pitch) break;
            durationSteps += 1;
          }
        } else if (!durationSteps) {
          durationSteps = inferLegacyTabDurationSteps(
            measure,
            index,
            tab.string,
            measure.grid.length,
          );
        }
        const pitch = scientificPitchForStringFret(tab.string, tab.fret);
        const actualMidi = parseScientificPitch(pitch)?.midi ?? -1;
        output.push({
          measure: measure.measure,
          startUnits: index * stepDurationUnits,
          endUnits: (index + durationSteps) * stepDurationUnits,
          string: tab.string,
          fret: tab.fret,
          midi: actualMidi,
          attack: true,
        });
      }
    });
  });
  return output;
}

function expectedEventsFromPhysicalContract(
  events: readonly ExpectedAsciiGuitarTabEvent[],
  stepDurationUnits: number,
): TabEvent[] {
  return events.map(event => {
    const pitch = scientificPitchForStringFret(event.string, event.fret);
    return {
      measure: event.measure,
      startUnits: event.stepIndex * stepDurationUnits,
      endUnits: (event.stepIndex + event.durationSteps) * stepDurationUnits,
      string: event.string,
      fret: event.fret,
      midi: parseScientificPitch(pitch)?.midi ?? -1,
      attack: true,
    };
  });
}

function extractGuitarMusicBody(abc: string): string {
  const lines = abc.split(/\r?\n/);
  const guitarLines: string[] = [];
  let guitarVoiceActive = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const inlineVoice = line.match(/^\[V:([^\]]+)\](.*)$/);
    if (inlineVoice) {
      guitarVoiceActive = inlineVoice[1].trim() === "Guitar";
      if (guitarVoiceActive && inlineVoice[2].trim()) guitarLines.push(inlineVoice[2].trim());
      continue;
    }
    if (line.startsWith("V:")) {
      guitarVoiceActive = line.slice(2).trim().split(/\s+/)[0] === "Guitar";
      const body = line.replace(/^V:\S+\s*/, "").trim();
      if (guitarVoiceActive && body) guitarLines.push(body);
      continue;
    }
    if (guitarVoiceActive && line && !line.startsWith("%") && !/^[A-Za-z]:/.test(line)) {
      guitarLines.push(line);
    }
  }
  return guitarLines.length > 0 ? guitarLines.join(" ") : extractMusicBodyLines(abc).join(" ");
}

function eventKey(event: TabEvent): string {
  return `${event.measure}:${event.startUnits.toFixed(6)}:${event.string}`;
}

function mergeTiedEvents(events: TabEvent[]): TabEvent[] {
  const sorted = [...events].sort((left, right) => (
    left.measure - right.measure
    || left.string - right.string
    || left.startUnits - right.startUnits
  ));
  const merged: TabEvent[] = [];
  for (const event of sorted) {
    const previous = merged.at(-1);
    if (
      previous
      && !event.attack
      && previous.measure === event.measure
      && previous.string === event.string
      && previous.midi === event.midi
      && Math.abs(previous.endUnits - event.startUnits) < EPSILON
    ) {
      previous.endUnits = event.endUnits;
    } else {
      merged.push({ ...event });
    }
  }
  return merged;
}

export function validateGuitarAbcAgainstAsciiGuitarTab(input: {
  abc: string;
  measures: readonly TimeSliceMeasure[];
  durationContext: AbcDurationContext;
  keyAccidentals?: AbcKeyAccidentalMap;
  /** Use this for conversions where physical ASCII attacks own the duration contract. */
  expectedPhysicalEvents?: readonly ExpectedAsciiGuitarTabEvent[];
}): AbcAsciiGuitarTabValidationResult {
  const result: AbcAsciiGuitarTabValidationResult = {
    valid: true,
    checkedMeasures: input.measures.length,
    expectedEventCount: 0,
    actualEventCount: 0,
    mismatchCount: 0,
    mismatches: [],
    warnings: [],
  };
  const stepDurationUnits = input.durationContext.unitsPerBeat / 4;
  const expected = input.expectedPhysicalEvents
    ? expectedEventsFromPhysicalContract(input.expectedPhysicalEvents, stepDurationUnits)
    : expectedEvents(input.measures, stepDurationUnits);
  result.expectedEventCount = expected.length;

  const body = extractGuitarMusicBody(input.abc);
  const segments = splitAbcMeasureSegments(body);
  const actual: TabEvent[] = [];
  const tieState = new Map<GuitarStringNumber, { midi: number; fret: number }>();
  segments.forEach((segment, index) => actual.push(...parseMeasure(segment, input.measures[index]?.measure ?? index + 1, input.keyAccidentals, result, tieState)));
  const mergedActual = mergeTiedEvents(actual);
  result.actualEventCount = mergedActual.length;

  const expectedByKey = new Map(expected.filter(event => event.attack).map(event => [eventKey(event), event]));
  const actualByKey = new Map(mergedActual.filter(event => event.attack).map(event => [eventKey(event), event]));
  for (const event of expected.filter(value => value.attack)) {
    const actualEvent = actualByKey.get(eventKey(event));
    if (!actualEvent) {
      pushMismatch(result, { measure: event.measure, step: Math.round(event.startUnits / stepDurationUnits) + 1, string: event.string, kind: "missing-event", expected: `string ${event.string} fret ${event.fret}`, message: `Missing ABC attack at measure ${event.measure}, step ${Math.round(event.startUnits / stepDurationUnits) + 1}, string ${event.string}.` });
      continue;
    }
    if (actualEvent.fret !== event.fret) pushMismatch(result, { measure: event.measure, string: event.string, kind: "fret-mismatch", expected: String(event.fret), actual: String(actualEvent.fret), message: `Fret mismatch at measure ${event.measure}, string ${event.string}: expected ${event.fret}, got ${actualEvent.fret}.` });
  }
  for (const event of mergedActual.filter(value => value.attack)) {
    if (!expectedByKey.has(eventKey(event))) pushMismatch(result, { measure: event.measure, step: Math.round(event.startUnits / stepDurationUnits) + 1, string: event.string, kind: "unexpected-event", actual: `string ${event.string} fret ${event.fret}`, message: `Unexpected ABC attack at measure ${event.measure}, step ${Math.round(event.startUnits / stepDurationUnits) + 1}, string ${event.string}.` });
  }

  for (const event of expected.filter(value => value.attack)) {
    const counterpart = mergedActual.find(candidate => candidate.measure === event.measure && candidate.string === event.string && Math.abs(candidate.startUnits - event.startUnits) < EPSILON);
    if (counterpart && Math.abs(counterpart.endUnits - event.endUnits) > EPSILON) {
      pushMismatch(result, {
        measure: event.measure,
        string: event.string,
        kind: "duration-mismatch",
        expected: `${event.endUnits - event.startUnits}`,
        actual: `${counterpart.endUnits - counterpart.startUnits}`,
        message: `Duration mismatch at measure ${event.measure}, string ${event.string}.`,
      });
    }
  }

  for (let index = 0; index < input.measures.length; index += 1) {
    const pickupDuration = index === 0 ? input.measures[index].pickupDurationUnits : undefined;
    const expectedDuration = pickupDuration && pickupDuration > 0
      ? pickupDuration
      : input.measures[index].grid.length * stepDurationUnits;
    const actualDuration = segments[index] ? parseMeasureDuration(segments[index]) : 0;
    if (Math.abs(expectedDuration - actualDuration) > EPSILON) pushMismatch(result, { measure: input.measures[index].measure, kind: "measure-duration-mismatch", expected: String(expectedDuration), actual: String(actualDuration), message: `Measure ${input.measures[index].measure} duration mismatch: expected ${expectedDuration}, got ${actualDuration}.` });
  }

  result.valid = result.mismatchCount === 0;
  return result;
}

function parseMeasureDuration(segment: string): number {
  let total = 0;
  const music = segment.replace(/"[^"]*"/g, "");
  const regex = /(?:\[[^\]]+\]|(?:![1-6]!)?[_^=]{0,2}[A-Ga-g][,']*|[zx])([0-9]*(?:\/[0-9]*)?|\/[0-9]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(music)) !== null) total += parseDuration(match[1] ?? "");
  return total;
}

export function formatAbcAsciiGuitarTabValidation(result: AbcAsciiGuitarTabValidationResult): string {
  const header = `[${result.valid ? "OK" : "XX"}] measures=${result.checkedMeasures} expected-events=${result.expectedEventCount} actual-events=${result.actualEventCount} mismatches=${result.mismatchCount}`;
  const details = result.mismatches.slice(0, 8).map(mismatch => `- ${mismatch.message}`);
  return [header, ...details].join("\n");
}
