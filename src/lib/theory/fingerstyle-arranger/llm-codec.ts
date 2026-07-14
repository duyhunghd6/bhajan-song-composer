import type { GuitarStringNumber } from "../fingerstyle-compressor";
import type { GuitarVoicingQueryMatch } from "../guitar-voicings";
import type { TimeSliceMeasure } from "./time-slice";

const VOICING_FORMAT_VERSION = "voicings:v1";
const VOICING_HEADER = "{rank,span,frets_6_to_1,bass,melody,inner,barre}";
const TABLATURE_FORMAT_VERSION = "tablature:v1";
const TABLATURE_HEADER = "{measure,step,string,fret,finger,role}";
const MAX_TABLATURE_PAYLOAD_CHARS = 64_000;

const FINGERS = new Set(["p", "i", "m", "a", "-"]);
const ROLES = new Set(["bass", "melody", "fill", "root", "fifth"]);

export interface FingerstyleTablatureRow {
  measure: number;
  step: number;
  string: GuitarStringNumber;
  fret: number;
  finger: "p" | "i" | "m" | "a" | null;
  role: "bass" | "melody" | "fill" | "root" | "fifth";
}

export interface FingerstyleCodecError {
  code: string;
  message: string;
  line?: number;
}

export type FingerstyleTablatureDecodeResult =
  | { ok: true; rows: FingerstyleTablatureRow[]; measures: TimeSliceMeasure[] }
  | { ok: false; error: FingerstyleCodecError };

function location(line?: number): string {
  return line === undefined ? "" : `Line ${line}: `;
}

function codecFailure(code: string, message: string, line?: number): FingerstyleTablatureDecodeResult {
  return {
    ok: false,
    error: { code, line, message: `${location(line)}${message}` },
  };
}

function formatStringFret(position: { string: number; fret: number } | undefined): string {
  return position ? `${position.string}/${position.fret}` : "-";
}

export function formatGuitarVoicingsAsToon(matches: readonly GuitarVoicingQueryMatch[]): string {
  const lines = [
    `${VOICING_FORMAT_VERSION} rows=${matches.length}`,
    VOICING_HEADER,
  ];

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const barre = match.barre
      ? `${match.barre.fret}/${match.barre.fromString}-${match.barre.toString}`
      : "-";
    lines.push([
      index + 1,
      match.fretDistance ?? 0,
      match.frets.join("/"),
      formatStringFret(match.bass),
      formatStringFret(match.melody),
      match.available_inner_strings.length > 0 ? match.available_inner_strings.join("/") : "-",
      barre,
    ].join(","));
  }

  return lines.join("\n");
}

export function formatFingerstyleTablatureAsToon(measures: readonly TimeSliceMeasure[]): string {
  const lines = [TABLATURE_FORMAT_VERSION, TABLATURE_HEADER];

  for (const measure of measures) {
    const steps = [...measure.grid].sort((a, b) => a.step - b.step);
    for (const step of steps) {
      const events = [...(step.tablature ?? [])].sort((a, b) =>
        b.string - a.string
        || a.fret - b.fret
        || (a.finger ?? "-").localeCompare(b.finger ?? "-")
        || a.role.localeCompare(b.role)
      );
      for (const event of events) {
        lines.push([
          measure.measure,
          step.step,
          event.string,
          event.fret,
          event.finger ?? "-",
          event.role,
        ].join(","));
      }
    }
  }

  return lines.join("\n");
}

