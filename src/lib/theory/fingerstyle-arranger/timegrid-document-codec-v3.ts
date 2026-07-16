import type { GuitarStringNumber } from "../fingerstyle-compressor";
import type { TimeSliceGridStep, TimeSliceMeasure } from "./time-slice";
import type { ImportedTimeGridDocument } from "./timegrid-document-codec";

export const V3_FORMAT = "timegrid-document:v3";
const FINGERS = new Set(["p", "i", "m", "a", null]);
const ROLES = new Set(["bass", "melody", "fill", "harmony", "root", "fifth", "imported"]);
const WEIGHTS = new Set(["⬤", "●", "*", null]);
const STATES = new Set(["attack", "sustain", "rest"]);

export class TimeGridDocumentV3Error extends Error {
  constructor(message: string) { super(message); this.name = "TimeGridDocumentV3Error"; }
}
function fail(message: string): never { throw new TimeGridDocumentV3Error(message); }
function record(value: unknown, path: string): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${path} must be an object.`); return value as Record<string, unknown>; }
function array(value: unknown, path: string): unknown[] { if (!Array.isArray(value)) fail(`${path} must be an array.`); return value; }
function string(value: unknown, path: string): string { if (typeof value !== "string") fail(`${path} must be a string.`); return value; }
function nullableString(value: unknown, path: string): string | null { if (value !== null && typeof value !== "string") fail(`${path} must be a string or null.`); return value; }
function integer(value: unknown, path: string, min = 0): number { if (!Number.isInteger(value) || (value as number) < min) fail(`${path} must be an integer >= ${min}.`); return value as number; }
function finite(value: unknown, path: string): number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${path} must be a non-negative number.`); return value; }
function optionalNumber(value: unknown, path: string): number | undefined { return value === undefined ? undefined : finite(value, path); }

function style(measure: TimeSliceMeasure): Record<string, string> {
  return {
    key: measure.style_profile.key,
    comp: measure.style_profile.comping_style,
    voice: measure.style_profile.voicing_plan,
    ...(measure.style_profile.fill_density === undefined ? {} : { fills: measure.style_profile.fill_density }),
  };
}
function sameStyle(left: TimeSliceMeasure, right: TimeSliceMeasure): boolean { return JSON.stringify(style(left)) === JSON.stringify(style(right)); }
function event(tab: NonNullable<TimeSliceGridStep["tablature"]>[number]) {
  return { string: tab.string, fret: tab.fret, finger: tab.finger, role: tab.role, ...(tab.durationSteps === undefined ? {} : { durationSteps: tab.durationSteps }), ...(tab.fillWindowId === undefined ? {} : { fillWindowId: tab.fillWindowId }), ...(tab.fillCandidateId === undefined ? {} : { fillCandidateId: tab.fillCandidateId }) };
}

function wireStep(step: TimeSliceGridStep) {
  return {
    step: step.step,
    chord: step.chord,
    ...(step.weight === null ? {} : { weight: step.weight }),
    melody: step.melody,
    ...(step.lyric === null ? {} : { lyric: step.lyric }),
    ...(step.tablature === undefined ? {} : { tab: step.tablature.map(event) }),
  };
}

function formatMeasure(measure: TimeSliceMeasure): string {
  const fields = [
    ["measure", measure.measure],
    ["lineIndex", measure.lineIndex],
    ...(measure.pickupDurationUnits === undefined ? [] : [["pickupDurationUnits", measure.pickupDurationUnits]]),
    ...(measure.sourceDurationUnits === undefined ? [] : [["sourceDurationUnits", measure.sourceDurationUnits]]),
    ...(measure.barline === undefined ? [] : [["barline", measure.barline]]),
    ...(measure.visualTablature === undefined ? [] : [["visualTablature", measure.visualTablature]]),
    ...(measure.guitarSlurs === undefined ? [] : [["guitarSlurs", measure.guitarSlurs]]),
    ...(measure.source_abc === undefined ? [] : [["sourceAbc", measure.source_abc]]),
  ];
  const propertyLines = fields.map(([key, value]) => `      ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  const gridLines = measure.grid.map(step => `        ${JSON.stringify(wireStep(step))}`);
  return [
    "    {",
    ...propertyLines,
    "      \"grid\": [",
    gridLines.join(",\n"),
    "      ]",
    "    }",
  ].join("\n");
}

/** The one emitted, literal-value TimeGrid interchange document. */
export function formatV3Document(document: ImportedTimeGridDocument): string {
  const rootMeasure = document.measures[0];
  const rootStyle = rootMeasure ? style(rootMeasure) : { key: "", comp: "", voice: "" };
  const overrides = document.measures.flatMap((measure, measureIndex) => rootMeasure && !sameStyle(measure, rootMeasure) ? [{ measureIndex, style: style(measure) }] : []);
  return [
    "{",
    `  \"format\": ${JSON.stringify(V3_FORMAT)},`,
    `  \"source\": ${JSON.stringify({ rawAbc: document.source.rawAbc })},`,
    `  \"style\": ${JSON.stringify(rootStyle)},`,
    ...(overrides.length ? [`  \"styleOverrides\": ${JSON.stringify(overrides)},`] : []),
    "  \"measures\": [",
    document.measures.map(formatMeasure).join(",\n"),
    "  ]",
    "}",
  ].join("\n");
}

