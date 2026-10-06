import { describe, expect, it } from 'vitest';
import abcjs from 'abcjs';
import { prepareSteelGuitarAudio } from '@/components/music-sheet/abcjs-playback/guitar-audio';
import type { VisualObj } from '@/components/music-sheet/abcjs-playback/types';
import { prepareAbcjsRenderInput } from '@/components/music-sheet/abcjs-playback/render-input';
import { generateStrummingCandidates, currentStrummingSelection, STRUMMING_STYLES } from './index';
import { buildMetricTimeline } from '../metric-timeline';
import { applyAbcLayerVisibility, applyAbcLayerVolumes } from '../../abc-layer-visibility';
import { buildGuitarChordScore, createGuitarChordOverride, type GuitarParsedTune } from '../../guitar-chord-score';
const abc = (body: string, meter = '4/4') => `X:1\nT:Strumming test\nM:${meter}\nL:1/8\nQ:1/4=100\nK:C\n${body}`;
const source = abc('"C" C2 D2 "G" E2 F2 |\nw: one two three four\n"Am" A4 B4 |]');
function audio(text: string) { return (abcjs.parseOnly(text)[0] as unknown as GuitarParsedTune).setUpAudio({ chordsOff: true }); }

describe('Harmony strumming', () => {
  it('offers seven meter-declared styles and seven audibly distinct arrangements', () => {
    expect(STRUMMING_STYLES).toHaveLength(7);
    const candidates = generateStrummingCandidates(source, 'folk');
    expect(candidates).toHaveLength(7);
    expect(new Set(candidates.map(c => JSON.stringify(audio(c.abc).tracks[1]))).size).toBe(7);
    for (const candidate of candidates) {
      expect(buildMetricTimeline(candidate.abc).map(m => m.events.map(e => [e.onset, e.duration, e.pitches, e.chords])))
        .toEqual(buildMetricTimeline(source).map(m => m.events.map(e => [e.onset, e.duration, e.pitches, e.chords])));
      expect(candidate.abc).toContain('w: one two three four');
      const track = audio(candidate.abc).tracks[1];
      expect(track.some(e => e.cmd === 'program' && e.instrument === 25)).toBe(true);
      const events = candidate.timeGrid.strumming.events;
      expect(events.every(e => e.onset + e.duration <= candidate.timeGrid.timeline[e.measureIndex].duration + 1e-7)).toBe(true);
      expect(events.filter(e => e.measureIndex === 0 && e.onset < 0.5).every(e => e.chord === 'C' && e.onset + e.duration <= 0.5)).toBe(true);
      expect(events.find(e => e.measureIndex === 0 && e.onset === 0.5)?.chord).toBe('G');
      expect(candidate.timeGrid.measures[0].grid[0].tablature?.length).toBeGreaterThan(0);
    }
  });
  it.each(STRUMMING_STYLES.flatMap(style => style.meters.map(meter => [style.id, meter] as const)))('realizes %s in %s with equal voice durations', (style, meter) => {
    const [num, den] = meter.split('/').map(Number);
    const result = generateStrummingCandidates(abc(`"C" C${num * 8 / den} |`, meter), style);
    const signatures = result.map(candidate => {
      const visual = abcjs.parseOnly(prepareAbcjsRenderInput({ abcString: candidate.abc }))[0] as unknown as VisualObj;
      const prepared = prepareSteelGuitarAudio(visual, candidate.abc);
      return JSON.stringify((prepared.setUpAudio as (options: Record<string, unknown>) => ReturnType<typeof audio>)({ chordsOff: true }).tracks[1]);
    });
    expect(new Set(signatures).size).toBe(7);
    for (const candidate of result) {
      const tracks = audio(candidate.abc).tracks;
      const end = (index: number) => Math.max(...tracks[index].filter(e => e.cmd === 'note').map(e => e.start! + e.duration!));
      expect(end(1)).toBeLessThanOrEqual(end(0) + 1e-6);
      expect(candidate.timeGrid.timeline[0].duration).toBe(num / den);
    }
  });
  it('rejects incompatible meters without re-metering a melody', () => {
    expect(() => generateStrummingCandidates(source, 'waltz')).toThrow('supports 3/4');
    expect(() => generateStrummingCandidates(abc('C8 |'), 'folk')).toThrow('chord symbols');
  });
  it('preserves pickups, repeats, endings and short final bars', () => {
    const pickup = abc('"G" G2 |: "C" C8 |[1 "G" G8 :|[2 "C" C6 |]');
    const candidate = generateStrummingCandidates(pickup, 'folk')[0];
    const base = audio(pickup), realized = audio(candidate.abc);
    expect(realized.totalDuration).toBeCloseTo(base.totalDuration);
    const end = (track: typeof realized.tracks[number]) => Math.max(...track.filter(e => e.cmd === 'note').map(e => e.start! + e.duration!));
    expect(end(realized.tracks[1])).toBeCloseTo(end(realized.tracks[0]));
    expect(candidate.abc).toContain(':|[2');
  });
  it('clips strokes to exact tuplet chord changes rather than rounding', () => {
    const candidate = generateStrummingCandidates(abc('(3"C"C"G"DE F2 G4 |'), 'folk')[0];
    const change = candidate.timeGrid.strumming.events.find(e => Math.abs(e.onset - 1 / 12) < 1e-7)!;
    expect(change.chord).toBe('G');
    expect(change.step).toBeCloseTo(1 + 4 / 3);
    expect(candidate.timeGrid.strumming.events[0].duration).toBeCloseTo(1 / 12);
  });
  it('applies source-bound guitar shapes and saves only valid source-bound decisions', () => {
    const score = buildGuitarChordScore(source, source);
    const occurrence = score.occurrences[0];
    const shape = occurrence.shapes[1];
    const override = createGuitarChordOverride(score, occurrence, shape);
    const candidate = generateStrummingCandidates(source, 'folk', [override])[6];
    expect(candidate.timeGrid.strumming.events[0].notes.map(n => n.midi)).toEqual(shape.midi);
    expect(currentStrummingSelection(JSON.parse(JSON.stringify(candidate.selection)), source)).toEqual(candidate.selection);
    expect(currentStrummingSelection(candidate.selection, source + '\n% edit')).toBeNull();
    expect(currentStrummingSelection({ ...candidate.selection, variant: 99 }, source)).toBeNull();
  });
  it.each(['C', 'Em', 'F', 'D'])('plays the physical concert pitches in key %s through the render adapter', key => {
    const input = abc('"C" C4 "F#" F4 | "F" F8 |').replace('K:C', `K:${key}`);
    const candidate = generateStrummingCandidates(input, 'folk')[6];
    const track = audio(prepareAbcjsRenderInput({ abcString: candidate.abc })).tracks[1];
    for (const event of candidate.timeGrid.strumming.events.filter(event => event.notes.length)) {
      const start = event.measureIndex + event.onset;
      const pitches = track.filter(note => note.cmd === 'note' && Math.abs(note.start! - start) < 1e-7).map(note => note.pitch).sort((a, b) => a! - b!);
      expect(pitches).toEqual(event.notes.map(note => note.midi).sort((a, b) => a - b));
    }
    expect(candidate.abc).not.toContain('octave=1');
  });
  it('visibility and volume do not mutate saved TimeGrid or ABC', () => {
    const candidate = generateStrummingCandidates(source, 'folk')[0];
    const before = JSON.stringify(candidate);
    const hidden = applyAbcLayerVisibility(candidate.abc, { GuitarStrumming: false });
    expect(hidden).not.toContain('V:GuitarStrumming');
    applyAbcLayerVolumes(candidate.abc, { GuitarStrumming: 25 });
    expect(JSON.stringify(candidate)).toBe(before);
  });
});

