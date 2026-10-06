import { Chord, Note } from '@tonaljs/tonal';
import type { AccompanimentWorkflowOption, AccompanimentWorkflowRun, AccompanimentWorkflowSelectedContext, AccompanimentWorkflowStepId } from '../accompaniment-workflow/definition';
import { getScaleNotes } from '../scales';
import { getDiatonicChords } from '../chords';
import { keyContext } from './auto-chords';
import { buildMetricTimeline, type MetricMeasure } from './metric-timeline';

export function isAlgorithmicHarmonyStep(stepId: string): boolean {
  return ['key-beats', 'chord-roles-progression', 'voice-leading-validation'].includes(stepId);
}
interface Input {
  stepId: AccompanimentWorkflowStepId;
  sourceAbc: string;
  previousSelections: AccompanimentWorkflowSelectedContext[];
}
const EPS = 1e-7;
const pitchClasses = (symbol: string) => Chord.get(symbol).notes.map(n => Note.chroma(n));

function checkMeasures(measures: MetricMeasure[]) {
  if (!measures.some(m => m.events.some(e => e.pitches.length))) throw new Error('The melody has no sounding notes.');
  for (const m of measures) {
    keyContext(m.key);
    if (m.duration > m.expectedDuration + EPS || (m.measureIndex > 0 && m.measureIndex < measures.length - 1 && m.duration < m.expectedDuration - EPS)) {
      throw new Error(`Measure ${m.measureIndex + 1}: correct the irregular bar length before generating harmony.`);
    }
  }
}

function option(id: string, label: string, data: Record<string, unknown>, summary: string, warnings: string[] = []): AccompanimentWorkflowOption {
  return { id, label, data, summary, justification: 'Computed from the exact melody timeline and tonal chord compatibility.', warnings, validationNotes: ['Melody pitches, rhythm, lyrics and line breaks retained.'] };
}

function melodySignature(measures: MetricMeasure[]) {
  return JSON.stringify(measures.map(m => ({ key: m.key, meter: m.meter, duration: m.duration, events: m.events.map(e => [e.onset, e.duration, e.pitches]) })));
}

function validate(source: string, abc: string) {
  const original = buildMetricTimeline(source);
  const measures = buildMetricTimeline(abc);
  checkMeasures(measures);
  if (melodySignature(original) !== melodySignature(measures)) throw new Error('Harmony changed the source melody, key or timing. Regenerate Chords.');
  const warnings: string[] = [];
  let active = '';
  for (const m of measures) {
    for (const event of m.events) {
      if (event.chords.length) active = event.chords.at(-1)!;
      if (event.pitches.length && !active && !m.pickupOffset) throw new Error(`Measure ${m.measureIndex + 1}: sounding melody has no active chord.`);
      if (active && active !== 'N.C.' && !pitchClasses(active).length) throw new Error(`Unsupported chord: ${active}`);
    }
  }
  active = '';
  for (const m of measures) {
    const before = active;
    for (const beat of m.strongBeats) {
      const symbol = m.events.filter(e => e.onset <= beat.onset + EPS).flatMap(e => e.chords).at(-1) ?? before;
      if (symbol && symbol !== 'N.C.' && beat.pitches.some(p => !pitchClasses(symbol).includes(p % 12))) {
        warnings.push(`Measure ${m.measureIndex + 1}, beat ${beat.beat}: non-chord melody tone over ${symbol}.`);
      }
    }
    active = m.events.flatMap(e => e.chords).at(-1) ?? active;
  }
  return warnings;
}

