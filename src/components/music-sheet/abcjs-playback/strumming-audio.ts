import { extractAbcVoiceIds } from '@/lib/theory/abc-layer-visibility';
import type { GuitarAudioEvent, GuitarAudioSequence } from '@/lib/theory/guitar-chord-score';
import type { VisualObj } from './types';

interface Element {
  pitches?: { name: string }[];
  strummingPitchOrder?: string[];
  startChar?: number;
  decoration?: string[];
  chord?: { name: string; position: string }[];
}
interface StrummingVisual {
  lines?: { staff?: { voices?: Element[][] }[] }[];
}

/** Project written gestures after timbre normalization and before sample loading.
 * Source offsets identify each gesture; playback start also keys repetitions.
 * The ABC note order is physical string order, not pitch rank.
 */
export function realizeStrummingAudio(audio: GuitarAudioSequence, visual: VisualObj, abc: string, playbackRate = 1): GuitarAudioSequence {
  const voiceIds = extractAbcVoiceIds(abc);
  const voiceIndex = voiceIds.indexOf('GuitarStrumming');
  if (voiceIndex < 0 || !audio.tracks[voiceIndex]) return audio;
  // abcjs dynamics override MIDI beat volumes. Restore the preview mixer gain
  // after realization so a muted Strumming layer cannot leak percussion.
  let currentVoice = '';
  const gains = new Map<string, number>();
  for (const line of abc.split('\n')) {
    const voice = line.match(/^(?:V:|\[V:)([^\s\]]+)/);
    if (voice) currentVoice = voice[1];
    const beat = line.match(/^%%MIDI beat (\d+) \1 \1 1\s*$/);
    if (beat) gains.set(currentVoice, Math.min(127, Number(beat[1])) / 127);
  }
  const volumeScale = gains.get('GuitarStrumming') ?? 1;
  const elements = new Map<number, Element>();
  for (const line of (visual as unknown as StrummingVisual).lines ?? []) {
    for (const staff of line.staff ?? []) for (const voice of staff.voices ?? []) {
      for (const element of voice) if (element.startChar !== undefined) elements.set(element.startChar, element);
    }
  }
  // Sequence time is whole-note units; qpm has already been applied by setUpAudio.
  const secondsPerWhole = playbackRate * 240 / (typeof audio.tempo === 'number' && audio.tempo > 0 ? audio.tempo : 120);
  const groups = new Map<string, GuitarAudioEvent[]>();
  const keyOf = (event: GuitarAudioEvent) => `${event.startChar}:${event.start}`;
  const track = audio.tracks[voiceIndex];
  for (const event of track) {
    if (event.cmd !== 'note' || event.start === undefined || event.duration === undefined) continue;
    const key = keyOf(event);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const emitted = new Set<string>();
  const realized = track.flatMap(event => {
    if (event.cmd !== 'note' || event.start === undefined || event.duration === undefined) return [{ ...event }];
    const key = keyOf(event);
    if (emitted.has(key)) return [];
    emitted.add(key);
    const group = groups.get(key)!;
    const element = elements.get(event.startChar as number);
    const marks = element?.chord?.filter(chord => chord.position !== 'default').flatMap(chord => chord.name.split(/\s+/)) ?? [];
    const up = marks.includes('↑') || (element?.decoration?.includes('upbow') ?? false);
    const palmMute = marks.includes('PM');
    const dead = marks.includes('Dead'), slap = marks.includes('X') || marks.includes('Slap');
    if (dead || slap) {
      // GM side-stick / hand-clap are deliberate preview approximations of
      // dead strings / string slap, not recorded acoustic-guitar techniques.
      return [{ ...event, pitch: slap ? 39 : 37, instrument: 128,
        duration: Math.min(event.duration, (slap ? 0.075 : 0.045) / secondsPerWhole),
        volume: Math.round((event.volume ?? 75) * volumeScale * (slap ? 0.9 : 0.6)), gap: 0 }];
    }
    const available = group.map((note, index) => ({ note, name: element?.pitches?.[index]?.name }));
    const ordered = element?.strummingPitchOrder?.map(name => {
      const index = available.findIndex(item => item.name === name);
      return index >= 0 ? available.splice(index, 1)[0].note : undefined;
    });
    const stroke = ordered?.length === group.length && ordered.every(note => note !== undefined) ? ordered : group;
    const sweep = Math.min((up ? 0.026 : 0.042) / secondsPerWhole, event.duration * 0.22);
    const end = event.start + event.duration;
    return stroke.map((note, index) => {
      const delay = group.length > 1 ? sweep * index / (group.length - 1) : 0;
      const start = event.start! + delay;
      const duration = Math.min(end - start, palmMute ? 0.095 / secondsPerWhole : Infinity);
      return { ...note, start, duration, instrument: 25, gap: 0,
        strumDirection: up ? "up" : "down", strumOrder: index + 1, strumStart: event.start,
        volume: Math.round((note.volume ?? 75) * volumeScale * (up ? 0.78 : 1) * (palmMute ? 0.65 : 1) * (1 - index * 0.025)) };
    });
  });
  return { ...audio, tracks: audio.tracks.map((track, index) => index === voiceIndex ? realized : track.map(event => event.cmd === 'note' ? { ...event, volume: Math.round((event.volume ?? 75) * (gains.get(voiceIds[index]) ?? 1)) } : { ...event })) };
}
