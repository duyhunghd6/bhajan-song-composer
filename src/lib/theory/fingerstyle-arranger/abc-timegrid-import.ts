import { buildAbcDurationContext, cleanAbcMeasureSegment, type AbcDurationContext } from "../abc-duration";
import { abcNoteToMidiWithKey, getKeyAccidentalsFromAbc } from "../abc-key-signature";
import { parseNoteDuration } from "../melody-analyzer";
import { convertAbcToTimeSliceGrid, type TimeSliceGridStep, type TimeSliceMeasure } from "./time-slice";
import type { ImportedTimeGridDocument } from "./timegrid-document-codec";
import type { GuitarStringNumber } from "../fingerstyle-compressor";

export interface AbcTimeGridImportDiagnostic {
  measure?: number;
  message: string;
}

export interface AbcTimeGridImportResult {
  valid: boolean;
  document?: ImportedTimeGridDocument;
  diagnostics: AbcTimeGridImportDiagnostic[];
}

type PhysicalEvent = {
  onset: number;
  duration: number;
  string: GuitarStringNumber;
  fret: number;
};

type TieContinuation = {
  event: PhysicalEvent;
  midi: number;
};

const EPSILON = 1e-6;

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < EPSILON;
}

function guitarMeasures(abc: string): string[] {
  const measures: string[] = [];
  let active = false;

  const appendMeasures = (body: string) => {
    measures.push(...body
      .split("|")
      .map(cleanAbcMeasureSegment)
      .filter(Boolean));
  };

  for (const source of abc.split(/\r?\n/)) {
    const line = source.trim();
    if (line.startsWith("V:")) {
      active = line.slice(2).split(/\s/)[0] === "Guitar";
      continue;
    }

    const inline = line.match(/^\[V:([^\]]+)\](.*)$/);
    if (inline) {
      active = inline[1].trim() === "Guitar";
      if (active) appendMeasures(inline[2]);
      continue;
    }

    if (active && line && !/^[A-Za-z]:/.test(line) && !line.startsWith("%") && !line.startsWith("w:")) {
      appendMeasures(line);
    }
  }

  return measures;
}

function openMidi(string: GuitarStringNumber): number {
  return [0, 64, 59, 55, 50, 45, 40][string];
}

function gridPosition(
  units: number,
  stepDurationUnits: number,
  measure: number,
  diagnostics: AbcTimeGridImportDiagnostic[],
  label: string,
): number {
  const raw = units / stepDurationUnits;
  const rounded = Math.round(raw);
  if (!nearlyEqual(raw, rounded)) {
    diagnostics.push({
      measure,
      message: `${label} at ${units} ABC units was rounded to TimeGrid step ${rounded + 1}.`,
    });
  }
  return rounded;
}

function durationSuffix(text: string): string {
  return text.match(/^(?:[0-9]+(?:\/[0-9]*)?|\/[0-9]*)/)?.[0] ?? "";
}

