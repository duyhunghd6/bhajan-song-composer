import {
  buildAbcDurationContext,
  extractMusicBodyLines,
  measureDurationUnits,
  splitAbcMeasureSegments,
  stripAbcChordSymbols,
} from "./abc-duration";
import { parseNoteDuration } from "./melody-analyzer";

const BEAT_ANNOTATION_PATTERN = /["“”][ \t]*(?:_|\^|=)?[ \t]*[⬤●•·][ \t]*["“”]/g;
const EPSILON = 1e-6;

export function stripBeatAnnotations(value: string): string {
  return value.replace(BEAT_ANNOTATION_PATTERN, "");
}

const STRONG_BEAT_LYRIC_CONTENT_PATTERN = /^[\s|*⬤●•·]+$/;

export function isStrongBeatLyricLine(line: string): boolean {
  const trimmed = line.trim();
  if (!/^w:\s*/.test(trimmed)) return false;

  const content = trimmed
    .replace(/^w:\s*/, "")
    .replace(/\s*%.*$/, "")
    .trim();

  return content.length > 0 && STRONG_BEAT_LYRIC_CONTENT_PATTERN.test(content);
}

export function stripStrongBeatLyricLines(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((line) => !isStrongBeatLyricLine(line))
    .join("\n");
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPSILON;
}

export type StrongBeatWeight = "strong" | "medium" | "soft";

export type StrongBeatEmphasis = "all-metric-beats" | "primary-strong-beats" | "downbeats-only";

export interface StrongBeatDirective {
  measureIndex: number;
  beats: Array<{
    beatTime: number;
    weight: StrongBeatWeight;
  }>;
}

export interface StrongBeatIconGenerationResult {
  valid: boolean;
  emphasis: StrongBeatEmphasis;
  strongBeatDirectives: StrongBeatDirective[];
  musicLines: string[];
  abcNotation: string;
  issues: string[];
}

function normalizeEmphasis(value: unknown): StrongBeatEmphasis {
  if (value === "primary-strong-beats" || value === "downbeats-only" || value === "all-metric-beats") {
    return value;
  }

  return "all-metric-beats";
}

function weightAllowedForEmphasis(weight: StrongBeatWeight, emphasis: StrongBeatEmphasis): boolean {
  if (emphasis === "all-metric-beats") return true;
  if (emphasis === "primary-strong-beats") return weight === "strong" || weight === "medium";
  return weight === "strong";
}

function beatGlyphForWeight(weight: StrongBeatWeight): string {
  if (weight === "strong") return "⬤";
  if (weight === "medium") return "●";
  return "•";
}

function beatAnnotationForWeight(weight: StrongBeatWeight): string {
  return `"_${beatGlyphForWeight(weight)}"`;
}

function metricWeightForPosition(timeInMeasure: number, timeSignature: string): StrongBeatWeight | null {
  if (timeSignature === "4/4" || timeSignature === "C") {
    if (nearlyEqual(timeInMeasure, 0)) return "strong";
    if (nearlyEqual(timeInMeasure, 4)) return "medium";
    if (nearlyEqual(timeInMeasure, 2) || nearlyEqual(timeInMeasure, 6)) return "soft";
    return null;
  }

  if (timeSignature === "3/4") {
    if (nearlyEqual(timeInMeasure, 0)) return "strong";
    if (nearlyEqual(timeInMeasure, 2) || nearlyEqual(timeInMeasure, 4)) return "soft";
    return null;
  }

  if (timeSignature === "6/8") {
    if (nearlyEqual(timeInMeasure, 0)) return "strong";
    if (nearlyEqual(timeInMeasure, 3)) return "medium";
    if (
      nearlyEqual(timeInMeasure, 1) ||
      nearlyEqual(timeInMeasure, 2) ||
      nearlyEqual(timeInMeasure, 4) ||
      nearlyEqual(timeInMeasure, 5)
    ) {
      return "soft";
    }
    return null;
  }

  return nearlyEqual(timeInMeasure, 0) ? "strong" : null;
}

