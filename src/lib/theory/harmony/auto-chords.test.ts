import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMetricTimeline } from './metric-timeline';
import { fillMissingMeasureChords } from './auto-chords';
const abc = (body: string, meter = '4/4', length = '1/8', key = 'C') => `X:1\nT:Metric test\nM:${meter}\nL:${length}\nK:${key}\n${body}`;
const pcs = (source: string) => buildMetricTimeline(source).map(m => m.strongBeats.map(b => b.pitches.map(p => p % 12)));

describe('metric timeline and missing harmony', () => {
  it('uses actual durations independent of unit note length', () => {
    expect(pcs(abc('C2 D2 E2 F2 |'))).toEqual([[[0], [4]]]);
    expect(pcs(abc('C D E F |', '4/4', '1/4'))).toEqual([[[0], [4]]]);
  });
  it('counts rests, sounding syncopations, tuplets, broken rhythms and slurs', () => {
    expect(pcs(abc('z C5 D2 |'))).toEqual([[[], [0]]]);
    expect(pcs(abc('(3CDE F2 G>A B2 |'))).toEqual([[[0], [7]]]);
    expect(pcs(abc('(C2 D2 E2 F2) |'))).toEqual([[[0], [4]]]);
  });
  it('right-aligns pickups and distinguishes compound and triple meters', () => {
    const grid = buildMetricTimeline(abc('G2 | C8 |'));
    expect(grid[0].pickupOffset).toBe(0.75);
    expect(grid[0].strongBeats).toEqual([]);
    expect(pcs(abc('CDE GAB |', '6/8'))).toEqual([[[0], [7]]]);
    expect(pcs(abc('CDE GAB |', '3/4'))).toEqual([[[0]]]);
    expect(buildMetricTimeline(abc('C12 |', '12/8'))[0].strongBeats.map(b => b.beat)).toEqual([1, 4, 7, 10]);
    expect(buildMetricTimeline(abc('C7 |', '(2+2+3)/8'))[0].strongBeats.map(b => b.beat)).toEqual([1, 3, 5]);
  });
  it('respects key, carried accidentals, bar resets, ties and bracket chords', () => {
    expect(pcs(abc('F2 =F2 F4 | F8 |', '4/4', '1/8', 'G'))).toEqual([[[6], [5]], [[6], [6]]]);
    expect(pcs(abc('^F8- | F8 |'))).toEqual([[[6], [6]], [[6], [6]]]);
    expect(pcs(abc('[CEG]8 |'))).toEqual([[[0, 4, 7], [0, 4, 7]]]);
  });
  it('keeps visual line breaks within a measure and tracks meter changes', () => {
    const grid = buildMetricTimeline(abc('C2 D2\nE2 F2 | [M:3/4] G6 |'));
    expect(grid).toHaveLength(2);
    expect(grid[1].meter).toBe('3/4');
  });
  it('fills only unannotated Melody bars without changing any existing characters', () => {
    const source = abc('V:Bass\nC,8 | C,8 |\nV:Melody\n|: "^Verse"(C2 E2 G2 E2) | "G7"G8 :|\nw: one two three four | five');
    const result = fillMissingMeasureChords(source);
    expect(result.suggestions.map(s => s.symbol)).toEqual(['C']);
    expect(result.abc.replace('"C"', '')).toBe(source);
    expect(fillMissingMeasureChords(result.abc).abc).toBe(result.abc);
    expect(buildMetricTimeline(result.abc)[0].events[0].chords).toEqual(['C']);
  });
  it('recognizes N.C. and multiple existing chords; ignores section and beat annotations', () => {
    const result = fillMissingMeasureChords(abc('"N.C."C8 | "C"C4 "G"G4 | "^Bridge""_⬤"E8 |'));
    expect(result.suggestions.map(s => s.measureIndex)).toEqual([2]);
  });
  it('skips silent and malformed interior bars without compacting measure indices', () => {
    const result = fillMissingMeasureChords(abc('z8 | C2 | E8 |'));
    expect(result.suggestions.map(s => s.measureIndex)).toEqual([2]);
    expect(result.issues).toHaveLength(2);
  });
  it('handles common/cut time and preserves explicit modal key context', () => {
    expect(buildMetricTimeline(abc('C8 |', 'C'))[0].strongBeats.map(b => b.beat)).toEqual([1, 3]);
    expect(buildMetricTimeline(abc('C8 |', 'C|'))[0].strongBeats.map(b => b.beat)).toEqual([1]);
    expect(fillMissingMeasureChords(abc('D8 |', '4/4', '1/8', 'Ddor')).suggestions[0].symbol).toBe('Dm');
  });
  it('fills Ganesha without changing existing annotations or sounding notes', () => {
    const source = readFileSync('data/songs/sanskrit/ganesha.melody.abc', 'utf8');
    const result = fillMissingMeasureChords(source);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.abc.replace(/"[^"\n]*"/g, '')).toBe(source.replace(/"[^"\n]*"/g, ''));
    const after = buildMetricTimeline(result.abc);
    result.measures.forEach((measure, index) => {
      expect(after[index].strongBeats).toEqual(measure.strongBeats);
      const beforeChords = measure.events.flatMap(e => e.chords);
      if (beforeChords.length) expect(after[index].events.flatMap(e => e.chords)).toEqual(beforeChords);
    });
    expect(fillMissingMeasureChords(result.abc).suggestions).toHaveLength(0);
  });
  it('rejects free meter rather than inventing strong beats', () => {
    expect(() => fillMissingMeasureChords(abc('C D E', 'none'))).toThrow(/meter/);
  });
  it('reparses inserted annotations before tuplets and grace notes with identical timing and pitches', () => {
    const source = abc('{g}(3CDE F2 G4 | C8 |');
    const result = fillMissingMeasureChords(source);
    const musicalFacts = (s: string) => buildMetricTimeline(s).map(m => m.events.map(e => [e.onset, e.duration, e.pitches]));
    expect(musicalFacts(result.abc)).toEqual(musicalFacts(source));
    expect(fillMissingMeasureChords(result.abc).suggestions).toHaveLength(0);
  });
});
