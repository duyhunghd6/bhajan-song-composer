/**
 * Character-offset map between the caller's ABC (`abcString`) and the transient
 * string handed to abcjs (`prepareAbcjsRenderInput`). abcjs reports
 * `startChar`/`endChar` against the prepared string, while editors select
 * against the caller's source, so every cross-link must go through this map.
 *
 * The map is derived by aligning the two strings instead of instrumenting each
 * render adaptation: adaptations stay free to evolve in `render-input.ts`
 * without each one having to report its own splices.
 */
export interface AbcSourceMap {
  toSource(preparedOffset: number): number;
  toPrepared(sourceOffset: number): number;
}

export interface SourceRange {
  start: number;
  end: number;
}

type Pair = readonly [number, number];

// Bounds the LCS table for one changed region; larger regions keep only their
// common prefix/suffix anchors and degrade to the nearest following anchor.
const MAX_ALIGNMENT_CELLS = 400_000;

function alignSequences<T>(a: readonly T[], b: readonly T[]): Pair[] {
  const pairs: Pair[] = [];
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    pairs.push([prefix, prefix]);
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const aMiddle = a.length - prefix - suffix;
  const bMiddle = b.length - prefix - suffix;
  if (aMiddle > 0 && bMiddle > 0 && aMiddle * bMiddle <= MAX_ALIGNMENT_CELLS) {
    const width = bMiddle + 1;
    const table = new Uint32Array((aMiddle + 1) * width);
    for (let i = aMiddle - 1; i >= 0; i -= 1) {
      for (let j = bMiddle - 1; j >= 0; j -= 1) {
        table[i * width + j] = a[prefix + i] === b[prefix + j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < aMiddle && j < bMiddle) {
      if (a[prefix + i] === b[prefix + j]) {
        pairs.push([prefix + i, prefix + j]);
        i += 1;
        j += 1;
      } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
        i += 1;
      } else {
        j += 1;
      }
    }
  }

  for (let k = suffix; k > 0; k -= 1) pairs.push([a.length - k, b.length - k]);
  return pairs;
}

function lineStarts(lines: readonly string[]): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  return starts;
}

/** Fills unmatched offsets with the next matched offset (the insertion point). */
function buildLookup(length: number, targetLength: number, matches: Map<number, number>): Int32Array {
  const table = new Int32Array(length + 1);
  table[length] = targetLength;
  for (let index = length - 1; index >= 0; index -= 1) {
    table[index] = matches.get(index) ?? table[index + 1];
  }
  return table;
}

function lookup(table: Int32Array, offset: number): number {
  return table[Math.max(0, Math.min(table.length - 1, Math.trunc(offset)))];
}

const IDENTITY_CLAMP = (length: number) => (offset: number) => Math.max(0, Math.min(length, Math.trunc(offset)));

export function buildAbcSourceMap(source: string, prepared: string): AbcSourceMap {
  if (source === prepared) {
    const clamp = IDENTITY_CLAMP(source.length);
    return { toSource: clamp, toPrepared: clamp };
  }

  const sourceLines = source.split("\n");
  const preparedLines = prepared.split("\n");
  const sourceStarts = lineStarts(sourceLines);
  const preparedStarts = lineStarts(preparedLines);
  const sourceToPrepared = new Map<number, number>();
  const preparedToSource = new Map<number, number>();

  const matchLines = (sourceLine: number, preparedLine: number) => {
    const sourceText = sourceLines[sourceLine];
    const preparedText = preparedLines[preparedLine];
    // Offsets are UTF-16 code units, matching abcjs `startChar` and editor positions.
    const charPairs = sourceText === preparedText
      ? Array.from({ length: sourceText.length }, (_, index) => [index, index] as const)
      : alignSequences(sourceText.split(""), preparedText.split(""));
    for (const [sourceChar, preparedChar] of charPairs) {
      sourceToPrepared.set(sourceStarts[sourceLine] + sourceChar, preparedStarts[preparedLine] + preparedChar);
      preparedToSource.set(preparedStarts[preparedLine] + preparedChar, sourceStarts[sourceLine] + sourceChar);
    }
    const hasSourceBreak = sourceLine < sourceLines.length - 1;
    const hasPreparedBreak = preparedLine < preparedLines.length - 1;
    if (hasSourceBreak && hasPreparedBreak) {
      const sourceBreak = sourceStarts[sourceLine] + sourceText.length;
      const preparedBreak = preparedStarts[preparedLine] + preparedText.length;
      sourceToPrepared.set(sourceBreak, preparedBreak);
      preparedToSource.set(preparedBreak, sourceBreak);
    }
  };

  // Identical lines anchor the alignment; edited lines between two anchors are
  // paired in order so in-line adaptations still map character by character.
  const linePairs = alignSequences(sourceLines, preparedLines);
  let previous: Pair = [-1, -1];
  for (const pair of [...linePairs, [sourceLines.length, preparedLines.length] as const]) {
    const gapSource = pair[0] - previous[0] - 1;
    const gapPrepared = pair[1] - previous[1] - 1;
    for (let k = 0; k < Math.min(gapSource, gapPrepared); k += 1) {
      matchLines(previous[0] + 1 + k, previous[1] + 1 + k);
    }
    if (pair[0] < sourceLines.length) matchLines(pair[0], pair[1]);
    previous = pair;
  }

  const toSourceTable = buildLookup(prepared.length, source.length, preparedToSource);
  const toPreparedTable = buildLookup(source.length, prepared.length, sourceToPrepared);
  return {
    toSource: (offset) => lookup(toSourceTable, offset),
    toPrepared: (offset) => lookup(toPreparedTable, offset),
  };
}

/** Drops surrounding whitespace that abcjs folds into element ranges. */
export function trimSourceRange(text: string, range: SourceRange): SourceRange {
  let { start, end } = range;
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  return { start, end };
}