function beatWeightForPosition(
  timeInMeasure: number,
  timeSignature: string,
  unitsPerBeat: number,
  measureIndex?: number,
  directives?: StrongBeatDirective[]
): StrongBeatWeight | null {
  if (directives && measureIndex !== undefined) {
    const directive = directives.find(d => d.measureIndex === measureIndex);
    if (directive) {
      const currentBeat = (timeInMeasure / unitsPerBeat) + 1;
      const beatInfo = directive.beats.find(b => nearlyEqual(b.beatTime, currentBeat));
      return beatInfo?.weight ?? null;
    }
  }

  return metricWeightForPosition(timeInMeasure, timeSignature);
}

function beatAnnotationForPosition(
  timeInMeasure: number,
  timeSignature: string,
  unitsPerBeat: number,
  measureIndex?: number,
  directives?: StrongBeatDirective[]
): string {
  const weight = beatWeightForPosition(timeInMeasure, timeSignature, unitsPerBeat, measureIndex, directives);
  return weight ? beatAnnotationForWeight(weight) : "";
}

function beatLyricTokenForPosition(
  timeInMeasure: number,
  timeSignature: string,
  unitsPerBeat: number,
  measureIndex?: number,
  directives?: StrongBeatDirective[]
): string {
  const weight = beatWeightForPosition(timeInMeasure, timeSignature, unitsPerBeat, measureIndex, directives);
  return weight ? beatGlyphForWeight(weight) : "*";
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

function addDirectiveBeat(
  directivesByMeasure: Map<number, StrongBeatDirective>,
  measureIndex: number,
  beatTime: number,
  weight: StrongBeatWeight
): void {
  const directive = directivesByMeasure.get(measureIndex) ?? { measureIndex, beats: [] };
  if (!directive.beats.some((beat) => nearlyEqual(beat.beatTime, beatTime))) {
    directive.beats.push({ beatTime, weight });
  }
  directivesByMeasure.set(measureIndex, directive);
}

function isMusicBodyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("%")) return false;
  return !/^[A-Za-z]:/.test(trimmed);
}

export function buildStrongBeatDirectives(input: {
  musicLines: string[];
  baseAbc: string;
  emphasis?: StrongBeatEmphasis;
}): StrongBeatDirective[] {
  const context = buildAbcDurationContext(input.baseAbc);
  const emphasis = normalizeEmphasis(input.emphasis);
  const directivesByMeasure = new Map<number, StrongBeatDirective>();
  let timeInMeasure = firstMeasureOffset(input.musicLines, input.baseAbc);
  let measureIndex = 0;

  for (const line of input.musicLines) {
    const cleanLine = stripBeatAnnotations(line);
    let index = 0;
    let inSlur = false;
    let slurHasBeat = false;

    while (index < cleanLine.length) {
      const quoted = readQuotedToken(cleanLine, index);
      if (quoted) {
        index = quoted.endIndex;
        continue;
      }

      if (cleanLine[index] === "(") {
        inSlur = true;
        slurHasBeat = false;
        index += 1;
        continue;
      }

      if (cleanLine[index] === ")") {
        inSlur = false;
        slurHasBeat = false;
        index += 1;
        continue;
      }

      const chord = readChordToken(cleanLine, index);
      if (chord) {
        if (!inSlur || !slurHasBeat) {
          const weight = metricWeightForPosition(timeInMeasure, context.timeSignature);
          if (weight && weightAllowedForEmphasis(weight, emphasis)) {
            addDirectiveBeat(directivesByMeasure, measureIndex, (timeInMeasure / context.unitsPerBeat) + 1, weight);
            if (inSlur) slurHasBeat = true;
          }
        }
        timeInMeasure += chord.durationUnits;
        index = chord.endIndex;
        continue;
      }

      const note = readNoteToken(cleanLine, index);
      if (note) {
        if (!inSlur || !slurHasBeat) {
          const weight = metricWeightForPosition(timeInMeasure, context.timeSignature);
          if (weight && weightAllowedForEmphasis(weight, emphasis)) {
            addDirectiveBeat(directivesByMeasure, measureIndex, (timeInMeasure / context.unitsPerBeat) + 1, weight);
            if (inSlur) slurHasBeat = true;
          }
        }
        timeInMeasure += note.durationUnits;
        index = note.endIndex;
        continue;
      }

      const rest = readRestToken(cleanLine, index);
      if (rest) {
        timeInMeasure += rest.durationUnits;
        index = rest.endIndex;
        continue;
      }

      if (isBarCharacter(cleanLine[index])) {
        if (timeInMeasure > 0) {
          timeInMeasure = 0;
          measureIndex += 1;
        } else if (index > 0 && isBarCharacter(cleanLine[index - 1])) {
          // Double barline or repeat boundary already handled by the previous character.
        } else {
          timeInMeasure = 0;
        }
      }
      index += 1;
    }
  }

  return [...directivesByMeasure.values()].map((directive) => ({
    ...directive,
    beats: directive.beats.sort((a, b) => a.beatTime - b.beatTime),
  })).sort((a, b) => a.measureIndex - b.measureIndex);
}

