import type { AbcBarlineInfo } from "../abc-duration";
import type { GuitarStringNumber } from "../fingerstyle-compressor";
import type { TimeSliceGridStep, TimeSliceMeasure } from "./time-slice";
import type { ImportedTimeGridDocument } from "./timegrid-document-codec";

export const V2_FORMAT = "timegrid-document:v2";

export class TimeGridDocumentV2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeGridDocumentV2Error";
  }
}

const WEIGHTS = [null, "⬤", "●", "*"] as const;
const FINGERS = ["p", "i", "m", "a", null] as const;
const ROLES = ["bass", "melody", "fill", "harmony", "root", "fifth"] as const;
const METADATA_MASK = 31;

type Style = [string, string, string, string | null];
type V2Document = { f: typeof V2_FORMAT; a: string; c: string[]; p: string[]; s: Style[]; d: number; o: [number, number][]; m: unknown[][] };

function fail(message: string): never { throw new TimeGridDocumentV2Error(message); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function int(value: unknown, path: string, minimum = 0): number {
  if (!Number.isInteger(value) || (value as number) < minimum) fail(`${path} must be an integer >= ${minimum}.`);
  return value as number;
}
function text(value: unknown, path: string): string { if (typeof value !== "string") fail(`${path} must be a string.`); return value; }
function nullableText(value: unknown, path: string): string | null { if (value !== null && typeof value !== "string") fail(`${path} must be a string or null.`); return value; }
function list(value: unknown, path: string): unknown[] { if (!Array.isArray(value)) fail(`${path} must be an array.`); return value; }
function tuple(value: unknown, length: number, path: string): unknown[] { const result = list(value, path); if (result.length !== length) fail(`${path} must have ${length} items.`); return result; }
function finite(value: unknown, path: string): number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(`${path} must be a non-negative finite number.`); return value; }
function indexOf<T>(values: readonly T[], value: unknown, path: string): number { const index = values.indexOf(value as T); if (index < 0) fail(`${path} has an unsupported value.`); return index; }

function isV2Representable(document: ImportedTimeGridDocument): boolean {
  return document.measures.every((measure, measureIndex) => measure.measure === measureIndex + 1 && measure.grid.every((step, stepIndex) => {
    if (step.step !== stepIndex + 1) return false;
    if (step.melody.state === "rest") return step.melody.pitch === null;
    return step.melody.pitch !== null && step.melody.pitch !== "r";
  }));
}

