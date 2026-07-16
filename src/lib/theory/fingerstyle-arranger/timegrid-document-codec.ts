import type { AbcBarlineInfo } from "../abc-duration";
import type { GuitarStringNumber } from "../fingerstyle-compressor";
import type { TimeSliceGridStep, TimeSliceMeasure } from "./time-slice";
import {
  formatV2Document,
  formatV2DocumentPresentation,
  parseV2Document,
  TimeGridDocumentV2Error,
  V2_FORMAT,
} from "./timegrid-document-codec-v2";
import { formatV3Document, parseV3Document, TimeGridDocumentV3Error, V3_FORMAT } from "./timegrid-document-codec-v3";

/** Immutable source envelope plus its editable canonical guitar arrangement. */
export interface ImportedTimeGridDocument {
  version: 1;
  source: { rawAbc: string };
  measures: TimeSliceMeasure[];
}

const V1_FORMAT = "timegrid-document:v1";
const FINGERS = new Set(["p", "i", "m", "a", null]);
const ROLES = new Set(["bass", "melody", "fill", "harmony", "root", "fifth"]);
const WEIGHTS = new Set(["⬤", "●", "*", null]);
const MELODY_STATES = new Set(["attack", "sustain", "rest"]);

type CompactEvent = [number, number, "p" | "i" | "m" | "a" | null, "bass" | "melody" | "fill" | "harmony" | "root" | "fifth", number | null, string | null, string | null];
type CompactStep = [number, string, "⬤" | "●" | "*" | null, string | null, "attack" | "sustain" | "rest", string | null, CompactEvent[] | null];
type CompactMeasure = [number, number, [string, string, string, string | null], number | null, number | null, [boolean, boolean, string | null] | null, string | null, [string, string, string] | null, CompactStep[]];
type CompactDocument = { f: typeof V1_FORMAT; a: string; m: CompactMeasure[] };