export function annotateStrongBeatIndicators(input: {
  musicLines: string[];
  baseAbc: string;
  directives?: StrongBeatDirective[];
}): string[] {
  const context = buildAbcDurationContext(input.baseAbc);
  let timeInMeasure = firstMeasureOffset(input.musicLines, input.baseAbc);
  let measureIndex = 0;

  return input.musicLines.map((line) => {
    const cleanLine = stripBeatAnnotations(line);
    let output = "";
    let index = 0;
    let inSlur = false;
    let slurHasBeat = false;

    while (index < cleanLine.length) {
      const quoted = readQuotedToken(cleanLine, index);
      if (quoted) {
        output += quoted.token;
        index = quoted.endIndex;
        continue;
      }

      if (cleanLine[index] === "(") {
        inSlur = true;
        slurHasBeat = false;
        output += "(";
        index += 1;
        continue;
      }

      if (cleanLine[index] === ")") {
        inSlur = false;
        slurHasBeat = false;
        output += ")";
        index += 1;
        continue;
      }

      const chord = readChordToken(cleanLine, index);
      if (chord) {
        if (!inSlur || !slurHasBeat) {
          const ann = beatAnnotationForPosition(timeInMeasure, context.timeSignature, context.unitsPerBeat, measureIndex, input.directives);
          if (ann) {
            output += ann;
            if (inSlur) slurHasBeat = true;
          }
        }
        output += chord.token;
        timeInMeasure += chord.durationUnits;
        index = chord.endIndex;
        continue;
      }

      const note = readNoteToken(cleanLine, index);
      if (note) {
        if (!inSlur || !slurHasBeat) {
          const ann = beatAnnotationForPosition(timeInMeasure, context.timeSignature, context.unitsPerBeat, measureIndex, input.directives);
          if (ann) {
            output += ann;
            if (inSlur) slurHasBeat = true;
          }
        }
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
        if (timeInMeasure > 0) {
          timeInMeasure = 0;
          measureIndex += 1;
        } else if (index > 0 && isBarCharacter(cleanLine[index - 1])) {
          // Double barline or repeat boundary already handled by the previous character.
        } else {
          timeInMeasure = 0;
        }
      }
      index += 1;
    }

    return output;
  });
}

