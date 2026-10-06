import { describe, expect, it } from 'vitest';
import { buildHarmonyTimeGrid, renderHarmonyBeatLyrics } from './time-grid';
import { buildHarmonyLayerProjection } from './analysis-preview';
const abc = (body: string, meter = '4/4') => `X:1\nM:${meter}\nL:1/8\nK:C\n${body}`;
describe('Harmony TimeGrid beat weights', () => {
  it('stores all metric weights and renders Accompaniment-compatible black-dot lyrics', () => {
    const document = buildHarmonyTimeGrid(abc('C2 D2 E2 F2 |\nw: one two three four'));
    expect(document.measures[0].grid).toHaveLength(16);
    expect([0, 4, 8, 12].map(i => document.measures[0].grid[i].weight)).toEqual(['⬤', '*', '●', '*']);
    expect(renderHarmonyBeatLyrics(document)).toContain('w: one two three four\nw: ⬤ • ● •');
  });
  it('keeps strong weights during a held note, independent of the display switch', () => {
    const source = abc('C8 |');
    const on = buildHarmonyLayerProjection(source, { StrongBeats: true });
    const off = buildHarmonyLayerProjection(source, { StrongBeats: false });
    expect(on.timeGrid).toEqual(off.timeGrid);
    expect(on.timeGrid?.measures[0].grid[8]).toMatchObject({ weight: '●', melody: { state: 'sustain', pitch: 'C4' } });
    expect(on.abc).toContain('w: ⬤');
    expect(off.abc).not.toContain('w:');
  });
  it('uses 24 steps and compound grouping in 6/8', () => {
    const document = buildHarmonyTimeGrid(abc('C D E F G A |', '6/8'));
    expect(document.measures[0].grid).toHaveLength(24);
    expect(document.measures[0].grid[12].weight).toBe('●');
    expect(renderHarmonyBeatLyrics(document)).toContain('w: ⬤ • • ● • •');
  });
  it('retains exact tuplet data and diagnoses the fixed-grid approximation', () => {
    const document = buildHarmonyTimeGrid(abc('(3CDE F2 G4 |'));
    expect(document.diagnostics).toHaveLength(1);
    expect(document.timeline[0].events[1].onset).toBeCloseTo(1 / 12);
  });
  it('stores generated chord changes and removes them when Missing Chord is unchecked', () => {
    const source = abc('"G"G8 | C8 |');
    const on = buildHarmonyLayerProjection(source, { MissingChord: true });
    const off = buildHarmonyLayerProjection(source, { MissingChord: false });
    expect(on.timeGrid?.measures[1].grid[0].chord).toBe('C');
    expect(off.timeGrid?.measures[1].grid[0].chord).toBe('G');
  });
  it('keeps the opening pickup chord-free when Missing Chord is enabled', () => {
    const source = abc('G2 | C8 |');
    const projection = buildHarmonyLayerProjection(source, { MissingChord: true, StrongBeats: true });
    expect(projection.timeGrid?.timeline[0].events.flatMap(e => e.chords)).toEqual([]);
    expect(projection.timeGrid?.measures[0].grid.every(step => step.chord === '')).toBe(true);
    expect(projection.timeGrid?.measures[1].grid[0].chord).toBe('C');
    expect(projection.abc).toMatch(/G2 \|\s*"C"\s*C8 \|/);
  });
  it('removes legacy generated pickup chords from selected harmony but preserves source chords', () => {
    const melody = abc('B, |: "C"C8 |');
    const legacy = abc('"G"B, |: "C"C8 |');
    for (const MissingChord of [true, false]) {
      const projection = buildHarmonyLayerProjection(legacy, { MissingChord }, melody);
      expect(projection.timeGrid?.timeline[0].events.flatMap(e => e.chords)).toEqual([]);
      expect(projection.abc).toBe(melody);
    }
    expect(buildHarmonyLayerProjection(legacy, { MissingChord: true }, legacy).abc).toBe(legacy);
    expect(buildHarmonyLayerProjection(legacy, { MissingChord: true }).abc).toBe(legacy);
  });
});
