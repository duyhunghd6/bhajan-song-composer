import type { GuitarAudioSequence } from "@/lib/theory/guitar-chord-score";

export function playbackTraceEvents(audio: GuitarAudioSequence) {
  const secondsPerWhole = 240 / Number(audio.tempo ?? 120);
  return audio.tracks.flatMap((track, trackIndex) => track.filter(event => event.cmd === "note" && (event.volume ?? 0) > 0).map(event => {
    const midi = Number(event.pitch);
    return {
      track: trackIndex, atSeconds: Number(event.start) * secondsPerWhole,
      durationSeconds: Number(event.duration) * secondsPerWhole,
      midi, note: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][midi % 12] + (Math.floor(midi / 12) - 1),
      program: event.instrument,
      instrument: event.instrument === 25 ? "acoustic_guitar_steel" : event.instrument === 128 ? "percussion" : `GM ${event.instrument}`,
      direction: event.strumDirection ?? "none", order: event.strumOrder ?? null,
      stroke: event.strumStart ?? null, sourceOffset: event.startChar ?? null,
    };
  })).sort((a, b) => a.atSeconds - b.atSeconds || a.track - b.track);
}

/** Trace scheduled attacks from the final synth sequence; this is not a microphone measurement. */
export class PlaybackTrace {
  events: ReturnType<typeof playbackTraceEvents> = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  stop() { clearInterval(this.timer); this.timer = undefined; }
  start(fromSeconds: number, now: () => number, player: string) {
    this.stop();
    const origin = now();
    let index = this.events.findIndex(event => event.atSeconds >= fromSeconds - 1e-7);
    if (index < 0) return;
    console.log("[StaffPlayback 0.1x]", { player, status: "scheduled-note trace", fromSeconds });
    const tick = () => {
      const position = fromSeconds + now() - origin;
      while (index < this.events.length && this.events[index].atSeconds <= position + 0.001) {
        console.log("[StaffPlayback 0.1x] note", { player, ...this.events[index++] });
      }
      if (index === this.events.length) this.stop();
    };
    this.timer = setInterval(tick, 10);
    tick();
  }
}