export function buildStrongBeatLyricLines(input: {
  musicLines: string[];
  baseAbc: string;
  directives?: StrongBeatDirective[];
}): string[] {
  const context = buildAbcDurationContext(input.baseAbc);
  let timeInMeasure = firstMeasureOffset(input.musicLines, input.baseAbc);
  let measureIndex = 0;

  return input.musicLines.map((line) => {
    const cleanLine = stripBeatAnnotations(line);
    const lyricTokens: string[] = [];
    let index = 0;
    let inSlur = false;
    let slurHasBeat = false;

    while (index < cleanLine.length) {
      const quoted = readQuotedToken(cleanLine, index);
      if (quoted) {
        index = quoted.endIndex;
        continue;
      }

      if (cleanLine[index] === "(") {
        inSlur = true;
        slurHasBeat = false;
        index += 1;
        continue;
      }

      if (cleanLine[index] === ")") {
        inSlur = false;
        slurHasBeat = false;
        index += 1;
        continue;
      }

      const chord = readChordToken(cleanLine, index);
      if (chord) {
        const token = (!inSlur || !slurHasBeat)
          ? beatLyricTokenForPosition(timeInMeasure, context.timeSignature, context.unitsPerBeat, measureIndex, input.directives)
          : "*";
        lyricTokens.push(token);
        if (token !== "*" && inSlur) slurHasBeat = true;
        timeInMeasure += chord.durationUnits;
        index = chord.endIndex;
        continue;
      }

      const note = readNoteToken(cleanLine, index);
      if (note) {
        const token = (!inSlur || !slurHasBeat)
          ? beatLyricTokenForPosition(timeInMeasure, context.timeSignature, context.unitsPerBeat, measureIndex, input.directives)
          : "*";
        lyricTokens.push(token);
        if (token !== "*" && inSlur) slurHasBeat = true;
        timeInMeasure += note.durationUnits;
        index = note.endIndex;
        continue;
      }

      const rest = readRestToken(cleanLine, index);
      if (rest) {
        timeInMeasure += rest.durationUnits;
        index = rest.endIndex;
        continue;
      }

      if (isBarCharacter(cleanLine[index])) {
        if (timeInMeasure > 0) {
          lyricTokens.push("|");
          timeInMeasure = 0;
          measureIndex += 1;
        } else if (index > 0 && isBarCharacter(cleanLine[index - 1])) {
          // Double barline or repeat boundary already handled by the previous character.
        } else {
          timeInMeasure = 0;
        }
      }
      index += 1;
    }

    return lyricTokens.length > 0 ? `w: ${lyricTokens.join(" ")}` : "";
  });
}

function addStrongBeatLyricLinesToAbc(input: {
  abcNotation: string;
  musicLines: string[];
  beatLyricLines: string[];
}): string {
  const output: string[] = [];
  const lines = stripStrongBeatLyricLines(input.abcNotation).split(/\r?\n/);
  let musicLineIndex = 0;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!isMusicBodyLine(line)) {
      if (!isStrongBeatLyricLine(line)) output.push(line);
      index += 1;
      continue;
    }

    output.push(stripBeatAnnotations(line.trim()));
    const beatLine = input.beatLyricLines[musicLineIndex] ?? "";
    musicLineIndex += 1;
    index += 1;

    while (index < lines.length && /^w:/.test(lines[index].trim())) {
      if (!isStrongBeatLyricLine(lines[index])) output.push(lines[index]);
      index += 1;
    }

    if (beatLine) output.push(beatLine);
  }

  return output.join("\n");
}

export function addStrongBeatIconsToAbcNotation(input: {
  abcNotation: string;
  emphasis?: StrongBeatEmphasis;
}): StrongBeatIconGenerationResult {
  const emphasis = normalizeEmphasis(input.emphasis);
  const cleanedAbcNotation = stripStrongBeatLyricLines(input.abcNotation);
  const musicLines = extractMusicBodyLines(cleanedAbcNotation).map(stripBeatAnnotations);
  const strongBeatDirectives = buildStrongBeatDirectives({
    musicLines,
    baseAbc: cleanedAbcNotation,
    emphasis,
  });
  const beatLyricLines = buildStrongBeatLyricLines({
    musicLines,
    baseAbc: cleanedAbcNotation,
    directives: strongBeatDirectives,
  });
  const abcNotation = addStrongBeatLyricLinesToAbc({
    abcNotation: cleanedAbcNotation,
    musicLines,
    beatLyricLines,
  });
  const issues = strongBeatDirectives.length === 0
    ? ["No strong beat targets were found in the supplied ABCNotation."]
    : [];

  return {
    valid: issues.length === 0,
    emphasis,
    strongBeatDirectives,
    musicLines,
    abcNotation,
    issues,
  };
}