export class TimeGridDocumentCodecError extends Error {
  constructor(message: string) { super(message); this.name = "TimeGridDocumentCodecError"; }
}
function fail(message: string): never { throw new TimeGridDocumentCodecError(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function requiredString(value: unknown, path: string): string { if (typeof value !== "string") fail(`${path} must be a string.`); return value; }
function nullableString(value: unknown, path: string): string | null { if (value !== null && typeof value !== "string") fail(`${path} must be a string or null.`); return value; }
function integer(value: unknown, path: string, minimum?: number): number { if (!Number.isInteger(value) || (minimum !== undefined && (value as number) < minimum)) fail(`${path} must be an integer${minimum === undefined ? "" : ` >= ${minimum}`}.`); return value as number; }
function nullableFiniteNumber(value: unknown, path: string): number | undefined { if (value === null) return undefined; if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${path} must be a non-negative finite number or null.`); return value; }
function tuple(value: unknown, length: number, path: string): unknown[] { if (!Array.isArray(value) || value.length !== length) fail(`${path} must be a ${length}-item tuple.`); return value; }

function compactEvent(event: NonNullable<TimeSliceGridStep["tablature"]>[number]): CompactEvent { return [event.string, event.fret, event.finger, event.role, event.durationSteps ?? null, event.fillWindowId ?? null, event.fillCandidateId ?? null]; }
function compactStep(step: TimeSliceGridStep): CompactStep { return [step.step, step.chord, step.weight, step.melody.pitch, step.melody.state, step.lyric, step.tablature === undefined ? null : step.tablature.map(compactEvent)]; }
function compactDocument(document: ImportedTimeGridDocument): CompactDocument { return { f: V1_FORMAT, a: document.source.rawAbc, m: document.measures.map(measure => [measure.measure, measure.lineIndex, [measure.style_profile.key, measure.style_profile.comping_style, measure.style_profile.voicing_plan, measure.style_profile.fill_density ?? null], measure.pickupDurationUnits ?? null, measure.sourceDurationUnits ?? null, measure.barline ? [measure.barline.repeatStart, measure.barline.repeatEnd, measure.barline.volta] : null, measure.visualTablature ?? null, measure.source_abc ? [measure.source_abc.melody, measure.source_abc.lyric, measure.source_abc.beatWeight] : null, measure.grid.map(compactStep)]) }; }
function formatV1Document(document: ImportedTimeGridDocument): string { return JSON.stringify(compactDocument(document)); }

function formatV1MeasurePresentation(measure: CompactMeasure): string {
  const prefix = JSON.stringify(measure.slice(0, -1)).slice(0, -1);
  const rows: string[] = [];
  for (let index = 0; index < measure[8].length; index += 4) rows.push(measure[8].slice(index, index + 4).map(step => JSON.stringify(step)).join(","));
  return `${prefix},[\n${rows.map(row => `  ${row}`).join(",\n")}\n]]`;
}
function formatV1DocumentPresentation(document: ImportedTimeGridDocument): string { const compact = compactDocument(document); return `{"f":${JSON.stringify(compact.f)},"a":${JSON.stringify(compact.a)},"m":[\n${compact.m.map(formatV1MeasurePresentation).join(",\n")}\n]}`; }

function parseV1Event(value: unknown, path: string) {
  const [stringValue, fretValue, fingerValue, roleValue, durationValue, windowValue, candidateValue] = tuple(value, 7, path);
  const string = integer(stringValue, `${path}[0]`, 1); if (string > 6) fail(`${path}[0] must be a guitar string from 1 through 6.`);
  const fret = integer(fretValue, `${path}[1]`, 0);
  if (!FINGERS.has(fingerValue as null) || !ROLES.has(roleValue as string)) fail(`${path} has an unsupported event value.`);
  const durationSteps = durationValue === null ? undefined : integer(durationValue, `${path}[4]`, 1);
  const fillWindowId = nullableString(windowValue, `${path}[5]`) ?? undefined;
  const fillCandidateId = nullableString(candidateValue, `${path}[6]`) ?? undefined;
  return { string: string as GuitarStringNumber, fret, finger: fingerValue as "p" | "i" | "m" | "a" | null, role: roleValue as "bass" | "melody" | "fill" | "harmony" | "root" | "fifth", ...(durationSteps === undefined ? {} : { durationSteps }), ...(fillWindowId === undefined ? {} : { fillWindowId }), ...(fillCandidateId === undefined ? {} : { fillCandidateId }) };
}
function parseV1Step(value: unknown, path: string): TimeSliceGridStep {
  const [stepValue, chordValue, weightValue, pitchValue, stateValue, lyricValue, tablatureValue] = tuple(value, 7, path);
  if (!WEIGHTS.has(weightValue as null) || !MELODY_STATES.has(stateValue as string)) fail(`${path} has an unsupported step value.`);
  if (tablatureValue !== null && !Array.isArray(tablatureValue)) fail(`${path}[6] must be an event list or null.`);
  const tablature = tablatureValue?.map((event, index) => parseV1Event(event, `${path}[6][${index}]`));
  const strings = new Set<number>(); for (const event of tablature ?? []) { if (strings.has(event.string)) fail(`${path}[6] contains duplicate string ${event.string} attacks.`); strings.add(event.string); }
  return { step: integer(stepValue, `${path}[0]`, 1), chord: requiredString(chordValue, `${path}[1]`), weight: weightValue as TimeSliceGridStep["weight"], melody: { pitch: nullableString(pitchValue, `${path}[3]`), state: stateValue as TimeSliceGridStep["melody"]["state"] }, lyric: nullableString(lyricValue, `${path}[5]`), ...(tablatureValue === null ? {} : { tablature }) };
}
function parseV1Measure(value: unknown, path: string): TimeSliceMeasure {
  const [measureValue, lineIndexValue, styleValue, pickupValue, sourceDurationValue, barlineValue, visualValue, sourceAbcValue, gridValue] = tuple(value, 9, path);
  const style = tuple(styleValue, 4, `${path}[2]`); const fillDensity = nullableString(style[3], `${path}[2][3]`) ?? undefined;
  if (barlineValue !== null && !Array.isArray(barlineValue)) fail(`${path}[5] must be a barline tuple or null.`);
  const barlineTuple = barlineValue === null ? null : tuple(barlineValue, 3, `${path}[5]`);
  if (barlineTuple && (typeof barlineTuple[0] !== "boolean" || typeof barlineTuple[1] !== "boolean")) fail(`${path}[5] repeat flags must be boolean.`);
  const barline: AbcBarlineInfo | undefined = barlineTuple ? { repeatStart: barlineTuple[0] as boolean, repeatEnd: barlineTuple[1] as boolean, volta: nullableString(barlineTuple[2], `${path}[5][2]`) } : undefined;
  if (sourceAbcValue !== null && !Array.isArray(sourceAbcValue)) fail(`${path}[7] must be a source tuple or null.`);
  const source = sourceAbcValue === null ? null : tuple(sourceAbcValue, 3, `${path}[7]`);
  if (!Array.isArray(gridValue)) fail(`${path}[8] must be a grid array.`);
  const grid = gridValue.map((step, index) => parseV1Step(step, `${path}[8][${index}]`));
  return { measure: integer(measureValue, `${path}[0]`, 1), lineIndex: integer(lineIndexValue, `${path}[1]`, 0), style_profile: { key: requiredString(style[0], `${path}[2][0]`), comping_style: requiredString(style[1], `${path}[2][1]`), voicing_plan: requiredString(style[2], `${path}[2][2]`), ...(fillDensity === undefined ? {} : { fill_density: fillDensity }) }, ...(nullableFiniteNumber(pickupValue, `${path}[3]`) === undefined ? {} : { pickupDurationUnits: nullableFiniteNumber(pickupValue, `${path}[3]`) }), ...(nullableFiniteNumber(sourceDurationValue, `${path}[4]`) === undefined ? {} : { sourceDurationUnits: nullableFiniteNumber(sourceDurationValue, `${path}[4]`) }), ...(barline === undefined ? {} : { barline }), ...(visualValue === null ? {} : { visualTablature: requiredString(visualValue, `${path}[6]`) }), ...(source === null ? {} : { source_abc: { melody: requiredString(source[0], `${path}[7][0]`), lyric: requiredString(source[1], `${path}[7][1]`), beatWeight: requiredString(source[2], `${path}[7][2]`) } }), grid };
}
function parseV1Document(parsed: Record<string, unknown>): ImportedTimeGridDocument { if (!Array.isArray(parsed.m)) fail("The v1 compact TimeGrid document must contain a measure array."); return { version: 1, source: { rawAbc: requiredString(parsed.a, "a") }, measures: parsed.m.map((measure, index) => parseV1Measure(measure, `m[${index}]`)) }; }

/** Emits the single literal-value, human/AI-readable TimeGrid document. */
export function formatImportedTimeGridDocumentCompact(document: ImportedTimeGridDocument): string { return formatV3Document(document); }
/** @deprecated The single v3 formatter already produces the display document. */
export function formatImportedTimeGridDocumentCompactPresentation(document: ImportedTimeGridDocument): string { return formatV3Document(document); }
/** Parses current v3 documents and legacy v1/v2 migration inputs. */
export function parseImportedTimeGridDocumentCompact(payload: string): ImportedTimeGridDocument {
  let parsed: unknown; try { parsed = JSON.parse(payload); } catch { fail("The compact TimeGrid document is not valid JSON."); }
  if (!isRecord(parsed)) fail("The compact TimeGrid document must be an object.");
  try { if (parsed.format === V3_FORMAT) return parseV3Document(parsed); if (parsed.f === V1_FORMAT) return parseV1Document(parsed); if (parsed.f === V2_FORMAT) return parseV2Document(parsed); } catch (error) { if (error instanceof TimeGridDocumentV2Error || error instanceof TimeGridDocumentV3Error) fail(error.message); throw error; }
  fail("The compact TimeGrid document has an unsupported format version.");
}
