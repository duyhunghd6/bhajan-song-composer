import { Note } from '@tonaljs/tonal';
import { getDiatonicChords } from '../chords';
import type { MetricMeasure } from './metric-timeline';
import { buildHarmonyTimeGrid } from './time-grid';

export interface ChordSuggestion {
  measureIndex: number; symbol: string; score: number;
  alternatives: { symbol: string; score: number }[];
}
export interface AutoChordResult {
  abc: string; measures: MetricMeasure[]; suggestions: ChordSuggestion[]; issues: string[];
}
export function keyContext(key: string) {
  const match = key.match(/^([A-G][#b]?)(.*)$/);
  if (!match) throw new Error(`Unsupported key ${key}. Confirm a tonal key before filling chords.`);
  const modes: Record<string, string> = { '': 'major', maj: 'major', m: 'natural minor', min: 'natural minor', dor: 'dorian', mix: 'mixolydian', phr: 'phrygian', lyd: 'lydian', loc: 'locrian', aeo: 'natural minor', ion: 'major' };
  const mode = modes[match[2].toLowerCase()];
  if (!mode) throw new Error(`Unsupported mode ${key}. Confirm the key before filling chords.`);
  return { root: match[1], mode };
}

/** Inserts annotations at original source offsets; all existing characters remain untouched. */
export function fillMissingMeasureChords(source: string): AutoChordResult {
  const { timeline: measures } = buildHarmonyTimeGrid(source);
  const suggestions: ChordSuggestion[] = [];
  const issues: string[] = [];
  const insertions: { offset: number; text: string }[] = [];
  let previous: string | undefined;
  for (const measure of measures) {
    const existing = measure.events.flatMap(e => e.chords);
    if (existing.length) { previous = existing.at(-1); continue; }
    const label = `Measure ${measure.measureIndex + 1}`;
    if (measure.duration > measure.expectedDuration + 1e-7 || (measure.measureIndex > 0 && measure.measureIndex < measures.length - 1 && measure.duration < measure.expectedDuration - 1e-7)) {
      issues.push(`${label}: irregular bar length; left unchanged.`); continue;
    }
    const notes = measure.events.flatMap(e => e.pitches);
    if (!notes.length) { issues.push(`${label}: rests only; left unchanged.`); continue; }
    const { root, mode } = keyContext(measure.key);
    const candidates = getDiatonicChords(root, mode).map(chord => {
      const pcs = chord.notes.map(n => Note.chroma(n));
      let score = 0;
      for (const event of measure.events) {
        for (const pitch of event.pitches) score += event.duration / measure.expectedDuration * (pcs.includes(pitch % 12) ? 2 : -1) / event.pitches.length;
      }
      for (const beat of measure.strongBeats) {
        for (const pitch of beat.pitches) score += beat.weight * (pcs.includes(pitch % 12) ? 2 : -1) / beat.pitches.length;
      }
      // Small stylistic priors never outweigh a strong-beat chord-tone match.
      if (chord.degree === 1) score += 0.3 + (measure.measureIndex === measures.length - 1 ? 0.5 : 0);
      if ([4, 5].includes(chord.degree)) score += 0.15;
      if (chord.chordName === previous) score += 0.2;
      return { symbol: chord.chordName, score };
    }).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const offset = measure.events[0].startChar;
    if (!best || offset < 0 || offset >= source.length) throw new Error(`${label}: cannot locate the original ABC safely.`);
    suggestions.push({ measureIndex: measure.measureIndex, ...best, alternatives: candidates.slice(0, 3) });
    insertions.push({ offset, text: `"${best.symbol}"` });
    previous = best.symbol;
  }
  let abc = source;
  for (const insertion of insertions.sort((a, b) => b.offset - a.offset)) abc = abc.slice(0, insertion.offset) + insertion.text + abc.slice(insertion.offset);
  return { abc, measures, suggestions, issues };
}
