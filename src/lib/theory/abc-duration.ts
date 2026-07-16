import { parseAbcHeader, parseNoteDuration } from "./melody-analyzer";

export interface AbcMeterFraction {
  numerator: number;
  denominator: number;
}

export interface AbcDurationContext {
  timeSignature: string;
  meter: AbcMeterFraction;
  defaultNoteLength: number;
  unitsPerBeat: number;
  fullMeasureUnits: number;
}

export interface AbcDurationToken {
  token: string;
  durationSuffix: string;
  durationUnits: number;
  tieSuffix: "" | "-";
}

const ABC_EVENT_REGEX = /(\[[^\]]+\]|(?:![1-6]!)?[_^=]{0,2}[A-Ga-g][,']*|[zx])([0-9]*(?:\/[0-9]*)?|\/[0-9]*)(-?)/g;

function parseFraction(value: string): number | null {
  const [rawNumerator, rawDenominator] = value.trim().split("/");
  const numerator = Number.parseInt(rawNumerator, 10);
  const denominator = Number.parseInt(rawDenominator, 10);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }

  return numerator / denominator;
}

export function parseMeterFraction(timeSignature: string): AbcMeterFraction {
  const trimmed = timeSignature.trim();
  if (trimmed === "C") return { numerator: 4, denominator: 4 };
  if (trimmed === "C|") return { numerator: 2, denominator: 2 };

  const [rawNumerator, rawDenominator] = trimmed.split("/");
  const numerator = Number.parseInt(rawNumerator, 10);
  const denominator = Number.parseInt(rawDenominator, 10);

  if (!Number.isFinite(numerator) || numerator <= 0 || !Number.isFinite(denominator) || denominator <= 0) {
    return { numerator: 4, denominator: 4 };
  }

  return { numerator, denominator };
}

export function parseDefaultNoteLength(abcString: string, timeSignature?: string): number {
  const lengthLine = abcString
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("L:"));

  if (lengthLine) {
    const parsed = parseFraction(lengthLine.substring(2));
    if (parsed) return parsed;
  }

  const meter = parseMeterFraction(timeSignature ?? parseAbcHeader(abcString).timeSignature);
  const meterValue = meter.numerator / meter.denominator;
  return meterValue < 0.75 ? 1 / 16 : 1 / 8;
}

export function buildAbcDurationContext(abcString: string): AbcDurationContext {
  const { timeSignature } = parseAbcHeader(abcString);
  const meter = parseMeterFraction(timeSignature);
  const defaultNoteLength = parseDefaultNoteLength(abcString, timeSignature);
  const unitsPerBeat = (1 / meter.denominator) / defaultNoteLength;

  return {
    timeSignature,
    meter,
    defaultNoteLength,
    unitsPerBeat,
    fullMeasureUnits: meter.numerator * unitsPerBeat,
  };
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y > 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-6;
}

export function formatAbcDuration(units: number): string {
  if (nearlyEqual(units, 1)) return "";

  const rounded = Math.round(units);
  if (nearlyEqual(units, rounded)) return String(rounded);

  const denominator = 64;
  const numerator = Math.round(units * denominator);
  const divisor = gcd(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;

  if (reducedNumerator === 1) return `/${reducedDenominator}`;
  return `${reducedNumerator}/${reducedDenominator}`;
}

export function extractMusicBodyLines(abcString: string): string[] {
  return abcString
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (line.startsWith("%")) return false;
      if (/^[A-Za-z]:/.test(line)) return false;
      return true;
    });
}

export function stripAbcChordSymbols(value: string): string {
  return value.replace(/"[^"]*"/g, "");
}

export function cleanAbcMeasureSegment(segment: string): string {
  return segment
    .replace(/\[\|/g, "")
    .replace(/\|\]/g, "")
    .replace(/^\]$/g, "")
    .replace(/^\[[0-9,\-]+\s*/g, "")
    .replace(/^[:\s]+|[:\s]+$/g, "")
    .trim();
}

export function splitAbcMeasureSegments(musicBody: string): string[] {
  return musicBody
    .split("|")
    .map(cleanAbcMeasureSegment)
    .filter(Boolean);
}

/* ── Barline / repeat metadata ── */

export interface AbcBarlineInfo {
  /** true when the barline leading into this measure is a repeat-start `|:` */
  repeatStart: boolean;
  /** true when the barline trailing this measure is a repeat-end `:|` */
  repeatEnd: boolean;
  /** Volta bracket label (e.g. "1", "2", "1,3"), or null */
  volta: string | null;
}

export const EMPTY_BARLINE_INFO: Readonly<AbcBarlineInfo> = Object.freeze({
  repeatStart: false,
  repeatEnd: false,
  volta: null,
});

/**
 * Extract barline metadata from a raw measure segment (before cleaning).
 * After `musicBody.split("|")`, a segment may carry:
 * - Leading `:` from `|:` → repeatStart
 * - Trailing `:` from `:|` → repeatEnd
 * - Leading `[N` from `|[N` → volta bracket
 */
