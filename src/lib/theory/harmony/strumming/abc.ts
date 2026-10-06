import abcjs from 'abcjs';
import { getKeyAccidentalsFromAbc } from '../../abc-key-signature';
import { parseDefaultNoteLength } from '../../abc-duration';
import { primaryVoiceElements, type GuitarParsedTune } from '../../guitar-chord-score';
import type { HarmonyTimeGrid } from '../time-grid';
import type { StrummingEvent } from './index';

const BARS: Record<string, string> = { bar_thin: '|', bar_thin_thin: '||', bar_thin_thick: '|]', bar_thick_thin: '[|', bar_left_repeat: '|:', bar_right_repeat: ':|', bar_dbl_repeat: ':|:', bar_invisible: '[|]' };
function length(value: number): string {
  let numerator = Math.round(value * 2580480);
  let denominator = 2580480;
  let a = numerator, b = denominator;
  while (b) [a, b] = [b, a % b];
  numerator /= a || 1; denominator /= a || 1;
  return denominator === 1 ? (numerator === 1 ? '' : String(numerator)) : `${numerator}/${denominator}`;
}
function pitch(midi: number, explicitLetters: Set<string>): string {
  const names = ['=C', '^C', '=D', '^D', '=E', '=F', '^F', '=G', '^G', '=A', '^A', '=B'];
  const octave = Math.floor(midi / 12) - 1;
  const name = names[midi % 12];
  return (explicitLetters.has(name[1]) ? name : name.slice(1)) + (octave < 4 ? ','.repeat(4 - octave) : "'".repeat(octave - 4));
}

/** Render the exact event timeline, retaining source bars, pickups, endings and staff systems. */
export function renderStrummingAbc(grid: HarmonyTimeGrid, events: StrummingEvent[]): string {
  const source = grid.sourceAbc;
  const unit = parseDefaultNoteLength(source);
  const tune = abcjs.parseOnly(source)[0] as unknown as GuitarParsedTune;
  const bars = new Map<number, string>();
  let index = -1, hasNotes = false;
  for (const element of primaryVoiceElements(tune)) {
    if (element.el_type === 'note') {
      if (!hasNotes) { index++; hasNotes = true; }
    } else if (element.el_type === 'bar') {
      const bar = (BARS[element.type ?? ''] ?? '|') + (element.startEnding ? `[${element.startEnding}` : '');
      bars.set(index, (bars.get(index) ?? '') + bar);
      hasNotes = false;
    }
  }
  const keyAccidentals = getKeyAccidentalsFromAbc(source);
  const music = grid.timeline.map(measure => {
    const measureEvents = events.filter(e => e.measureIndex === measure.measureIndex);
    // If a letter changes accidental anywhere in a bar, spell every occurrence
    // explicitly so simultaneous octaves and later naturals remain unambiguous.
    const explicitLetters = new Set<string>();
    const pitchNames = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
    for (const note of measureEvents.flatMap(event => event.notes)) {
      const letter = pitchNames[note.midi % 12];
      const accidental = [1, 3, 6, 8, 10].includes(note.midi % 12) ? '^' : undefined;
      if (keyAccidentals.get(letter) !== accidental) explicitLetters.add(letter);
    }
    const tokens: string[] = [];
    let cursor = 0;
    for (const event of measureEvents) {
      if (event.onset > cursor + 1e-7) tokens.push(`z${length((event.onset - cursor) / unit)}`);
      const duration = length(event.duration / unit);
      const notes = event.notes.map(note => `!${note.string}!${pitch(note.midi, explicitLetters)}`).join('');
      const dynamics = event.velocity < 60 ? '!p!' : event.velocity > 85 ? '!f!' : '!mf!';
      const stroke = event.direction === 'up' ? '!upbow!' : '!downbow!';
      const dynamic = event === events[0] ? dynamics : '';
      if (event.technique === 'rest' || event.technique === 'choke') {
        tokens.push(`${event.technique === 'choke' ? '"^Choke"' : ''}z${duration}`);
      } else if (event.technique === 'dead-strum' || event.technique === 'slap') {
        // An x-head is a rhythmic placeholder, never a harmonic chord note.
        // The playback adapter replaces it with a short non-pitched hit.
        tokens.push(`"^${event.technique === 'slap' ? 'Slap' : 'X'}"${dynamic}!style=x!${stroke}B${duration}`);
      } else {
        tokens.push(`${event.technique === 'palm-mute' ? '"^PM"' : ''}${dynamic}${stroke}[${notes}]${duration}`);
      }
      cursor = event.onset + event.duration;
    }
    if (cursor < measure.duration - 1e-7) tokens.push(`z${length((measure.duration - cursor) / unit)}`);
    return tokens.join(' ') + ' ' + (bars.get(measure.measureIndex) ?? '|');
  });
  const byLine = new Map<number, string[]>();
  grid.measures.forEach((measure, index) => {
    byLine.set(measure.lineIndex!, [...(byLine.get(measure.lineIndex!) ?? []), music[index]]);
  });
  const lines = source.split('\n');
  const keyIndex = lines.findIndex(line => /^K:/.test(line));
  const output = lines.slice(0, keyIndex).filter(line => !/^(V:|%%score|%%MIDI)/.test(line));
  output.push('%%score (Melody) (GuitarStrumming)', 'V:Melody name="Melody"', 'V:GuitarStrumming clef=treble-8 name="Strumming"', lines[keyIndex]);
  output.push('[V:Melody]', '%%MIDI program 52', '[V:GuitarStrumming]', '%%MIDI program 25');
  let firstSystem = true;
  for (let line = keyIndex + 1; line < lines.length; line++) {
    const accompaniment = byLine.get(line);
    if (accompaniment) {
      output.push(`[V:Melody] ${lines[line].replace(/\[V:[^\]]+\]/g, '')}`);
      while (line + 1 < lines.length && /^\s*w:/.test(lines[line + 1])) output.push(lines[++line]);
      output.push(`[V:GuitarStrumming] ${firstSystem ? bars.get(-1) ?? '' : ''} ${accompaniment.join(' ')}`);
      firstSystem = false;
    } else if (lines[line].trim() && !/^(V:|%%score|%%MIDI)/.test(lines[line]) && !/^\s*\[V:[^\]]+\]\s*$/.test(lines[line])) {
      output.push(lines[line]);
    }
  }
  return output.join('\n');
}