function styleKey(style: TimeSliceMeasure["style_profile"]): string {
  return JSON.stringify([style.key, style.comping_style, style.voicing_plan, style.fill_density ?? null]);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function event(event: NonNullable<TimeSliceGridStep["tablature"]>[number]): unknown[] {
  const value: unknown[] = [event.string, event.fret, indexOf(FINGERS, event.finger, "event finger"), indexOf(ROLES, event.role, "event role")];
  if (event.durationSteps !== undefined || event.fillWindowId !== undefined || event.fillCandidateId !== undefined) value.push(event.durationSteps ?? null);
  if (event.fillWindowId !== undefined || event.fillCandidateId !== undefined) value.push(event.fillWindowId ?? null);
  if (event.fillCandidateId !== undefined) value.push(event.fillCandidateId);
  return value;
}

function buildV2(document: ImportedTimeGridDocument): V2Document | null {
  if (!isV2Representable(document)) return null;
  const styles = unique(document.measures.map(measure => styleKey(measure.style_profile))).map(key => JSON.parse(key) as Style);
  const styleIndexes = document.measures.map(measure => styles.findIndex(style => JSON.stringify(style) === styleKey(measure.style_profile)));
  const styleCounts = styles.map((_, styleIndex) => styleIndexes.filter(value => value === styleIndex).length);
  const defaultStyle = styleCounts.reduce((best, count, index) => count > styleCounts[best] ? index : best, 0);
  const chords = unique(document.measures.flatMap(measure => measure.grid.map(step => step.chord)));
  const pitches = unique(document.measures.flatMap(measure => measure.grid.flatMap(step => step.melody.pitch === null ? [] : [step.melody.pitch])));
  const overrides: [number, number][] = [];
  const measures = document.measures.map((measure, measureIndex) => {
    if (styleIndexes[measureIndex] !== defaultStyle) overrides.push([measureIndex, styleIndexes[measureIndex]]);
    let mask = 0;
    const metadata: unknown[] = [];
    if (measure.pickupDurationUnits !== undefined) { mask |= 1; metadata.push(measure.pickupDurationUnits); }
    if (measure.sourceDurationUnits !== undefined) { mask |= 2; metadata.push(measure.sourceDurationUnits); }
    if (measure.barline !== undefined) { mask |= 4; metadata.push([Number(measure.barline.repeatStart) | (Number(measure.barline.repeatEnd) << 1), ...(measure.barline.volta === null ? [] : [measure.barline.volta])]); }
    if (measure.visualTablature !== undefined) { mask |= 8; metadata.push(measure.visualTablature); }
    if (measure.source_abc !== undefined) { mask |= 16; metadata.push([measure.source_abc.melody, measure.source_abc.lyric, measure.source_abc.beatWeight]); }
    const steps = measure.grid.map(step => {
      const melody: unknown = step.melody.state === "rest" ? "r" : [pitches.indexOf(step.melody.pitch!), step.melody.state === "attack"];
      const value: unknown[] = [chords.indexOf(step.chord), indexOf(WEIGHTS, step.weight, "weight"), melody];
      if (step.lyric !== null || step.tablature !== undefined) value.push(step.lyric);
      if (step.tablature !== undefined) value.push(step.tablature.map(event));
      return value;
    });
    return [measure.lineIndex, mask, ...metadata, steps];
  });
  return { f: V2_FORMAT, a: document.source.rawAbc, c: chords, p: pitches, s: styles, d: defaultStyle, o: overrides, m: measures };
}

export function formatV2Document(document: ImportedTimeGridDocument): string | null {
  const compact = buildV2(document);
  return compact ? JSON.stringify(compact) : null;
}

function measurePresentation(measure: unknown[]): string {
  const grid = measure.at(-1);
  if (!Array.isArray(grid)) fail("Internal v2 measure is missing its grid.");
  const prefix = JSON.stringify(measure.slice(0, -1)).slice(0, -1);
  const rows: string[] = [];
  for (let index = 0; index < grid.length; index += 4) rows.push(grid.slice(index, index + 4).map(step => JSON.stringify(step)).join(","));
  return `${prefix},[\n${rows.map(row => `  ${row}`).join(",\n")}\n]]`;
}

export function formatV2DocumentPresentation(document: ImportedTimeGridDocument): string | null {
  const compact = buildV2(document);
  if (!compact) return null;
  return `{"f":"${V2_FORMAT}","a":${JSON.stringify(compact.a)},"c":${JSON.stringify(compact.c)},"p":${JSON.stringify(compact.p)},"s":${JSON.stringify(compact.s)},"d":${compact.d},"o":${JSON.stringify(compact.o)},"m":[\n${compact.m.map(measurePresentation).join(",\n")}\n]}`;
}

function table(value: unknown, path: string): string[] {
  const items = list(value, path).map((item, index) => text(item, `${path}[${index}]`));
  if (new Set(items).size !== items.length) fail(`${path} must not contain duplicates.`);
  return items;
}
function ref(value: unknown, values: string[], path: string): string { const index = int(value, path); if (index >= values.length) fail(`${path} is out of range.`); return values[index]; }

function parseEvent(value: unknown, path: string) {
  const parts = list(value, path);
  if (parts.length < 4 || parts.length > 7) fail(`${path} must have 4 through 7 items.`);
  const string = int(parts[0], `${path}[0]`, 1); if (string > 6) fail(`${path}[0] must be 1 through 6.`);
  const fret = int(parts[1], `${path}[1]`);
  const finger = FINGERS[int(parts[2], `${path}[2]`)]; if (finger === undefined) fail(`${path}[2] is out of range.`);
  const role = ROLES[int(parts[3], `${path}[3]`)]; if (role === undefined) fail(`${path}[3] is out of range.`);
  const durationSteps = parts.length >= 5 && parts[4] !== null ? int(parts[4], `${path}[4]`, 1) : undefined;
  const fillWindowId = parts.length >= 6 ? nullableText(parts[5], `${path}[5]`) ?? undefined : undefined;
  const fillCandidateId = parts.length === 7 ? nullableText(parts[6], `${path}[6]`) ?? undefined : undefined;
  return { string: string as GuitarStringNumber, fret, finger, role, ...(durationSteps === undefined ? {} : { durationSteps }), ...(fillWindowId === undefined ? {} : { fillWindowId }), ...(fillCandidateId === undefined ? {} : { fillCandidateId }) };
}

function parseV2Measure(value: unknown, measureIndex: number, style: Style, chords: string[], pitches: string[]): TimeSliceMeasure {
  const parts = list(value, `m[${measureIndex}]`); if (parts.length < 3) fail(`m[${measureIndex}] is too short.`);
  const lineIndex = int(parts[0], `m[${measureIndex}][0]`);
  const mask = int(parts[1], `m[${measureIndex}][1]`); if (mask > METADATA_MASK) fail(`m[${measureIndex}][1] has unsupported bits.`);
  let cursor = 2;
  const next = (bit: number) => mask & bit ? parts[cursor++] : undefined;
  const pickup = next(1); const sourceDuration = next(2); const barlineValue = next(4); const visual = next(8); const source = next(16);
  const gridValue = parts[cursor++]; if (cursor !== parts.length) fail(`m[${measureIndex}] has extra metadata.`);
  const grid = list(gridValue, `m[${measureIndex}].grid`).map((stepValue, stepIndex) => {
    const step = list(stepValue, `m[${measureIndex}].grid[${stepIndex}]`); if (step.length < 3 || step.length > 5) fail(`m[${measureIndex}].grid[${stepIndex}] must have 3 through 5 items.`);
    const weightCode = int(step[1], `m[${measureIndex}].grid[${stepIndex}][1]`); const weight = WEIGHTS[weightCode]; if (weight === undefined) fail(`Invalid weight code.`);
    let melody: TimeSliceGridStep["melody"];
    if (step[2] === "r") melody = { pitch: null, state: "rest" };
    else { const encoded = tuple(step[2], 2, `m[${measureIndex}].grid[${stepIndex}][2]`); const pitch = ref(encoded[0], pitches, "pitch index"); if (typeof encoded[1] !== "boolean") fail("Melody state must be boolean."); melody = { pitch, state: encoded[1] ? "attack" : "sustain" }; }
    const lyric = step.length >= 4 ? nullableText(step[3], "lyric") : null;
    const tablature = step.length === 5 ? list(step[4], "tablature").map((item, index) => parseEvent(item, `tablature[${index}]`)) : undefined;
    const strings = new Set<number>(); for (const item of tablature ?? []) { if (strings.has(item.string)) fail("Duplicate tablature string."); strings.add(item.string); }
    return { step: stepIndex + 1, chord: ref(step[0], chords, "chord index"), weight, melody, lyric, ...(tablature === undefined ? {} : { tablature }) };
  });
  let barline: AbcBarlineInfo | undefined;
  if (barlineValue !== undefined) { const parts = list(barlineValue, "barline"); if (parts.length < 1 || parts.length > 2) fail("Invalid barline."); const flags = int(parts[0], "barline flags"); if (flags > 3) fail("Invalid barline flags."); barline = { repeatStart: Boolean(flags & 1), repeatEnd: Boolean(flags & 2), volta: parts.length === 2 ? text(parts[1], "volta") : null }; }
  return { measure: measureIndex + 1, lineIndex, style_profile: { key: style[0], comping_style: style[1], voicing_plan: style[2], ...(style[3] === null ? {} : { fill_density: style[3] }) }, ...(pickup === undefined ? {} : { pickupDurationUnits: finite(pickup, "pickup") }), ...(sourceDuration === undefined ? {} : { sourceDurationUnits: finite(sourceDuration, "source duration") }), ...(barline === undefined ? {} : { barline }), ...(visual === undefined ? {} : { visualTablature: text(visual, "visual tab") }), ...(source === undefined ? {} : { source_abc: (() => { const parts = tuple(source, 3, "source ABC"); return { melody: text(parts[0], "source melody"), lyric: text(parts[1], "source lyric"), beatWeight: text(parts[2], "source beat weight") }; })() }), grid };
}

export function parseV2Document(parsed: Record<string, unknown>): ImportedTimeGridDocument {
  const allowed = new Set(["f", "a", "c", "p", "s", "d", "o", "m"]); if (Object.keys(parsed).some(key => !allowed.has(key)) || Object.keys(parsed).length !== allowed.size) fail("The v2 document has invalid root fields.");
  const chords = table(parsed.c, "c"); const pitches = table(parsed.p, "p");
  const styles = list(parsed.s, "s").map((item, index) => { const style = tuple(item, 4, `s[${index}]`); return [text(style[0], "style key"), text(style[1], "style comping"), text(style[2], "style voicing"), nullableText(style[3], "style density")] as Style; });
  if (!styles.length || new Set(styles.map(style => JSON.stringify(style))).size !== styles.length) fail("s must contain unique styles.");
  const defaultStyle = int(parsed.d, "d"); if (defaultStyle >= styles.length) fail("d is out of range.");
  const overrides = new Map<number, number>(); let previous = -1;
  for (const [measureIndexValue, styleIndexValue] of list(parsed.o, "o").map((item, index) => tuple(item, 2, `o[${index}]`))) { const measureIndex = int(measureIndexValue, "override measure"); const styleIndex = int(styleIndexValue, "override style"); if (measureIndex <= previous || styleIndex >= styles.length || styleIndex === defaultStyle) fail("Invalid style override."); overrides.set(measureIndex, styleIndex); previous = measureIndex; }
  const measures = list(parsed.m, "m"); if ([...overrides.keys()].some(index => index >= measures.length)) fail("Style override is out of measure range.");
  return { version: 1, source: { rawAbc: text(parsed.a, "a") }, measures: measures.map((measure, index) => parseV2Measure(measure, index, styles[overrides.get(index) ?? defaultStyle], chords, pitches)) };
}