function parseMeasure(
  text: string,
  key: ReturnType<typeof getKeyAccidentalsFromAbc>,
  durationContext: AbcDurationContext,
  diagnostics: AbcTimeGridImportDiagnostic[],
  measure: number,
) {
  const events: PhysicalEvent[] = [];
  const slurs: Array<{ startStep: number; endStep: number }> = [];
  const ties = new Map<GuitarStringNumber, TieContinuation>();
  const slurStarts: number[] = [];
  const stepDurationUnits = durationContext.unitsPerBeat / 4;
  let index = 0;
  let onset = 0;

  const parseNote = () => {
    let string: GuitarStringNumber | null = null;
    while (text[index] === "!") {
      const end = text.indexOf("!", index + 1);
      if (end < 0) {
        diagnostics.push({ measure, message: "Unclosed ABC decoration in Guitar notation." });
        return null;
      }
      const value = text.slice(index + 1, end);
      index = end + 1;
      if (/^[1-6]$/.test(value)) string = Number(value) as GuitarStringNumber;
    }

    const start = index;
    while ("_^=".includes(text[index] ?? "")) index++;
    if (!/[A-Ga-g]/.test(text[index] ?? "")) {
      index = start;
      return null;
    }
    index++;
    while (",'".includes(text[index] ?? "")) index++;
    const midi = abcNoteToMidiWithKey(text.slice(start, index), key);
    if (midi === null || string === null) {
      if (string === null) diagnostics.push({ measure, message: "Guitar notes must use !1! through !6! string forcing." });
      return null;
    }
    return { string, midi: midi - 12, tied: false };
  };

  const addAttack = (event: PhysicalEvent) => {
    const overlapping = events.some(existing => (
      existing.string === event.string
      && event.onset < existing.onset + existing.duration - EPSILON
      && existing.onset < event.onset + event.duration - EPSILON
    ));
    if (overlapping) {
      diagnostics.push({ measure, message: `Overlapping Guitar attacks on string ${event.string} cannot be represented in TimeGrid.` });
      return;
    }
    events.push(event);
  };

  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === '"') {
      const end = text.indexOf('"', index + 1);
      if (end < 0) {
        diagnostics.push({ measure, message: "Unclosed chord symbol in Guitar notation." });
        break;
      }
      index = end + 1;
      continue;
    }
    if (char === "(" && /[2-9]/.test(text[index + 1] ?? "")) {
      const tuplet = text.slice(index).match(/^\([2-9](?::[0-9]+(?::[0-9]+)?)?/)?.[0] ?? "(";
      diagnostics.push({ measure, message: `Tuplet '${tuplet}' was approximated to TimeGrid timing.` });
      index += tuplet.length;
      continue;
    }
    if (char === "(") {
      slurStarts.push(onset);
      index++;
      continue;
    }
    if (char === ")") {
      const start = slurStarts.pop();
      if (start === undefined) {
        diagnostics.push({ measure, message: "Guitar slur closes without an opening parenthesis." });
      } else {
        const startIndex = gridPosition(start, stepDurationUnits, measure, diagnostics, "Slur start");
        const endIndex = gridPosition(onset, stepDurationUnits, measure, diagnostics, "Slur end");
        if (endIndex > startIndex) slurs.push({ startStep: startIndex + 1, endStep: endIndex });
      }
      index++;
      continue;
    }
    if (char === "z" || char === "x") {
      index++;
      const suffix = durationSuffix(text.slice(index));
      index += suffix.length;
      onset += parseNoteDuration(suffix);
      continue;
    }
    if (char === "{") {
      const end = text.indexOf("}", index + 1);
      diagnostics.push({ measure, message: "Grace-note syntax was skipped because it has no TimeGrid duration." });
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (char === ">" || char === "<") {
      diagnostics.push({ measure, message: `Broken-rhythm marker '${char}' was approximated to TimeGrid timing.` });
      index++;
      continue;
    }

    const notes: Array<{ string: GuitarStringNumber; midi: number; tied: boolean }> = [];
    if (char === "[") {
      index++;
      while (index < text.length && text[index] !== "]") {
        const note = parseNote();
        if (note) {
          notes.push(note);
          continue;
        }
        if (text[index] === "-" && notes.length) notes[notes.length - 1].tied = true;
        index++;
      }
      if (text[index] !== "]") {
        diagnostics.push({ measure, message: "Unclosed Guitar chord bracket." });
        break;
      }
      index++;
    } else {
      const note = parseNote();
      if (note) notes.push(note);
      else {
        diagnostics.push({ measure, message: `Unsupported Guitar ABC near '${text.slice(index, index + 8)}'.` });
        index++;
        continue;
      }
    }

    const suffix = durationSuffix(text.slice(index));
    index += suffix.length;
    const trailingTie = text[index] === "-";
    if (trailingTie) index++;
    const duration = parseNoteDuration(suffix);

    for (const note of notes) {
      const continuation = ties.get(note.string);
      const continuesPrior = continuation
        && continuation.midi === note.midi
        && nearlyEqual(continuation.event.onset + continuation.event.duration, onset);

      if (continuesPrior) {
        continuation.event.duration += duration;
      } else {
        if (continuation) {
          diagnostics.push({ measure, message: `Tie on string ${note.string} does not continue the same adjacent pitch.` });
        }
        addAttack({
          onset,
          duration,
          string: note.string,
          fret: note.midi - openMidi(note.string),
        });
      }

      const physicalEvent = continuesPrior
        ? continuation.event
        : events.at(-1)?.string === note.string && nearlyEqual(events.at(-1)?.onset ?? -1, onset)
          ? events.at(-1)
          : undefined;
      if (note.tied || trailingTie) {
        if (physicalEvent) ties.set(note.string, { event: physicalEvent, midi: note.midi });
      } else {
        ties.delete(note.string);
      }
    }
    onset += duration;
  }

  for (const start of slurStarts) {
    diagnostics.push({ measure, message: `Guitar slur opened at ${start} ABC units has no closing parenthesis.` });
  }
  for (const string of ties.keys()) {
    diagnostics.push({ measure, message: `Tie on string ${string} crosses a barline and was clipped to this TimeGrid measure.` });
  }

  return { events, slurs, durationUnits: onset };
}