function parseStyle(value: unknown, path: string): TimeSliceMeasure["style_profile"] {
  const item = record(value, path);
  return { key: string(item.key, `${path}.key`), comping_style: string(item.comp, `${path}.comp`), voicing_plan: string(item.voice, `${path}.voice`), ...(item.fills === undefined ? {} : { fill_density: string(item.fills, `${path}.fills`) }) };
}
function parseEvent(value: unknown, path: string) {
  const item = record(value, path); const guitarString = integer(item.string, `${path}.string`, 1); if (guitarString > 6) fail(`${path}.string must be 1 through 6.`);
  const finger = item.finger; const role = item.role;
  if (!FINGERS.has(finger as null) || !ROLES.has(role as string)) fail(`${path} has invalid finger or role.`);
  const durationSteps = item.durationSteps === undefined ? undefined : integer(item.durationSteps, `${path}.durationSteps`, 1);
  return { string: guitarString as GuitarStringNumber, fret: integer(item.fret, `${path}.fret`), finger: finger as "p" | "i" | "m" | "a" | null, role: role as "bass" | "melody" | "fill" | "harmony" | "root" | "fifth" | "imported", ...(durationSteps === undefined ? {} : { durationSteps }), ...(item.fillWindowId === undefined ? {} : { fillWindowId: string(item.fillWindowId, `${path}.fillWindowId`) }), ...(item.fillCandidateId === undefined ? {} : { fillCandidateId: string(item.fillCandidateId, `${path}.fillCandidateId`) }) };
}

function parseGuitarSlurs(value: unknown, path: string): TimeSliceMeasure["guitarSlurs"] {
  if (value === undefined) return undefined;
  return array(value, path).map((raw, index) => {
    const item = record(raw, `${path}[${index}]`);
    const startStep = integer(item.startStep, `${path}[${index}].startStep`, 1);
    const endStep = integer(item.endStep, `${path}[${index}].endStep`, startStep);
    return { startStep, endStep };
  });
}

export function parseV3Document(value: Record<string, unknown>): ImportedTimeGridDocument {
  const source = record(value.source, "source"); const rootStyle = parseStyle(value.style, "style"); const rawMeasures = array(value.measures, "measures");
  const overrides = new Map<number, TimeSliceMeasure["style_profile"]>();
  for (const [index, raw] of array(value.styleOverrides ?? [], "styleOverrides").entries()) { const item = record(raw, `styleOverrides[${index}]`); const measureIndex = integer(item.measureIndex, `styleOverrides[${index}].measureIndex`); if (overrides.has(measureIndex)) fail("Duplicate style override."); overrides.set(measureIndex, parseStyle(item.style, `styleOverrides[${index}].style`)); }
  if ([...overrides.keys()].some(index => index >= rawMeasures.length)) fail("Style override is out of range.");
  return { version: 1, source: { rawAbc: string(source.rawAbc, "source.rawAbc") }, measures: rawMeasures.map((rawMeasure, measureIndex) => {
    const item = record(rawMeasure, `measures[${measureIndex}]`); const grid = array(item.grid, `measures[${measureIndex}].grid`).map((rawStep, stepIndex) => {
      const step = record(rawStep, `grid[${stepIndex}]`); const melody = record(step.melody, `grid[${stepIndex}].melody`); const state = string(melody.state, "melody.state"); const pitch = nullableString(melody.pitch, "melody.pitch");
      if (!STATES.has(state) || (state === "rest" ? pitch !== null : pitch === null)) fail("Invalid melody state/pitch.");
      const weight = step.weight === undefined ? null : step.weight; if (!WEIGHTS.has(weight as null)) fail("Invalid weight.");
      const tablature = step.tab === undefined ? undefined : array(step.tab, "tab").map((tab, tabIndex) => parseEvent(tab, `tab[${tabIndex}]`)); const strings = new Set<number>(); for (const tab of tablature ?? []) { if (strings.has(tab.string)) fail("Duplicate tablature string."); strings.add(tab.string); }
      return { step: integer(step.step, "step", 1), chord: string(step.chord, "chord"), weight: weight as TimeSliceGridStep["weight"], melody: { pitch, state: state as TimeSliceGridStep["melody"]["state"] }, lyric: step.lyric === undefined ? null : nullableString(step.lyric, "lyric"), ...(tablature === undefined ? {} : { tablature }) };
    });
    return { measure: integer(item.measure, "measure", 1), lineIndex: integer(item.lineIndex, "lineIndex"), style_profile: overrides.get(measureIndex) ?? rootStyle, ...(optionalNumber(item.pickupDurationUnits, "pickupDurationUnits") === undefined ? {} : { pickupDurationUnits: optionalNumber(item.pickupDurationUnits, "pickupDurationUnits") }), ...(optionalNumber(item.sourceDurationUnits, "sourceDurationUnits") === undefined ? {} : { sourceDurationUnits: optionalNumber(item.sourceDurationUnits, "sourceDurationUnits") }), ...(item.barline === undefined ? {} : { barline: record(item.barline, "barline") as unknown as TimeSliceMeasure["barline"] }), ...(item.visualTablature === undefined ? {} : { visualTablature: string(item.visualTablature, "visualTablature") }), ...(item.guitarSlurs === undefined ? {} : { guitarSlurs: parseGuitarSlurs(item.guitarSlurs, "guitarSlurs") }), ...(item.sourceAbc === undefined ? {} : { source_abc: record(item.sourceAbc, "sourceAbc") as TimeSliceMeasure["source_abc"] }), grid };
  }) };
}
