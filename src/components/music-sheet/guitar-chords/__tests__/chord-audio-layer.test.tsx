import { renderToStaticMarkup } from 'react-dom/server';
import abcjs from 'abcjs';
import { expect, it, vi } from 'vitest';
import GuitarChordAccompaniment from '../GuitarChordAccompaniment';
import { generateStrummingCandidates } from '@/lib/theory/harmony/strumming';
import type { GuitarParsedTune } from '@/lib/theory/guitar-chord-score';
import type { VisualObj } from '../../abcjs-playback/types';

const captured = vi.hoisted(() => ({ prepare: undefined as undefined | ((visual: VisualObj) => VisualObj) }));
vi.mock('../../AbcjsPlaybackController', () => ({
  default: ({ prepareAudio }: { prepareAudio: (visual: VisualObj) => VisualObj }) => {
    captured.prepare = prepareAudio;
    return null;
  },
}));
const source = 'X:1\nM:4/4\nL:1/8\nK:C\n"C" C4 "G" G4 |';
const written = generateStrummingCandidates(source, 'folk')[0].abc;

it.each([false, true])('plays independently of hidden chord symbols (enabled=%s)', enabled => {
  const display = written.replace(/"C"|"G"/g, '');
  renderToStaticMarkup(<GuitarChordAccompaniment abcString={display} sourceAbc={source}
    chordAudioAbc={source} chordAudioEnabled={enabled} writtenAccompaniment chordVolume={35}
    overrides={[]} onOverridesChange={() => {}} />);
  const tune = abcjs.parseOnly(display)[0] as unknown as GuitarParsedTune;
  const options = { chordsOff: true, qpm: 84 };
  const base = tune.setUpAudio(options);
  const projected = captured.prepare!(tune as unknown as VisualObj) as unknown as GuitarParsedTune;
  const result = projected.setUpAudio(options);
  expect(result.tracks.slice(0, base.tracks.length)).toEqual(base.tracks);
  expect(result.tracks.length).toBe(base.tracks.length + (enabled ? 1 : 0));
  if (enabled) {
    const notes = result.tracks.at(-1)!.filter(event => event.cmd === 'note');
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every(event => event.instrument === 25 && event.volume === 75 * 0.35)).toBe(true);
  }
});