/**
 * Imports forced-string Guitar ABC into the editable TimeGrid projection.
 * The input source remains byte-exact in source.rawAbc; normalized output is
 * intentionally a physical-event reconstruction rather than a concrete ABC AST.
 */
export function importAbcNotationToTimeGrid(abc: string): AbcTimeGridImportResult {
  const diagnostics: AbcTimeGridImportDiagnostic[] = [];
  const measures: TimeSliceMeasure[] = convertAbcToTimeSliceGrid(abc, []).map(measure => ({
    ...measure,
    grid: measure.grid.map(step => ({ ...step, tablature: undefined })),
  }));
  const guitar = guitarMeasures(abc);
  const durationContext = buildAbcDurationContext(abc);
  const key = getKeyAccidentalsFromAbc(abc);
  const stepDurationUnits = durationContext.unitsPerBeat / 4;

  if (guitar.length !== measures.length) {
    diagnostics.push({ message: `Guitar has ${guitar.length} measures; Melody has ${measures.length}.` });
  }

  for (const [index, measure] of measures.entries()) {
    const source = guitar[index];
    if (!source) continue;
    const parsed = parseMeasure(source, key, durationContext, diagnostics, measure.measure);
    measure.guitarSlurs = parsed.slurs;

    if (!nearlyEqual(parsed.durationUnits / stepDurationUnits, Math.round(parsed.durationUnits / stepDurationUnits))) {
      diagnostics.push({ measure: measure.measure, message: "Guitar measure duration was rounded to the fixed TimeGrid." });
    }

    for (const event of parsed.events) {
      const stepIndex = gridPosition(event.onset, stepDurationUnits, measure.measure, diagnostics, "Guitar onset");
      const durationSteps = Math.max(1, gridPosition(event.duration, stepDurationUnits, measure.measure, diagnostics, "Guitar duration"));
      if (!measure.grid[stepIndex] || event.fret < 0 || event.fret > 30) {
        diagnostics.push({ measure: measure.measure, message: "Guitar event is outside the supported TimeGrid/fret range." });
        continue;
      }
      const tab: NonNullable<TimeSliceGridStep["tablature"]> = measure.grid[stepIndex].tablature ?? [];
      if (tab.some(value => value.string === event.string)) {
        diagnostics.push({ measure: measure.measure, message: `Duplicate string ${event.string} attack.` });
        continue;
      }
      tab.push({ string: event.string, fret: event.fret, finger: null, role: "imported", durationSteps });
      measure.grid[stepIndex].tablature = tab;
    }
  }

  return {
    valid: true,
    diagnostics,
    document: { version: 1, source: { rawAbc: abc }, measures },
  };
}

/** Returns the immutable source direction of the bidirectional conversion exactly. */
export function reEmitImportedSourceAbc(document: ImportedTimeGridDocument): string {
  return document.source.rawAbc;
}
