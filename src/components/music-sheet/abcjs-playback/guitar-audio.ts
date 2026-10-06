import { realizeStrummingAudio } from "./strumming-audio";
import { extractAbcVoiceIds } from "@/lib/theory/abc-layer-visibility";
import { ACOUSTIC_STEEL_GUITAR_PROGRAM } from "@/lib/theory/guitar-sound";
import type { GuitarAudioSequence } from "@/lib/theory/guitar-chord-score";
import type { VisualObj } from "./types";

/** Apply playback timbre before sample loading, including legacy nylon ABC. */
export function prepareSteelGuitarAudio(visual: VisualObj, abc: string, playbackRate = 1, onAudio?: (audio: GuitarAudioSequence) => void): VisualObj {
  if (typeof visual.setUpAudio !== "function") return visual;
  const setUpAudio = visual.setUpAudio as (options: Record<string, unknown>) => GuitarAudioSequence;
  const guitarIndices = new Set(extractAbcVoiceIds(abc).flatMap((voice, index) => /^Guitar/i.test(voice) ? [index] : []));
  const projected = Object.create(visual) as VisualObj;
  projected.setUpAudio = (options: Record<string, unknown> = {}) => {
    const audio = setUpAudio.call(visual, {
      chordprog: ACOUSTIC_STEEL_GUITAR_PROGRAM,
      bassprog: ACOUSTIC_STEEL_GUITAR_PROGRAM,
      ...options,
    });
    const normalized = {
      ...audio,
      tracks: audio.tracks.map((track, index) => track.map((event) =>
        (event.cmd === "note" || event.cmd === "program")
          && (guitarIndices.has(index) || event.instrument === 24)
          ? { ...event, instrument: ACOUSTIC_STEEL_GUITAR_PROGRAM }
          : { ...event })),
    };
    const result = realizeStrummingAudio(normalized, visual, abc, playbackRate);
    onAudio?.(result);
    return result;
  };
  return projected;
}
