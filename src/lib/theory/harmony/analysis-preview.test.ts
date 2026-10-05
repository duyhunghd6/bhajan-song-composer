import { describe, expect, it } from 'vitest';
import abcjs from 'abcjs';
import { buildHarmonyAnalysisPreview } from './analysis-preview';
import { buildMetricTimeline } from './metric-timeline';
import { buildGuitarChordScore, realizeGuitarChordAudio, type GuitarParsedTune } from '../guitar-chord-score';

const source = 'X:1\nM:4/4\nL:1/4\nK:C\n"G"G4 | z C2 E |';
const chords = (abc: string) => buildMetricTimeline(abc).map(m => m.events.flatMap(e => e.chords));
describe('automatic Harmony layers', () => {
  it('independently adds real chords and beat annotations, reverting from immutable source', () => {
    const on = buildHarmonyAnalysisPreview(source, { StrongBeats: true, MissingChord: true });
    expect(on).toContain('w: ⬤ • •');
    expect(on).not.toContain('● 3');
    expect(on).not.toContain('Missing chord');
    expect(chords(on)).toEqual([['G'], ['C']]);
    const melody = (abc: string) => buildMetricTimeline(abc).map(m => m.events.map(e => [e.onset, e.duration, e.pitches]));
    expect(melody(on)).toEqual(melody(source));
    expect(buildHarmonyAnalysisPreview(source, { MissingChord: true })).not.toMatch(/[⬤●•]/);
    expect(chords(buildHarmonyAnalysisPreview(source, { StrongBeats: true }))).toEqual([['G'], []]);
    expect(chords(buildHarmonyAnalysisPreview(source, {}))).toEqual([['G'], []]);
    expect(buildHarmonyAnalysisPreview(source, { StrongBeats: true, MissingChord: true })).toBe(on);
  });
  it('can show generated harmony while existing ChordProgression is hidden', () => {
    expect(chords(buildHarmonyAnalysisPreview(source, { ChordProgression: false, MissingChord: true }))).toEqual([[], ['C']]);
  });
  it('feeds generated chord windows into the actual guitar playback projection', () => {
    const audio = (enabled: boolean) => {
      const abc = buildHarmonyAnalysisPreview(source, { MissingChord: enabled });
      const score = buildGuitarChordScore(abc, source, []);
      const tune = abcjs.parseOnly(abc)[0] as unknown as GuitarParsedTune;
      return realizeGuitarChordAudio(tune.setUpAudio({ chordsOff: true }), score, {}).tracks.at(-1);
    };
    const off = audio(false);
    const on = audio(true);
    expect(on).not.toEqual(off);
    expect(audio(false)).toEqual(off);
  });
});
