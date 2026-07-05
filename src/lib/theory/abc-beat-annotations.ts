import {
  buildAbcDurationContext,
  measureDurationUnits,
  splitAbcMeasureSegments,
  stripAbcChordSymbols,
} from "./abc-duration";
import { parseNoteDuration } from "./melody-analyzer";

const BEAT_ANNOTATION_PATTERN = /"_[⬤●•·]"/g;
const EPSILON = 1e-6;

export function stripBeatAnnotations(value: string): string {
  return value.replace(BEAT_ANNOTATION_PATTERN, "");
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

function beatAnnotationForPosition(timeInMeasure: number, timeSignature: string): string {
  if (timeSignature === "4/4" || timeSignature === "C") {
    if (nearlyEqual(timeInMeasure, 0)) return '"_⬤"';
    if (nearlyEqual(timeInMeasure, 4)) return '"_●"';
    if (nearlyEqual(timeInMeasure, 2) || nearlyEqual(timeInMeasure, 6)) return '"_•"';
    return "";
  }

  if (timeSignature === "3/4") {
    if (nearlyEqual(timeInMeasure, 0)) return '"_⬤"';
    if (nearlyEqual(timeInMeasure, 2) || nearlyEqual(timeInMeasure, 4)) return '"_•"';
    return "";
  }

  if (timeSignature === "6/8") {
    if (nearlyEqual(timeInMeasure, 0)) return '"_⬤"';
    if (nearlyEqual(timeInMeasure, 3)) return '"_●"';
    if (
      nearlyEqual(timeInMeasure, 1) ||
      nearlyEqual(timeInMeasure, 2) ||
      nearlyEqual(timeInMeasure, 4) ||
      nearlyEqual(timeInMeasure, 5)
    ) {
      return '"_•"';
    }
    return "";
  }

  return nearlyEqual(timeInMeasure, 0) ? '"_⬤"' : "";
}

function readDurationSuffix(value: string, startIndex: number): { suffix: string; endIndex: number } {
  let index = startIndex;
  while (index < value.length && /[0-9/]/.test(value[index])) {
    index += 1;
  }
  return { suffix: value.slice(startIndex, index), endIndex: index };
}

function readNoteToken(value: string, startIndex: number): { token: string; durationUnits: number; endIndex: number } | null {
  let index = startIndex;

  while (index < value.length && /[_^=]/.test(value[index])) {
    index += 1;
  }

  if (!/[A-Ga-g]/.test(value[index] ?? "")) return null;
  index += 1;

  while (index < value.length && /[,']/.test(value[index])) {
    index += 1;
  }

  const duration = readDurationSuffix(value, index);
  return {
    token: value.slice(startIndex, duration.endIndex),
    durationUnits: parseNoteDuration(duration.suffix),
    endIndex: duration.endIndex,
  };
}

function readRestToken(value: string, startIndex: number): { token: string; durationUnits: number; endIndex: number } | null {
  if (!/[zx]/.test(value[startIndex] ?? "")) return null;
  const duration = readDurationSuffix(value, startIndex + 1);
  return {
    token: value.slice(startIndex, duration.endIndex),
    durationUnits: parseNoteDuration(duration.suffix),
    endIndex: duration.endIndex,
  };
}

function readChordToken(value: string, startIndex: number): { token: string; durationUnits: number; endIndex: number } | null {
  if (value[startIndex] !== "[") return null;
  const closeIndex = value.indexOf("]", startIndex + 1);
  if (closeIndex === -1) return null;

  const chordContent = value.slice(startIndex + 1, closeIndex);
  if (chordContent.startsWith("|") || /^[0-9,\-]+$/.test(chordContent) || !/[A-Ga-g]/.test(chordContent)) {
    return null;
  }

  const duration = readDurationSuffix(value, closeIndex + 1);
  return {
    token: value.slice(startIndex, duration.endIndex),
    durationUnits: parseNoteDuration(duration.suffix),
    endIndex: duration.endIndex,
  };
}

function readQuotedToken(value: string, startIndex: number): { token: string; endIndex: number } | null {
  if (value[startIndex] !== '"') return null;
  const closeIndex = value.indexOf('"', startIndex + 1);
  if (closeIndex === -1) return null;
  return { token: value.slice(startIndex, closeIndex + 1), endIndex: closeIndex + 1 };
}

function isBarCharacter(value: string): boolean {
  return value === "|" || value === ":";
}

function firstMeasureOffset(musicLines: string[], baseAbc: string): number {
  const context = buildAbcDurationContext(baseAbc);
  const segments = splitAbcMeasureSegments(stripAbcChordSymbols(musicLines.join(" ")).replace(BEAT_ANNOTATION_PATTERN, ""));
  const firstDuration = segments.length > 0 ? measureDurationUnits(segments[0]) : 0;

  if (firstDuration > 0 && firstDuration < context.fullMeasureUnits) {
    return context.fullMeasureUnits - firstDuration;
  }

  return 0;
}

export function annotateStrongBeatIndicators(input: { musicLines: string[]; baseAbc: string }): string[] {
  const context = buildAbcDurationContext(input.baseAbc);
  let timeInMeasure = firstMeasureOffset(input.musicLines, input.baseAbc);

  return input.musicLines.map((line) => {
    const cleanLine = stripBeatAnnotations(line);
    let output = "";
    let index = 0;

    while (index < cleanLine.length) {
      const quoted = readQuotedToken(cleanLine, index);
      if (quoted) {
        output += quoted.token;
        index = quoted.endIndex;
        continue;
      }

      const chord = readChordToken(cleanLine, index);
      if (chord) {
        output += beatAnnotationForPosition(timeInMeasure, context.timeSignature);
        output += chord.token;
        timeInMeasure += chord.durationUnits;
        index = chord.endIndex;
        continue;
      }

      const note = readNoteToken(cleanLine, index);
      if (note) {
        output += beatAnnotationForPosition(timeInMeasure, context.timeSignature);
        output += note.token;
        timeInMeasure += note.durationUnits;
        index = note.endIndex;
        continue;
      }

      const rest = readRestToken(cleanLine, index);
      if (rest) {
        output += rest.token;
        timeInMeasure += rest.durationUnits;
        index = rest.endIndex;
        continue;
      }

      output += cleanLine[index];
      if (isBarCharacter(cleanLine[index])) {
        timeInMeasure = 0;
      }
      index += 1;
    }

    return output;
  });
}
