import abcjs from 'abcjs';
import { describe, expect, it } from 'vitest';
import { prepareSteelGuitarAudio } from '../guitar-audio';
import { prepareAbcjsRenderInput } from '../render-input';
import type { VisualObj } from '../types';
import type { GuitarAudioSequence } from '@/lib/theory/guitar-chord-score';
import { generateStrummingCandidates } from '@/lib/theory/harmony/strumming';
import { applyAbcLayerVisibility, applyAbcLayerVolumes } from '@/lib/theory/abc-layer-visibility';

function play(abc: string, qpm = 120) {
  const visual = abcjs.parseOnly(prepareAbcjsRenderInput({ abcString: abc }))[0] as unknown as VisualObj;
  const audio = prepareSteelGuitarAudio(visual, abc);
  return (audio.setUpAudio as (options: Record<string, unknown>) => GuitarAudioSequence)({ chordsOff: true, qpm });
}
const source = 'X:1\nM:4/4\nL:1/8\nQ:1/4=120\nK:C\n"C" C8 |';
const notes = (audio: GuitarAudioSequence) => audio.tracks[1].filter(e => e.cmd === 'note');

describe('written strumming performance', () => {
  it('sweeps down bass-to-treble and up treble-to-bass with lighter attacks', () => {
    const candidate = generateStrummingCandidates(source, 'folk')[6];
    const audio = play(candidate.abc);
    const down = notes(audio).filter(e => e.start! < 0.25);
    const up = notes(audio).filter(e => e.start! >= 0.375 && e.start! < 0.5);
    expect(down.map(e => e.pitch)).toEqual(candidate.timeGrid.strumming.events[0].notes.map(n => n.midi));
    expect(down.map(e => e.start)).toEqual([...down.map(e => e.start)].sort((a, b) => a! - b!));
    expect(new Set(down.map(e => e.start)).size).toBe(down.length);
    expect(up.map(e => e.pitch)).toEqual([...up.map(e => e.pitch)].sort((a, b) => b! - a!));
    expect(new Set(up.map(e => e.start)).size).toBe(up.length);
    expect(up[0].volume!).toBeLessThan(down[0].volume!);
    expect(up.every(e => e.start! + e.duration! <= 0.5 + 1e-7)).toBe(true);
  });
  it('plays dead-strum and slap as distinct percussion without pitched placeholder notes', () => {
    const candidate = generateStrummingCandidates(source, 'folk')[0];
    const audio = play(candidate.abc);
    expect(notes(audio).filter(e => e.start === 0.25)).toMatchObject([{ instrument: 128, pitch: 37 }]);
    expect(notes(audio).filter(e => e.start === 0.75)).toMatchObject([{ instrument: 128, pitch: 39 }]);
    expect(notes(audio).filter(e => e.instrument === 128)).toHaveLength(2);
    expect(candidate.timeGrid.strumming.events.filter(e => ['dead-strum', 'slap'].includes(e.technique)).every(e => e.notes.length === 0)).toBe(true);
  });
  it('respects authored silent beats and final chokes, even when harmony changes there', () => {
    const candidate = generateStrummingCandidates(source.replace('"C" C8', '"C" C4 "G" G4'), 'folk')[0];
    const audio = play(candidate.abc);
    expect(candidate.timeGrid.strumming.events.find(e => e.onset === 0.5)).toMatchObject({ technique: 'rest', notes: [] });
    expect(notes(audio).some(e => e.start! < 0.625 && e.start! + e.duration! > 0.5 + 1e-7)).toBe(false);
    expect(notes(audio).some(e => e.start! + e.duration! > 0.9375 + 1e-7)).toBe(false);
    expect(candidate.abc).toContain('"^Choke"z');
  });
  it('palm mute remains pitched, quieter and short; rolling notes never cross a cut', () => {
    const candidate = generateStrummingCandidates(source, 'blues')[0];
    const played = notes(play(candidate.abc));
    const muted = played.filter(e => e.start! < 0.125);
    expect(muted.length).toBeGreaterThan(1);
    expect(muted.every(e => e.instrument === 25 && e.duration! * 2 <= 0.095 + 1e-7)).toBe(true);
    expect(muted.every(e => e.start! + e.duration! <= candidate.timeGrid.strumming.events[0].duration + 1e-7)).toBe(true);
    expect(candidate.abc).toContain('"^PM"');
  });
  it.each([60, 180, 360])('keeps sweep time in seconds and clips at fast tempo %s', tempo => {
    const candidate = generateStrummingCandidates(source, 'folk')[6];
    const down = notes(play(candidate.abc, tempo)).filter(e => e.start! < 0.25);
    expect(down.at(-1)!.start! * 240 / tempo).toBeCloseTo(Math.min(0.042, 0.25 * 0.22 * 240 / tempo));
    expect(down.every(e => e.duration! > 0 && e.start! + e.duration! <= 0.25 + 1e-7)).toBe(true);
  });
  it('retains duplicate strings and repeated passages without sharing gesture state', () => {
    const input = 'X:1\nM:4/4\nL:1/8\nV:Melody\nV:GuitarStrumming clef=treble-8\nK:C\n[V:Melody] |: C8 :|\n[V:GuitarStrumming] |: !downbow![!5!D,!4!D,!3!G,]2 "^X"!style=x!B2 !upbow![!3!G,!4!D,!5!D,]2 z2 :|';
    const played = notes(play(input));
    expect(played.filter(e => e.start! < 0.25).map(e => e.pitch)).toEqual([50, 50, 55]);
    expect(played.filter(e => e.start! >= 1 && e.start! < 1.25).map(e => e.pitch)).toEqual([50, 50, 55]);
    expect(played.filter(e => e.instrument === 128)).toHaveLength(2);
  });
  it('keeps melody, volume, hidden-layer behavior and source immutable', () => {
    const candidate = generateStrummingCandidates(source, 'folk')[0];
    const before = JSON.stringify(candidate);
    const normal = play(candidate.abc);
    const quiet = play(applyAbcLayerVolumes(candidate.abc, { GuitarStrumming: 0 }));
    expect(notes(quiet).every(e => e.volume === 0)).toBe(true);
    const sounding = (track: typeof normal.tracks[number]) => track.filter(e => e.cmd === 'note').map(e => [e.pitch, e.start, e.duration, e.volume]);
    expect(sounding(normal.tracks[0])).toEqual(sounding(quiet.tracks[0]));
    const hidden = play(applyAbcLayerVisibility(candidate.abc, { GuitarStrumming: false }));
    expect(hidden.tracks).toHaveLength(1);
    expect(sounding(hidden.tracks[0])).toEqual(sounding(normal.tracks[0]));
    expect(JSON.stringify(candidate)).toBe(before);
  });
});

it('auditions only allowed string slaps, with ordinary pitched strokes replacing palm mute', () => {
  const candidate = generateStrummingCandidates(source, 'blues', [], ['slap'])[0];
  const played = notes(play(candidate.abc));
  expect(played.filter(event => event.instrument === 128)).toMatchObject([{ pitch: 39, start: 0.75 }]);
  expect(played.some(event => event.start === 0.25)).toBe(false);
  const first = played.filter(event => event.start! < 0.125);
  expect(first.every(event => event.instrument === 25)).toBe(true);
  expect(first[0].duration! * 2).toBeGreaterThan(0.095);
  expect(notes(play(generateStrummingCandidates(source, 'blues', [], [])[0].abc)).some(event => event.instrument === 128)).toBe(false);
});