/** Bounded beam search retains complete alternative progressions, not independent random bars. */
function progressions(source: string, measures: MetricMeasure[], downbeatsOnly: boolean) {
  type Path = { score: number; symbols: string[]; insertions: { offset: number; symbol: string }[]; previous: string };
  let paths: Path[] = [{ score: 0, symbols: [], insertions: [], previous: '' }];
  for (const m of measures) {
    const supplied = m.events.flatMap(e => e.chords);
    if (supplied.length || m.pickupOffset > 0 || !m.events.some(e => e.pitches.length)) {
      paths = paths.map(p => ({ ...p, previous: supplied.at(-1) ?? p.previous, symbols: [...p.symbols, supplied.join(' → ') || (m.pickupOffset > 0 ? 'pickup' : 'rest')] }));
      continue;
    }
    const { root, mode } = keyContext(m.key);
    const ranked = getDiatonicChords(root, mode).map(chord => {
      const pcs = chord.notes.map(n => Note.chroma(n));
      let score = 0;
      for (const e of m.events) for (const pitch of e.pitches) score += e.duration / m.expectedDuration * (pcs.includes(pitch % 12) ? 2 : -1) / e.pitches.length;
      for (const b of m.strongBeats.filter(b => !downbeatsOnly || b.beat === 1)) for (const pitch of b.pitches) score += b.weight * (pcs.includes(pitch % 12) ? 2 : -1) / b.pitches.length;
      const ending = m.measureIndex === measures.length - 1 || m.events.at(-1)?.pitches.length === 0;
      if (chord.degree === 1) score += ending ? 0.8 : 0.3;
      return { symbol: chord.chordName, pcs, score };
    });
    paths = paths.flatMap(p => ranked.map(c => {
      const prior = pitchClasses(p.previous);
      const common = c.pcs.filter(pc => prior.includes(pc)).length;
      return { score: p.score + c.score + common * 0.12 + (p.previous === c.symbol ? 0.2 : 0), symbols: [...p.symbols, c.symbol], previous: c.symbol, insertions: [...p.insertions, { offset: m.events[0].startChar, symbol: c.symbol }] };
    })).sort((a, b) => b.score - a.score || a.symbols.join().localeCompare(b.symbols.join())).slice(0, 12);
  }
  return paths.slice(0, 3).map(p => {
    let abc = source;
    for (const entry of [...p.insertions].sort((a, b) => b.offset - a.offset)) {
      if (entry.offset < 0 || entry.offset >= source.length) throw new Error('Cannot locate chord insertion in source.');
      abc = abc.slice(0, entry.offset) + `"${entry.symbol}"` + abc.slice(entry.offset);
    }
    return { abc, score: p.score, progression: p.symbols };
  });
}

export function generateHarmonyWorkflowStep(input: Input): AccompanimentWorkflowRun {
  const measures = buildMetricTimeline(input.sourceAbc);
  checkMeasures(measures);
  let options: AccompanimentWorkflowOption[];
  if (input.stepId === 'key-beats') {
    const analysis = measures.map(m => ({ measure: m.measureIndex + 1, key: m.key, scale: keyContext(m.key).mode, scaleNotes: getScaleNotes(keyContext(m.key).root, keyContext(m.key).mode), meter: m.meter, pickupOffset: m.pickupOffset, strongBeats: m.strongBeats, cadenceTarget: m.measureIndex === measures.length - 1 || m.events.at(-1)?.pitches.length === 0 }));
    options = [option('metric-pulses', 'Primary and secondary pulses', { strongBeatEmphasis: 'primary-strong-beats', analysis }, 'Weight all metric strong beats when ranking chords.'), option('downbeats', 'Downbeat emphasis', { strongBeatEmphasis: 'downbeats-only', analysis }, 'Prioritize beat 1 with duration-weighted melody coverage.')];
  } else if (input.stepId === 'chord-roles-progression') {
    const key = input.previousSelections.find(s => s.stepId === 'key-beats');
    if (!key) throw new Error('Select Key & Beats first.');
    const source = materializeLyricChords(input.sourceAbc, measures);
    options = progressions(source, buildMetricTimeline(source), key.data.strongBeatEmphasis === 'downbeats-only').map((p, i) => option(`progression-${i + 1}`, `Rank ${i + 1} · ${p.score.toFixed(2)}`, { harmonizedAbc: p.abc, progression: p.progression, score: p.score }, p.progression.join(' → '), validate(input.sourceAbc, p.abc)));
  } else if (input.stepId === 'voice-leading-validation') {
    const selected = input.previousSelections.find(s => s.stepId === 'chord-roles-progression');
    const abc = selected?.data.harmonizedAbc;
    if (typeof abc !== 'string' || !abc.trim()) throw new Error('Select a Chords result first.');
    const warnings = validate(input.sourceAbc, abc);
    options = [option('validated-harmony', 'Validated selected progression', { validatedAbc: abc, validation: { melodyPreserved: true, metricCoverage: true } }, 'Exact selected ABC checked for melody, duration and chord coverage.', [...warnings, 'Chord symbols do not specify voices; parallel fifths/octaves require the later instrument voicing stage.'])];
  } else throw new Error('Not a shared harmony step.');
  return { id: `${input.stepId}-${Date.now()}`, createdAt: new Date().toISOString(), stepId: input.stepId, requestPrompt: 'Deterministic harmony algorithm v1', userNote: '', options };
}

function materializeLyricChords(source: string, measures: MetricMeasure[]) {
  const insertions = measures.flatMap(m => m.events.flatMap(e => e.chords.length ? [] : (e.lyricChords ?? []).map(symbol => ({ offset: e.startChar, symbol }))));
  let abc = source;
  for (const { offset, symbol } of insertions.sort((a, b) => b.offset - a.offset)) {
    if (offset < 0 || offset >= source.length) throw new Error('Cannot align lyric chord with melody.');
    abc = abc.slice(0, offset) + `"${symbol}"` + abc.slice(offset);
  }
  return abc;
}
