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
}

const ABC_EVENT_REGEX = /(\[[^\]]+\]|[_^=]?[A-Ga-g][,']*|[zx])([0-9]*(?:\/[0-9]*)?|\/[0-9]*)/g;

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
    normalized.push(`${token.token}${formatAbcDuration(duration)}`);
    elapsed += duration;
  }

  if (elapsed < targetUnits) {
    normalized.push(`z${formatAbcDuration(targetUnits - elapsed)}`);
  }

  return normalized.join(" ");
}
