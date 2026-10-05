import abcjs from 'abcjs';
import { isAbcChordSymbol, normalizeAbcChordSymbol } from '../abc-chord-symbol';

interface Meter { type?: string; value?: { num: string; den: string }[] }
interface Key { root: string; acc: string; mode: string; accidentals: { note: string; acc: string }[] }
interface Element {
  el_type: string; duration?: number; startChar?: number;
  pitches?: { pitch: number; accidental?: string; startTie?: unknown; endTie?: boolean }[];
  lyric?: { syllable: string }[];
  chord?: { name: string; position: string }[];
  startTriplet?: number; tripletMultiplier?: number; endTriplet?: boolean;
  value?: Meter['value']; type?: string;
  root?: string; acc?: string; mode?: string; accidentals?: Key['accidentals'];
}
interface Tune {
  voices: Record<string, { staffNum: number; index: number }>;
  lines: { staff?: { voices: Element[][]; key: Key; meter?: Meter }[] }[];
}
export interface MetricEvent {
  /** Whole-note units, independent of L: and playback tempo. */
  onset: number; duration: number; pitches: number[]; startChar: number;
  chords: string[]; lyricChords?: string[];
}
export interface MetricMeasure {
  measureIndex: number; key: string; meter: string; duration: number; expectedDuration: number;
  pickupOffset: number; events: MetricEvent[];
  strongBeats: { beat: number; onset: number; weight: number; pitches: number[] }[];
}
const EPS = 1e-7;
const ACC: Record<string, number> = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2 };

function meterInfo(meter?: Meter) {
  if (meter?.type === 'common_time') return { groups: [4], denominator: 4 };
  if (meter?.type === 'cut_time') return { groups: [2], denominator: 2 };
  const value = meter?.value;
  if (!value?.length || value.length !== 1) throw new Error('Auto chords require a single, explicit meter.');
  const groups = value[0].num.replace(/[()]/g, '').split('+').map(Number);
  const denominator = Number(value[0].den);
  if (groups.some(n => !Number.isInteger(n) || n <= 0) || ![1, 2, 4, 8, 16, 32].includes(denominator)) throw new Error('Unsupported meter for auto chords.');
  return { groups, denominator };
}

/** Exact event grid for analysis; never quantizes tuplets into the editable Guitar grid. */
export function buildMetricTimeline(abc: string): MetricMeasure[] {
  const tune = abcjs.parseOnly(abc)[0] as unknown as Tune | undefined;
  if (!tune) throw new Error('No ABC tune found.');
  const voice = tune.voices?.Melody ?? Object.values(tune.voices ?? {})[0] ?? { staffNum: 0, index: 0 };
  const measures: MetricMeasure[] = [];
  let meter: Meter | undefined;
  let key: Key | undefined;
  let events: MetricEvent[] = [];
  let onset = 0;
  let multiplier = 1;
  const accidentals = new Map<number, number>();
  const ties = new Map<number, number>();
  const finish = () => {
    if (!events.length || !key) return;
    const { groups, denominator } = meterInfo(meter);
    const numerator = groups.reduce((a, b) => a + b, 0);
    const expectedDuration = numerator / denominator;
    const pickupOffset = measures.length === 0 && onset < expectedDuration - EPS ? expectedDuration - onset : 0;
    let positions = [0];
    if (groups.length > 1) positions = groups.slice(0, -1).reduce((a, n) => [...a, a[a.length - 1] + n], [0]);
    else if (numerator > 3 && numerator % 3 === 0) positions = Array.from({ length: numerator / 3 }, (_, i) => i * 3);
    else if (numerator === 4) positions = [0, 2];
    const strongBeats = positions.flatMap(position => {
      const time = position / denominator - pickupOffset;
      if (time < -EPS || time >= onset - EPS) return [];
      const pitches = events.filter(e => e.onset <= time + EPS && e.onset + e.duration > time + EPS).flatMap(e => e.pitches);
      return [{ beat: position + 1, onset: Math.max(0, time), weight: position === 0 ? 3 : 2, pitches }];
    });
    measures.push({ measureIndex: measures.length, key: key.root + key.acc + key.mode, meter: `${groups.join('+')}/${denominator}`, duration: onset, expectedDuration, pickupOffset, events, strongBeats });
    events = []; onset = 0; accidentals.clear();
  };
  for (const line of tune.lines) {
    const staff = line.staff?.[voice.staffNum];
    if (!staff) continue;
    key = staff.key ?? key;
    meter = staff.meter ?? meter;
    for (const element of staff.voices[voice.index] ?? []) {
      if (element.el_type === 'bar') { finish(); continue; }
      if (element.el_type === 'meter') {
        if (events.length) throw new Error('A meter change inside a measure requires manual harmony.');
        meter = element; continue;
      }
      if (element.el_type === 'key') {
        if (events.length) throw new Error('A key change inside a measure requires manual harmony.');
        key = element as Key & Element; accidentals.clear(); continue;
      }
      if (element.el_type !== 'note' || !element.duration) continue;
      if (element.startTriplet) multiplier = element.tripletMultiplier ?? 2 / 3;
      const duration = element.duration * multiplier;
      if (element.endTriplet) multiplier = 1;
      const pitches = (element.pitches ?? []).map(p => {
        const degree = ((p.pitch % 7) + 7) % 7;
        const letter = 'cdefgab'[degree];
        const keyAcc = key?.accidentals.find(a => a.note.toLowerCase() === letter)?.acc;
        if (p.accidental) accidentals.set(p.pitch, ACC[p.accidental] ?? 0);
        const accidental = accidentals.get(p.pitch) ?? ACC[keyAcc ?? 'natural'] ?? 0;
        const midi = p.endTie && ties.has(p.pitch) ? ties.get(p.pitch)! : 60 + 12 * Math.floor(p.pitch / 7) + [0, 2, 4, 5, 7, 9, 11][degree] + accidental;
        if (p.startTie) ties.set(p.pitch, midi); else ties.delete(p.pitch);
        return midi;
      });
      events.push({ onset, duration, pitches, startChar: element.startChar ?? -1,
        lyricChords: (element.lyric ?? []).flatMap(l => [...l.syllable.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]).filter(isAbcChordSymbol).map(normalizeAbcChordSymbol)),
        chords: (element.chord ?? []).filter(c => c.position === 'default' && isAbcChordSymbol(c.name)).map(c => normalizeAbcChordSymbol(c.name)) });
      onset += duration;
    }
  }
  finish();
  return measures;
}
