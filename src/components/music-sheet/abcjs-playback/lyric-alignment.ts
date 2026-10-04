import type { SourceRange } from "./source-map";

/**
 * Source-side alignment of aligned-lyric (`w:`) syllables to the notes of the
 * music line they follow. abcjs attaches syllables to notes but does not report
 * where each syllable sits in the source, so this follows the ABC 2.1 rules
 * (§5.1) to answer "which note does the caret in this lyric line belong to?".
 */
export type LyricUnitKind = "syllable" | "hold" | "skip" | "bar";

export interface LyricUnit extends SourceRange {
  kind: LyricUnitKind;
}

const LYRIC_LINE = /^\s*w:/;

export function lineBoundsAt(text: string, offset: number): SourceRange {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  const newline = text.indexOf("\n", offset);
  return { start, end: newline === -1 ? text.length : newline };
}

export function isLyricLine(line: string): boolean {
  return LYRIC_LINE.test(line);
}

function isMusicLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && !trimmed.startsWith("%") && !/^[A-Za-z]:/.test(trimmed);
}

/** The music line a lyric line aligns to: the nearest music line above it, across verse lines. */
export function findAlignedMusicLine(text: string, lyricLineStart: number): SourceRange | null {
  let lineEnd = lyricLineStart - 1;
  while (lineEnd >= 0) {
    const start = text.lastIndexOf("\n", lineEnd - 1) + 1;
    const line = text.slice(start, lineEnd);
    const trimmed = line.trim();
    if (isMusicLine(line)) return { start, end: lineEnd };
    if (!(isLyricLine(line) || trimmed === "" || trimmed.startsWith("%"))) return null;
    lineEnd = start - 1;
  }
  return null;
}

export function tokenizeLyricLine(text: string, line: SourceRange): LyricUnit[] {
  const prefix = text.slice(line.start, line.end).match(LYRIC_LINE);
  if (!prefix) return [];
  const units: LyricUnit[] = [];
  let syllableStart = -1;
  const flush = (end: number) => {
    if (syllableStart < 0) return;
    units.push({ kind: "syllable", start: syllableStart, end });
    syllableStart = -1;
  };

  let index = line.start + prefix[0].length;
  for (; index < line.end; index += 1) {
    const character = text[index];
    if (character === "%") break;
    if (character === "\\" && text[index + 1] === "-") {
      if (syllableStart < 0) syllableStart = index;
      index += 1;
      continue;
    }
    if (/\s/.test(character)) {
      flush(index);
    } else if (character === "-") {
      // A hyphen after a syllable splits the word; a hyphen after a space or
      // another hyphen is a syllable of its own and takes a note.
      if (syllableStart >= 0) flush(index + 1);
      else units.push({ kind: "syllable", start: index, end: index + 1 });
    } else if (character === "_" || character === "*" || character === "|") {
      flush(index);
      units.push({ kind: character === "_" ? "hold" : character === "*" ? "skip" : "bar", start: index, end: index + 1 });
    } else if (syllableStart < 0) {
      syllableStart = index;
    }
  }
  flush(index);
  return units;
}

/**
 * Returns, per unit, the index into `notes` it occupies (or null). `notes` and
 * `bars` are the music line's sounding notes and bar lines in source order.
 */
export function alignLyricUnits(
  units: readonly LyricUnit[],
  notes: readonly SourceRange[],
  bars: readonly SourceRange[],
  musicStart: number,
): (number | null)[] {
  let cursor = 0;
  return units.map((unit) => {
    if (unit.kind === "bar") {
      // Lyrics may outrun the notes (or the score may not be indexed yet).
      const previous = notes[Math.min(cursor, notes.length) - 1];
      const after = previous ? previous.end : musicStart;
      const bar = bars.find((candidate) => candidate.start >= after);
      if (bar) {
        const next = notes.findIndex((note) => note.start >= bar.end);
        cursor = next === -1 ? notes.length : next;
      }
      return null;
    }
    const index = cursor < notes.length ? cursor : null;
    cursor += 1;
    return index;
  });
}

function unitsForRange(units: readonly LyricUnit[], range: SourceRange): LyricUnit[] {
  if (range.end > range.start) {
    return units.filter((unit) => range.end > unit.start && range.start < unit.end);
  }
  const caret = range.start;
  const containing = units.find((unit) => unit.start <= caret && caret < unit.end);
  if (containing) return [containing];
  const before = units.filter((unit) => unit.end <= caret);
  return before.length ? [before[before.length - 1]] : units.slice(0, 1);
}

/**
 * Notes addressed by a selection inside a `w:` line, or null when the
 * selection does not start in a lyric line.
 */
export function resolveLyricNoteTargets<T extends SourceRange>(
  text: string,
  range: SourceRange,
  notes: readonly T[],
  bars: readonly SourceRange[],
): T[] | null {
  const line = lineBoundsAt(text, range.start);
  if (!isLyricLine(text.slice(line.start, line.end))) return null;
  const music = findAlignedMusicLine(text, line.start);
  if (!music) return [];

  const inMusicLine = (element: SourceRange) => element.start >= music.start && element.start < music.end;
  const lineNotes = notes.filter(inMusicLine);
  const lineBars = bars.filter(inMusicLine);
  const units = tokenizeLyricLine(text, line);
  const alignment = alignLyricUnits(units, lineNotes, lineBars, music.start);
  const clipped = { start: range.start, end: Math.min(range.end, line.end) };

  const targets = new Set<T>();
  for (const unit of unitsForRange(units, clipped)) {
    const noteIndex = alignment[units.indexOf(unit)];
    if (noteIndex !== null) targets.add(lineNotes[noteIndex]);
  }
  return [...targets];
}