it.each(STRUMMING_STYLES.flatMap(style => style.meters.map(meter => [style.id, meter] as const)))('respects playable techniques in every %s / %s variant', (style, meter) => {
  const [num, den] = meter.split('/').map(Number);
  const input = abc(`"C" C${num * 8 / den} |`, meter);
  for (const allowed of [[], ['slap']] as const) {
    const candidates = generateStrummingCandidates(input, style, [], allowed);
    expect(candidates).toHaveLength(7);
    for (const candidate of candidates) {
      expect(candidate.selection.techniques).toEqual(allowed);
      expect(candidate.timeGrid.strumming.techniques).toEqual(allowed);
      expect(candidate.timeGrid.strumming.events.every(event => ['strum', 'rest', ...allowed].includes(event.technique))).toBe(true);
      expect(candidate.abc).not.toMatch(/"\^PM"|"\^X"|"\^Choke"/);
      expect(candidate.timeGrid.strumming.events.map(event => [event.onset, event.step]))
        .toEqual(generateStrummingCandidates(input, style)[candidate.selection.variant].timeGrid.strumming.events.map(event => [event.onset, event.step]));
    }
  }
});
it('keeps string slaps while replacing palm mute with pitched ordinary strokes', () => {
  const result = generateStrummingCandidates(abc('"C" C8 |'), 'blues', [], ['slap'])[2];
  expect(result.timeGrid.strumming.events.some(event => event.technique === 'slap')).toBe(true);
  expect(result.timeGrid.strumming.events[0].technique).toBe('strum');
  expect(result.timeGrid.strumming.events[0].notes.length).toBeGreaterThan(0);
  expect(result.abc).toContain('"^Slap"');
});
