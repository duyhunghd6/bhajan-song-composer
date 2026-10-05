import { isAbcChordSymbol, normalizeAbcChordSymbol } from './abc-chord-symbol';
import { buildGuitarChordScore } from './guitar-chord-score';
import { validateHarmonyTimelineAbc } from './accompaniment-workflow/harmony-validation';
import { abcMatchesReferenceMeasureLinePattern } from './accompaniment-workflow';

/** Locate the original harmonic annotation by its temporal occurrence, never by preview offsets. */
export function editScoreChord(sourceAbc: string, measureIndex: number, beat: number, symbol: string | null): string {
  if (symbol !== null && !isAbcChordSymbol(symbol)) throw new Error('Enter a valid chord symbol, such as C, Am or G7.');
  const occurrence = buildGuitarChordScore(sourceAbc, sourceAbc, []).occurrences.find((item) => item.measureIndex === measureIndex && Math.abs(item.beat - beat) < 0.001);
  if (!occurrence || occurrence.startChar < 0) throw new Error('This chord no longer belongs to the current source.');
  const prefix = sourceAbc.slice(0, occurrence.startChar);
  const preceding = prefix.match(/((?:"[^"]*"|![^!]*!|\s)+)$/)?.[1] ?? '';
  const start = occurrence.startChar - preceding.length;
  const fragment = sourceAbc.slice(start);
  const annotations = fragment.match(/^((?:"[^"]*"|![^!]*!|\s)*)/)?.[1] ?? '';
  const match = [...annotations.matchAll(/"([^"]*)"/g)].find((item) => normalizeAbcChordSymbol(item[1]) === normalizeAbcChordSymbol(occurrence.symbol));
  if (!match || match.index === undefined) throw new Error('Could not identify the original chord annotation safely.');
  const offset = start + match.index;
  return sourceAbc.slice(0, offset) + (symbol === null ? '' : `"${normalizeAbcChordSymbol(symbol)}"`) + sourceAbc.slice(offset + match[0].length);
}

export function validateManualHarmony(candidate: string, reference: string): string[] {
  const errors: string[] = [];
  if (!abcMatchesReferenceMeasureLinePattern(candidate, reference)) errors.push('Melody measure layout changed.');
  if (candidate.replace(/"[^"]*"/g, '') !== reference.replace(/"[^"]*"/g, '')) errors.push('Chord editing must preserve the melody exactly.');
  errors.push(...validateHarmonyTimelineAbc(candidate));
  return errors;
}
