import abcjs from 'abcjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareSteelGuitarAudio } from '../guitar-audio';
import { PlaybackTrace, playbackTraceEvents } from '../playback-trace';
import type { VisualObj } from '../types';
import type { GuitarAudioSequence } from '@/lib/theory/guitar-chord-score';

const abc = 'X:1\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nV:GuitarStrumming\n%%MIDI program 25\n"^↓"[C,EG]2 "^↑"[GEC,]2 |';
function sequence(rate: number) {
  const visual = abcjs.parseOnly(abc)[0] as unknown as VisualObj;
  const projected = prepareSteelGuitarAudio(visual, abc, rate);
  return (projected.setUpAudio as (options: object) => GuitarAudioSequence)({ qpm: 120 * rate, chordsOff: true });
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe('slow playback diagnostics', () => {
  it('scales both gesture spacing and stroke timing without changing pitch or direction', () => {
    const normal = playbackTraceEvents(sequence(1));
    const slow = playbackTraceEvents(sequence(0.1));
    expect(slow.map(e => e.midi)).toEqual([48, 64, 67, 67, 64, 48]);
    expect(slow.map(e => e.direction)).toEqual(['down', 'down', 'down', 'up', 'up', 'up']);
    expect(slow.map(e => e.order)).toEqual([1, 2, 3, 1, 2, 3]);
    slow.forEach((event, index) => {
      expect(event.atSeconds).toBeCloseTo(normal[index].atSeconds * 10);
      expect(event.durationSeconds).toBeCloseTo(normal[index].durationSeconds * 10);
      expect(event.instrument).toBe('acoustic_guitar_steel');
      expect(event.program).toBe(25);
    });
    expect(slow[2].atSeconds - slow[0].atSeconds).toBeCloseTo(0.42);
    expect(slow[5].atSeconds - slow[3].atSeconds).toBeCloseTo(0.26);
  });
  it('logs attacks in playback order, stops on pause, and skips past attacks on resume', () => {
    vi.useFakeTimers();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const trace = new PlaybackTrace();
    trace.events = playbackTraceEvents(sequence(0.1));
    const now = () => Date.now() / 1000;
    trace.start(0, now, 'test');
    vi.advanceTimersByTime(450);
    expect(log.mock.calls.filter(call => call[0].endsWith(' note')).map(call => call[1].midi)).toEqual([48, 64, 67]);
    trace.stop();
    const count = log.mock.calls.length;
    vi.advanceTimersByTime(12000);
    expect(log).toHaveBeenCalledTimes(count);
    trace.start(10, now, 'test');
    vi.advanceTimersByTime(300);
    expect(log.mock.calls.filter(call => call[0].endsWith(' note')).slice(-3).map(call => call[1].midi)).toEqual([67, 64, 48]);
    trace.stop();
  });
});
