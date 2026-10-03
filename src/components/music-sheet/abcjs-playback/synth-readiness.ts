/**
 * abcjs exposes an audio buffer only after `prime()` has produced playable
 * events. Calling `start()` or seeking a synth without one makes abcjs access
 * `directSource[0]`, which throws when a rendered score has no audible notes.
 */
export function isSynthReadyForPlayback(synth: {
  getAudioBuffer?: () => unknown;
} | null | undefined): boolean {
  try {
    return Boolean(synth?.getAudioBuffer?.());
  } catch {
    return false;
  }
}