function parseInteger(value: string): number | null {
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function applyFingerstyleTablatureToon(
  payload: unknown,
  sourceMeasures: readonly TimeSliceMeasure[],
): FingerstyleTablatureDecodeResult {
  if (typeof payload !== "string") {
    return codecFailure("payload-type", "tablature_toon must be a string.");
  }
  if (payload.length > MAX_TABLATURE_PAYLOAD_CHARS) {
    return codecFailure(
      "payload-too-large",
      `tablature_toon exceeds the ${MAX_TABLATURE_PAYLOAD_CHARS}-character limit.`,
    );
  }

  const lines = payload.split(/\r?\n/);
  if (lines[0]?.trim() !== TABLATURE_FORMAT_VERSION) {
    return codecFailure("format-version", `Expected first line '${TABLATURE_FORMAT_VERSION}'.`, 1);
  }
  if (lines[1]?.trim() !== TABLATURE_HEADER) {
    return codecFailure("format-header", `Expected second line '${TABLATURE_HEADER}'.`, 2);
  }

  const measureByNumber = new Map<number, TimeSliceMeasure>();
  for (const measure of sourceMeasures) {
    if (measureByNumber.has(measure.measure)) {
      return codecFailure("duplicate-source-measure", `Source measure ${measure.measure} appears more than once.`);
    }
    measureByNumber.set(measure.measure, measure);
  }

  const maximumRows = sourceMeasures.reduce((count, measure) => count + measure.grid.length * 6, 0);
  const dataLines = lines
    .slice(2)
    .map((line, index) => ({ text: line.trim(), line: index + 3 }))
    .filter((entry) => entry.text.length > 0);
  if (dataLines.length > maximumRows) {
    return codecFailure(
      "too-many-rows",
      `Received ${dataLines.length} tablature rows; the source grid permits at most ${maximumRows}.`,
    );
  }

  const rows: FingerstyleTablatureRow[] = [];
  const assignedStrings = new Set<string>();

  for (const entry of dataLines) {
    const columns = entry.text.split(",").map((value) => value.trim());
    if (columns.length !== 6) {
      return codecFailure("column-count", `Expected 6 comma-separated columns, received ${columns.length}.`, entry.line);
    }

    const measureNumber = parseInteger(columns[0]);
    const stepNumber = parseInteger(columns[1]);
    const stringNumber = parseInteger(columns[2]);
    const fret = parseInteger(columns[3]);
    const finger = columns[4];
    const role = columns[5];

    if (measureNumber === null || measureNumber < 1) {
      return codecFailure("measure-number", `Invalid measure '${columns[0]}'.`, entry.line);
    }
    const sourceMeasure = measureByNumber.get(measureNumber);
    if (!sourceMeasure) {
      return codecFailure("unknown-measure", `Measure ${measureNumber} is not part of this request.`, entry.line);
    }
    if (stepNumber === null || stepNumber < 1) {
      return codecFailure("step-number", `Invalid step '${columns[1]}'.`, entry.line);
    }
    if (!sourceMeasure.grid.some((step) => step.step === stepNumber)) {
      return codecFailure("unknown-step", `Measure ${measureNumber} has no step ${stepNumber}.`, entry.line);
    }
    if (stringNumber === null || stringNumber < 1 || stringNumber > 6) {
      return codecFailure("string-number", `String must be an integer from 1 to 6; received '${columns[2]}'.`, entry.line);
    }
    if (fret === null || fret < 0) {
      return codecFailure("fret-number", `Fret must be a non-negative integer; received '${columns[3]}'.`, entry.line);
    }
    if (!FINGERS.has(finger)) {
      return codecFailure("finger", `Finger must be p, i, m, a, or -; received '${finger}'.`, entry.line);
    }
    if (!ROLES.has(role)) {
      return codecFailure("role", `Unknown tablature role '${role}'.`, entry.line);
    }

    const assignmentKey = `${measureNumber}:${stepNumber}:${stringNumber}`;
    if (assignedStrings.has(assignmentKey)) {
      return codecFailure(
        "duplicate-string",
        `Measure ${measureNumber} step ${stepNumber} assigns string ${stringNumber} more than once.`,
        entry.line,
      );
    }
    assignedStrings.add(assignmentKey);

    rows.push({
      measure: measureNumber,
      step: stepNumber,
      string: stringNumber as GuitarStringNumber,
      fret,
      finger: finger === "-" ? null : finger as "p" | "i" | "m" | "a",
      role: role as FingerstyleTablatureRow["role"],
    });
  }

  const rowsByStep = new Map<string, FingerstyleTablatureRow[]>();
  for (const row of rows) {
    const key = `${row.measure}:${row.step}`;
    const stepRows = rowsByStep.get(key) ?? [];
    stepRows.push(row);
    rowsByStep.set(key, stepRows);
  }

  const measures = sourceMeasures.map((measure) => ({
    ...measure,
    grid: measure.grid.map((step) => ({
      ...step,
      melody: { ...step.melody },
      tablature: (rowsByStep.get(`${measure.measure}:${step.step}`) ?? [])
        .sort((a, b) => b.string - a.string)
        .map((row) => ({
          string: row.string,
          fret: row.fret,
          finger: row.finger,
          role: row.role,
        })),
    })),
  }));

  return { ok: true, rows, measures };
}

export const FINGERSTYLE_TABLATURE_TOON_CONTRACT = [
  `Use exactly this compact format:`,
  TABLATURE_FORMAT_VERSION,
  TABLATURE_HEADER,
  `One row is one tablature attack. Omitted steps have empty tablature. Use '-' only for a null finger.`,
].join("\n");