export function extractBarlineInfo(rawSegment: string): AbcBarlineInfo {
  const trimmed = rawSegment.trim();
  if (!trimmed) return EMPTY_BARLINE_INFO;

  const repeatStart = /^:/.test(trimmed);
  const repeatEnd = /:\s*$/.test(trimmed);

  // Volta may appear after optional leading ':' and whitespace
  const afterColon = trimmed.replace(/^:\s*/, "");
  const voltaMatch = afterColon.match(/^\[([0-9,\-]+)/);
  const volta = voltaMatch ? voltaMatch[1] : null;

  if (!repeatStart && !repeatEnd && !volta) return EMPTY_BARLINE_INFO;
  return { repeatStart, repeatEnd, volta };
}

export interface AbcMeasureWithBarline {
  content: string;
  barline: AbcBarlineInfo;
}

/**
 * Like `splitAbcMeasureSegments`, but also returns barline metadata
 * (repeat start/end, volta) for each measure.
 */
export function splitAbcMeasureSegmentsWithBarlines(musicBody: string): AbcMeasureWithBarline[] {
  return musicBody
    .split("|")
    .map((raw) => ({
      content: cleanAbcMeasureSegment(raw),
      barline: extractBarlineInfo(raw),
    }))
    .filter((segment) => segment.content.length > 0);
}

/**
 * Join ABC measure strings with appropriate barlines, preserving repeat markers
 * (|: :|) and volta brackets ([N) from the provided barline info.
 * When `barlines` is empty or all entries are EMPTY_BARLINE_INFO, the output
 * matches the plain `| A | B | C |` format.
 */
export function joinAbcMeasuresWithBarlines(
  measures: string[],
  barlines: AbcBarlineInfo[]
): string {
  if (measures.length === 0) return "";

  const parts: string[] = [];

  for (let i = 0; i < measures.length; i++) {
    const curr = barlines[i] ?? EMPTY_BARLINE_INFO;
    const prev = i > 0 ? (barlines[i - 1] ?? EMPTY_BARLINE_INFO) : undefined;

    // Barline before this measure
    if (i === 0) {
      parts.push(curr.repeatStart ? "|: " : "| ");
    } else {
      if (prev!.repeatEnd && curr.repeatStart) {
        parts.push(" :|: ");
      } else if (prev!.repeatEnd) {
        parts.push(" :| ");
      } else if (curr.repeatStart) {
        parts.push(" |: ");
      } else {
        parts.push(" | ");
      }
    }

    // Volta bracket after barline, before measure content
    if (curr.volta) {
      parts.push(`[${curr.volta} `);
    }

    parts.push(measures[i]);
  }

  // Trailing barline
  const last = barlines[measures.length - 1] ?? EMPTY_BARLINE_INFO;
  parts.push(last.repeatEnd ? " :|" : " |");

  return parts.join("");
}

export function extractDurationTokens(abcMeasure: string): AbcDurationToken[] {
  const tokens: AbcDurationToken[] = [];
  const cleanMeasure = stripAbcChordSymbols(cleanAbcMeasureSegment(abcMeasure));
  let match: RegExpExecArray | null;

  ABC_EVENT_REGEX.lastIndex = 0;
  while ((match = ABC_EVENT_REGEX.exec(cleanMeasure)) !== null) {
    const durationSuffix = match[2] ?? "";
    tokens.push({
      token: match[1],
      durationSuffix,
      durationUnits: parseNoteDuration(durationSuffix),
      tieSuffix: match[3] === "-" ? "-" : "",
    });
  }

  return tokens;
}

export function measureDurationUnits(abcMeasure: string): number {
  const cleanMeasure = stripAbcChordSymbols(cleanAbcMeasureSegment(abcMeasure));
  const chordRegex = /\[[^\]]+\]([0-9]*(?:\/[0-9]*)?|\/[0-9]*)/g;
  let chordDuration = 0;
  let chordMatch: RegExpExecArray | null;

  while ((chordMatch = chordRegex.exec(cleanMeasure)) !== null) {
    chordDuration += parseNoteDuration(chordMatch[1] ?? "");
  }

  const withoutChords = cleanMeasure.replace(/\[[^\]]+\][0-9]*(?:\/[0-9]*)?|\[[^\]]+\]\/[0-9]*/g, "");
  const noteDuration = extractDurationTokens(withoutChords).reduce((sum, token) => sum + token.durationUnits, 0);

  return chordDuration + noteDuration;
}

export function normalizeAbcMeasureDuration(abcMeasure: string, targetUnits: number): string {
  const tokens = extractDurationTokens(abcMeasure);
  const normalized: string[] = [];
  let elapsed = 0;

  for (const token of tokens) {
    if (elapsed >= targetUnits) break;
    const remaining = targetUnits - elapsed;
    const duration = Math.min(token.durationUnits, remaining);
    normalized.push(`${token.token}${formatAbcDuration(duration)}${token.tieSuffix}`);
    elapsed += duration;
  }

  if (elapsed < targetUnits) {
    normalized.push(`z${formatAbcDuration(targetUnits - elapsed)}`);
  }

  return normalized.join(" ");
}
