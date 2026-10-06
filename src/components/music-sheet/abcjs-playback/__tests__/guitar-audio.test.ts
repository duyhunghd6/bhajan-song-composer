import abcjs from "abcjs";
import { describe, expect, it } from "vitest";
import { prepareSteelGuitarAudio } from "../guitar-audio";
import type { VisualObj } from "../types";
import type { GuitarAudioSequence } from "@/lib/theory/guitar-chord-score";

function prepare(abc: string, options: Record<string, unknown> = {}) {
  const tune = abcjs.parseOnly(abc)[0] as unknown as VisualObj;
  const projected = prepareSteelGuitarAudio(tune, abc);
  return (projected.setUpAudio as (options: Record<string, unknown>) => GuitarAudioSequence)(options);
}
const header = 'X:1\nM:4/4\nL:1/4\nK:C\n';
const notes = (audio: GuitarAudioSequence, index: number) => audio.tracks[index].filter((event) => event.cmd === "note");

describe("shared staff guitar playback", () => {
  it("plays automatic chord and bass accompaniment with steel strings, preserving the melody", () => {
    const audio = prepare(header + '"C" C4 |');
    expect(audio.tracks).toHaveLength(2);
    expect(notes(audio, 0).map((event) => event.instrument)).toEqual([0]);
    expect(notes(audio, 1).length).toBeGreaterThan(0);
    expect(new Set(notes(audio, 1).map((event) => event.instrument))).toEqual(new Set([25]));
    expect(prepare(header + '"C" C4 |', { chordsOff: true }).tracks).toHaveLength(1);
  });

  it.each([undefined, 24, 25])("plays GuitarSupport without chord labels using steel strings (program %s)", (program) => {
    const source = header + 'V:Melody\n%%MIDI program 52\nE4 |\nV:GuitarSupport\n'
      + (program === undefined ? '' : `%%MIDI program ${program}\n`) + '[C,EG]2 z2 |';
    const audio = prepare(source, { chordsOff: true });
    expect(notes(audio, 0).map((event) => event.instrument)).toEqual([52]);
    expect(notes(audio, 1).map((event) => event.instrument)).toEqual([25, 25, 25]);
    expect(notes(audio, 1).map((event) => [event.start, event.duration])).toEqual([[0, 0.5], [0, 0.5], [0, 0.5]]);
  });

  it("converts legacy unnamed nylon voices and retains other instruments", () => {
    const audio = prepare(header + '%%MIDI program 24\n[CEG]4 |', { chordsOff: true });
    expect(notes(audio, 0).map((event) => event.instrument)).toEqual([25, 25, 25]);
    for (const program of [0, 20, 40, 73]) {
      expect(notes(prepare(header + `%%MIDI program ${program}\nC4 |`), 0)[0].instrument).toBe(program);
    }
  });
});
